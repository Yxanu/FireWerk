import { BaseGenerator } from './BaseGenerator.mjs';
import fs from 'fs/promises';
import path from 'path';

export class ImageGenerator extends BaseGenerator {
  constructor(config = {}) {
    super({
      url: 'https://firefly.adobe.com/generate/image',
      waitAfterClick: Number(process.env.POST_CLICK_WAIT_MS || 15000),
      variantsPerPrompt: Number(process.env.VARIANTS_PER_PROMPT || 1),
      captureMode: 'screenshot', // 'screenshot' or 'download'
      ...config
    });
  }

  async generate(prompts, email = process.env.FIREFLY_EMAIL || 'web@adam-medien.de') {
    await this.init();
    await this.page.goto(this.config.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await this.page.waitForTimeout(8000); // Increased from 5s to 8s

    await this.dismissCookieBanner();

    // Check if login is needed
    const isLoggedIn = await this.checkLogin();
    if (!isLoggedIn) {
      await this.login(email);
      // After login, wait longer for the page to fully load
      await this.page.waitForTimeout(5000);
    }

    // Verify prompt textarea is ready
    console.log('[DEBUG] Verifying prompt textarea is ready...');
    const promptBox = this.page.locator('textarea').first();
    await promptBox.waitFor({ timeout: 15000, state: 'visible' }); // Increased timeout
    console.log('[DEBUG] Prompt textarea is visible and ready');

    // Enable all models by clicking Firefly 5 banner FIRST
    // CRITICAL: This must happen BEFORE processing prompts
    await this.enableAllModels();

    // Ensure output directory exists
    await this.ensureDir(this.config.outputDir);

    // Process each prompt
    for (let i = 0; i < prompts.length; i++) {
      const item = prompts[i];
      const id = item.prompt_id || item.id || `item_${Math.random().toString(36).slice(2,8)}`;
      console.log(`\n[INFO] 🪄 Prompt: ${id}`);

      // STEP 1: Select model FIRST (this determines which controls appear)
      if (this.config.model) {
        console.log(`[INFO] Selecting model: ${this.config.model}`);
        await this.selectModel(this.config.model);
        // Wait for UI to update after model selection
        await this.page.waitForTimeout(1500);
      }

      // STEP 2: Set aspect ratio (only appears AFTER model selection for certain models)
      if (item.aspect_ratio) {
        await this.setAspectRatio(item.aspect_ratio, id);
      }

      // STEP 3: Set content type/style if specified
      if (item.style) {
        console.log(`[DEBUG] Attempting to set style to: ${item.style}`);

        let styleSet = false;
        try {
          const styleSelectors = [
            this.page.getByLabel(/content type|style/i),
            this.page.locator('[aria-label*="Content Type"]'),
          ];
          for (const selector of styleSelectors) {
            try {
              await selector.first().click({ timeout: 2000 });
              await this.page.getByText(item.style, { exact: false }).first().click({ timeout: 2000 });
              console.log(`[INFO] ✓ Set content type to ${item.style}`);
              styleSet = true;
              await this.page.waitForTimeout(500);
              break;
            } catch {}
          }
        } catch {}
      }

      // STEP 4: Fill the prompt
      const currentPromptBox = this.page.locator('textarea[placeholder*="Describe"], textarea').first();
      await currentPromptBox.waitFor({ timeout: 10000, state: 'visible' });
      await currentPromptBox.click();
      await this.page.waitForTimeout(500);
      await currentPromptBox.fill('');
      await currentPromptBox.fill(item.prompt_text);
      console.log(`[DEBUG] Filled prompt: ${item.prompt_text.substring(0, 80)}...`);
      await this.page.waitForTimeout(1000);

      // Take screenshot AFTER model selection to show final state before generation
      const beforeGenShot = `./data/debug-before-generation-${this.safeName(id)}.png`;
      await this.page.screenshot({ path: beforeGenShot, fullPage: true });
      console.log(`[DEBUG] Screenshot saved: ${beforeGenShot}`);

      // Wait for generate button to be enabled
      const genBtn = this.page.getByTestId('generate-button');
      try {
        await this.page.waitForFunction(
          () => {
            const btn = document.querySelector('[data-testid="generate-button"]');
            return btn && !btn.hasAttribute('aria-disabled') && btn.getAttribute('aria-disabled') !== 'true';
          },
          { timeout: 10000 }
        );
        console.log('[INFO] Generate button is enabled');
      } catch {
        console.log('[WARN] Generate button may be disabled, trying anyway...');
      }

      // Generate variants
      for (let v = 1; v <= this.config.variantsPerPrompt; v++) {
        // Dismiss cookie banner before clicking
        await this.dismissCookieBanner();
        await this.closeBlockingOverlays();

        // Click generate button - try keyboard shortcut or click
        console.log('[DEBUG] Attempting to trigger generation...');

        const generationStarted = await this.triggerGeneration(id);

        if (!generationStarted) {
          console.log('[WARN] UI did not change after trigger attempts');
          const failureShot = `./data/debug-click-failed-${this.safeName(id)}-${v}.png`;
          await this.page.screenshot({ path: failureShot });
          console.log(`[DEBUG] Saved screenshot: ${failureShot}`);
        } else {
          console.log('[DEBUG] Generation start confirmed');
        }

        console.log(`[INFO] Waiting ${this.config.waitAfterClick/1000}s for image generation...`);
        await this.page.waitForTimeout(this.config.waitAfterClick);

        // Take a debug screenshot after generation wait
        await this.page.screenshot({ path: `./data/debug-after-gen-${this.safeName(id)}-${v}.png` });
        console.log(`[DEBUG] Post-generation screenshot saved to ./data/debug-after-gen-${this.safeName(id)}-${v}.png`);

        // Capture image based on mode
        if (this.config.captureMode === 'download') {
          await this.captureViaDownload(id, v);
        } else {
          await this.captureImage(id, v);
        }

        await this.page.waitForTimeout(1500);
      }

      await this.page.waitForTimeout(2000);

      // Report progress
      if (this.config.onProgress) {
        this.config.onProgress(i + 1);
      }
    }

    console.log('\n✅ All prompts processed');
  }

  async closeBlockingOverlays() {
    // Attempt to close any onboarding or tooltip overlays that steal clicks
    const overlaySelectors = [
      'button[aria-label="Close"]',
      'button:has-text("Dismiss")',
      'button:has-text("Got it")',
      'button:has-text("Continue")',
      'button:has-text("Maybe later")',
      '[data-testid="modal-close"]',
      '[aria-label*="Close"]:not([disabled])'
    ];

    for (let pass = 0; pass < 3; pass++) {
      let closedAny = false;
      for (const selector of overlaySelectors) {
        try {
          const el = this.page.locator(selector).first();
          if (await el.isVisible({ timeout: 500 }).catch(() => false)) {
            await el.click({ force: true });
            await this.page.waitForTimeout(300);
            console.log(`[INFO] Closed blocking overlay via selector: ${selector}`);
            closedAny = true;
          }
        } catch {}
      }

      if (!closedAny) {
        break;
      }
    }
  }

  async triggerGeneration(promptId) {
    const strategies = [
      {
        name: 'Cmd+Enter',
        run: async () => {
          const textarea = this.page.locator('textarea').first();
          await textarea.click();
          await this.page.waitForTimeout(200);
          await this.page.keyboard.press('Meta+Enter');
        }
      },
      {
        name: 'Ctrl+Enter',
        run: async () => {
          const textarea = this.page.locator('textarea').first();
          await textarea.click();
          await this.page.waitForTimeout(200);
          await this.page.keyboard.press('Control+Enter');
        }
      },
      {
        name: 'Playwright click',
        run: async () => {
          const btn = this.page.getByTestId('generate-button');
          await btn.scrollIntoViewIfNeeded();
          await this.page.waitForTimeout(200);
          await btn.click({ force: true });
        }
      },
      {
        name: 'JS element.click',
        run: async () => {
          await this.page.evaluate(() => {
            const btn = document.querySelector('[data-testid="generate-button"]');
            if (btn) {
              btn.click();
            } else {
              throw new Error('Generate button not found for JS click');
            }
          });
        }
      },
      {
        name: 'Pointer events',
        run: async () => {
          await this.page.evaluate(() => {
            const btn = document.querySelector('[data-testid="generate-button"]');
            if (!btn) {
              throw new Error('Generate button not found for pointer events');
            }
            const events = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
            for (const type of events) {
              btn.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
            }
          });
        }
      }
    ];

    for (const strategy of strategies) {
      try {
        console.log(`[DEBUG] Trying generation strategy: ${strategy.name}`);
        await strategy.run();
      } catch (err) {
        console.log(`[WARN] Strategy "${strategy.name}" failed: ${err.message}`);
        continue;
      }

      const started = await this.waitForGenerationStart();
      if (started) {
        console.log(`[INFO] Generation triggered using strategy: ${strategy.name}`);
        await this.page.waitForTimeout(500); // allow UI to switch into generating state
        return true;
      }

      console.log(`[DEBUG] No UI change detected after strategy: ${strategy.name}`);
    }

    console.log(`[WARN] Unable to confirm generation start for prompt ${promptId}`);
    return false;
  }

  async waitForGenerationStart(timeout = 7000) {
    try {
      await this.page.waitForFunction(
        () => {
          const btn = document.querySelector('[data-testid="generate-button"]');
          const btnDisabled = !!(btn && (
            btn.hasAttribute('disabled') ||
            btn.getAttribute('aria-disabled') === 'true' ||
            btn.getAttribute('aria-busy') === 'true'
          ));

          const textChanged = !document.body.innerText.includes('Start generating images');
          const loadingIndicator = document.querySelector('[data-testid*="progress"], [data-testid*="loader"], [data-testid*="spinner"], [class*="loader"], [class*="Spinner"], [class*="Progress"], [data-testid="image-loader"]');

          const generatingCopy = Array.from(document.querySelectorAll('button, span, div'))
            .some(el => /generating|working|creating/i.test(el?.textContent?.trim() || ''));

          return btnDisabled || loadingIndicator || generatingCopy || textChanged;
        },
        { timeout }
      );
      return true;
    } catch {
      return false;
    }
  }

  async captureImage(id, variant) {
    console.log('[INFO] Looking for generated images in DOM...');

    try {
      // Wait for results container to appear - increased timeout
      await this.page.waitForSelector('[data-testid="results-container"], [class*="result"], [class*="ResultsGrid"], img[src*="firefly"]', { timeout: 30000 });

      // Find all large images in the results area
      const images = await this.page.evaluate(() => {
        const candidates = [];

        // Look for images in various potential containers
        const selectors = [
          'img[src^="blob:"]',
          'img[src*="firefly"]',
          '[data-testid*="result"] img',
          '[class*="result"] img',
          '[class*="ResultsGrid"] img'
        ];

        for (const selector of selectors) {
          const imgs = document.querySelectorAll(selector);
          imgs.forEach(img => {
            if (img.naturalWidth > 200 && img.naturalHeight > 200) {
              candidates.push({
                src: img.src,
                width: img.naturalWidth,
                height: img.naturalHeight
              });
            }
          });
        }

        return candidates;
      });

      console.log(`[DEBUG] Found ${images.length} potential result images in DOM`);
      images.forEach(img => {
        console.log(`[DEBUG] Image: ${img.width}x${img.height} - ${img.src.substring(0, 80)}`);
      });

      if (images.length === 0) {
        console.warn(`[WARN] No images found in DOM for ${id} variant ${variant}`);
        return;
      }

      // Take the first large image (most recent generation)
      const targetImg = images[0];

      // If it's a blob URL, screenshot it
      if (targetImg.src.startsWith('blob:') || targetImg.src.startsWith('data:')) {
        console.log('[INFO] Capturing blob/data URL image via screenshot...');

        const imgElement = await this.page.locator(`img[src="${targetImg.src}"]`).first();
        const imgBuffer = await imgElement.screenshot({ type: 'png' });

        const outPath = path.join(this.config.outputDir, `${this.safeName(id)}_${variant}.png`);
        await fs.writeFile(outPath, imgBuffer);
        console.log(`[INFO] 💾 Saved ${path.basename(outPath)} (${Math.round(imgBuffer.length/1024)} KB)`);
      } else {
        // Regular HTTP URL - fetch it
        console.log(`[INFO] Fetching image from: ${targetImg.src}`);
        const response = await this.page.goto(targetImg.src, { waitUntil: 'networkidle' });
        const imgBuffer = await response.body();

        const ct = response.headers()['content-type'] || 'image/png';
        const ext = ct.includes('png') ? 'png' : (ct.includes('webp') ? 'webp' : 'jpg');
        const outPath = path.join(this.config.outputDir, `${this.safeName(id)}_${variant}.${ext}`);
        await fs.writeFile(outPath, imgBuffer);
        console.log(`[INFO] 💾 Saved ${path.basename(outPath)} (${Math.round(imgBuffer.length/1024)} KB)`);

        // Go back to the generation page
        await this.page.goBack();
      }

    } catch (err) {
      console.error(`[ERROR] Failed to capture image from DOM: ${err.message}`);
      console.warn(`[WARN] No image captured for ${id} variant ${variant}`);
    }
  }

  async enableAllModels() {
    console.log('[INFO] Enabling access to all models by clicking Firefly 5 banner...');

    try {
      // SINGLE CLICK on firefly-link-info-card unlocks ALL partner models
      // Based on screenshot evidence from user's recording

      const firefly5Banner = this.page.locator('firefly-link-info-card').first();
      const isBannerVisible = await firefly5Banner.isVisible({ timeout: 3000 }).catch(() => false);

      if (isBannerVisible) {
        console.log('[INFO] Clicking Firefly 5 banner to unlock all partner models...');
        await firefly5Banner.click();
        await this.page.waitForTimeout(2000); // Wait for models to load
        console.log('[INFO] ✓ All partner models unlocked');

        // Take screenshot to verify
        await this.page.screenshot({ path: './data/debug-firefly5-enabled.png', fullPage: false });
        console.log('[DEBUG] Screenshot saved: ./data/debug-firefly5-enabled.png');
        return true;
      } else {
        console.log('[INFO] Firefly 5 banner not visible - partner models may already be enabled');
        return false;
      }
    } catch (err) {
      console.log(`[WARN] Could not click Firefly 5 banner: ${err.message}`);
      // Don't fail - models might already be enabled
      return false;
    }
  }

  async setAspectRatio(aspectRatio, promptId) {
    console.log(`[DEBUG] Attempting to set aspect ratio to: ${aspectRatio}`);

    // Map common aspect ratio formats to UI text
    const aspectRatioMap = {
      '1:1': 'Square (1:1)',
      'square': 'Square (1:1)',
      '4:3': 'Landscape (4:3)',
      'landscape': 'Landscape (4:3)',
      '3:4': 'Portrait (3:4)',
      'portrait': 'Portrait (3:4)',
      '16:9': 'Widescreen (16:9)',
      'widescreen': 'Widescreen (16:9)',
    };

    const targetRatio = aspectRatioMap[aspectRatio.toLowerCase()] || aspectRatio;
    console.log(`[DEBUG] Mapped aspect ratio: "${aspectRatio}" -> "${targetRatio}"`);

    try {
      // Wait for aspect ratio controls to appear (they show after model selection)
      await this.page.waitForTimeout(500);

      // Get all sp-pickers - aspect ratio is typically the second one
      const allPickers = await this.page.locator('sp-picker').all();

      let aspectRatioPicker = null;

      // Try to find the aspect ratio picker by checking text content
      for (const picker of allPickers) {
        const text = await picker.textContent().catch(() => '');
        if (text.includes('Landscape') || text.includes('Square') || text.includes('Portrait') || text.includes('Widescreen')) {
          aspectRatioPicker = picker;
          break;
        }
      }

      if (!aspectRatioPicker) {
        console.log(`[INFO] Aspect ratio controls not available for this model`);
        return false;
      }

      console.log(`[DEBUG] Found aspect ratio sp-picker`);

      // Close any open menus by pressing Escape
      await this.page.keyboard.press('Escape');
      await this.page.waitForTimeout(300);

      // Click to open the aspect ratio dropdown
      await aspectRatioPicker.click({ force: true });
      console.log(`[DEBUG] Clicked aspect ratio dropdown`);

      // Wait for dropdown animation and verify it opened
      await this.page.waitForTimeout(1000);

      // Take screenshot of open aspect ratio dropdown
      await this.page.screenshot({ path: './data/debug-aspect-ratio-dropdown.png', fullPage: true });
      console.log('[DEBUG] Screenshot: ./data/debug-aspect-ratio-dropdown.png');

      // Select the target aspect ratio using sp-menu-item:has-text
      try {
        const option = this.page.locator(`sp-menu-item:has-text("${targetRatio}")`).first();
        await option.waitFor({ timeout: 3000, state: 'visible' });
        console.log(`[DEBUG] Found aspect ratio option: ${targetRatio}`);
        await option.click({ timeout: 2000 });
        console.log(`[INFO] ✓ Set aspect ratio to ${targetRatio}`);
        await this.page.waitForTimeout(500);
        return true;
      } catch (err) {
        console.log(`[WARN] Could not select aspect ratio ${targetRatio}: ${err.message}`);
        return false;
      }

    } catch (err) {
      console.log(`[INFO] Aspect ratio not available for this model: ${err.message}`);
      return false;
    }
  }

  async selectModel(modelName) {
    console.log(`[INFO] Selecting model: ${modelName}`);

    try {
      // Model name mappings for common variations
      const modelNameMap = {
        'Flux 1.1 Pro': 'FLUX1.1 [pro]',
        'flux 1.1 pro': 'FLUX1.1 [pro]',
        'Flux 1.1 Pro Ultra': 'FLUX1.1 [pro] Ultra',
        'Firefly Image 5': 'Firefly Image 5 (preview)',
        'Firefly 5': 'Firefly Image 5 (preview)',
        'GPT Image': 'GPT Image',
        'Imagen 4': 'Imagen 4',
        'Imagen 3': 'Imagen 3',
        'Ideogram 3.0': 'Ideogram 3.0',
        'Firefly Image 3': 'Firefly Image 3',
        'Firefly Image 2': 'Firefly Image 2',
        'Gemini 2.5 (Nano Banana)': 'Nano Banana',
        'Nano Banana': 'Nano Banana',
      };

      const targetModelName = modelNameMap[modelName] || modelName;
      console.log(`[DEBUG] Mapped model name: "${modelName}" -> "${targetModelName}"`);

      // Look for the model sp-picker (first one is the model selector)
      const modelPicker = this.page.locator('sp-picker').first();

      if (!await modelPicker.isVisible({ timeout: 3000 })) {
        console.log('[WARN] Could not find model selector sp-picker');
        return;
      }

      // Click to open the model menu
      await modelPicker.click();
      console.log('[DEBUG] Clicked model selector sp-picker');

      // CRITICAL: Wait for the menu to actually open
      // Verify the menu opened by checking aria-expanded attribute
      try {
        await this.page.waitForFunction(
          () => {
            const picker = document.querySelector('sp-picker');
            return picker && picker.getAttribute('aria-expanded') === 'true';
          },
          { timeout: 3000 }
        );
        console.log('[DEBUG] Model menu is now open (aria-expanded=true)');
      } catch {
        console.log('[WARN] Could not verify menu opened, proceeding anyway...');
      }

      // Wait for dropdown animation to complete
      await this.page.waitForTimeout(1500);

      // Take screenshot of open dropdown
      await this.page.screenshot({ path: './data/debug-model-dropdown-open.png', fullPage: true });
      console.log('[DEBUG] Screenshot saved: ./data/debug-model-dropdown-open.png');

      // Look for the model option using sp-menu-item:has-text selector (most reliable)
      try {
        const option = this.page.locator(`sp-menu-item:has-text("${targetModelName}")`).first();
        await option.waitFor({ timeout: 5000, state: 'visible' });
        console.log(`[DEBUG] Found model option: ${targetModelName}`);
        await option.click({ timeout: 3000 });
        console.log(`[INFO] ✓ Clicked model: ${targetModelName}`);

        // Wait for UI to process model selection and update controls
        await this.page.waitForTimeout(2000);

        console.log(`[INFO] ✓ Model selected: ${targetModelName}`);
      } catch (err) {
        console.log(`[WARN] Could not find model option "${targetModelName}" in dropdown: ${err.message}`);
        // Take a screenshot for debugging
        await this.page.screenshot({ path: `./data/debug-model-not-found-${this.safeName(targetModelName)}.png`, fullPage: true });
        console.log(`[DEBUG] Screenshot saved: ./data/debug-model-not-found-${this.safeName(targetModelName)}.png`);
      }

    } catch (err) {
      console.log(`[WARN] Failed to select model "${modelName}": ${err.message}`);
    }
  }

  async captureViaDownload(id, variant) {
    console.log('[INFO] Capturing image via download button...');

    try {
      // Wait for images to appear - look for blob URLs
      await this.page.waitForSelector('img[src^="blob:"], img[src*="firefly"]', { timeout: 30000 });
      await this.page.waitForTimeout(2000); // Wait for UI to stabilize
      console.log('[DEBUG] Generated images are visible');

      // Hover over the first generated image to reveal download button
      const firstImage = this.page.locator('img[src^="blob:"]').first();
      await firstImage.hover();
      console.log('[DEBUG] Hovering over first generated image');
      await this.page.waitForTimeout(1000);

      // Look for the download button - try multiple selectors
      const downloadSelectors = [
        'sp-action-button[label="Download"]',
        'button[aria-label="Download"]',
        'button[aria-label*="Download"]',
        'sp-action-button:has-text("Download")',
        '[data-testid*="download"]'
      ];

      let downloadBtn = null;
      for (const selector of downloadSelectors) {
        try {
          const btn = this.page.locator(selector).first();
          if (await btn.isVisible({ timeout: 2000 })) {
            downloadBtn = btn;
            console.log(`[DEBUG] Found download button with selector: ${selector}`);
            break;
          }
        } catch {}
      }

      if (!downloadBtn) {
        throw new Error('Download button not found after trying all selectors');
      }

      // Set up download listener before clicking
      const downloadPromise = this.page.waitForEvent('download', { timeout: 30000 });

      // Click the download button
      await downloadBtn.click();
      console.log('[DEBUG] Clicked download button');

      // Wait for download to complete
      const download = await downloadPromise;
      const downloadPath = await download.path();

      if (downloadPath) {
        // Move the downloaded file to our output directory
        const fileName = download.suggestedFilename() || `${this.safeName(id)}_${variant}.jpg`;
        const outPath = path.join(this.config.outputDir, `${this.safeName(id)}_${variant}.jpg`);

        await fs.copyFile(downloadPath, outPath);
        const stats = await fs.stat(outPath);
        console.log(`[INFO] 💾 Saved ${path.basename(outPath)} (${Math.round(stats.size/1024)} KB)`);
      } else {
        console.warn(`[WARN] Download path not available for ${id} variant ${variant}`);
      }

    } catch (err) {
      console.error(`[ERROR] Failed to download image: ${err.message}`);
      console.warn(`[WARN] No image captured for ${id} variant ${variant}`);
    }
  }
}
