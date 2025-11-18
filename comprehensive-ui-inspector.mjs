#!/usr/bin/env node
import { chromium } from 'playwright';

async function comprehensiveInspect() {
  const browser = await chromium.launch({
    headless: false,
    channel: 'chrome'
  });

  const context = await browser.newContext({
    storageState: './data/storageState.json',
    viewport: { width: 1920, height: 1080 }
  });

  const page = await context.newPage();

  console.log('[INSPECTOR] Opening Firefly and analyzing UI...\n');

  await page.goto('https://firefly.adobe.com/generate/images', {
    waitUntil: 'domcontentloaded',
    timeout: 60000
  });

  await page.waitForTimeout(5000);

  // Take initial screenshot
  await page.screenshot({ path: './data/inspect-1-initial.png', fullPage: true });
  console.log('[SCREENSHOT] ./data/inspect-1-initial.png\n');

  // Ensure General settings is expanded
  console.log('[ACTION] Ensuring General settings is expanded...');
  const generalSettings = page.locator('text=/General settings/i').first();

  // Check if sp-picker is visible (indicates it's expanded)
  let pickerVisible = await page.locator('sp-picker').first().isVisible({ timeout: 2000 }).catch(() => false);

  if (!pickerVisible) {
    console.log('[ACTION] Clicking General settings to expand...');
    await generalSettings.click();
    await page.waitForTimeout(1000);
  }

  await page.screenshot({ path: './data/inspect-2-general-expanded.png', fullPage: true });
  console.log('[SCREENSHOT] ./data/inspect-2-general-expanded.png\n');

  // Inspect all sp-picker elements
  console.log('='.repeat(60));
  console.log('ANALYZING SP-PICKER ELEMENTS');
  console.log('='.repeat(60));

  const pickers = await page.locator('sp-picker').all();
  console.log(`\nFound ${pickers.length} sp-picker elements:\n`);

  for (let i = 0; i < pickers.length; i++) {
    const picker = pickers[i];
    const isVisible = await picker.isVisible().catch(() => false);
    const label = await picker.getAttribute('label').catch(() => '');
    const value = await picker.getAttribute('value').catch(() => '');
    const ariaLabel = await picker.getAttribute('aria-label').catch(() => '');
    const text = await picker.textContent().catch(() => '');

    console.log(`Picker ${i + 1}:`);
    console.log(`  Visible: ${isVisible}`);
    console.log(`  Label: "${label}"`);
    console.log(`  Value: "${value}"`);
    console.log(`  Aria-label: "${ariaLabel}"`);
    console.log(`  Text: "${text?.trim().substring(0, 100)}"`);
    console.log('');
  }

  // Click the FIRST sp-picker (should be model selector)
  console.log('='.repeat(60));
  console.log('OPENING FIRST SP-PICKER (MODEL SELECTOR)');
  console.log('='.repeat(60) + '\n');

  const firstPicker = page.locator('sp-picker').first();
  await firstPicker.click();
  await page.waitForTimeout(1000);

  await page.screenshot({ path: './data/inspect-3-model-dropdown.png', fullPage: true });
  console.log('[SCREENSHOT] ./data/inspect-3-model-dropdown.png\n');

  // List all menu items
  const menuItems = await page.locator('sp-menu-item').all();
  console.log(`Found ${menuItems.length} menu items:\n`);

  for (let i = 0; i < Math.min(menuItems.length, 20); i++) {
    const item = menuItems[i];
    const text = await item.textContent().catch(() => '');
    const value = await item.getAttribute('value').catch(() => '');
    console.log(`  [${i}] "${text?.trim()}" (value: "${value}")`);
  }

  // Close the dropdown
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);

  // Look for GPT Image
  console.log('\n' + '='.repeat(60));
  console.log('SEARCHING FOR GPT IMAGE');
  console.log('='.repeat(60) + '\n');

  await firstPicker.click();
  await page.waitForTimeout(500);

  const gptImage = page.getByText('GPT Image', { exact: false });
  const gptImageExists = await gptImage.isVisible({ timeout: 2000 }).catch(() => false);
  console.log(`GPT Image found: ${gptImageExists}`);

  if (gptImageExists) {
    console.log('[ACTION] Clicking GPT Image...');
    await gptImage.first().click();
    await page.waitForTimeout(1000);

    await page.screenshot({ path: './data/inspect-4-gpt-selected.png', fullPage: true });
    console.log('[SCREENSHOT] ./data/inspect-4-gpt-selected.png\n');
  }

  // Look for aspect ratio controls
  console.log('='.repeat(60));
  console.log('SEARCHING FOR ASPECT RATIO CONTROLS');
  console.log('='.repeat(60) + '\n');

  const aspectSelectors = [
    { name: 'Button with "aspect"', selector: page.locator('button:has-text("aspect")') },
    { name: 'Button with "ratio"', selector: page.locator('button:has-text("ratio")') },
    { name: 'Button with "1:1"', selector: page.locator('button:has-text("1:1")') },
    { name: 'Any element with "aspect"', selector: page.locator('*:has-text("aspect")') },
    { name: 'sp-action-button with aspect', selector: page.locator('sp-action-button').filter({ hasText: /aspect|ratio/i }) },
  ];

  for (const { name, selector } of aspectSelectors) {
    const count = await selector.count();
    const visible = count > 0 ? await selector.first().isVisible({ timeout: 1000 }).catch(() => false) : false;
    console.log(`${name}: ${count} found, first visible: ${visible}`);

    if (count > 0 && visible) {
      const text = await selector.first().textContent().catch(() => '');
      console.log(`  Text: "${text?.trim()}"`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('INSPECTION COMPLETE');
  console.log('='.repeat(60));
  console.log('\nPlease review the screenshots in ./data/inspect-*.png');
  console.log('Press Ctrl+C to close the browser\n');

  await new Promise(() => {});
}

comprehensiveInspect().catch(console.error);
