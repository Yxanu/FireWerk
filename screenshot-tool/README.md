# Website Screenshot & Video Capture Tool

Automated screenshot and video recording tool for websites using Playwright. Capture both local development sites and deployed production sites with ease.

## Features

- **Screenshot Capture** - Capture full pages, viewports, or specific elements
- **Video Recording** - Record automated video demonstrations of website usage
- **Tab Navigation** - Automatically navigate through multiple tabs
- **Custom Actions** - Define click, type, scroll, and wait actions for videos
- **Flexible Viewport** - Configure any viewport size
- **Headless Mode** - Run with or without visible browser

## Installation

```bash
cd screenshot-tool
npm install
```

## Usage

### Screenshot Mode

Capture static screenshots of websites:

```bash
# Basic screenshot
node capture.mjs --url http://localhost:3000

# Full page screenshot
node capture.mjs --url https://example.com --full-page

# Custom viewport
node capture.mjs --url http://localhost:3000 --width 1920 --height 1080

# Multiple tabs
node capture.mjs --url http://localhost:3000 \
  --tab 'button[data-tab="generate"]' \
  --tab 'button[data-tab="outputs"]' \
  --tab 'button[data-tab="history"]'

# Specific elements
node capture.mjs --url http://localhost:3000 \
  --selector '.hero-section' \
  --selector '.features-grid'
```

### Video Recording Mode

Record automated videos showing website usage:

```bash
# Basic 10-second video
node capture.mjs --url http://localhost:3000 --video

# Custom duration (15 seconds)
node capture.mjs --url http://localhost:3000 --video --video-duration 15000

# Video with tab navigation
node capture.mjs --url http://localhost:3000 --video \
  --video-action "click:button[data-tab='outputs']:0:2000" \
  --video-action "click:button[data-tab='history']:0:2000"

# Video with form interaction
node capture.mjs --url http://localhost:3000 --video \
  --video-action "type:input[name='prompt']:Amazing product photo:0:1000" \
  --video-action "click:button[type='submit']:0:3000"

# Complex workflow demonstration
node capture.mjs --url http://localhost:3000 --video --video-duration 20000 \
  --video-action "type:input.prompt-input:Beautiful sunset landscape:0:1500" \
  --video-action "click:button.generate-btn:0:5000" \
  --video-action "click:button[data-tab='outputs']:0:2000" \
  --video-action "scroll:0:500:0:1000"
```

## Options

### Common Options

| Option | Description | Default |
|--------|-------------|---------|
| `--url <url>` | URL to capture | `http://localhost:3000` |
| `--output <dir>` | Output directory | `./screenshots` |
| `--width <pixels>` | Viewport width | `1440` |
| `--height <pixels>` | Viewport height | `900` |
| `--headless <bool>` | Run in headless mode | `true` |
| `--wait <ms>` | Wait time after page load | `1000` |

### Screenshot Options

| Option | Description |
|--------|-------------|
| `--full-page` | Capture full page instead of viewport only |
| `--selector <css>` | Capture specific element (can use multiple times) |
| `--tab <selector>` | Click tab before capturing (can use multiple times) |

### Video Options

| Option | Description | Default |
|--------|-------------|---------|
| `--video` | Enable video recording mode | `false` |
| `--video-duration <ms>` | Recording duration in milliseconds | `10000` |
| `--video-action <action>` | Action to perform during recording (see below) | - |

## Video Actions

Video actions follow the format: `type:selector:value:delay`

### Action Types

**click** - Click an element
```bash
--video-action "click:button[data-tab='outputs']:0:2000"
# Click button, wait 2 seconds
```

**type** - Type text into an input
```bash
--video-action "type:input[name='prompt']:Hello World:0:1000"
# Type "Hello World", wait 1 second
```

**scroll** - Scroll the page
```bash
--video-action "scroll:0:500:0:2000"
# Scroll to x=0, y=500, wait 2 seconds
```

**wait** - Just wait (useful for timing)
```bash
--video-action "wait:0:0:3000"
# Wait 3 seconds
```

## Examples

### Example 1: FireWerk UI Documentation

Capture screenshots of all three tabs in the FireWerk UI:

```bash
node capture.mjs \
  --url http://localhost:3000 \
  --output ../screenshots \
  --tab 'button[data-tab="generate"]' \
  --tab 'button[data-tab="outputs"]' \
  --tab 'button[data-tab="history"]'
```

**Output:**
- `screenshots/page-main.png` - Generate tab (default)
- `screenshots/page-outputs.png` - Outputs tab
- `screenshots/page-history.png` - History tab

### Example 2: Usage Video Demo

Record a video showing how to generate images:

```bash
node capture.mjs \
  --url http://localhost:3000 \
  --video \
  --video-duration 20000 \
  --output ../videos \
  --video-action "type:textarea[placeholder='Enter your prompt']:Cute gecko on moss:0:1500" \
  --video-action "click:select[name='model']:0:500" \
  --video-action "click:option[value='Firefly Image 4']:0:1000" \
  --video-action "click:button.generate-button:0:5000" \
  --video-action "click:button[data-tab='outputs']:0:2000"
```

**Output:**
- `videos/usage-demo.webm` - 20-second demonstration video

### Example 3: Deployed Site Capture

Capture screenshots from your production site:

```bash
node capture.mjs \
  --url https://firewerk.tosa.io \
  --output ./production-screenshots \
  --full-page \
  --width 1920 \
  --height 1080
```

### Example 4: Marketing Video

Create a polished marketing video with smooth transitions:

```bash
node capture.mjs \
  --url https://firewerk.tosa.io \
  --video \
  --video-duration 30000 \
  --output ./marketing \
  --video-action "wait:0:0:2000" \
  --video-action "scroll:0:800:0:2000" \
  --video-action "scroll:0:1600:0:2000" \
  --video-action "scroll:0:2400:0:2000" \
  --video-action "scroll:0:0:0:1000"
```

## Output Formats

### Screenshots
- Format: PNG
- Naming: `page-{name}.png`, `element-{name}.png`
- Location: Specified output directory

### Videos
- Format: WebM (VP8 codec)
- Naming: `usage-demo.webm`
- Location: Specified output directory
- Can be converted to MP4 using ffmpeg if needed

## Converting Video to MP4

If you need MP4 format for broader compatibility:

```bash
# Install ffmpeg (if not already installed)
brew install ffmpeg  # macOS
# or: apt install ffmpeg  # Linux

# Convert WebM to MP4
ffmpeg -i videos/usage-demo.webm -c:v libx264 -c:a aac videos/usage-demo.mp4
```

## Tips & Best Practices

### For Screenshots
- Use `--full-page` for documentation
- Use specific `--selector` for component documentation
- Use `--tab` for multi-tab UI navigation
- Higher `--width` (1920+) for high-DPI displays

### For Videos
- Start with `--headless false` to see what's happening
- Add initial wait action for smooth starts
- Use 2-3 second delays for user-paced demonstrations
- Test action selectors in browser DevTools first
- Keep videos under 30 seconds for better engagement

### Performance
- Headless mode is faster for batch operations
- Screenshot mode is faster than video for static captures
- Use `--wait` to ensure content loads before capture

## Troubleshooting

**Video not capturing interactions?**
- Verify selectors using browser DevTools
- Increase delay times in video actions
- Run with `--headless false` to debug visually

**Empty screenshots?**
- Increase `--wait` time for page load
- Check that URL is accessible
- Verify selectors exist on the page

**Video quality issues?**
- Videos are recorded at viewport size
- Use larger `--width` and `--height` for better quality
- Convert to MP4 with higher bitrate for production use

## License

MIT - Use freely in your projects!
