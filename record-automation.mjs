#!/usr/bin/env node
import { chromium } from 'playwright';
import fs from 'fs/promises';

async function recordAutomation() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized']
  });

  const context = await browser.newContext({
    viewport: null,
    storageState: './data/storageState.json'
  });

  const page = await context.newPage();
  let stepCounter = 0;

  // Helper to take screenshot and log
  const screenshot = async (description) => {
    stepCounter++;
    const filename = `./data/record/step-${String(stepCounter).padStart(3, '0')}-${description.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.png`;
    await page.screenshot({ path: filename, fullPage: true });
    console.log(`[${stepCounter}] ${description}`);
    console.log(`    Screenshot: ${filename}`);
  };

  try {
    // Create output directory
    await fs.mkdir('./data/record', { recursive: true });

    console.log('\n=== RECORDING AUTOMATION ===\n');

    // Navigate to page
    await page.goto('https://firefly.adobe.com/generate/image', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(3000);
    await screenshot('initial-page-load');

    // Wait for textarea
    const promptBox = page.locator('textarea').first();
    await promptBox.waitFor({ timeout: 15000, state: 'visible' });
    await screenshot('textarea-ready');

    // TRY TO SELECT MODEL: Ideogram 3.0
    console.log('\n=== SELECTING MODEL: Ideogram 3.0 ===\n');

    // Find model picker
    const modelPicker = page.locator('sp-picker').first();
    await screenshot('before-click-model-picker');

    // Click model picker
    await modelPicker.click();
    await page.waitForTimeout(1500);
    await screenshot('after-click-model-picker-dropdown-should-be-open');

    // Try to find and click Ideogram 3.0
    try {
      const ideogramOption = page.locator('sp-menu-item:has-text("Ideogram 3.0")').first();
      await ideogramOption.waitFor({ timeout: 3000, state: 'visible' });
      await screenshot('found-ideogram-option');

      await ideogramOption.click();
      await page.waitForTimeout(2000);
      await screenshot('after-click-ideogram-option');
    } catch (err) {
      await screenshot('FAILED-to-find-ideogram-option');
      console.log(`ERROR: ${err.message}`);
    }

    // Check what model is selected
    const selectedModelText = await modelPicker.textContent();
    console.log(`\nSelected model shows: "${selectedModelText.trim().split('\n')[0]}"`);
    await screenshot('final-model-selection-state');

    // TRY TO SELECT ASPECT RATIO
    console.log('\n=== SELECTING ASPECT RATIO: Square (1:1) ===\n');

    // Get all pickers, aspect ratio is typically second
    const allPickers = await page.locator('sp-picker').all();
    console.log(`Found ${allPickers.length} sp-picker elements`);

    if (allPickers.length > 1) {
      const aspectRatioPicker = allPickers[1];
      await screenshot('before-click-aspect-ratio-picker');

      await aspectRatioPicker.click({ force: true });
      await page.waitForTimeout(1000);
      await screenshot('after-click-aspect-ratio-picker');

      try {
        const squareOption = page.locator('sp-menu-item:has-text("Square (1:1)")').first();
        await squareOption.waitFor({ timeout: 3000, state: 'visible' });
        await screenshot('found-square-option');

        await squareOption.click();
        await page.waitForTimeout(500);
        await screenshot('after-click-square-option');
      } catch (err) {
        await screenshot('FAILED-to-find-square-option');
        console.log(`ERROR: ${err.message}`);
      }
    }

    // FILL PROMPT
    console.log('\n=== FILLING PROMPT ===\n');
    await promptBox.click();
    await page.waitForTimeout(500);
    await screenshot('before-fill-prompt');

    await promptBox.fill('Test prompt: a beautiful mountain landscape');
    await page.waitForTimeout(1000);
    await screenshot('after-fill-prompt');

    // GENERATE
    console.log('\n=== CLICKING GENERATE ===\n');
    await screenshot('before-click-generate');

    // Try multiple selectors for the generate button
    const generateSelectors = [
      page.getByTestId('generate-button'),
      page.getByRole('button', { name: /generate/i }),
      page.locator('button:has-text("Generate")'),
      page.locator('button[aria-label*="Generate"]')
    ];

    let clicked = false;
    for (const selector of generateSelectors) {
      try {
        await selector.click({ timeout: 3000 });
        clicked = true;
        console.log('Generated clicked successfully');
        break;
      } catch {}
    }

    if (!clicked) {
      console.log('Could not click generate with any selector, trying keyboard');
      await page.keyboard.press('Meta+Enter');
    }

    await page.waitForTimeout(2000);
    await screenshot('after-click-generate-button');

    await page.waitForTimeout(15000);
    await screenshot('after-15-second-wait-for-generation');

    console.log('\n=== RECORDING COMPLETE ===');
    console.log(`\nTotal steps: ${stepCounter}`);
    console.log('Review screenshots in ./data/record/\n');

    // Keep browser open
    await page.waitForTimeout(30000);

  } catch (err) {
    console.error('Error:', err);
    await screenshot('ERROR-state');
  } finally {
    await browser.close();
  }
}

recordAutomation();
