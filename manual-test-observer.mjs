#!/usr/bin/env node
/**
 * Manual test observer - opens Firefly and logs all user interactions
 */

import { chromium } from 'playwright';
import fs from 'fs/promises';

async function observeManualTest() {
  console.log('🔍 Opening Firefly for manual testing...\n');
  console.log('📝 All clicks and interactions will be logged\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 100 // Slow down actions a bit for better observation
  });

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

  // Set up logging for all interactions
  const interactions = [];

  // Log page navigation
  page.on('load', () => {
    console.log(`[PAGE] Loaded: ${page.url()}`);
    interactions.push({ type: 'navigation', url: page.url(), timestamp: Date.now() });
  });

  // Log console messages
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log(`[CONSOLE ERROR] ${msg.text()}`);
    }
  });

  // Set up click tracking
  await page.exposeFunction('logClick', (target) => {
    console.log(`\n[CLICK] ${target.type} - "${target.text}" | ${target.role} | ${target.ariaLabel}`);
    interactions.push({
      type: 'click',
      target,
      timestamp: Date.now(),
      url: page.url()
    });
  });

  await page.addInitScript(() => {
    document.addEventListener('click', (e) => {
      const target = e.target;
      window.logClick({
        type: target.tagName,
        text: target.textContent?.substring(0, 50).trim(),
        role: target.getAttribute('role'),
        ariaLabel: target.getAttribute('aria-label'),
        id: target.id,
        className: target.className?.substring(0, 50)
      });
    }, true);
  });

  try {
    // Navigate to Firefly
    console.log('[INFO] Navigating to Firefly...\n');
    await page.goto('https://firefly.adobe.com/generate/images', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    await page.waitForTimeout(5000);

    // Dismiss cookie banner if present
    try {
      const consentButton = page.locator('#onetrust-accept-btn-handler, button:has-text("Accept"), button:has-text("Enable all")').first();
      if (await consentButton.isVisible({ timeout: 2000 })) {
        await consentButton.click({ force: true });
        console.log('[INFO] Dismissed cookie consent banner\n');
        await page.waitForTimeout(1000);
      }
    } catch {}

    // Take initial screenshot
    await page.screenshot({ path: './data/manual-test-initial.png', fullPage: true });
    console.log('[SCREENSHOT] ./data/manual-test-initial.png\n');

    console.log('✅ Browser is ready for manual testing');
    console.log('👉 Please perform the following steps:');
    console.log('   1. Expand "General settings" if collapsed');
    console.log('   2. Turn OFF "Fast mode" toggle');
    console.log('   3. Click the Model dropdown');
    console.log('   4. Select a model (e.g., Firefly Image 4)');
    console.log('   5. All interactions will be logged below\n');
    console.log('📸 Taking screenshots every 5 seconds...\n');
    console.log('Press Ctrl+C when done\n');
    console.log('='.repeat(60) + '\n');

    // Take screenshots periodically and log state
    let screenshotCount = 0;
    const screenshotInterval = setInterval(async () => {
      try {
        screenshotCount++;
        const filename = `./data/manual-test-step-${screenshotCount}.png`;
        await page.screenshot({ path: filename, fullPage: true });
        console.log(`[SCREENSHOT] ${filename}`);

        // Log current UI state
        const uiState = await page.evaluate(() => {
          // Check Fast mode state
          const fastModeToggle = document.querySelector('input[type="checkbox"][aria-label*="Fast"], input[type="checkbox"] + *:has-text("Fast mode")');
          const fastModeEnabled = fastModeToggle?.checked;

          // Check selected model
          const modelButton = document.querySelector('button:has-text("Firefly Image"), button:has-text("Firefly"), [aria-label*="Model"]');
          const selectedModel = modelButton?.textContent?.trim();

          // Check general settings expanded
          const generalSettings = document.querySelector('text=/General settings/i, *:has-text("General settings")');
          const isExpanded = generalSettings && generalSettings.getAttribute('aria-expanded') !== 'false';

          return { fastModeEnabled, selectedModel, isExpanded };
        });

        console.log(`[STATE] Fast mode: ${uiState.fastModeEnabled ? 'ON' : 'OFF'} | Model: ${uiState.selectedModel} | General settings: ${uiState.isExpanded ? 'EXPANDED' : 'COLLAPSED'}\n`);

      } catch (err) {
        console.log(`[ERROR] Screenshot failed: ${err.message}`);
      }
    }, 5000);

    // Keep browser open until user closes it
    await new Promise((resolve) => {
      process.on('SIGINT', async () => {
        clearInterval(screenshotInterval);
        console.log('\n\n📝 Saving interaction log...');

        // Save all interactions to a file
        await fs.writeFile(
          './data/manual-test-interactions.json',
          JSON.stringify(interactions, null, 2)
        );
        console.log('✅ Saved to ./data/manual-test-interactions.json');

        console.log('\n📊 Summary:');
        console.log(`   Total interactions logged: ${interactions.length}`);
        console.log(`   Screenshots taken: ${screenshotCount}`);

        await browser.close();
        resolve();
      });
    });

  } catch (err) {
    console.error('[ERROR]', err.message);
  }
}

observeManualTest();
