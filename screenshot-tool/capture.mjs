import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdir, rename } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Parse command line arguments
 */
function parseArgs() {
  const args = process.argv.slice(2);
  const config = {
    url: 'http://localhost:3000',
    output: './screenshots',
    width: 1440,
    height: 900,
    fullPage: false,
    headless: true,
    wait: 1000,
    selectors: [],
    tabs: [],
    video: false,
    videoDuration: 10000,
    videoActions: []
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--url':
        config.url = args[++i];
        break;
      case '--output':
        config.output = args[++i];
        break;
      case '--width':
        config.width = parseInt(args[++i]);
        break;
      case '--height':
        config.height = parseInt(args[++i]);
        break;
      case '--full-page':
        config.fullPage = true;
        break;
      case '--headless':
        config.headless = args[++i] !== 'false';
        break;
      case '--wait':
        config.wait = parseInt(args[++i]);
        break;
      case '--selector':
        config.selectors.push(args[++i]);
        break;
      case '--tab':
        config.tabs.push(args[++i]);
        break;
      case '--video':
        config.video = true;
        break;
      case '--video-duration':
        config.videoDuration = parseInt(args[++i]);
        break;
      case '--video-action':
        config.videoActions.push(args[++i]);
        break;
      case '--help':
        printHelp();
        process.exit(0);
        break;
    }
  }

  return config;
}

/**
 * Print help message
 */
function printHelp() {
  console.log(`
Website Screenshot & Video Capture Tool

Usage:
  node capture.mjs [options]

Options:
  --url <url>              URL to capture (default: http://localhost:3000)
  --output <dir>           Output directory (default: ./screenshots)
  --width <pixels>         Viewport width (default: 1440)
  --height <pixels>        Viewport height (default: 900)
  --full-page              Capture full page (default: viewport only)
  --headless <bool>        Run in headless mode (default: true)
  --wait <ms>              Wait time after page load (default: 1000)
  --selector <css>         Capture specific element (can be used multiple times)
  --tab <selector>         Click tab before capturing (can be used multiple times)
  --video                  Record video instead of screenshots
  --video-duration <ms>    Video recording duration (default: 10000ms)
  --video-action <action>  Action to perform during video recording (format: "type:selector:value:delay")
                           Examples: "click:button[data-tab="outputs"]:0:2000"
                                     "type:input[name="prompt"]:Hello World:0:1000"
                                     "scroll:0:500:0:2000"
  --help                   Show this help message

Examples:
  # Capture screenshots
  node capture.mjs --url http://localhost:3000 --output ./screenshots

  # Record 15-second video showing UI usage
  node capture.mjs --url http://localhost:3000 --video --video-duration 15000 --output ./videos

  # Record video with tab clicks
  node capture.mjs --url http://localhost:3000 --video \\
    --video-action "click:button[data-tab='outputs']:0:2000" \\
    --video-action "click:button[data-tab='history']:0:2000"

  # Record video with form interaction
  node capture.mjs --url http://localhost:3000 --video \\
    --video-action "type:input[name='prompt']:Amazing product photo:0:1000" \\
    --video-action "click:button[type='submit']:0:3000"

  # Capture deployed site
  node capture.mjs --url https://example.com --output ./screenshots

  # Capture with tabs (screenshots)
  node capture.mjs --url http://localhost:3000 --tab 'button[data-tab="generate"]' --tab 'button[data-tab="outputs"]'

  # Visible mode (see browser)
  node capture.mjs --url http://localhost:3000 --headless false
  `);
}

/**
 * Parse video action string into components
 */
function parseVideoAction(actionString) {
  const parts = actionString.split(':');
  const action = {
    type: parts[0], // click, type, scroll, wait
    selector: parts[1] || null,
    value: parts[2] || null,
    delay: parseInt(parts[3]) || 1000
  };
  return action;
}

/**
 * Execute video actions during recording
 */
async function executeVideoActions(page, actions) {
  for (const actionString of actions) {
    const action = parseVideoAction(actionString);

    console.log(`  Executing: ${action.type} ${action.selector || ''}`);

    try {
      switch (action.type) {
        case 'click':
          await page.click(action.selector);
          break;
        case 'type':
          await page.fill(action.selector, action.value);
          break;
        case 'scroll':
          await page.evaluate((x, y) => window.scrollTo(x, y),
            parseInt(action.selector), parseInt(action.value));
          break;
        case 'wait':
          // Just wait, no action needed
          break;
      }

      await page.waitForTimeout(action.delay);
    } catch (error) {
      console.error(`  ❌ Failed to execute action: ${error.message}`);
    }
  }
}

/**
 * Record video of website usage
 */
