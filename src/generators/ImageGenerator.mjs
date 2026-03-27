import fs from 'fs/promises';
import path from 'path';
import { BaseGenerator } from './BaseGenerator.mjs';
import {
  resolveImageModel,
  validateImageRequest,
  normalizeAspectRatio,
  normalizeStyle
} from '../models/imageModelCatalog.mjs';
import {
  PROMPT_INPUT_SELECTORS,
  MODEL_PICKER_SELECTORS,
  ASPECT_RATIO_PICKER_SELECTORS,
  STYLE_PICKER_SELECTORS,
  GENERATE_BUTTON_SELECTORS,
  RESULT_IMAGE_SELECTORS,
  DOWNLOAD_BUTTON_SELECTORS,
  findFirstVisibleLocator,
  findPickerByHints,
  findOptionByTexts,
  buildModelOptionTexts,
  findPartnerConsentButton
} from './imageSelectors.mjs';
import {
  detectFireflyGeneratePageState,
  FIREFLY_PAGE_STATES
} from './fireflyPageState.mjs';
import { buildOutPath } from '../utils/files.js';
import { RunArtifacts } from '../utils/runArtifacts.mjs';

const ASPECT_RATIO_OPTION_TEXT = {
  '1:1': ['Square (1:1)', 'Square', '1:1'],
  '4:5': ['Portrait (4:5)', 'Portrait', '4:5'],
  '16:9': ['Widescreen (16:9)', 'Landscape', '16:9']
};

const STYLE_OPTION_TEXT = {
  photographic: ['Photographic', 'Photo'],
  art: ['Art', 'Artistic'],
  graphic: ['Graphic', 'Editorial']
};

export class ImageGenerator extends BaseGenerator {
  constructor(config = {}) {
    super({
      url: 'https://firefly.adobe.com/generate/image',
      waitForResultTimeoutMs: Number(process.env.WAIT_FOR_RESULT_TIMEOUT_MS || 90000),
      variantsPerPrompt: Number(process.env.VARIANTS_PER_PROMPT || 1),
      captureMode: process.env.CAPTURE_MODE || 'download',
      saveArtifacts: process.env.SAVE_ARTIFACTS || 'failures',
      debugRunDir: process.env.DEBUG_RUN_DIR || '',
      ...config
    });

    this.progress = null;
    this.runArtifacts = null;
  }

  async generate(prompts, email = process.env.FIREFLY_EMAIL || 'web@adam-medien.de') {
    const totalVariants = prompts.length * this.config.variantsPerPrompt;

    this.progress = {
      status: 'running',
      phase: 'initializing',
      totalPrompts: prompts.length,
      totalVariants,
      processedPrompts: 0,
      generatedVariants: 0,
      capturesSucceeded: 0,
      fallbackCount: 0,
      currentPromptId: null,
      currentVariant: null,
      lastError: null
    };

    this.runArtifacts = new RunArtifacts({
      outputDir: this.config.outputDir,
      baseDir: this.config.debugRunDir || undefined,
      saveArtifacts: this.config.saveArtifacts
    });

    await this.runArtifacts.init({
      generator: 'ImageGenerator',
      model: this.config.model || this.config.modelId || null,
      captureMode: this.config.captureMode,
      totalPrompts: prompts.length,
      totalVariants
    });

    await this.init();
    await this.ensureDir(this.config.outputDir);

    try {
      const authenticated = await this.ensureAuthenticatedSession(email, this.config.url);
      if (!authenticated) {
        throw new Error('Authentication did not reach an authenticated Firefly session');
      }
      await this.ensurePageReady();

      for (const prompt of prompts) {
        await this.processPrompt(prompt);
      }

      this.progress.status = 'completed';
      this.progress.phase = 'completed';
      await this.runArtifacts.writeSummary({
        progress: this.progress,
        status: 'completed'
      });
    } catch (error) {
      this.progress.status = 'failed';
      this.progress.phase = 'failed';
      this.progress.lastError = error.message;
      this.runArtifacts.recordError(error, { scope: 'generate' });
      await this.collectDiagnostics('run-failure', error, { mode: 'failure' });
      await this.runArtifacts.writeSummary({
        progress: this.progress,
        status: 'failed'
      });
      throw error;
    }
  }

