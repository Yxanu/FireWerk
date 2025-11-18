#!/usr/bin/env node
import { chromium } from 'playwright';
import fs from 'fs/promises';

async function inspectUI() {
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
    console.log('[DEBUG] Navigating to Firefly...');
    await page.goto('https://firefly.adobe.com/generate/images', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    await page.waitForTimeout(5000);

    console.log('[DEBUG] Step 1: Taking screenshot of initial state');
    await page.screenshot({
      path: './data/debug-ui-step1-initial.png',
      fullPage: true
    });

    // Check if General settings is visible
    const generalSettings = page.locator('text=/General settings/i').first();
    const isVisible = await generalSettings.isVisible({ timeout: 3000 }).catch(() => false);
    console.log(`[DEBUG] General settings visible: ${isVisible}`);

    if (isVisible) {
      // Check if it's expanded or collapsed
      const container = page.locator('text=/General settings/i').locator('..');
      const arrowIcon = container.locator('svg, [class*="icon"]').first();

      console.log('[DEBUG] Step 2: Clicking General settings to expand');
      await generalSettings.click();
      await page.waitForTimeout(1000);

      await page.screenshot({
        path: './data/debug-ui-step2-general-expanded.png',
        fullPage: true
      });
    }

    // Look for model selector
    console.log('[DEBUG] Step 3: Looking for model selector...');
    const modelSelectors = [
      'sp-picker',
      '[aria-label*="model"]',
      '[aria-label*="Model"]',
      'button:has-text("Firefly")',
      'button:has-text("Flux")',
      'select',
      '[class*="model"]',
      '[data-testid*="model"]'
    ];

    for (const selector of modelSelectors) {
      try {
        const elements = await page.locator(selector).all();
        if (elements.length > 0) {
          console.log(`[DEBUG] Found ${elements.length} elements with selector: ${selector}`);
          for (let i = 0; i < elements.length; i++) {
            const text = await elements[i].textContent().catch(() => '');
            const ariaLabel = await elements[i].getAttribute('aria-label').catch(() => '');
            console.log(`  [${i}] Text: "${text?.trim()}" | aria-label: "${ariaLabel}"`);
          }
        }
      } catch (err) {
        // Silent fail
      }
    }

    // Look for aspect ratio selector
    console.log('[DEBUG] Step 4: Looking for aspect ratio selector...');
    const ratioSelectors = [
      'button:has-text("Aspect")',
      'button:has-text("aspect")',
      'button:has-text("ratio")',
      'button:has-text("1:1")',
      '[aria-label*="aspect"]',
      '[aria-label*="ratio"]',
      '[data-testid*="aspect"]',
      '[class*="aspect"]'
    ];

    for (const selector of ratioSelectors) {
      try {
        const elements = await page.locator(selector).all();
        if (elements.length > 0) {
          console.log(`[DEBUG] Found ${elements.length} elements with selector: ${selector}`);
          for (let i = 0; i < elements.length; i++) {
            const text = await elements[i].textContent().catch(() => '');
            const ariaLabel = await elements[i].getAttribute('aria-label').catch(() => '');
            console.log(`  [${i}] Text: "${text?.trim()}" | aria-label: "${ariaLabel}"`);
          }
        }
      } catch (err) {
        // Silent fail
      }
    }

    // Try clicking model selector if found
    console.log('[DEBUG] Step 5: Trying to click model selector...');
    const picker = page.locator('sp-picker').first();
    const pickerVisible = await picker.isVisible({ timeout: 2000 }).catch(() => false);

    if (pickerVisible) {
      console.log('[DEBUG] Found sp-picker, clicking it...');
      await picker.click();
      await page.waitForTimeout(1000);

      await page.screenshot({
        path: './data/debug-ui-step3-model-dropdown.png',
        fullPage: true
      });

      // List available models
      console.log('[DEBUG] Looking for model options in dropdown...');
      const menuItems = await page.locator('sp-menu-item').all();
      console.log(`[DEBUG] Found ${menuItems.length} menu items:`);
      for (let i = 0; i < menuItems.length; i++) {
        const text = await menuItems[i].textContent();
        console.log(`  [${i}] "${text?.trim()}"`);
      }
    } else {
      console.log('[DEBUG] sp-picker not visible');
    }

    console.log('\n[DEBUG] Inspection complete. Check ./data/debug-ui-step*.png for screenshots.');

  } catch (err) {
    console.error('[ERROR]', err);
  } finally {
    await page.waitForTimeout(5000); // Keep browser open for manual inspection
    await browser.close();
  }
}

inspectUI();
