import React from 'react';
import { getEnvironmentStatus } from '../../utils/envChecker';

/**
 * Environment Test Component
 * Displays environment variable status for debugging
 */
const EnvironmentTest = () => {
  const envStatus = getEnvironmentStatus();
  
  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: envStatus.status === 'success' ? '#4caf50' : '#f44336',
      color: 'white',
      padding: '10px',
      borderRadius: '5px',
      fontSize: '12px',
      zIndex: 9999,
      maxWidth: '300px'
    }}>
      <strong>Environment Status:</strong><br/>
      {envStatus.status === 'success' ? '✅ All variables loaded' : '❌ Missing variables'}<br/>
      {envStatus.status === 'error' && (
        <div style={{ marginTop: '5px' }}>
          <strong>Missing:</strong><br/>
          {envStatus.details.missing.map(varName => (
            <div key={varName}>• {varName}</div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EnvironmentTest;
