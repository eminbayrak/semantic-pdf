import React, { useState, useEffect } from 'react';
import { AzureTestComponent } from './AzureTestComponent';

export const CredentialsValidator = ({ onValidationComplete }) => {
  const [credentials, setCredentials] = useState({
    azureEndpoint: '',
    azureKey: '',
    openaiKey: '',
    ttsKey: '',
    ttsRegion: ''
  });
  const [validationStatus, setValidationStatus] = useState({
    azure: 'pending',
    openai: 'pending',
    tts: 'pending'
  });
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    // Load credentials from environment variables
    setCredentials({
      azureEndpoint: process.env.REACT_APP_AZURE_ENDPOINT || '',
      azureKey: process.env.REACT_APP_AZURE_KEY || '',
      openaiKey: process.env.REACT_APP_OPENAI_API_KEY || '',
      ttsKey: process.env.REACT_APP_TTS_API_KEY || '',
      ttsRegion: process.env.REACT_APP_TTS_REGION || ''
    });
  }, []);

  const validateCredentials = async () => {
    setIsValidating(true);
    const status = { azure: 'pending', openai: 'pending', tts: 'pending' };

    try {
      // Validate Azure credentials
      if (credentials.azureEndpoint && credentials.azureKey) {
        try {
          const response = await fetch(`${credentials.azureEndpoint}/formrecognizer/info`, {
            headers: {
              'Ocp-Apim-Subscription-Key': credentials.azureKey
            }
          });
          status.azure = response.ok ? 'valid' : 'invalid';
        } catch (error) {
          status.azure = 'invalid';
        }
      } else {
        status.azure = 'missing';
      }

      // Validate OpenAI credentials
      if (credentials.openaiKey) {
        try {
          const response = await fetch('https://api.openai.com/v1/models', {
            headers: {
              'Authorization': `Bearer ${credentials.openaiKey}`
            }
          });
          status.openai = response.ok ? 'valid' : 'invalid';
        } catch (error) {
          status.openai = 'invalid';
        }
      } else {
        status.openai = 'missing';
      }

      // TTS is optional, so we just check if it's configured
      status.tts = credentials.ttsKey && credentials.ttsRegion ? 'valid' : 'optional';

    } catch (error) {
      console.error('Validation error:', error);
    }

    setValidationStatus(status);
    setIsValidating(false);
    onValidationComplete(status);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'valid':
        return <span className="text-green-600">✓</span>;
      case 'invalid':
        return <span className="text-red-600">✗</span>;
      case 'missing':
        return <span className="text-yellow-600">⚠</span>;
      case 'optional':
        return <span className="text-blue-600">ℹ</span>;
      default:
        return <span className="text-gray-400">○</span>;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'valid':
        return 'Valid';
      case 'invalid':
        return 'Invalid';
      case 'missing':
        return 'Missing';
      case 'optional':
        return 'Optional';
      default:
        return 'Pending';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'valid':
        return 'text-green-600';
      case 'invalid':
        return 'text-red-600';
      case 'missing':
        return 'text-yellow-600';
      case 'optional':
        return 'text-blue-600';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Credentials Validation</h2>
      
      <div className="space-y-4">
        {/* Azure Document Intelligence */}
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center space-x-3">
            {getStatusIcon(validationStatus.azure)}
            <div>
              <h3 className="font-medium text-gray-900">Azure Document Intelligence</h3>
              <p className="text-sm text-gray-500">
                {credentials.azureEndpoint ? 'Configured' : 'Not configured'}
              </p>
            </div>
          </div>
          <span className={`text-sm font-medium ${getStatusColor(validationStatus.azure)}`}>
            {getStatusText(validationStatus.azure)}
          </span>
        </div>

        {/* OpenAI API */}
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center space-x-3">
            {getStatusIcon(validationStatus.openai)}
            <div>
              <h3 className="font-medium text-gray-900">OpenAI API</h3>
              <p className="text-sm text-gray-500">
                {credentials.openaiKey ? 'Configured' : 'Not configured'}
              </p>
            </div>
          </div>
          <span className={`text-sm font-medium ${getStatusColor(validationStatus.openai)}`}>
            {getStatusText(validationStatus.openai)}
          </span>
        </div>

        {/* Azure TTS */}
        <div className="flex items-center justify-between p-3 border rounded-lg">
          <div className="flex items-center space-x-3">
            {getStatusIcon(validationStatus.tts)}
            <div>
              <h3 className="font-medium text-gray-900">Azure Text-to-Speech</h3>
              <p className="text-sm text-gray-500">
                {credentials.ttsKey && credentials.ttsRegion ? 'Configured' : 'Optional (using mock)'}
              </p>
            </div>
          </div>
          <span className={`text-sm font-medium ${getStatusColor(validationStatus.tts)}`}>
            {getStatusText(validationStatus.tts)}
          </span>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <div className="flex justify-center">
          <button
            onClick={validateCredentials}
            disabled={isValidating}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded"
          >
            {isValidating ? 'Validating...' : 'Validate Credentials'}
          </button>
        </div>
        
        {/* Azure Test Component */}
        <AzureTestComponent />
      </div>

      {/* Instructions */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="font-medium text-gray-900 mb-2">Setup Instructions:</h4>
        <ol className="text-sm text-gray-600 space-y-1">
          <li>1. Create a .env file in your project root</li>
          <li>2. Add your Azure Document Intelligence endpoint and key</li>
          <li>3. Add your OpenAI API key</li>
          <li>4. (Optional) Add Azure TTS credentials for real audio generation</li>
        </ol>
        <div className="mt-2 text-xs text-gray-500">
          <p>Example .env file:</p>
          <pre className="bg-gray-100 p-2 rounded mt-1">
{`REACT_APP_AZURE_ENDPOINT=https://your-resource.cognitiveservices.azure.com/
REACT_APP_AZURE_KEY=your_azure_key_here
REACT_APP_OPENAI_API_KEY=your_openai_key_here
REACT_APP_TTS_API_KEY=your_tts_key_here
REACT_APP_TTS_REGION=your_tts_region_here`}
          </pre>
        </div>
      </div>
    </div>
  );
};
