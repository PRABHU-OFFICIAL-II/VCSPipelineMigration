import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '100vh', padding: '40px',
          fontFamily: 'Segoe UI, sans-serif',
        }}>
          <div style={{
            background: '#fff', border: '1px solid #f5c6cb', borderRadius: '8px',
            padding: '40px', maxWidth: '500px', textAlign: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>&#9888;</div>
            <h2 style={{ color: '#dc3545', margin: '0 0 12px' }}>Something went wrong</h2>
            <p style={{ color: '#6c757d', marginBottom: '24px' }}>
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              style={{
                background: '#007bff', color: '#fff', border: 'none',
                padding: '10px 24px', borderRadius: '6px', cursor: 'pointer',
                fontSize: '14px', fontWeight: '600',
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
