import React, { useState } from 'react';
import { HTMLGenerator } from '../PDFToHTML/HTMLGenerator';
import { SemanticIDInjector } from '../PDFToHTML/SemanticIDInjector';

export const DemoPDFProcessor = ({ onHTMLGenerated, onError }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  // Mock Azure Document Intelligence result
  const createMockAzureResult = () => {
    return {
      pages: [
        {
          pageNumber: 1,
          paragraphs: [
            {
              content: "Medical Insurance Statement",
              confidence: 0.99,
              boundingRegions: [{
                polygon: [
                  { x: 100, y: 50, z: 0 },
                  { x: 400, y: 50, z: 0 },
                  { x: 400, y: 80, z: 0 },
                  { x: 100, y: 80, z: 0 }
                ]
              }]
            },
            {
              content: "Member Information",
              confidence: 0.95,
              boundingRegions: [{
                polygon: [
                  { x: 100, y: 120, z: 0 },
                  { x: 300, y: 120, z: 0 },
                  { x: 300, y: 140, z: 0 },
                  { x: 100, y: 140, z: 0 }
                ]
              }]
            },
            {
              content: "John Doe",
              confidence: 0.98,
              boundingRegions: [{
                polygon: [
                  { x: 120, y: 160, z: 0 },
                  { x: 200, y: 160, z: 0 },
                  { x: 200, y: 180, z: 0 },
                  { x: 120, y: 180, z: 0 }
                ]
              }]
            },
            {
              content: "Policy Number: 123456789",
              confidence: 0.97,
              boundingRegions: [{
                polygon: [
                  { x: 120, y: 200, z: 0 },
                  { x: 350, y: 200, z: 0 },
                  { x: 350, y: 220, z: 0 },
                  { x: 120, y: 220, z: 0 }
                ]
              }]
            },
            {
              content: "Claims Summary",
              confidence: 0.96,
              boundingRegions: [{
                polygon: [
                  { x: 100, y: 280, z: 0 },
                  { x: 300, y: 280, z: 0 },
                  { x: 300, y: 300, z: 0 },
                  { x: 100, y: 300, z: 0 }
                ]
              }]
            }
          ]
        }
      ],
      tables: [
        {
          id: "claims-table",
          rowCount: 3,
          columnCount: 4,
          cells: [
            { content: "Date", rowIndex: 0, columnIndex: 0, confidence: 0.99, boundingRegions: [{ polygon: [{ x: 100, y: 320, z: 0 }, { x: 150, y: 320, z: 0 }, { x: 150, y: 340, z: 0 }, { x: 100, y: 340, z: 0 }] }] },
            { content: "Service", rowIndex: 0, columnIndex: 1, confidence: 0.99, boundingRegions: [{ polygon: [{ x: 150, y: 320, z: 0 }, { x: 250, y: 320, z: 0 }, { x: 250, y: 340, z: 0 }, { x: 150, y: 340, z: 0 }] }] },
            { content: "Amount", rowIndex: 0, columnIndex: 2, confidence: 0.99, boundingRegions: [{ polygon: [{ x: 250, y: 320, z: 0 }, { x: 350, y: 320, z: 0 }, { x: 350, y: 340, z: 0 }, { x: 250, y: 340, z: 0 }] }] },
            { content: "Status", rowIndex: 0, columnIndex: 3, confidence: 0.99, boundingRegions: [{ polygon: [{ x: 350, y: 320, z: 0 }, { x: 450, y: 320, z: 0 }, { x: 450, y: 340, z: 0 }, { x: 350, y: 340, z: 0 }] }] },
            { content: "2024-01-15", rowIndex: 1, columnIndex: 0, confidence: 0.98, boundingRegions: [{ polygon: [{ x: 100, y: 340, z: 0 }, { x: 150, y: 340, z: 0 }, { x: 150, y: 360, z: 0 }, { x: 100, y: 360, z: 0 }] }] },
            { content: "Office Visit", rowIndex: 1, columnIndex: 1, confidence: 0.98, boundingRegions: [{ polygon: [{ x: 150, y: 340, z: 0 }, { x: 250, y: 340, z: 0 }, { x: 250, y: 360, z: 0 }, { x: 150, y: 360, z: 0 }] }] },
            { content: "$150.00", rowIndex: 1, columnIndex: 2, confidence: 0.98, boundingRegions: [{ polygon: [{ x: 250, y: 340, z: 0 }, { x: 350, y: 340, z: 0 }, { x: 350, y: 360, z: 0 }, { x: 250, y: 360, z: 0 }] }] },
            { content: "Paid", rowIndex: 1, columnIndex: 3, confidence: 0.98, boundingRegions: [{ polygon: [{ x: 350, y: 340, z: 0 }, { x: 450, y: 340, z: 0 }, { x: 450, y: 360, z: 0 }, { x: 350, y: 360, z: 0 }] }] },
            { content: "2024-01-20", rowIndex: 2, columnIndex: 0, confidence: 0.98, boundingRegions: [{ polygon: [{ x: 100, y: 360, z: 0 }, { x: 150, y: 360, z: 0 }, { x: 150, y: 380, z: 0 }, { x: 100, y: 380, z: 0 }] }] },
            { content: "Lab Test", rowIndex: 2, columnIndex: 1, confidence: 0.98, boundingRegions: [{ polygon: [{ x: 150, y: 360, z: 0 }, { x: 250, y: 360, z: 0 }, { x: 250, y: 380, z: 0 }, { x: 150, y: 380, z: 0 }] }] },
            { content: "$75.00", rowIndex: 2, columnIndex: 2, confidence: 0.98, boundingRegions: [{ polygon: [{ x: 250, y: 360, z: 0 }, { x: 350, y: 360, z: 0 }, { x: 350, y: 380, z: 0 }, { x: 250, y: 380, z: 0 }] }] },
            { content: "Pending", rowIndex: 2, columnIndex: 3, confidence: 0.98, boundingRegions: [{ polygon: [{ x: 350, y: 360, z: 0 }, { x: 450, y: 360, z: 0 }, { x: 450, y: 380, z: 0 }, { x: 350, y: 380, z: 0 }] }] }
          ]
        }
      ],
      keyValuePairs: [
        {
          key: { content: "Total Amount", confidence: 0.99 },
          value: { content: "$225.00", confidence: 0.99 },
          confidence: 0.99,
          boundingRegions: [{ polygon: [{ x: 100, y: 420, z: 0 }, { x: 300, y: 420, z: 0 }, { x: 300, y: 440, z: 0 }, { x: 100, y: 440, z: 0 }] }]
        }
      ]
    };
  };

  const processDemoPDF = async () => {
    setIsProcessing(true);
    setProgress(0);

    try {
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      setProgress(30);

      // Create mock Azure result
      const mockResult = createMockAzureResult();
      setProgress(50);

      // Generate HTML from mock result
      const htmlGenerator = new HTMLGenerator();
      const htmlContent = await htmlGenerator.generateFromAzureResult(mockResult);
      setProgress(70);

      // Inject semantic IDs
      const semanticInjector = new SemanticIDInjector();
      const enhancedHTML = semanticInjector.injectSemanticIDs(htmlContent, mockResult);
      setProgress(90);

      // Complete processing
      setProgress(100);
      onHTMLGenerated(enhancedHTML);

    } catch (error) {
      console.error('Demo processing error:', error);
      onError(error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6">
      <div className="border-2 border-dashed border-green-300 rounded-lg p-8 text-center bg-green-50">
        <div className="space-y-4">
          <div className="mx-auto w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              Demo PDF Processing
            </h3>
            <p className="text-sm text-gray-500">
              Test the system with a sample medical insurance document
            </p>
          </div>

          <button
            onClick={processDemoPDF}
            disabled={isProcessing}
            className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white ${
              isProcessing 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-green-600 hover:bg-green-700 cursor-pointer'
            }`}
          >
            {isProcessing ? 'Processing Demo...' : 'Process Demo PDF'}
          </button>

          {isProcessing && (
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          )}

          <div className="text-xs text-gray-400">
            This will create a sample medical insurance document with member info, claims table, and summary
          </div>
        </div>
      </div>
    </div>
  );
};