  emitProgress(overrides = {}) {
    this.progress = {
      ...this.progress,
      ...overrides
    };

    if (this.config.onProgress) {
      this.config.onProgress({ ...this.progress });
    }
  }

  async processPrompt(item) {
    const promptId = item.prompt_id || item.id || `item_${Math.random().toString(36).slice(2, 8)}`;
    const promptText = item.prompt_text || item.prompt || item.visual_prompt || '';
    const requestedModel = item.modelId || item.model || this.config.modelId || this.config.model || '';
    const requestedAspectRatio = item.aspect_ratio || item.aspectRatio || this.config.aspectRatio || '';
    const requestedStyle = item.style || this.config.style || '';

    const validation = validateImageRequest({
      modelId: requestedModel,
      model: requestedModel,
      aspectRatio: requestedAspectRatio,
      style: requestedStyle
    });

    if (!validation.ok) {
      throw new Error(`Prompt "${promptId}" is invalid: ${validation.errors.join('; ')}`);
    }

    const model = validation.normalized.model || resolveImageModel('Firefly Image 5 (Preview)');
    const aspectRatio = normalizeAspectRatio(validation.normalized.aspectRatio);
    const style = normalizeStyle(validation.normalized.style);

    this.emitProgress({
      phase: 'processing-prompt',
      currentPromptId: promptId,
      currentVariant: null
    });
    this.runArtifacts.recordPromptPhase(promptId, 'start', { modelId: model?.id || null });

    await this.openGenerateImage();
    await this.dismissOverlays();
    await this.ensurePageReady();
    await this.ensureModelAvailable(model, promptId);
    await this.selectModel(model, promptId);
    await this.applyPrompt(promptText, promptId);
    await this.applyCapabilities({ model, aspectRatio, style, promptId });

    for (let variant = 1; variant <= this.config.variantsPerPrompt; variant++) {
      await this.generateVariant({
        promptId,
        promptText,
        model,
        aspectRatio,
        style,
        variant
      });
    }

    this.emitProgress({
      processedPrompts: this.progress.processedPrompts + 1,
      currentVariant: null
    });
    this.runArtifacts.recordPromptPhase(promptId, 'completed', {
      processedPrompts: this.progress.processedPrompts
    });
  }

  async openGenerateImage() {
    this.emitProgress({ phase: 'open-generate-image' });
    await this.openPage(this.config.url);
    await this.dismissCookieBanner();
  }

  async ensurePageReady() {
    this.emitProgress({ phase: 'ensure-page-ready' });
    const pageState = await this.detectPageState();

    if (pageState.matchedState === FIREFLY_PAGE_STATES.AUTH_GATE || pageState.hasAuthFrame) {
      throw new Error('Firefly state: authentication gate blocking prompt input');
    }

    if (pageState.matchedState === FIREFLY_PAGE_STATES.CREDIT_GATE) {
      throw new Error('Firefly state: credit gate blocking generation');
    }

    if (pageState.matchedState === FIREFLY_PAGE_STATES.LOADING) {
      await this.page.waitForTimeout(1500);
    }

    const promptField = await this.findPromptField();
    if (!promptField) {
      const detail = pageState.hasPromptShell
        ? 'prompt shell found but no editable node'
        : 'no prompt shell detected';
      throw new Error(`Firefly state: ${pageState.matchedState}, ${detail}`);
    }

    this.runArtifacts.recordSelector('prompt-input', promptField.strategy.name, {
      inputMode: promptField.inputMode || 'fill'
    });
  }

  async dismissOverlays() {
    this.emitProgress({ phase: 'dismiss-overlays' });
    await this.dismissCookieBanner();

    const overlaySelectors = [
      'firefly-sign-in-dialog button[aria-label*="Close" i]',
      'button[aria-label="Close"]',
      'button:has-text("Dismiss")',
      'button:has-text("Got it")',
      'button:has-text("Continue")',
      'button:has-text("Maybe later")',
      '[data-testid="modal-close"]',
      '[aria-label*="Close"]:not([disabled])'
    ];

    for (const selector of overlaySelectors) {
      try {
        const locator = this.page.locator(selector).first();
        if (await locator.isVisible({ timeout: 600 })) {
          await locator.click({ force: true });
          this.runArtifacts.recordEvent('overlay-closed', { selector });
          await this.page.waitForTimeout(250);
        }
      } catch {
        // Overlay not present.
      }
    }
  }

