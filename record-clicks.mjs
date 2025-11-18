#!/usr/bin/env node
import { chromium } from 'playwright';

async function recordClicks() {
  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
    slowMo: 1000 // Slow down for visibility
  });

  const context = await browser.newContext({
    storageState: './data/storageState.json',
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  let clickCount = 0;

  // Set up click listener to log and screenshot
  await page.exposeFunction('logClick', async (info) => {
    clickCount++;
    console.log(`\n[CLICK ${clickCount}]`);
    console.log(`  Tag: ${info.tagName}`);
    console.log(`  Text: ${info.text}`);
    console.log(`  Class: ${info.className}`);
    console.log(`  ID: ${info.id}`);
    console.log(`  aria-label: ${info.ariaLabel}`);
    console.log(`  data-testid: ${info.testId}`);
    console.log(`  Selector suggestion: ${info.tagName.toLowerCase()}${info.id ? '#' + info.id : ''}${info.className ? '.' + info.className.split(' ')[0] : ''}`);
  });

  // Inject click listener
  await page.addInitScript(() => {
    let clickNum = 0;
    document.addEventListener('click', (e) => {
      clickNum++;
      const target = e.target;
      window.logClick({
        tagName: target.tagName,
        text: target.textContent?.trim().substring(0, 100) || '',
        className: target.className || '',
        id: target.id || '',
        ariaLabel: target.getAttribute('aria-label') || '',
        testId: target.getAttribute('data-testid') || ''
      });
    }, true);
  });

  // Take screenshot after each mutation
  let screenshotNum = 0;
  const takeScreenshot = async () => {
    screenshotNum++;
    const path = `./data/recorded-click-${screenshotNum}.png`;
    await page.screenshot({ path, fullPage: true });
    console.log(`[SCREENSHOT] Saved: ${path}`);
  };

  // Watch for DOM changes and take screenshots
  await page.exposeFunction('onDomChange', takeScreenshot);
  await page.evaluate(() => {
    const observer = new MutationObserver((mutations) => {
      // Debounce screenshots
      clearTimeout(window.screenshotTimeout);
      window.screenshotTimeout = setTimeout(() => {
        window.onDomChange();
      }, 500);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true
    });
  });

  console.log('[RECORDING] Opening Firefly...');
  console.log('[RECORDING] Please perform your clicks:');
  console.log('  1. Expand General settings (if needed)');
  console.log('  2. Click Model selector');
  console.log('  3. Select GPT Image');
  console.log('  4. Click Aspect Ratio selector');
  console.log('  5. Select 1:1');
  console.log('\n[RECORDING] Screenshots will be taken automatically after each change');
  console.log('[RECORDING] Press Ctrl+C when done\n');

  await page.goto('https://firefly.adobe.com/generate/images', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  await page.waitForTimeout(3000);
  await takeScreenshot(); // Initial screenshot

  // Keep browser open indefinitely
  await new Promise(() => {});
}

recordClicks().catch(console.error);
