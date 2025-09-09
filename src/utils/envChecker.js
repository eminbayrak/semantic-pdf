/**
 * Environment Variable Checker
 * Helps debug environment variable loading issues
 */

export const checkEnvironmentVariables = () => {
  const requiredVars = [
    'VITE_AZURE_OPENAI_ENDPOINT',
    'VITE_AZURE_OPENAI_API_KEY',
    'VITE_AZURE_OPENAI_DEPLOYMENT_NAME',
    'VITE_AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT',
    'VITE_AZURE_DOCUMENT_INTELLIGENCE_KEY'
  ];

  const results = {
    allPresent: true,
    missing: [],
    present: [],
    allEnv: {}
  };

  requiredVars.forEach(varName => {
    const value = import.meta.env[varName];
    results.allEnv[varName] = value ? 'Set' : 'Not set';
    
    if (value) {
      results.present.push(varName);
    } else {
      results.missing.push(varName);
      results.allPresent = false;
    }
  });

  console.log('Environment Check Results:', results);
  return results;
};

export const getEnvironmentStatus = () => {
  const check = checkEnvironmentVariables();
  
  if (check.allPresent) {
    return {
      status: 'success',
      message: 'All environment variables are configured',
      details: check
    };
  } else {
    return {
      status: 'error',
      message: `Missing environment variables: ${check.missing.join(', ')}`,
      details: check
    };
  }
};

export default {
  checkEnvironmentVariables,
  getEnvironmentStatus
};