  async ensureModelAvailable(model, promptId) {
    this.emitProgress({ phase: 'ensure-model-available' });
    if (!model) {
      return;
    }

    if (model.family === 'partner' || model.id === 'firefly-image-5-preview') {
      const banner = this.page.locator('firefly-link-info-card').first();
      try {
        if (await banner.isVisible({ timeout: 1500 })) {
          await banner.click();
          this.runArtifacts.recordFallback('activation-banner', {
            promptId,
            modelId: model.id
          });
          await this.page.waitForTimeout(500);
        }
      } catch {
        // Banner is optional.
      }
    }
  }

  async selectModel(model, promptId) {
    if (!model) {
      return;
    }

    this.emitProgress({ phase: 'select-model' });
    const picker = await this.findPicker(MODEL_PICKER_SELECTORS, ['model', 'firefly', 'flux', 'imagen', 'gpt']);
    if (!picker) {
      throw new Error(`Model picker not found for prompt "${promptId}"`);
    }

    this.runArtifacts.recordSelector('model-picker', picker.strategy.name, { promptId, modelId: model.id });
    await picker.locator.scrollIntoViewIfNeeded();
    await picker.locator.click({ force: true });

    const option = await findOptionByTexts(this.page, buildModelOptionTexts(model), { timeoutMs: 4000 });
    if (!option) {
      throw new Error(`Model option "${model.label}" not found`);
    }

    this.runArtifacts.recordSelector('model-option', option.name, { promptId, modelId: model.id });
    await option.locator.click({ force: true });
    await this.confirmPartnerConsentIfPresent(promptId, model);
    await this.page.waitForTimeout(300);
  }

  async applyPrompt(promptText, promptId) {
    this.emitProgress({ phase: 'apply-prompt' });
    const promptField = await this.findPromptField();
    if (!promptField) {
      throw new Error(`Prompt input not found for prompt "${promptId}"`);
    }

    const { locator, strategy } = promptField;
    this.runArtifacts.recordSelector('prompt-apply', strategy.name, { promptId });
    await locator.scrollIntoViewIfNeeded();
    await locator.click({ force: true });

    if (promptField.inputMode === 'keyboard') {
      try {
        await this.page.keyboard.press('Meta+A');
      } catch {
        await this.page.keyboard.press('Control+A').catch(() => {});
      }
      await this.page.keyboard.press('Backspace').catch(() => {});
      await this.page.keyboard.type(promptText, { delay: 12 });
      return;
    }

    try {
      await locator.fill('');
      await locator.fill(promptText);
    } catch {
      await locator.evaluate((element, text) => {
        if ('value' in element) {
          element.value = text;
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
        } else {
          element.textContent = text;
          element.dispatchEvent(new InputEvent('input', { bubbles: true, data: text, inputType: 'insertText' }));
        }
      }, promptText);
    }
  }

  async applyCapabilities({ model, aspectRatio, style, promptId }) {
    this.emitProgress({ phase: 'apply-capabilities' });

    if (aspectRatio) {
      await this.applyAspectRatio(aspectRatio, model, promptId);
    }

    if (style && model?.supportsStyleControl) {
      await this.applyStyle(style, promptId);
    }
  }

  async generateVariant({ promptId, model, aspectRatio, style, variant }) {
    this.emitProgress({
      phase: 'trigger-generation',
      currentVariant: variant
    });

    const previousResultCount = await this.countResultCandidates();
    const generationStarted = await this.triggerGeneration(promptId);
    if (!generationStarted) {
      throw new Error(`Generation did not start for "${promptId}" variant ${variant}`);
    }

    await this.awaitResult(previousResultCount);
    const capture = await this.captureResult({ promptId, variant });
    this.emitProgress({
      generatedVariants: this.progress.generatedVariants + 1,
      capturesSucceeded: this.progress.capturesSucceeded + 1
    });

    this.runArtifacts.recordVariantResult(promptId, variant, {
      modelId: model?.id || null,
      aspectRatio,
      style,
      ...capture
    });
  }

