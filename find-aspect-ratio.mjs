#!/usr/bin/env node
import { chromium } from 'playwright';

async function findAspectRatio() {
  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome'
  });

  const context = await browser.newContext({
    storageState: './data/storageState.json',
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  try {
    console.log('[DEBUG] Opening Firefly...');
    await page.goto('https://firefly.adobe.com/generate/images', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    await page.waitForTimeout(5000);

    // Take initial screenshot
    await page.screenshot({ path: './data/debug-aspect-1-initial.png', fullPage: true });

    // Expand all collapsible sections to find aspect ratio
    const sectionHeaders = [
      'General settings',
      'Content type',
      'Composition',
      'Style'
    ];

    for (const header of sectionHeaders) {
      try {
        console.log(`[DEBUG] Expanding section: ${header}`);
        const section = page.locator(`text=/^${header}$/i`).first();
        const isVisible = await section.isVisible({ timeout: 2000 }).catch(() => false);

        if (isVisible) {
          await section.click();
          await page.waitForTimeout(500);

          await page.screenshot({
            path: `./data/debug-aspect-2-${header.replace(/\s/g, '-').toLowerCase()}.png`,
            fullPage: true
          });
        }
      } catch (err) {
        console.log(`[WARN] Could not expand ${header}: ${err.message}`);
      }
    }

    // Search for aspect ratio related elements
    console.log('\n[DEBUG] Searching for aspect ratio elements...');

    const searchTerms = [
      'aspect',
      'ratio',
      '1:1',
      '16:9',
      '4:3',
      'square',
      'landscape',
      'portrait',
      'dimensions',
      'size'
    ];

    for (const term of searchTerms) {
      const elements = await page.locator(`text=/${term}/i`).all();
      if (elements.length > 0) {
        console.log(`[DEBUG] Found ${elements.length} elements containing "${term}"`);
        for (let i = 0; i < Math.min(elements.length, 3); i++) {
          const text = await elements[i].textContent().catch(() => '');
          const tag = await elements[i].evaluate(el => el.tagName).catch(() => '');
          console.log(`  [${i}] <${tag}> "${text?.trim().substring(0, 60)}"`);
        }
      }
    }

    // Check if aspect ratio appears after selecting a specific model
    console.log('\n[DEBUG] Checking if aspect ratio appears for different models...');

    // Select Firefly Image 5 (preview) to see if aspect ratio appears
    const modelPicker = page.locator('sp-picker').first();
    if (await modelPicker.isVisible({ timeout: 2000 }).catch(() => false)) {
      await modelPicker.click();
      await page.waitForTimeout(500);

      const fireflyModel = page.getByText('Firefly Image 5 (preview)').first();
      if (await fireflyModel.isVisible({ timeout: 2000 }).catch(() => false)) {
        await fireflyModel.click();
        console.log('[DEBUG] Switched to Firefly Image 5');
        await page.waitForTimeout(1500);

        await page.screenshot({ path: './data/debug-aspect-3-firefly-model.png', fullPage: true });

        // Check again for aspect ratio
        const aspectRatioVisible = await page.locator('text=/aspect.*ratio/i').isVisible({ timeout: 2000 }).catch(() => false);
        console.log(`[DEBUG] Aspect ratio visible with Firefly: ${aspectRatioVisible}`);
      }
    }

    console.log('\n[DEBUG] Search complete. Check ./data/debug-aspect-*.png');
    await page.waitForTimeout(3000);

  } catch (err) {
    console.error('[ERROR]', err);
  } finally {
    await browser.close();
  }
}

findAspectRatio();
