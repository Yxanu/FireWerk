#!/usr/bin/env node
import { chromium } from 'playwright';

async function interactiveDebug() {
  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
    slowMo: 500 // Slow down actions for visibility
  });

  const context = await browser.newContext({
    storageState: './data/storageState.json',
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  // Set up click listener to log all clicks
  await page.exposeFunction('logClick', (info) => {
    console.log('\n[CLICK RECORDED]');
    console.log(`  Tag: ${info.tagName}`);
    console.log(`  Text: ${info.text}`);
    console.log(`  Class: ${info.className}`);
    console.log(`  ID: ${info.id}`);
    console.log(`  aria-label: ${info.ariaLabel}`);
    console.log(`  data-testid: ${info.testId}`);
  });

  // Inject click listener into page
  await page.addInitScript(() => {
    document.addEventListener('click', (e) => {
      const target = e.target;
      window.logClick({
        tagName: target.tagName,
        text: target.textContent?.trim().substring(0, 80) || '',
        className: target.className || '',
        id: target.id || '',
        ariaLabel: target.getAttribute('aria-label') || '',
        testId: target.getAttribute('data-testid') || ''
      });
    }, true);
  });

  console.log('[DEBUG] Opening Firefly in interactive mode...');
  console.log('[DEBUG] Please manually:');
  console.log('  1. Expand General settings');
  console.log('  2. Click on the Model selector');
  console.log('  3. Click on "Flux 1.1 Pro" if available');
  console.log('  4. Try to find the Aspect Ratio selector');
  console.log('  5. All your clicks will be logged here\n');
  console.log('[DEBUG] Press Ctrl+C in this terminal when done.\n');

  await page.goto('https://firefly.adobe.com/generate/images', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  // Take periodic screenshots
  let screenshotCount = 0;
  const screenshotInterval = setInterval(async () => {
    screenshotCount++;
    await page.screenshot({
      path: `./data/interactive-debug-${screenshotCount}.png`,
      fullPage: true
    });
    console.log(`[AUTO-SCREENSHOT] Saved: ./data/interactive-debug-${screenshotCount}.png`);
  }, 10000); // Every 10 seconds

  // Keep browser open indefinitely
  await new Promise(() => {});
}

interactiveDebug().catch(console.error);
