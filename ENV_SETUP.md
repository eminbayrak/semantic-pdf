# Environment Setup Guide

This guide will help you configure the necessary environment variables for the PDF to Video Presentation System.

## Required Environment Variables

### 1. Azure Document Intelligence

You need an Azure Cognitive Services resource with Document Intelligence enabled.

1. Go to [Azure Portal](https://portal.azure.com)
2. Create a new "Cognitive Services" resource
3. Select "Form Recognizer" as the service type
4. After creation, go to "Keys and Endpoint"
5. Copy the endpoint URL and one of the keys

Add to your `.env` file:
```env
REACT_APP_AZURE_ENDPOINT=https://your-resource-name.cognitiveservices.azure.com/
REACT_APP_AZURE_KEY=your_azure_key_here
```

### 2. OpenAI API

You need an OpenAI API key for GPT-4o integration.

1. Go to [OpenAI Platform](https://platform.openai.com)
2. Sign up or log in
3. Go to "API Keys" section
4. Create a new API key

Add to your `.env` file:
```env
REACT_APP_OPENAI_API_KEY=your_openai_api_key_here
```

### 3. Azure Text-to-Speech (Optional)

For real audio generation, you need Azure Cognitive Services Speech.

1. Go to [Azure Portal](https://portal.azure.com)
2. Create a new "Cognitive Services" resource
3. Select "Speech Services" as the service type
4. After creation, go to "Keys and Endpoint"
5. Copy the key and region

Add to your `.env` file:
```env
REACT_APP_TTS_API_KEY=your_tts_key_here
REACT_APP_TTS_REGION=your_tts_region_here
```

## Complete .env File Example

Create a `.env` file in your project root with the following content:

```env
# Azure Document Intelligence (Required)
REACT_APP_AZURE_ENDPOINT=https://your-resource-name.cognitiveservices.azure.com/
REACT_APP_AZURE_KEY=your_azure_key_here

# OpenAI API (Required)
REACT_APP_OPENAI_API_KEY=your_openai_api_key_here

# Azure Text-to-Speech (Optional - system will use mock TTS if not provided)
REACT_APP_TTS_API_KEY=your_tts_key_here
REACT_APP_TTS_REGION=your_tts_region_here
```

## Testing Your Configuration

1. Start the development server:
   ```bash
   npm run dev
   ```

2. The application will automatically check your credentials on startup
3. If credentials are valid, you'll be taken to the upload step
4. If not, you'll see the credentials validation screen

## Troubleshooting

### Common Issues

1. **"Azure credentials not configured"**
   - Check that your `.env` file exists in the project root
   - Verify the variable names are correct (including `REACT_APP_` prefix)
   - Restart the development server after adding environment variables

2. **"Invalid Azure endpoint"**
   - Ensure the endpoint URL ends with `/`
   - Check that it's a valid Azure Cognitive Services endpoint
   - Verify the resource is active and not deleted

3. **"OpenAI API key invalid"**
   - Check that your API key is correct
   - Ensure you have sufficient credits in your OpenAI account
   - Verify the key has the necessary permissions

4. **CORS errors**
   - This is normal for browser-based Azure API calls
   - The application includes proper CORS handling
   - If issues persist, check your Azure resource CORS settings

### Testing Without Real Credentials

If you want to test the system without setting up real credentials:

1. Use the "Try Demo" option on the upload page
2. This will process a mock medical insurance document
3. You can test the full workflow without Azure/OpenAI calls

## Security Notes

- Never commit your `.env` file to version control
- The `.env` file is already in `.gitignore`
- Use different keys for development and production
- Rotate your API keys regularly
- Monitor your API usage to avoid unexpected charges

## Cost Considerations

### Azure Document Intelligence
- Pay per page analyzed
- Free tier: 500 pages per month
- Standard pricing: ~$1.50 per 1,000 pages

### OpenAI API
- Pay per token used
- GPT-4o pricing: ~$0.03 per 1K input tokens, ~$0.06 per 1K output tokens
- Typical cost per document: $0.10-$0.50

### Azure Text-to-Speech
- Pay per character processed
- Free tier: 500,000 characters per month
- Standard pricing: ~$4 per 1M characters

## Support

If you encounter issues:

1. Check the browser console for detailed error messages
2. Verify your credentials using the built-in validator
3. Test with the demo option first
4. Check the Azure and OpenAI service status pages
5. Review the application logs for specific error details
