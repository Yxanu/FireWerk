<div align="center">

<img src="src/ui/public/firewerk-logo.png" alt="FireWerk - Adobe Firefly Bulk Image Generation Tool" width="120" height="120" />

# FireWerk 🔥

**Adobe Firefly Bulk Image Generation & Batch Processing Tool**

Automate Adobe Firefly image generation at scale. Batch process hundreds of prompts with support for all Firefly models, partner AI models, and advanced features like aspect ratio control, style presets, and background removal.

[![License: MIT](https://img.shields.io/badge/License-MIT-orange.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)

[Features](#features) • [Quick Start](#quick-start) • [Documentation](#documentation) • [Web UI](#web-ui) • [CLI](#cli-usage)

**Keywords**: Adobe Firefly automation, bulk image generation, batch AI art, Firefly API alternative, automated creative workflow, mass image generation, AI batch processing

</div>

---

## ✨ Features - Adobe Firefly Bulk Generation at Scale

### 🎨 Bulk Image Generation & Batch Processing

- **Mass Adobe Firefly Image Generation** - Process 100s or 1000s of prompts automatically
  - **All Adobe Firefly Models**: Firefly Image 3, 4, 4 Ultra, 5 (Preview)
  - **Partner AI Models**: Flux (Kontext Max/Pro, 1.1 Pro/Ultra), Google Gemini 2.5, Imagen 3/4, OpenAI GPT Image, Runway Gen-4
  - **Aspect Ratio Control**: Square (1:1), Portrait (4:5), Landscape (16:9), and custom ratios
  - **Style Presets**: Photographic, Art, Graphic, Editorial styles
  - **Multi-Variant Generation**: Generate multiple variations per prompt
  - **Two Capture Modes**: Full-resolution download or fast screenshot capture
  - **CSV/JSON Import**: Bulk import prompts from spreadsheets or JSON files

### 🔊 Automated Speech Generation

- Batch text-to-speech processing with Adobe Firefly
- Multiple voice options and language selection
- Automated audio file download and organization

### 🖥️ Professional Web Interface

- **Modern Glassmorphism UI** with ember glow design
- **Drag-and-drop prompt management** for bulk operations
- **Real-time batch generation monitoring** with progress tracking
- **Output Gallery** with thumbnails and sorting options
- **Built-in Background Removal** (powered by rembg AI)
- **Generation History** for tracking bulk job runs
- **Responsive Design** optimized for desktop workflows

### ⚡ Command-Line Interface (CLI) for DevOps

- **Scriptable Batch Processing** - Integrate with CI/CD pipelines
- **CSV/JSON Bulk Import** - Process large prompt datasets
- **Environment Variables** - Configure for different environments
- **Headless Mode** - Run on servers without display
- **Perfect for**: Marketing teams, content creators, ecommerce, social media automation

### 🔐 Smart Authentication & Session Management

- **One-Time Setup** - Login once, never again
- **2FA Support** - Adobe Access app integration
- **Persistent Sessions** - Automatic session renewal
- **Secure Storage** - Local credential management
- **No API Key Required** - Works with your existing Adobe account

---

## 🚀 Quick Start - Adobe Firefly Bulk Generation in 3 Steps

### Prerequisites

- **Node.js 18+** (Download from [nodejs.org](https://nodejs.org/))
- **Adobe Firefly Account** (Free tier works!)
- **5 minutes** to get started with bulk image generation

### Installation

```bash
# 1. Clone the FireWerk bulk generation tool
git clone https://github.com/yourusername/FireWerk.git
cd FireWerk

# 2. Install dependencies
npm install

# 3. Configure your Adobe Firefly account (optional)
cp .env.example .env
# Edit .env with your Adobe email for automatic login
```

### Option 1: Web UI - Best for Bulk Image Management

Start the professional web interface for managing bulk Adobe Firefly generations:

```bash
npm run ui
```

Open **http://localhost:3000** to access the bulk generation dashboard:

✅ **Import CSV/JSON** with hundreds of prompts
✅ **Select Models** - Choose from 15+ AI models including all Firefly versions
✅ **Configure Batch Settings** - Aspect ratios, styles, variants
✅ **Monitor Progress** - Real-time status of bulk generation jobs
✅ **Gallery View** - Browse and manage generated images
✅ **Background Removal** - Batch remove backgrounds from generated images
✅ **Export & Download** - Bulk download all generated assets

### Option 2: CLI - Best for Automated Workflows

Perfect for bulk processing in scripts, cron jobs, or CI/CD pipelines:

```bash
# Bulk generate images from CSV prompt file
npm run generate:images -- --prompts ./examples/prompts/bulk-prompts.csv

# Batch generate with specific model and output folder
npm run generate:images -- --prompts ./prompts.csv --model "Firefly Image 4 Ultra" --output ./marketing-images

# Mass generate with multiple variants per prompt
npm run generate:images -- --prompts ./products.csv --variants 4 --output ./product-photos

# Bulk speech generation
npm run generate:speech -- --prompts ./audio-scripts.csv --output ./voiceovers
```

### First Run - One-Time Adobe Firefly Authentication

On first run, FireWerk will handle Adobe Firefly authentication automatically:

1. ✅ Browser opens to Adobe Firefly login page
2. ✅ Your email is auto-filled (from .env file)
3. ✅ Approve login in your **Adobe Access mobile app** (2FA)
4. ✅ Session saved locally - **never login again!**
5. ✅ Start batch generating images immediately

**No API keys needed** - Works with your existing Adobe Firefly subscription!

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

## ⚠️ Important Notes for Bulk Adobe Firefly Generation

### Best Practices for Mass Image Generation

- **Respect Adobe's Terms**: Use your own Adobe Firefly account for bulk generation
- **Rate Limiting**: For very large batches (1000+ images), consider running overnight or in smaller batches
- **Session Security**: Keep `storageState.json` secure (contains your Adobe session)
- **Automated Processing**: FireWerk handles all UI interactions automatically
- **Browser Automation**: Uses Playwright for reliable, unattended bulk generation

### Use Cases for Bulk Adobe Firefly Generation

✅ **Marketing Teams** - Generate hundreds of social media images at once
✅ **E-commerce** - Bulk create product photography variations
✅ **Content Creators** - Mass produce blog post headers and thumbnails
✅ **Agencies** - Automate client deliverables with batch processing
✅ **Developers** - Integrate Adobe Firefly into your automated workflows
✅ **Designers** - Rapid ideation with bulk variant generation

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

Free to use for commercial bulk Adobe Firefly image generation projects.

---

## 🔍 SEO Keywords

Adobe Firefly bulk generation, Adobe Firefly batch processing, automate Adobe Firefly, bulk AI image generation, Adobe Firefly automation tool, mass image generation Firefly, batch AI art creation, Adobe Firefly API alternative, bulk creative automation, automated Firefly workflow, Firefly batch image generator, Adobe AI bulk processing, mass produce AI images, Firefly automation script, bulk Firefly images tool

---

<div align="center">

**[⬆ back to top](#firewerk-)**

**Adobe Firefly Bulk Generation Made Easy** - Process hundreds of AI images automatically

</div>
