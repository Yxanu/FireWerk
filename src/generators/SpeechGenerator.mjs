import { BaseGenerator } from './BaseGenerator.mjs';
import fs from 'fs/promises';
import path from 'path';

export class SpeechGenerator extends BaseGenerator {
  constructor(config = {}) {
    super({
      url: 'https://firefly.adobe.com/generate/speech',
      waitAfterClick: Number(process.env.POST_CLICK_WAIT_MS || 10000),
      ...config
    });
  }

  async generate(prompts, email = process.env.FIREFLY_EMAIL || 'web@adam-medien.de') {
    await this.init();
    await this.page.goto(this.config.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await this.page.waitForTimeout(5000);

    await this.dismissCookieBanner();

    // Check if login is needed
    const isLoggedIn = await this.checkLogin();
    if (!isLoggedIn) {
      await this.login(email);
    }

    // Ensure output directory exists
    await this.ensureDir(this.config.outputDir);

    // Process each prompt
    for (let i = 0; i < prompts.length; i++) {
      const item = prompts[i];
      const id = item.prompt_id || item.id || `speech_${Math.random().toString(36).slice(2,8)}`;
      console.log(`\n[INFO] 🎙️  Speech: ${id}`);

      // Reload page before each prompt (except first) to clear old audio history
      if (i > 0) {
        console.log('[DEBUG] Reloading page to clear previous audio...');
        await this.page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
        await this.page.waitForTimeout(3000);
        await this.dismissCookieBanner();
      }

      // Find and fill the text input for speech
      console.log('[DEBUG] Looking for text input field...');

      // Try multiple selector strategies
      let textInput = null;
      const selectors = [
        'textarea',
        'textarea.spectrum-Textfield-input',
        '[contenteditable="true"]',
        'input[type="text"]',
        '[role="textbox"]',
        '[placeholder*="text" i], [placeholder*="prompt" i]'
      ];

      for (const selector of selectors) {
        try {
          console.log(`[DEBUG] Trying selector: ${selector}`);
          const element = this.page.locator(selector).first();
          await element.waitFor({ timeout: 3000, state: 'visible' });
          textInput = element;
          console.log(`[DEBUG] Found text input with selector: ${selector}`);
          break;
        } catch (err) {
          console.log(`[DEBUG] Selector ${selector} failed: ${err.message}`);
        }
      }

      if (!textInput) {
        // Debug: show what's actually on the page
        console.log('[ERROR] Could not find text input. Page content:');
        const pageText = await this.page.evaluate(() => document.body.innerText);
        console.log(pageText.substring(0, 500));
        throw new Error('Text input not found on speech page');
      }

      await textInput.click();
      await this.page.waitForTimeout(500);
      await textInput.fill('');
      await textInput.fill(item.text);
      console.log(`[DEBUG] Filled text: ${item.text.substring(0, 80)}...`);
      await this.page.waitForTimeout(1000);

      // Select voice if specified
      if (item.voice) {
        try {
          // Look for voice selector dropdown
          const voiceSelector = this.page.locator('[aria-label*="Voice"], [data-testid*="voice"]').first();
          await voiceSelector.click({ timeout: 2000 });
          await this.page.getByText(item.voice, { exact: false }).first().click({ timeout: 2000 });
          console.log(`[INFO] Selected voice: ${item.voice}`);
          await this.page.waitForTimeout(500);
        } catch (err) {
          console.log(`[WARN] Could not select voice: ${err.message}`);
        }
      }

      // Set language if specified
      if (item.language) {
        try {
          const langSelector = this.page.locator('[aria-label*="Language"], [data-testid*="language"]').first();
          await langSelector.click({ timeout: 2000 });
          await this.page.getByText(item.language, { exact: false }).first().click({ timeout: 2000 });
          console.log(`[INFO] Selected language: ${item.language}`);
          await this.page.waitForTimeout(500);
        } catch (err) {
          console.log(`[WARN] Could not select language: ${err.message}`);
        }
      }

      // Find and click the generate/create button
      console.log('[DEBUG] Looking for generate button...');

      let generateBtn = null;
      const buttonSelectors = [
        'button:has-text("Generate")',
        'button:has-text("Create")',
        'button[type="submit"]',
        '[role="button"]:has-text("Generate")',
        '[role="button"]:has-text("Create")',
        'button.spectrum-Button--cta',
        'button[aria-label*="Generate" i]',
        'button[aria-label*="Create" i]'
      ];

      for (const selector of buttonSelectors) {
        try {
          console.log(`[DEBUG] Trying button selector: ${selector}`);
          const button = this.page.locator(selector).first();
          await button.waitFor({ timeout: 2000, state: 'visible' });
          generateBtn = button;
          console.log(`[DEBUG] Found generate button with selector: ${selector}`);
          break;
        } catch (err) {
          console.log(`[DEBUG] Button selector ${selector} failed`);
        }
      }

      if (!generateBtn) {
        // Debug: show all buttons on the page
        console.log('[ERROR] Could not find generate button. Available buttons:');
        const buttonTexts = await this.page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button, [role="button"]'));
          return buttons.slice(0, 10).map(b => ({
            text: b.textContent?.trim().substring(0, 50),
            aria: b.getAttribute('aria-label'),
            type: b.tagName
          }));
        });
        console.log(JSON.stringify(buttonTexts, null, 2));
        throw new Error('Generate button not found on speech page');
      }

      // Dismiss cookie banner before clicking
      await this.dismissCookieBanner();

      // Click generate button
      console.log('[DEBUG] Clicking generate button...');
      await generateBtn.scrollIntoViewIfNeeded();
      await this.page.waitForTimeout(500);
      await generateBtn.click({ force: true });
      console.log('[DEBUG] Generate button clicked');

      console.log(`[INFO] Waiting ${this.config.waitAfterClick/1000}s for speech generation...`);
      await this.page.waitForTimeout(this.config.waitAfterClick);

      // Capture the generated audio
      await this.captureAudio(id);

      await this.page.waitForTimeout(2000);
    }

