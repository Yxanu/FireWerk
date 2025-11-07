import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

async function captureScreenshots() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });
  const page = await context.newPage();

  try {
    // Navigate to UI
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(1000);

    // Screenshot 1: Generate Tab
    console.log('Capturing Generate Tab screenshot...');
    await page.screenshot({
      path: join(projectRoot, 'screenshots/ui-generate-tab.png'),
      fullPage: false
    });

    // Screenshot 2: Outputs Tab
    console.log('Capturing Outputs Tab screenshot...');
    await page.click('button[data-tab="outputs"]');
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: join(projectRoot, 'screenshots/ui-outputs-tab.png'),
      fullPage: false
    });

    // Screenshot 3: History Tab
    console.log('Capturing History Tab screenshot...');
    await page.click('button[data-tab="history"]');
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: join(projectRoot, 'screenshots/ui-history-tab.png'),
      fullPage: false
    });

    console.log('✅ All screenshots captured successfully!');
  } catch (error) {
    console.error('Error capturing screenshots:', error);
  } finally {
    await browser.close();
  }
}

captureScreenshots();