  async findPromptField() {
    const directMatch = await findFirstVisibleLocator(this.page, PROMPT_INPUT_SELECTORS, { timeoutMs: 1200 });
    if (directMatch) {
      const inputMode = directMatch.strategy.name === 'prompt-host-generic' ? 'keyboard' : 'fill';
      return {
        ...directMatch,
        inputMode
      };
    }

    const startedAt = Date.now();
    while (Date.now() - startedAt < 15000) {
      const handle = await this.page.evaluateHandle(() => {
        const host = document.querySelector('firefly-prompt, [data-testid="prompt-bar-input"]');
        const fromTextfield = host?.shadowRoot
          ?.querySelector('firefly-textfield')
          ?.shadowRoot
          ?.querySelector('textarea');

        if (fromTextfield) return fromTextfield;

        const nestedTextarea = host?.shadowRoot?.querySelector('textarea');
        if (nestedTextarea) return nestedTextarea;

        const richText = host?.shadowRoot?.querySelector('[contenteditable="true"], [role="textbox"]');
        if (richText) return richText;

        const globalTextarea = document.querySelector('textarea[placeholder*="Describe" i], textarea[aria-label*="prompt" i], textarea');
        if (globalTextarea) return globalTextarea;

        return document.querySelector('[role="textbox"][contenteditable="true"]');
      });

      const element = handle.asElement();
      if (element) {
        const locator = element;
        return {
          strategy: { name: 'prompt-shadow-dom', selector: 'shadow-dom' },
          locator,
          inputMode: 'fill'
        };
      }

      await handle.dispose();

      const promptShell = await this.page.locator('firefly-prompt, [data-testid="prompt-bar-input"]').first();
      try {
        if (await promptShell.isVisible({ timeout: 200 })) {
          return {
            strategy: { name: 'prompt-shell-keyboard', selector: 'firefly-prompt, [data-testid="prompt-bar-input"]' },
            locator: promptShell,
            inputMode: 'keyboard'
          };
        }
      } catch {
        // Ignore and continue retries.
      }

      await this.page.waitForTimeout(250);
    }

    return null;
  }

  async detectPageState() {
    const pageState = await detectFireflyGeneratePageState(this.page);
    this.runArtifacts.recordEvent('page-state', pageState);
    this.emitProgress({
      fireflyPageState: pageState.matchedState,
      fireflyPageReason: pageState.reason
    });
    return pageState;
  }

  async findPicker(strategies, hints) {
    const direct = await findFirstVisibleLocator(this.page, strategies, { timeoutMs: 1200 });
    if (direct && direct.strategy.name !== 'generic-picker-fallback') {
      return direct;
    }

    const semantic = await findPickerByHints(this.page, hints, { timeoutMs: 1200 });
    if (semantic) {
      return semantic;
    }

    return direct;
  }

  async applyAspectRatio(aspectRatio, model, promptId) {
    const picker = await this.findPicker(ASPECT_RATIO_PICKER_SELECTORS, ['aspect', 'square', 'portrait', 'landscape', 'widescreen']);
    if (!picker) {
      throw new Error(`Aspect ratio picker not found for "${promptId}"`);
    }

    const optionTexts = ASPECT_RATIO_OPTION_TEXT[aspectRatio] || [aspectRatio];
    this.runArtifacts.recordSelector('aspect-ratio-picker', picker.strategy.name, {
      promptId,
      aspectRatio,
      modelId: model?.id || null
    });
    await picker.locator.click({ force: true });

    const option = await findOptionByTexts(this.page, optionTexts, { timeoutMs: 3000 });
    if (!option) {
      throw new Error(`Aspect ratio option "${aspectRatio}" not found`);
    }

    this.runArtifacts.recordSelector('aspect-ratio-option', option.name, { promptId, aspectRatio });
    await option.locator.click({ force: true });
  }

