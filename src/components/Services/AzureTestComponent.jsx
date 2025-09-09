import React, { useState } from 'react';
import { AzureDocumentIntelligence } from './AzureDocumentIntelligence';

export const AzureTestComponent = () => {
  const [testResult, setTestResult] = useState(null);
  const [isTesting, setIsTesting] = useState(false);

  const testAzureConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const azureEndpoint = process.env.REACT_APP_AZURE_ENDPOINT;
      const azureKey = process.env.REACT_APP_AZURE_KEY;

      if (!azureEndpoint || !azureKey) {
        setTestResult({
          success: false,
          error: 'Azure credentials not configured'
        });
        return;
      }

      // Test Azure endpoint connectivity
      const response = await fetch(`${azureEndpoint}/formrecognizer/info`, {
        method: 'GET',
        headers: {
          'Ocp-Apim-Subscription-Key': azureKey,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setTestResult({
          success: true,
          message: 'Azure Document Intelligence connection successful',
          data: data
        });
      } else {
        setTestResult({
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`
        });
      }

    } catch (error) {
      setTestResult({
        success: false,
        error: error.message
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Azure Connection Test</h3>
      
      <div className="space-y-4">
        <div className="flex items-center space-x-4">
          <button
            onClick={testAzureConnection}
            disabled={isTesting}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded"
          >
            {isTesting ? 'Testing...' : 'Test Azure Connection'}
          </button>
          
          {testResult && (
            <div className={`flex items-center space-x-2 ${
              testResult.success ? 'text-green-600' : 'text-red-600'
            }`}>
              <span className="text-xl">
                {testResult.success ? '✓' : '✗'}
              </span>
              <span className="font-medium">
                {testResult.success ? 'Connected' : 'Failed'}
              </span>
            </div>
          )}
        </div>

        {testResult && (
          <div className={`p-4 rounded-lg ${
            testResult.success 
              ? 'bg-green-50 border border-green-200' 
              : 'bg-red-50 border border-red-200'
          }`}>
            <h4 className={`font-medium ${
              testResult.success ? 'text-green-800' : 'text-red-800'
            }`}>
              {testResult.success ? 'Success!' : 'Error'}
            </h4>
            <p className={`text-sm mt-1 ${
              testResult.success ? 'text-green-700' : 'text-red-700'
            }`}>
              {testResult.message || testResult.error}
            </p>
            
            {testResult.data && (
              <details className="mt-2">
                <summary className="text-sm text-green-600 cursor-pointer">
                  View Response Data
                </summary>
                <pre className="mt-2 text-xs bg-green-100 p-2 rounded overflow-auto">
                  {JSON.stringify(testResult.data, null, 2)}
                </pre>
              </details>
            )}
          </div>
        )}

        <div className="text-sm text-gray-600">
          <p><strong>Endpoint:</strong> {process.env.REACT_APP_AZURE_ENDPOINT || 'Not configured'}</p>
          <p><strong>Key:</strong> {process.env.REACT_APP_AZURE_KEY ? '***configured***' : 'Not configured'}</p>
        </div>
      </div>
    </div>
  );
};
