#!/usr/bin/env node
import { chromium } from 'playwright';

async function smartRecorder() {
  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome'
  });

  const context = await browser.newContext({
    storageState: './data/storageState.json',
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  const clicks = [];
  let clickNum = 0;

  console.log('\n' + '='.repeat(80));
  console.log('SMART CLICK RECORDER - Capturing DOM paths');
  console.log('='.repeat(80));
  console.log('\nClick sequence to perform:');
  console.log('  1. Firefly 5 banner (and any arrow/button to enable)');
  console.log('  2. Model selector');
  console.log('  3. Select "Flux 1.1 Pro" or your desired model');
  console.log('  4. Aspect ratio dropdown (if available)');
  console.log('  5. Select "1:1" or your desired ratio');
  console.log('\nI will generate the exact Playwright code for each click.\n');
  console.log('='.repeat(80) + '\n');

  // Enhanced click tracking with DOM path
  await page.exposeFunction('recordClick', (clickData) => {
    clickNum++;
    console.log(`\n${'='.repeat(80)}`);
    console.log(`CLICK #${clickNum}: ${clickData.tagName}`);
    console.log('='.repeat(80));
    console.log(`Text: ${clickData.text}`);
    console.log(`Tag: ${clickData.tagName}`);
    console.log(`ID: ${clickData.id || '(none)'}`);
    console.log(`Class: ${clickData.className || '(none)'}`);
    console.log(`aria-label: ${clickData.ariaLabel || '(none)'}`);
    console.log(`data-testid: ${clickData.testId || '(none)'}`);
    console.log(`\nSELECTOR: ${clickData.selector}`);
    console.log(`\nPLAYWRIGHT CODE:`);
    console.log(`  await page.locator('${clickData.selector}').first().click();`);
    console.log('='.repeat(80));

    clicks.push(clickData);
  });

  await page.addInitScript(() => {
    function getSelector(el) {
      // Generate best selector for element
      if (el.id) return `#${el.id}`;
      if (el.getAttribute('data-testid')) return `[data-testid="${el.getAttribute('data-testid')}"]`;
      if (el.tagName.toLowerCase() === 'firefly-link-info-card') return 'firefly-link-info-card';
      if (el.tagName.toLowerCase() === 'sp-picker') return 'sp-picker';
      if (el.tagName.toLowerCase() === 'sp-menu-item') {
        const text = el.textContent?.trim();
        if (text) return `sp-menu-item:has-text("${text.substring(0, 30)}")`;
        return 'sp-menu-item';
      }

      // Try by text for clickable elements
      const text = el.textContent?.trim();
      if (text && text.length < 50 && (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button')) {
        return `button:has-text("${text}")`;
      }

      // Fallback to tag + class
      const firstClass = el.className?.split(' ')[0];
      if (firstClass) return `${el.tagName.toLowerCase()}.${firstClass}`;

      return el.tagName.toLowerCase();
    }

    document.addEventListener('click', (e) => {
      const el = e.target;
      window.recordClick({
        tagName: el.tagName,
        text: (el.textContent || '').trim().substring(0, 80),
        id: el.id || '',
        className: el.className || '',
        ariaLabel: el.getAttribute('aria-label') || '',
        testId: el.getAttribute('data-testid') || '',
        selector: getSelector(el)
      });
    }, true);
  });

  await page.goto('https://firefly.adobe.com/generate/images', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  await page.waitForTimeout(5000);

  // Auto-screenshot after clicks
  let screenshotNum = 0;
  await page.exposeFunction('takeScreenshot', async () => {
    screenshotNum++;
    const path = `./data/smart-rec-${screenshotNum}.png`;
    await page.screenshot({ path, fullPage: false });
    console.log(`\n[SCREENSHOT ${screenshotNum}] ${path}\n`);
  });

  await page.evaluate(() => {
    let timeout;
    document.addEventListener('click', () => {
      clearTimeout(timeout);
      timeout = setTimeout(() => window.takeScreenshot(), 800);
    }, true);
  });

  console.log('✓ Ready. Start clicking now.\n');

  // When done, generate code
  process.on('SIGINT', () => {
    console.log('\n\n' + '='.repeat(80));
    console.log('GENERATING PLAYWRIGHT CODE');
    console.log('='.repeat(80) + '\n');

    clicks.forEach((click, i) => {
      console.log(`// Step ${i + 1}: Click ${click.tagName} - "${click.text.substring(0, 40)}"`);
      console.log(`await page.locator('${click.selector}').first().click();`);
      console.log(`await page.waitForTimeout(1000);\n`);
    });

    console.log('='.repeat(80) + '\n');
    process.exit(0);
  });

  await new Promise(() => {});
}

smartRecorder().catch(console.error);