  async applyStyle(style, promptId) {
    const picker = await this.findPicker(STYLE_PICKER_SELECTORS, ['style', 'content']);
    if (!picker) {
      throw new Error(`Style picker not found for "${promptId}"`);
    }

    const optionTexts = STYLE_OPTION_TEXT[style] || [style];
    this.runArtifacts.recordSelector('style-picker', picker.strategy.name, { promptId, style });
    await picker.locator.click({ force: true });

    const option = await findOptionByTexts(this.page, optionTexts, { timeoutMs: 3000 });
    if (!option) {
      throw new Error(`Style option "${style}" not found`);
    }

    this.runArtifacts.recordSelector('style-option', option.name, { promptId, style });
    await option.locator.click({ force: true });
  }

  async confirmPartnerConsentIfPresent(promptId, model) {
    if (!model || model.family !== 'partner') {
      return;
    }

    const consent = await findPartnerConsentButton(this.page, { timeoutMs: 800 });
    if (consent) {
      await consent.locator.click({ force: true });
      this.runArtifacts.recordFallback('partner-consent', {
        promptId,
        modelId: model.id,
        action: consent.action
      });
      await this.page.waitForTimeout(300);
    }
  }

  async waitForGenerateEnabled() {
    const button = await findFirstVisibleLocator(this.page, GENERATE_BUTTON_SELECTORS, { timeoutMs: 1500 });
    if (!button) {
      throw new Error('Generate button not found');
    }

    this.runArtifacts.recordSelector('generate-button', button.strategy.name);
    await this.page.waitForTimeout(100);

    const startedAt = Date.now();
    while (Date.now() - startedAt < 10000) {
      try {
        const isReady = await button.locator.evaluate((buttonElement) =>
          !buttonElement.hasAttribute('disabled') &&
          buttonElement.getAttribute('aria-disabled') !== 'true' &&
          buttonElement.getAttribute('aria-busy') !== 'true'
        );

        if (isReady) {
          return button;
        }
      } catch {
        // Retry until timeout.
      }

      await this.page.waitForTimeout(250);
    }

    throw new Error('Generate button stayed disabled');
  }

  async triggerGeneration(promptId) {
    const generateButton = await this.waitForGenerateEnabled();
    const promptField = await this.findPromptField();
    const strategies = [
      {
        name: 'meta-enter',
        run: async () => {
          if (!promptField) return;
          await promptField.locator.click({ force: true });
          await this.page.keyboard.press('Meta+Enter');
        }
      },
      {
        name: 'control-enter',
        run: async () => {
          if (!promptField) return;
          await promptField.locator.click({ force: true });
          await this.page.keyboard.press('Control+Enter');
        }
      },
      {
        name: generateButton.strategy.name,
        run: async () => {
          await generateButton.locator.click({ force: true });
        }
      }
    ];

    for (const strategy of strategies) {
      try {
        await strategy.run();
        if (await this.waitForGenerationStart()) {
          this.runArtifacts.recordSelector('generation-trigger', strategy.name, { promptId });
          return true;
        }
      } catch (error) {
        this.runArtifacts.recordFallback('trigger-strategy-failed', {
          promptId,
          strategy: strategy.name,
          message: error.message
        });
      }
    }

    return false;
  }

  async waitForGenerationStart() {
    try {
      await this.page.waitForFunction(
        () => {
          const button = document.querySelector('[data-testid="generate-button"]');
          const isBusy = Boolean(button && (
            button.hasAttribute('disabled') ||
            button.getAttribute('aria-disabled') === 'true' ||
            button.getAttribute('aria-busy') === 'true'
          ));
          const loader = document.querySelector('[data-testid*="progress"], [data-testid*="loader"], [class*="loader"], [class*="Spinner"]');
          const generatingCopy = Array.from(document.querySelectorAll('button, span, div'))
            .some((element) => /generating|working|creating/i.test(element?.textContent?.trim() || ''));
          return isBusy || Boolean(loader) || generatingCopy;
        },
        { timeout: 8000 }
      );
      return true;
    } catch {
      return false;
    }
  }

