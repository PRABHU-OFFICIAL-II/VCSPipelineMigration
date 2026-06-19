import React from 'react';

const TYPE_COLORS = {
  PROJECT:                  { bg: '#e0e0e0', text: '#424242' },
  FOLDER:                   { bg: '#fff3e0', text: '#e65100' },
  DTEMPLATE:                { bg: '#ede7f6', text: '#4527a0' },
  MAPPING:                  { bg: '#e3f2fd', text: '#0d47a1' },
  MTT:                      { bg: '#e0f2f1', text: '#004d40' },
  DSS:                      { bg: '#e1f5fe', text: '#01579b' },
  DMASK:                    { bg: '#fce4ec', text: '#880e4f' },
  DRS:                      { bg: '#e8f5e9', text: '#1b5e20' },
  DMAPPLET:                 { bg: '#e8eaf6', text: '#1a237e' },
  MAPPLET:                  { bg: '#f3e5f5', text: '#4a148c' },
  BSERVICE:                 { bg: '#f9fbe7', text: '#33691e' },
  HSCHEMA:                  { bg: '#fce4ec', text: '#c62828' },
  PCS:                      { bg: '#e0f7fa', text: '#006064' },
  FWCONFIG:                 { bg: '#eceff1', text: '#37474f' },
  CUSTOMSOURCE:             { bg: '#fff8e1', text: '#ff6f00' },
  MI_TASK:                  { bg: '#fff3e0', text: '#bf360c' },
  WORKFLOW:                 { bg: '#e8eaf6', text: '#283593' },
  TASKFLOW:                 { bg: '#f1f8e9', text: '#558b2f' },
  UDF:                      { bg: '#f9fbe7', text: '#827717' },
  MCT:                      { bg: '#e1f5fe', text: '#006064' },
  SAAS_CONNECTION:          { bg: '#fff3e0', text: '#e65100' },
  SAAS_RUNTIME_ENVIRONMENT: { bg: '#fbe9e7', text: '#bf360c' },
};

const DEFAULT_COLOR = { bg: '#f5f5f5', text: '#616161' };

function AssetTypeBadge({ type }) {
  const key = (type || '').toUpperCase();
  const colors = TYPE_COLORS[key] || DEFAULT_COLOR;

  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '12px',
      fontSize: '0.73em',
      fontWeight: '600',
      backgroundColor: colors.bg,
      color: colors.text,
      whiteSpace: 'nowrap',
      letterSpacing: '0.3px',
    }}>
      {type}
    </span>
  );
}

export default AssetTypeBadge;
