# PDF to Video Presentation System

A React application that converts PDFs to HTML and generates professional video presentations with accurate zooming and highlighting using Remotion. The system integrates Azure Document Intelligence, GPT-4o, and Azure TTS.

## Features

- **PDF Processing**: Convert PDF documents to interactive HTML using Azure Document Intelligence
- **Semantic Mapping**: Automatically inject semantic IDs for precise element targeting
- **AI Narration Mapping**: Use GPT-4o to map narration text to specific HTML elements
- **Video Generation**: Create professional videos with Remotion featuring:
  - Smooth zoom and pan animations
  - Element highlighting (border, spotlight, pulse effects)
  - Audio synchronization
  - Frame-perfect timing

## Architecture

### Core Components

- **PDFConverter**: Handles PDF upload and Azure Document Intelligence processing
- **SemanticIDInjector**: Maps Azure results to meaningful HTML element IDs
- **GPTNarrationMapper**: Uses GPT-4o to create timeline mappings
- **TTSGenerator**: Generates synchronized audio (with mock implementation)
- **DocumentPresentation**: Main Remotion component for video rendering
- **HighlightOverlay**: Visual emphasis system for elements
- **CoordinateMapper**: Precise positioning and transformation utilities

### Technology Stack

- **React 19** with Vite
- **Remotion** for video generation
- **Azure Document Intelligence** for PDF analysis
- **OpenAI GPT-4o** for narration mapping
- **Tailwind CSS** for styling
- **TypeScript** for type safety

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd preper
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp env.example .env
```

Edit `.env` with your API keys:
```env
REACT_APP_AZURE_ENDPOINT=your_azure_endpoint_here
REACT_APP_AZURE_KEY=your_azure_key_here
REACT_APP_OPENAI_API_KEY=your_openai_api_key_here
REACT_APP_TTS_API_KEY=your_tts_api_key_here
REACT_APP_TTS_REGION=your_tts_region_here
```

## Usage

### Development

Start the development server:
```bash
npm run dev
```

Open Remotion Studio for video preview:
```bash
npm run studio
```

### Production

Build the application:
```bash
npm run build
```

Render videos:
```bash
npm run video
```

## API Configuration

### Azure Document Intelligence

1. Create an Azure Cognitive Services resource
2. Get your endpoint and API key
3. Add them to your `.env` file

### OpenAI API

1. Get an API key from OpenAI
2. Add it to your `.env` file

### Azure Text-to-Speech (Optional)

The application includes a mock TTS implementation. To use real Azure TTS:

1. Create an Azure Cognitive Services Speech resource
2. Add your API key and region to `.env`

## Project Structure

```
src/
├── components/
│   ├── PDFToHTML/
│   │   ├── PDFConverter.jsx
│   │   ├── HTMLGenerator.jsx
│   │   └── SemanticIDInjector.jsx
│   ├── Remotion/
│   │   ├── DocumentPresentation.jsx
│   │   ├── HighlightOverlay.jsx
│   │   └── VideoComposition.jsx
│   └── Services/
│       ├── AzureDocumentIntelligence.js
│       ├── GPTNarrationMapper.js
│       ├── TTSGenerator.js
│       └── CoordinateMapper.js
├── utils/
│   ├── htmlTemplates.js
│   ├── animationHelpers.js
│   └── constants.js
├── App.jsx
├── Root.jsx
└── remotion.config.js
```

## Workflow

1. **Upload PDF**: User uploads a PDF document
2. **Azure Analysis**: Document is processed with Azure Document Intelligence
3. **HTML Generation**: Structured HTML is generated with semantic IDs
4. **Narration Mapping**: GPT-4o maps narration text to HTML elements
5. **Audio Generation**: TTS creates synchronized audio
6. **Video Rendering**: Remotion generates the final video

## Element ID Patterns

The system automatically generates semantic IDs:

- `header-section`: Document headers and titles
- `member-info`: Member/patient information
- `claims-table`: Claims and billing data
- `summary-section`: Summary and totals
- `field-{name}`: Individual data fields
- `amount-{type}`: Financial amounts
- `table-row-{index}`: Table rows

## Customization

### Highlight Types

- `border`: Animated border around elements
- `spotlight`: Radial gradient spotlight effect
- `pulse`: Pulsing animation

### Zoom Levels

- Minimum: 1.0x
- Default: 1.5x
- Maximum: 3.0x

### Animation Timing

- Default transition: 0.5 seconds
- Fade duration: 0.3 seconds
- Pulse duration: 2.0 seconds

## Troubleshooting

### Common Issues

1. **Azure API Errors**: Check your endpoint and API key
2. **OpenAI Errors**: Verify your API key and quota
3. **Rendering Issues**: Ensure all required data is available
4. **Memory Issues**: Reduce video resolution or duration

### Debug Mode

Enable debug mode by setting `NODE_ENV=development` to see:
- Viewport state information
- Element bounds
- Animation timing
- Coordinate transformations

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review the API documentation
3. Create an issue in the repository