  async awaitResult(previousResultCount) {
    this.emitProgress({ phase: 'await-result' });
    await this.page.waitForFunction(
      (previousCount) => {
        const candidates = document.querySelectorAll(
          'img[src^="blob:"], img[src*="firefly"], img[src*="adobe"], [data-testid*="result"] img, [class*="result"] img, canvas'
        );
        const button = document.querySelector('[data-testid="generate-button"]');
        const buttonReady = button &&
          !button.hasAttribute('disabled') &&
          button.getAttribute('aria-disabled') !== 'true' &&
          button.getAttribute('aria-busy') !== 'true';

        return candidates.length > previousCount && buttonReady;
      },
      previousResultCount,
      { timeout: this.config.waitForResultTimeoutMs }
    );
  }

  async countResultCandidates() {
    const counts = await Promise.all(
      RESULT_IMAGE_SELECTORS.map(async (entry) => {
        try {
          return await this.page.locator(entry.selector).count();
        } catch {
          return 0;
        }
      })
    );

    return Math.max(0, ...counts);
  }

  async captureResult({ promptId, variant }) {
    this.emitProgress({ phase: 'capture-result' });

    try {
      if (this.config.captureMode === 'screenshot') {
        return await this.captureViaScreenshot(promptId, variant);
      }

      return await this.captureViaDownload(promptId, variant);
    } catch (primaryError) {
      if (this.config.captureMode === 'download') {
        this.emitProgress({ fallbackCount: this.progress.fallbackCount + 1 });
        this.runArtifacts.recordFallback('capture-screenshot', {
          promptId,
          variant,
          reason: primaryError.message
        });
        const fallbackResult = await this.captureViaScreenshot(promptId, variant);
        return {
          ...fallbackResult,
          fallbackUsed: true,
          primaryCaptureError: primaryError.message
        };
      }

      throw primaryError;
    }
  }

  async captureViaDownload(promptId, variant) {
    const image = await this.findFirstResultLocator();
    if (!image) {
      throw new Error('Generated image not found for download capture');
    }

    await image.locator.scrollIntoViewIfNeeded();
    await image.locator.hover({ force: true });
    await this.page.waitForTimeout(500);

    const downloadButton = await findFirstVisibleLocator(this.page, DOWNLOAD_BUTTON_SELECTORS, { timeoutMs: 2000 });
    if (!downloadButton) {
      throw new Error('Download button not found');
    }

    this.runArtifacts.recordSelector('download-button', downloadButton.strategy.name, { promptId, variant });
    const downloadPromise = this.page.waitForEvent('download', { timeout: 30000 });
    await downloadButton.locator.click({ force: true });
    const download = await downloadPromise;
    const downloadPath = await download.path();

    if (!downloadPath) {
      throw new Error('Download path not available');
    }

    const suggestedFilename = download.suggestedFilename() || `${this.safeName(promptId)}_${variant}.png`;
    const extension = suggestedFilename.split('.').pop() || 'png';
    const outputPath = buildOutPath(this.config.outputDir, promptId, variant, extension);
    await fs.copyFile(downloadPath, outputPath);

    return {
      captureMode: 'download',
      filePath: outputPath
    };
  }

  async captureViaScreenshot(promptId, variant) {
    const image = await this.findFirstResultLocator();
    if (!image) {
      throw new Error('Generated image not found for screenshot capture');
    }

    this.runArtifacts.recordSelector('result-target', image.strategy.name, { promptId, variant });
    const buffer = await image.locator.screenshot({ type: 'png' });
    const outputPath = buildOutPath(this.config.outputDir, promptId, variant, 'png');
    await fs.writeFile(outputPath, buffer);

    return {
      captureMode: 'screenshot',
      filePath: outputPath
    };
  }

  async findFirstResultLocator() {
    return findFirstVisibleLocator(this.page, RESULT_IMAGE_SELECTORS, { timeoutMs: 2000 });
  }

  async collectDiagnostics(name, error, options = {}) {
    const screenshot = await this.runArtifacts.maybeSaveScreenshot(this.page, name, options);
    const pageState = await detectFireflyGeneratePageState(this.page).catch(() => null);
    const pageStateArtifact = pageState
      ? await this.runArtifacts.maybeSaveJson(`${name}-page-state`, pageState, options)
      : null;
    this.runArtifacts.recordEvent('diagnostic', {
      name,
      screenshot,
      pageState,
      pageStateArtifact,
      error: error?.message || null,
      bodyPreview: pageState?.bodyPreview || ''
    });
  }
}
