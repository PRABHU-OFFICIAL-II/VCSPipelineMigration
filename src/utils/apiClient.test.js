import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { proxyFetch } from './apiClient';

describe('proxyFetch', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('passes non-http URLs through unmodified', async () => {
    fetch.mockResolvedValueOnce({ ok: true });
    await proxyFetch('/relative/path', { method: 'GET' });
    expect(fetch).toHaveBeenCalledWith('/relative/path', { method: 'GET' });
  });

  it('routes to Vercel proxy when hostname ends with vercel.app', async () => {
    vi.stubGlobal('window', {
      location: { hostname: 'vcs-pipeline-migration.vercel.app' },
    });
    fetch.mockResolvedValueOnce({ ok: true });
    await proxyFetch('https://dm-us.informaticacloud.com/ma/api/v2/user/login', {});
    const calledUrl = fetch.mock.calls[0][0];
    expect(calledUrl).toMatch(/^\/api\/proxy\?url=/);
  });

  it('routes to local proxy with x-proxy-host header on localhost', async () => {
    vi.stubGlobal('window', {
      location: { hostname: 'localhost' },
    });
    fetch.mockResolvedValueOnce({ ok: true });
    await proxyFetch('https://dm-us.informaticacloud.com/ma/api/v2/user/login', {});
    const calledUrl  = fetch.mock.calls[0][0];
    const calledOpts = fetch.mock.calls[0][1];
    const headers    = calledOpts.headers;
    expect(calledUrl).toMatch(/^\/api-proxy\//);
    expect(headers.get('x-proxy-host')).toBe('https://dm-us.informaticacloud.com');
  });
});
