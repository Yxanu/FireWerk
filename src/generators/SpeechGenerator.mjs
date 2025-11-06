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
    for (const item of prompts) {
      const id = item.prompt_id || item.id || `speech_${Math.random().toString(36).slice(2,8)}`;
      console.log(`\n[INFO] 🎙️  Speech: ${id}`);

      // Find and fill the text input for speech
      const textInput = this.page.locator('textarea, input[type="text"]').first();
      await textInput.waitFor({ timeout: 10000, state: 'visible' });
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
      const generateBtn = this.page.locator('button:has-text("Generate"), button:has-text("Create")').first();

      try {
        await generateBtn.waitFor({ timeout: 5000, state: 'visible' });
        console.log('[INFO] Generate button is ready');
      } catch {
        console.log('[WARN] Generate button not found, trying anyway...');
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
    console.log('[INFO] Looking for generated audio in DOM...');

    try {
      // Wait for audio player or download button
      await this.page.waitForSelector('audio, button:has-text("Download"), a[download]', { timeout: 15000 });

      // Try to find download button
      const downloadBtn = this.page.locator('button:has-text("Download"), a[download]').first();

      if (await downloadBtn.isVisible({ timeout: 2000 })) {
        console.log('[INFO] Found download button, attempting to download...');

        // Set up download handling
        const downloadPromise = this.page.waitForEvent('download');
        await downloadBtn.click();
        const download = await downloadPromise;

        // Save the downloaded file
        const outPath = path.join(this.config.outputDir, `${this.safeName(id)}.${download.suggestedFilename().split('.').pop()}`);
        await download.saveAs(outPath);
        console.log(`[INFO] 💾 Saved ${path.basename(outPath)}`);
        return;
      }

      // If no download button, try to find audio element and extract src
      const audioSrc = await this.page.evaluate(() => {
        const audio = document.querySelector('audio');
        return audio ? audio.src : null;
      });

      if (audioSrc) {
        console.log(`[INFO] Found audio element with src: ${audioSrc.substring(0, 80)}...`);

        if (audioSrc.startsWith('blob:') || audioSrc.startsWith('data:')) {
          // For blob URLs, we need to fetch the content
          const audioBuffer = await this.page.evaluate(async (src) => {
            const response = await fetch(src);
            const blob = await response.blob();
            const arrayBuffer = await blob.arrayBuffer();
            return Array.from(new Uint8Array(arrayBuffer));
          }, audioSrc);

          const buffer = Buffer.from(audioBuffer);
          const outPath = path.join(this.config.outputDir, `${this.safeName(id)}.mp3`);
          await fs.writeFile(outPath, buffer);
          console.log(`[INFO] 💾 Saved ${path.basename(outPath)} (${Math.round(buffer.length/1024)} KB)`);
        } else {
          // Regular HTTP URL - navigate and download
          const response = await this.page.goto(audioSrc);
          const audioBuffer = await response.body();

          const ext = audioSrc.includes('.wav') ? 'wav' : 'mp3';
          const outPath = path.join(this.config.outputDir, `${this.safeName(id)}.${ext}`);
          await fs.writeFile(outPath, audioBuffer);
          console.log(`[INFO] 💾 Saved ${path.basename(outPath)} (${Math.round(audioBuffer.length/1024)} KB)`);

          // Go back
          await this.page.goBack();
        }
      } else {
        console.warn(`[WARN] No audio found for ${id}`);
      }

    } catch (err) {
      console.error(`[ERROR] Failed to capture audio: ${err.message}`);
      console.warn(`[WARN] No audio captured for ${id}`);
    }
  }
}
