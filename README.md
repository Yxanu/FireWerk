<div align="center">

<img src="src/ui/public/firewerk-logo.png" alt="FireWerk Logo" width="120" height="120" />

# FireWerk 🔥

**Batch your imagination.**

Automated Adobe Firefly generation for images and speech via Playwright automation.

[![License: MIT](https://img.shields.io/badge/License-MIT-orange.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CONTRIBUTING.md)

[Features](#features) • [Quick Start](#quick-start) • [Documentation](#documentation) • [Web UI](#web-ui) • [CLI](#cli-usage) • [Contributing](#contributing)

</div>

---

## ✨ Features

- **🎨 Image Generation** - Automated batch generation with support for multiple models:
  - Adobe Firefly Image 3, 4, 4 Ultra, 5 (Preview)
  - Partner models: Flux, Gemini, Imagen, GPT Image, Runway Gen-4
  - Aspect ratio control (1:1, 4:5, 16:9, and more)
  - Style presets (photographic, art, graphic)
  - Multi-variant generation
  - Download or screenshot capture modes

- **🔊 Speech Generation** - Text-to-speech with customizable options:
  - Multiple voice options
  - Language selection
  - Automated audio file download

- **🖥️ Web UI** - Beautiful glassmorphism interface with ember glow design:
  - Browser-based prompt management
  - Real-time generation status
  - Output gallery with thumbnails
  - Background removal tool (via rembg)
  - Generation history tracking
  - Dark mode with orange/red accents

- **⚡ CLI** - Command-line interface for scripted workflows:
  - Batch processing from CSV/JSON files
  - Environment variable configuration
  - Headless or visible browser modes

- **🔐 Automated Login** - Seamless authentication:
  - Email prefill with 2FA approval via Adobe Access app
  - Session persistence (no repeated logins)
  - Secure storage state management

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- Adobe Firefly account

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/FireWerk.git
cd FireWerk

# Install dependencies
npm install

# Configure environment (optional)
cp .env.example .env
# Edit .env with your Adobe email
```

### Option 1: Web UI (Recommended)

Start the web server and use the browser interface:

```bash
npm run ui
```

Then open **http://localhost:3000** in your browser to:
- ✅ Select prompt files from examples or upload your own
- ✅ Configure generation options (model, aspect ratio, style)
- ✅ Start image or speech generation with one click
- ✅ View generated outputs in a beautiful gallery
- ✅ Remove backgrounds from images
- ✅ Track generation history

### Option 2: Command Line

Generate images directly from the terminal:

```bash
# Basic image generation
npm run generate:images -- --prompts ./examples/prompts/geckio.csv

# With custom output directory
npm run generate:images -- --prompts ./examples/prompts/geckio.csv --output ./my-output

# Generate speech
npm run generate:speech -- --prompts ./examples/prompts/speech.csv
```

### First Run - Authentication

On first run (or when storage state expires), the browser will open and:

1. Navigate to Adobe Firefly
2. Fill in your email (from `FIREFLY_EMAIL` env var)
3. Wait for you to approve login in your **Adobe Access app**
4. Save the session for future runs (no repeated logins!)

---

## 📖 Documentation

### Web UI

The web interface provides a visual way to manage your Firefly generations:

**Generate Tab**
- Select prompt files (CSV or JSON)
- Choose generation type (Images or Speech)
- Configure model, aspect ratio, style
- Set number of variants
- Choose capture mode (download or screenshot)
- Add global style modifiers

**Outputs Tab**
- View all generated images in a grid or list
- Sort by name or date
- Remove backgrounds with adjustable threshold
- Download or view full resolution

**History Tab**
- Track all generation runs
- See completion status
- Review generation parameters
- Re-run previous generations

### CLI Usage

#### Image Generation Options

```bash
npm run generate:images -- [options]

Options:
  --prompts <path>     Path to prompts file (CSV or JSON) [required]
  --output <dir>       Output directory (default: ./output)
  --email <email>      Adobe email for login
  --model <name>       Model to use (e.g., "Firefly Image 5 (Vorschau)")
  --variants <n>       Number of variants per prompt (default: 1)
  --headless           Run in headless mode (default: true)
  --capture-mode       download or screenshot (default: screenshot)
```

#### Speech Generation Options

```bash
npm run generate:speech -- [options]

Options:
  --prompts <path>     Path to prompts file (CSV or JSON) [required]
  --output <dir>       Output directory (default: ./output)
  --email <email>      Adobe email for login
  --headless           Run in headless mode (default: true)
```

### Prompt File Formats

#### Images CSV

```csv
prompt_id,prompt_text,aspect_ratio,style,model
gecko_001,"highly detailed macro photo of a crested gecko on moss",1:1,photographic,Firefly Image 4
perfume_rose,"editorial product photo, perfume bottle with soft roses",4:5,editorial,Firefly Image 5 (Vorschau)
landscape_sunset,"epic mountain landscape at golden hour",16:9,photographic,Imagen 4
```

#### Images JSON

```json
[
  {
    "prompt_id": "gecko_001",
    "prompt_text": "highly detailed macro photo of a crested gecko on moss",
    "aspect_ratio": "1:1",
    "style": "photographic",
    "model": "Firefly Image 4"
  },
  {
    "prompt_id": "perfume_rose",
    "prompt_text": "editorial product photo, perfume bottle with soft roses",
    "aspect_ratio": "4:5",
    "style": "editorial"
  }
]
```

#### Speech CSV

```csv
prompt_id,text,voice,language
greeting,"Hello and welcome to our service",Natural,English (US)
announcement,"Important update for all users",Professional,English (US)
```

#### Speech JSON

```json
[
  {
    "prompt_id": "greeting",
    "text": "Hello and welcome to our service",
    "voice": "Natural",
    "language": "English (US)"
  },
  {
    "prompt_id": "announcement",
    "text": "Important update for all users",
    "voice": "Professional",
    "language": "English (US)"
  }
]
```

### Environment Variables

Create a `.env` file in the project root:

```bash
# Adobe account email for login
FIREFLY_EMAIL=your.email@example.com

# Output directory for generated files
OUTPUT_DIR=./output

# Storage state file path (session persistence)
STORAGE_STATE=./data/storageState.json

# Run in headless mode (true/false)
HEADLESS=true

# Wait time after clicking generate button (milliseconds)
POST_CLICK_WAIT_MS=15000

# Number of variants per prompt (images only)
VARIANTS_PER_PROMPT=1

# Capture mode: download or screenshot
CAPTURE_MODE=screenshot

# Model selection (optional, overrides prompt file)
MODEL=Firefly Image 4
```

---

## 🏗️ Project Structure

```
FireWerk/
├── src/
│   ├── generators/
│   │   ├── BaseGenerator.mjs      # Common automation functionality
│   │   ├── ImageGenerator.mjs     # Image generation logic
│   │   └── SpeechGenerator.mjs    # Speech generation logic
│   ├── ui/
│   │   ├── server.mjs             # Express web server
│   │   └── public/
│   │       ├── index.html         # Web interface
│   │       ├── css/
│   │       │   └── styles.css     # Ember glow design system
│   │       └── js/
│   │           └── app.js         # Frontend JavaScript
│   └── cli.mjs                    # CLI entry point
├── lib/
│   └── utils/
│       └── promptLoader.mjs       # CSV/JSON prompt loader
├── examples/
│   └── prompts/
│       ├── geckio.csv            # Example image prompts
│       └── speech.csv            # Example speech prompts
├── data/
│   └── storageState.json         # Saved login session (auto-generated)
├── output/                       # Generated files (auto-created)
├── .env.example                  # Environment template
├── package.json
└── README.md
```

---

## 🎨 Supported Models

### Adobe Firefly Models
- **Firefly Image 5 (Vorschau)** - Latest preview model
- **Firefly Image 4 Ultra** - Ultra high quality
- **Firefly Image 4** - High quality balanced
- **Firefly Image 3** - Previous generation

### Partner Models
- **Flux Kontext Max** - Context-aware generation
- **Flux Kontext Pro** - Professional quality
- **Flux 1.1 Pro** - Fast professional
- **Flux 1.1 Ultra** - Ultra quality Flux
- **Flux 1.1 Ultra (Raw)** - Raw output mode
- **Gemini 2.5 (Nano Banana)** - Google's latest
- **Imagen 4** - Google Imagen latest
- **Imagen 3** - Google Imagen previous
- **GPT Image** - OpenAI DALL-E integration
- **Runway Gen-4 Image** - Runway's generation model

---

## 🛠️ How It Works

### Image Generation Flow

1. **Initialize** - Opens Firefly Images page
2. **Authenticate** - Handles login with 2FA if needed
3. **Process Prompts** - For each prompt:
   - Sets model selection (if specified)
   - Sets aspect ratio (1:1, 4:5, 16:9, etc.)
   - Sets style preset (photographic, art, graphic)
   - Fills prompt text
   - Clicks generate button
   - Waits for generation completion
   - Captures image (download or screenshot mode)
   - Saves to output directory with sanitized filename
4. **Complete** - Reports summary and closes browser

### Speech Generation Flow

1. **Initialize** - Opens Firefly Speech page
2. **Authenticate** - Handles login with 2FA if needed
3. **Process Prompts** - For each prompt:
   - Fills text input
   - Selects voice and language
   - Clicks generate button
   - Waits for audio generation
   - Downloads audio file
   - Saves to output directory
4. **Complete** - Reports summary and closes browser

### Authentication Flow

- **First Run**: Email is pre-filled, user approves in Adobe Access app
- **Subsequent Runs**: Session is loaded from `storageState.json`
- **No Manual Work**: No cookie extraction or manual login required
- **Persistent**: Session persists until Adobe expires it (weeks/months)

---

## 🐛 Troubleshooting

### No images/audio captured?

- Increase `POST_CLICK_WAIT_MS` in your `.env` file (try 20000-30000)
- Run with `HEADLESS=false` to see what's happening in the browser
- Check that generation actually completed (look for result images in DOM)

### Login not working?

- Delete `./data/storageState.json` to force fresh login
- Check that `FIREFLY_EMAIL` matches your Adobe account email
- Make sure you have the **Adobe Access** app installed on your phone
- Approve the login request in the Adobe Access app when prompted

### Generate button not clicking?

- Cookie consent banner may be blocking it (should auto-dismiss)
- Prompt textarea may not be ready (waits automatically)
- Try running with `HEADLESS=false` to debug visually

### Model selection not working?

- Check that model name exactly matches the UI label
- Use quotes around model names with spaces: `MODEL="Firefly Image 5 (Vorschau)"`
- Model must be available in your Adobe Firefly account

### Background removal fails?

- Install rembg: `pip install rembg`
- Ensure Python is available in your PATH
- Try adjusting the threshold slider in the UI

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Development Setup

```bash
# Clone the repo
git clone https://github.com/yourusername/FireWerk.git
cd FireWerk

# Install dependencies
npm install

# Run in development mode (visible browser)
HEADLESS=false npm run generate:images -- --prompts ./examples/prompts/geckio.csv
```

### Reporting Issues

Found a bug or have a feature request? Please open an issue on GitHub with:
- Clear description of the problem or feature
- Steps to reproduce (for bugs)
- Expected vs actual behavior
- Screenshots if applicable

---

## ⚠️ Important Notes

- **Respect Adobe's Terms**: Use your own account and moderate throughput
- **Rate Limiting**: Keep generation rate moderate to respect Adobe's service
- **Storage State**: Keep `storageState.json` secure (contains session data)
- **Cookie Consent**: Automatically dismissed on Firefly pages
- **Force Click**: Generate button is clicked with force to handle overlays

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Built with [Playwright](https://playwright.dev/) for reliable browser automation
- Styled with the Ember Glow design system (glassmorphism + orange/red accents)
- Background removal powered by [rembg](https://github.com/danielgatis/rembg)
- Inspired by the need for batch creative workflows

---

<div align="center">

**[⬆ back to top](#firewerk-)**

Made with 🔥 by the FireWerk team

</div>