async function recordVideo(config) {
  console.log('\n🎥 Website Video Recorder\n');
  console.log(`URL: ${config.url}`);
  console.log(`Output: ${config.output}`);
  console.log(`Viewport: ${config.width}x${config.height}`);
  console.log(`Duration: ${config.videoDuration}ms`);
  console.log(`Headless: ${config.headless}\n`);

  const outputPath = join(process.cwd(), config.output);
  await mkdir(outputPath, { recursive: true });

  const browser = await chromium.launch({ headless: config.headless });
  const context = await browser.newContext({
    viewport: { width: config.width, height: config.height },
    recordVideo: {
      dir: outputPath,
      size: { width: config.width, height: config.height }
    }
  });
  const page = await context.newPage();

  try {
    console.log(`🌐 Loading ${config.url}...`);
    await page.goto(config.url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(config.wait);
    console.log('✅ Page loaded\n');

    if (config.videoActions.length > 0) {
      console.log('🎬 Executing video actions...\n');
      await executeVideoActions(page, config.videoActions);
    } else {
      console.log('⏱️  Recording...');
      await page.waitForTimeout(config.videoDuration);
    }

    console.log('\n✅ Recording complete, saving video...');

    // Get video path before closing page
    const videoPath = await page.video().path();
    await page.close();

    // Wait for video to be saved
    await new Promise(resolve => setTimeout(resolve, 1000));

    const finalVideoPath = join(outputPath, 'usage-demo.webm');

    try {
      await rename(videoPath, finalVideoPath);
      console.log(`✅ Video saved to: ${finalVideoPath}\n`);
    } catch (error) {
      console.log(`✅ Video saved to: ${videoPath}\n`);
    }

    await browser.close();
  } catch (error) {
    console.error('\n❌ Error recording video:', error);
    await browser.close();
    throw error;
  }
}

/**
 * Capture screenshots
 */
async function captureScreenshots(config) {
  console.log('\n📸 Website Screenshot Tool\n');
  console.log(`URL: ${config.url}`);
  console.log(`Output: ${config.output}`);
  console.log(`Viewport: ${config.width}x${config.height}`);
  console.log(`Headless: ${config.headless}\n`);

  // Ensure output directory exists
  const outputPath = join(process.cwd(), config.output);
  await mkdir(outputPath, { recursive: true });

  const browser = await chromium.launch({ headless: config.headless });
  const context = await browser.newContext({
    viewport: { width: config.width, height: config.height }
  });
  const page = await context.newPage();

  try {
    // Navigate to URL
    console.log(`🌐 Loading ${config.url}...`);
    await page.goto(config.url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(config.wait);
    console.log('✅ Page loaded\n');

    // Capture main page screenshot
    const mainScreenshotPath = join(outputPath, 'page-main.png');
    await page.screenshot({
      path: mainScreenshotPath,
      fullPage: config.fullPage
    });
    console.log(`✅ Captured: page-main.png`);

    // Capture tab screenshots if specified
    for (let i = 0; i < config.tabs.length; i++) {
      const tabSelector = config.tabs[i];
      console.log(`\n📑 Clicking tab: ${tabSelector}`);

      try {
        await page.click(tabSelector);
        await page.waitForTimeout(1000);

        const tabName = await page.evaluate((selector) => {
          const element = document.querySelector(selector);
          return element?.textContent?.trim().toLowerCase().replace(/\s+/g, '-') || `tab-${i + 1}`;
        }, tabSelector);

        const tabScreenshotPath = join(outputPath, `page-${tabName}.png`);
        await page.screenshot({
          path: tabScreenshotPath,
          fullPage: config.fullPage
        });
        console.log(`✅ Captured: page-${tabName}.png`);
      } catch (error) {
        console.error(`❌ Failed to capture tab ${tabSelector}:`, error.message);
      }
    }

    // Capture element screenshots if specified
    for (let i = 0; i < config.selectors.length; i++) {
      const selector = config.selectors[i];
      console.log(`\n📦 Capturing element: ${selector}`);

      try {
        const element = await page.$(selector);
        if (element) {
          const elementName = selector.replace(/[^a-z0-9]/gi, '-').toLowerCase();
          const elementScreenshotPath = join(outputPath, `element-${elementName}.png`);
          await element.screenshot({ path: elementScreenshotPath });
          console.log(`✅ Captured: element-${elementName}.png`);
        } else {
          console.error(`❌ Element not found: ${selector}`);
        }
      } catch (error) {
        console.error(`❌ Failed to capture ${selector}:`, error.message);
      }
    }

    console.log(`\n✅ All screenshots saved to: ${outputPath}\n`);
  } catch (error) {
    console.error('\n❌ Error capturing screenshots:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

// Main execution
const config = parseArgs();

if (config.video) {
  recordVideo(config).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
} else {
  captureScreenshots(config).catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
