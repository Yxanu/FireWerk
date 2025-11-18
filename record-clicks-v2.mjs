#!/usr/bin/env node
import { chromium } from 'playwright';

async function recordClicks() {
  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome',
    slowMo: 500
  });

  const context = await browser.newContext({
    storageState: './data/storageState.json',
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  let clickCount = 0;
  let screenshotCount = 0;

  console.log('\n' + '='.repeat(80));
  console.log('CLICK RECORDER v2 - Ready to record your clicks');
  console.log('='.repeat(80));
  console.log('\nIMPORTANT: Please click in this order:');
  console.log('  1. Firefly Image 5 (preview) banner/badge');
  console.log('  2. Model selector (sp-picker)');
  console.log('  3. GPT Image (or your desired model)');
  console.log('  4. Aspect ratio button');
  console.log('  5. 1:1 option');
  console.log('\nAll clicks will be logged with detailed element information.');
  console.log('Screenshots will be saved after each click.\n');
  console.log('='.repeat(80) + '\n');

  // Set up click listener
  await page.exposeFunction('logClickDetails', (details) => {
    clickCount++;
    console.log('\n' + '-'.repeat(80));
    console.log(`CLICK #${clickCount}`);
    console.log('-'.repeat(80));
    console.log(`Element: ${details.tagName}${details.id ? '#' + details.id : ''}${details.className ? '.' + details.className.split(' ')[0] : ''}`);
    console.log(`Tag Name: ${details.tagName}`);
    console.log(`ID: ${details.id || '(none)'}`);
    console.log(`Class: ${details.className || '(none)'}`);
    console.log(`Text Content: ${details.text}`);
    console.log(`aria-label: ${details.ariaLabel || '(none)'}`);
    console.log(`data-testid: ${details.testId || '(none)'}`);
    console.log(`Type: ${details.type || '(none)'}`);
    console.log(`Role: ${details.role || '(none)'}`);
    console.log(`Label: ${details.label || '(none)'}`);

    // Generate selector suggestions
    console.log('\nSuggested selectors:');
    if (details.id) {
      console.log(`  - page.locator('#${details.id}')`);
    }
    if (details.testId) {
      console.log(`  - page.getByTestId('${details.testId}')`);
    }
    if (details.ariaLabel) {
      console.log(`  - page.getByLabel('${details.ariaLabel}')`);
    }
    if (details.role) {
      console.log(`  - page.getByRole('${details.role}')`);
    }
    if (details.className) {
      const firstClass = details.className.split(' ')[0];
      console.log(`  - page.locator('.${firstClass}')`);
    }
    console.log(`  - page.locator('${details.tagName.toLowerCase()}')`);
    if (details.text && details.text.length < 50) {
      console.log(`  - page.locator('text=${details.text}')`);
    }
    console.log('-'.repeat(80));
  });

  // Inject click tracking
  await page.addInitScript(() => {
    document.addEventListener('click', (e) => {
      const el = e.target;
      window.logClickDetails({
        tagName: el.tagName,
        id: el.id || '',
        className: el.className || '',
        text: (el.textContent || '').trim().substring(0, 100),
        ariaLabel: el.getAttribute('aria-label') || '',
        testId: el.getAttribute('data-testid') || '',
        type: el.getAttribute('type') || '',
        role: el.getAttribute('role') || '',
        label: el.getAttribute('label') || ''
      });
    }, true);
  });

  // Navigate to page
  await page.goto('https://firefly.adobe.com/generate/images', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  await page.waitForTimeout(5000);

  // Take initial screenshot
  screenshotCount++;
  await page.screenshot({
    path: `./data/click-rec-${screenshotCount}-initial.png`,
    fullPage: false // Don't use fullPage to avoid blank screenshots
  });
  console.log(`[SCREENSHOT ${screenshotCount}] Saved: ./data/click-rec-${screenshotCount}-initial.png`);

  // Auto-screenshot after clicks
  let screenshotTimeout;
  await page.exposeFunction('takeAutoScreenshot', async () => {
    clearTimeout(screenshotTimeout);
    screenshotTimeout = setTimeout(async () => {
      screenshotCount++;
      const path = `./data/click-rec-${screenshotCount}-after-click-${clickCount}.png`;
      await page.screenshot({ path, fullPage: false });
      console.log(`\n[SCREENSHOT ${screenshotCount}] Saved: ${path}\n`);
    }, 800);
  });

  await page.evaluate(() => {
    document.addEventListener('click', () => {
      window.takeAutoScreenshot();
    }, true);
  });

  console.log('\n✓ Browser ready. Start clicking now.\n');

  // Keep browser open
  await new Promise(() => {});
}

recordClicks().catch(console.error);
