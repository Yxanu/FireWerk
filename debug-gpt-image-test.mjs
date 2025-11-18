#!/usr/bin/env node
import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';

async function debugGPTImage() {
  console.log('Starting GPT Image debug session...');
  console.log('Browser will open in visible mode with click recording\n');

  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized']
  });

  const context = await browser.newContext({
    viewport: null,
    storageState: './data/storageState.json'
  });

  const page = await context.newPage();
  let clickCounter = 0;

  // Record all clicks
  await page.exposeFunction('logClick', (target) => {
    clickCounter++;
    console.log(`[CLICK ${clickCounter}] ${target}`);
  });

  await page.addInitScript(() => {
    document.addEventListener('click', (e) => {
      const target = e.target;
      const info = `${target.tagName}${target.id ? '#' + target.id : ''}${target.className ? '.' + target.className.split(' ').join('.') : ''} - "${target.textContent?.substring(0, 50)}"`;
      window.logClick(info);
    }, true);
  });

  // Go to the Adobe Firefly page
  console.log('[1] Navigating to https://firefly.adobe.com/generate/image');
  await page.goto('https://firefly.adobe.com/generate/image', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(5000);
  await page.screenshot({ path: './data/debug-step-1-initial-page.png', fullPage: true });
  console.log('   Screenshot: ./data/debug-step-1-initial-page.png\n');

  // Dismiss cookie banner if present
  try {
    const cookieBanner = page.locator('button:has-text("Accept"), button:has-text("Reject")').first();
    if (await cookieBanner.isVisible({ timeout: 2000 })) {
      await cookieBanner.click();
      await page.waitForTimeout(1000);
      console.log('[2] Dismissed cookie banner\n');
    }
  } catch {}

  // Wait for prompt textarea
  console.log('[3] Waiting for prompt textarea to be ready...');
  const promptBox = page.locator('textarea').first();
  await promptBox.waitFor({ timeout: 15000, state: 'visible' });
  await page.screenshot({ path: './data/debug-step-2-textarea-ready.png', fullPage: true });
  console.log('   Screenshot: ./data/debug-step-2-textarea-ready.png\n');

  // Look for and click Firefly 5 banner to unlock partner models
  console.log('[4] Looking for Firefly 5 banner to unlock partner models...');
  try {
    const firefly5Banner = page.locator('firefly-link-info-card').first();
    if (await firefly5Banner.isVisible({ timeout: 3000 })) {
      console.log('   Found Firefly 5 banner - clicking to unlock partner models...');
      await firefly5Banner.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ path: './data/debug-step-3-after-banner-click.png', fullPage: true });
      console.log('   Screenshot: ./data/debug-step-3-after-banner-click.png\n');
    } else {
      console.log('   Firefly 5 banner not visible\n');
    }
  } catch (err) {
    console.log(`   Error clicking banner: ${err.message}\n`);
  }

  // Find and click model selector
  console.log('[5] Looking for model selector...');

  // Try multiple selectors to find the model picker
  const modelPickerSelectors = [
    '[data-testid="model-version-picker-picker"]',
    '#model-version-picker-id',
    'sp-picker'
  ];

  let modelPicker = null;
  for (const selector of modelPickerSelectors) {
    try {
      const picker = page.locator(selector).first();
      if (await picker.isVisible({ timeout: 2000 })) {
        const text = await picker.textContent();
        if (text.includes('Firefly') || text.includes('Image')) {
          modelPicker = picker;
          console.log(`   Found model picker using: ${selector}`);
          console.log(`   Current text: ${text.trim()}`);
          break;
        }
      }
    } catch {}
  }

  if (!modelPicker) {
    console.log('   ❌ Could not find model picker');
    await page.screenshot({ path: './data/debug-step-4-no-model-picker.png', fullPage: true });
    console.log('   Screenshot: ./data/debug-step-4-no-model-picker.png');
    console.log('\n   Trying to find all sp-picker elements...');

    const allPickers = await page.locator('sp-picker').all();
    console.log(`   Found ${allPickers.length} sp-picker elements`);

    for (let i = 0; i < allPickers.length; i++) {
      const text = await allPickers[i].textContent();
      console.log(`     sp-picker ${i + 1}: "${text.trim()}"`);
    }

    console.log('\n   Browser will remain open - please inspect manually');
    await page.waitForTimeout(300000);
    await browser.close();
    return;
  }

  console.log('   Opening model selector dropdown...');
  await modelPicker.click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: './data/debug-step-4-model-dropdown-open.png', fullPage: true });
  console.log('   Screenshot: ./data/debug-step-4-model-dropdown-open.png');

  // Get all available models
  const models = await page.evaluate(() => {
    const items = document.querySelectorAll('sp-menu-item');
    return Array.from(items).map(item => ({
      text: item.textContent?.trim(),
      testId: item.getAttribute('data-testid'),
      visible: item.offsetParent !== null
    }));
  });

  console.log('\n   Available models in dropdown:');
  models.forEach((model, i) => {
    console.log(`     ${i + 1}. "${model.text}" (testid: ${model.testId || 'none'})`);
  });
  console.log('');

  // Try to find and click GPT Image
  console.log('[6] Looking for GPT Image in the model list...');
  try {
    // Try multiple selectors
    const selectors = [
      'sp-menu-item:has-text("GPT Image")',
      'sp-menu-item:has-text("GPT")',
      '[data-testid*="gpt"]',
      'text="GPT Image"'
    ];

    let found = false;
    for (const selector of selectors) {
      try {
        const option = page.locator(selector).first();
        if (await option.isVisible({ timeout: 1000 })) {
          console.log(`   Found GPT Image using selector: ${selector}`);
          await option.click();
          found = true;
          await page.waitForTimeout(2000);
          await page.screenshot({ path: './data/debug-step-5-gpt-image-selected.png', fullPage: true });
          console.log('   Screenshot: ./data/debug-step-5-gpt-image-selected.png\n');
          break;
        }
      } catch {}
    }

    if (!found) {
      console.log('   ❌ GPT Image not found in model dropdown');
      console.log('   This suggests GPT Image may not be available or has a different name\n');
    }
  } catch (err) {
    console.log(`   Error selecting GPT Image: ${err.message}\n`);
  }

  // Check current UI state
  console.log('[7] Analyzing current UI state...');
  const uiState = await page.evaluate(() => {
    const modelPicker = document.querySelector('[data-testid="model-version-picker-picker"]');
    const aspectRatioPicker = document.querySelector('[data-testid="aspect-ratio-picker-picker"]');

    return {
      selectedModel: modelPicker?.textContent?.trim() || 'unknown',
      aspectRatioVisible: aspectRatioPicker?.offsetParent !== null,
      aspectRatioText: aspectRatioPicker?.textContent?.trim() || 'none'
    };
  });

  console.log(`   Current model: ${uiState.selectedModel}`);
  console.log(`   Aspect ratio controls visible: ${uiState.aspectRatioVisible}`);
  if (uiState.aspectRatioVisible) {
    console.log(`   Current aspect ratio: ${uiState.aspectRatioText}`);
  }
  console.log('');

  console.log('='.repeat(80));
  console.log('Debug session complete. Browser will remain open for manual inspection.');
  console.log('Press Ctrl+C to close the browser and exit.');
  console.log('='.repeat(80));

  // Keep browser open for inspection
  await page.waitForTimeout(300000); // 5 minutes
  await browser.close();
}

debugGPTImage().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