    console.log('\n✅ All speech prompts processed');
  }

  async captureAudio(id) {
    console.log('[INFO] Waiting for audio generation to complete...');

    try {
      // Dismiss credit dialog first if present
      try {
        const creditDialog = this.page.locator('[data-testid="credit-cost-dialog"]');
        if (await creditDialog.isVisible({ timeout: 2000 })) {
          console.log('[DEBUG] Credit dialog detected, dismissing...');

          const closeButtonSelectors = [
            '[data-testid="credit-cost-dialog"] button[aria-label*="close" i]',
            '[data-testid="credit-cost-dialog"] button[aria-label*="dismiss" i]',
            '[data-testid="credit-cost-dialog"] sp-button:has-text("Got it")',
            '[data-testid="credit-cost-dialog"] sp-button:has-text("OK")',
            '[data-testid="credit-cost-dialog"] button:has-text("Got it")',
            '[data-testid="credit-cost-dialog"] button:has-text("OK")',
            '[data-testid="credit-cost-dialog"] [role="button"]'
          ];

          for (const selector of closeButtonSelectors) {
            try {
              const closeBtn = this.page.locator(selector).first();
              await closeBtn.waitFor({ timeout: 1000, state: 'visible' });
              await closeBtn.click();
              await this.page.waitForTimeout(500);
              console.log('[DEBUG] Dialog dismissed');
              break;
            } catch (err) {
              // Try next selector
            }
          }
        }
      } catch (err) {
        console.log('[DEBUG] No credit dialog detected');
      }

      // Wait for audio generation to complete by waiting for NEW audio card to appear
      // The Generate button should become disabled during generation, then a new audio card appears
      console.log('[DEBUG] Waiting for new audio card to appear...');

      // Get count of existing audio cards before waiting
      const initialCardCount = await this.page.locator('[role="listitem"]').count();
      console.log(`[DEBUG] Initial audio cards: ${initialCardCount}`);

      // Wait for a new audio card to appear (count increases)
      // OR wait for the Generate button to become enabled again (generation complete)
      try {
        await this.page.waitForFunction(
          (expectedCount) => {
            const cards = document.querySelectorAll('[role="listitem"]');
            return cards.length > expectedCount;
          },
          initialCardCount,
          { timeout: 30000 }
        );
        console.log('[DEBUG] New audio card detected');
      } catch (err) {
        console.log('[WARN] Timeout waiting for new audio card, continuing anyway...');
      }

      // Give it a moment to fully render
      await this.page.waitForTimeout(2000);

      // Now look for the Download button in the preview/playback area
      console.log('[DEBUG] Looking for Download button...');
      const downloadButtonSelectors = [
        'button:has-text("Download")',
        'sp-button:has-text("Download")',
        '[aria-label*="Download" i]',
        'button:has-text("Herunterladen")',
        'sp-button:has-text("Herunterladen")'
      ];

      let downloadButton = null;
      for (const selector of downloadButtonSelectors) {
        try {
          console.log(`[DEBUG] Trying download button selector: ${selector}`);
          const button = this.page.locator(selector).first();
          await button.waitFor({ timeout: 3000, state: 'visible' });

          const isDisabled = await button.isDisabled().catch(() => false);
          if (isDisabled) {
            console.log(`[DEBUG] Button found but disabled: ${selector}`);
            continue;
          }

          downloadButton = button;
          console.log(`[DEBUG] Found Download button with selector: ${selector}`);
          break;
        } catch (err) {
          console.log(`[DEBUG] Download button selector ${selector} not found`);
        }
      }

      if (!downloadButton) {
        const debugScreenshotPath = path.join(this.config.outputDir, `debug-no-download-${id}.png`);
        await this.page.screenshot({ path: debugScreenshotPath });
        console.log(`[DEBUG] Screenshot saved to ${debugScreenshotPath}`);
        throw new Error('Download button not found in preview area');
      }

      // Click Download button
      console.log('[INFO] Clicking Download button...');
      const downloadPromise = this.page.waitForEvent('download', { timeout: 30000 });
      await downloadButton.scrollIntoViewIfNeeded();
      await this.page.waitForTimeout(500);
      await downloadButton.click();

      console.log('[INFO] Waiting for download...');
      const download = await downloadPromise;

      const suggestedName = download.suggestedFilename();
      const ext = suggestedName.split('.').pop() || 'wav';
      const outPath = path.join(this.config.outputDir, `${this.safeName(id)}.${ext}`);
      await download.saveAs(outPath);
      console.log(`[INFO] 💾 Saved ${path.basename(outPath)}`);

    } catch (err) {
      console.error(`[ERROR] Failed to capture audio: ${err.message}`);
      console.warn(`[WARN] No audio captured for ${id}`);

      try {
        const debugScreenshotPath = path.join(this.config.outputDir, `debug-error-${id}.png`);
        await this.page.screenshot({ path: debugScreenshotPath });
        console.log(`[DEBUG] Error screenshot saved to ${debugScreenshotPath}`);
      } catch (screenshotErr) {
        // Ignore screenshot errors
      }
    }
  }
}
