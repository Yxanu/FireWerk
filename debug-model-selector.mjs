#!/usr/bin/env node
/**
 * Debug script to capture the model selector dropdown
 */

import { chromium } from 'playwright';
import fs from 'fs/promises';

async function debugModelSelector() {
  console.log('🔍 Debugging model selector...\n');

  const browser = await chromium.launch({ headless: false });

  const contextOptions = { viewport: { width: 1366, height: 900 } };

  // Try to load storage state
  try {
    await fs.access('./data/storageState.json');
    contextOptions.storageState = './data/storageState.json';
    console.log('[INFO] Using storage state from ./data/storageState.json');
  } catch {
    console.log('[INFO] No storage state found');
  }

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  try {
    // Navigate to Firefly
    console.log('[INFO] Navigating to Firefly...');
    await page.goto('https://firefly.adobe.com/generate/images', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForTimeout(8000);

    // Dismiss cookie banner
    try {
      const consentButton = page.locator('#onetrust-accept-btn-handler, button:has-text("Accept"), button:has-text("Enable all")').first();
      if (await consentButton.isVisible({ timeout: 2000 })) {
        await consentButton.click({ force: true });
        console.log('[INFO] Dismissed cookie consent banner');
        await page.waitForTimeout(1000);
      }
    } catch {}

    // Wait for the page to load
    await page.waitForTimeout(3000);

    // Take screenshot of initial state
    await page.screenshot({ path: './data/debug-model-initial.png', fullPage: true });
    console.log('[INFO] Screenshot saved: ./data/debug-model-initial.png');

    // Try to find and click the model selector
    console.log('[INFO] Looking for model selector...');

    const modelButtonSelectors = [
      page.getByRole('button', { name: /firefly image|model|flux|gemini|imagen|ideogram|gpt|runway/i }),
      page.locator('button[aria-label*="model"], button[aria-label*="Modell"]'),
      page.locator('button:has-text("Firefly Image")'),
      page.locator('button:has-text("Ideogram")'),
    ];

    let modelButton = null;
    for (const selector of modelButtonSelectors) {
      try {
        const btn = selector.first();
        if (await btn.isVisible({ timeout: 2000 })) {
          modelButton = btn;
          console.log('[INFO] Found model selector button');
          break;
        }
      } catch {}
    }

    if (!modelButton) {
      console.log('[WARN] Could not find model selector button');

      // Try to extract all buttons on the page
      const buttons = await page.evaluate(() => {
        const allButtons = Array.from(document.querySelectorAll('button'));
        return allButtons.map(btn => ({
          text: btn.textContent?.trim().substring(0, 50),
          ariaLabel: btn.getAttribute('aria-label'),
          class: btn.className
        })).slice(0, 30);
      });

      console.log('\n[DEBUG] First 30 buttons found on page:');
      buttons.forEach((btn, i) => {
        console.log(`  ${i + 1}. "${btn.text}" | aria-label: "${btn.ariaLabel}" | class: "${btn.class}"`);
      });
    } else {
      // Click to open the model menu
      await modelButton.click();
      console.log('[INFO] Clicked model selector button');
      await page.waitForTimeout(2000);

      // Take screenshot of dropdown
      await page.screenshot({ path: './data/debug-model-dropdown.png', fullPage: true });
      console.log('[INFO] Screenshot saved: ./data/debug-model-dropdown.png');

      // Extract all available model options
      const models = await page.evaluate(() => {
        const allText = Array.from(document.querySelectorAll('[role="menu"] *, [role="listbox"] *, .menu *, .dropdown *'));
        const modelTexts = new Set();

        allText.forEach(el => {
          const text = el.textContent?.trim();
          if (text && text.length > 2 && text.length < 100 &&
              (text.toLowerCase().includes('firefly') ||
               text.toLowerCase().includes('flux') ||
               text.toLowerCase().includes('imagen') ||
               text.toLowerCase().includes('ideogram') ||
               text.toLowerCase().includes('gemini') ||
               text.toLowerCase().includes('gpt') ||
               text.toLowerCase().includes('runway'))) {
            modelTexts.add(text);
          }
        });

        return Array.from(modelTexts);
      });

      console.log('\n[INFO] Available models found:');
      models.forEach((model, i) => {
        console.log(`  ${i + 1}. "${model}"`);
      });
    }

    console.log('\n[INFO] Waiting 10 seconds for inspection...');
    await page.waitForTimeout(10000);

  } catch (err) {
    console.error('[ERROR]', err.message);
  } finally {
    await browser.close();
  }
}

debugModelSelector();
