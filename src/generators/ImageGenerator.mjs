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
import { hasFreshResult } from './resultState.mjs';
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
    const promptReadySignals = pageState.matchedState === FIREFLY_PAGE_STATES.READY_FOR_PROMPT ||
      pageState.hasPromptShell ||
      pageState.hasGenerateButton;

    if (pageState.matchedState === FIREFLY_PAGE_STATES.AUTH_GATE) {
      throw new Error('Firefly state: authentication gate blocking prompt input');
    }

    if (pageState.hasVisibleAuthFrame && !promptReadySignals) {
      throw new Error('Firefly state: visible authentication gate blocking prompt input');
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
    const previousPromptState = await this.readPromptState();
    this.runArtifacts.recordSelector('prompt-apply', strategy.name, { promptId });
    const strategies = [
      {
        name: `${strategy.name}-direct`,
        run: async () => {
          await locator.scrollIntoViewIfNeeded();
          await locator.click({ force: true });

          if (promptField.inputMode === 'keyboard') {
            await this.clearPromptField();
            await this.page.keyboard.insertText(promptText);
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
      },
      {
        name: 'prompt-dom-injection',
        run: async () => {
          const injected = await this.injectPromptText(promptText);
          if (!injected) {
            throw new Error('Prompt DOM injection target not found');
          }
        }
      },
      {
        name: 'prompt-shell-click-insert',
        run: async () => {
          await locator.scrollIntoViewIfNeeded();
          const box = await locator.boundingBox();
          if (!box) {
            throw new Error('Prompt shell bounding box unavailable');
          }

          const targetX = Math.round(box.x + Math.max(140, Math.min(260, box.width * 0.22)));
          const targetY = Math.round(box.y + Math.max(34, Math.min(52, box.height * 0.42)));
          await this.page.mouse.click(
            targetX,
            targetY,
            { clickCount: 2 }
          );
          await this.clearPromptField();
          await this.page.keyboard.insertText(promptText);
        }
      },
      {
        name: 'prompt-shell-tab-type',
        run: async () => {
          await locator.scrollIntoViewIfNeeded();
          const box = await locator.boundingBox();
          if (!box) {
            throw new Error('Prompt shell bounding box unavailable');
          }

          const targetX = Math.round(box.x + Math.max(140, Math.min(260, box.width * 0.22)));
          const targetY = Math.round(box.y + Math.max(34, Math.min(52, box.height * 0.42)));
          await this.page.mouse.click(
            targetX,
            targetY
          );
          await this.page.keyboard.press('Tab').catch(() => {});
          await this.clearPromptField();
          await this.page.keyboard.type(promptText, { delay: 18 });
        }
      }
    ];

    for (const applyStrategy of strategies) {
      try {
        await applyStrategy.run();
        if (await this.waitForPromptAccepted(promptText, previousPromptState)) {
          this.runArtifacts.recordSelector('prompt-apply-success', applyStrategy.name, { promptId });
          return;
        }
      } catch (error) {
        this.runArtifacts.recordFallback('prompt-apply-strategy-failed', {
          promptId,
          strategy: applyStrategy.name,
          message: error.message
        });
      }
    }

    const promptState = await this.readPromptState();
    this.runArtifacts.recordEvent('prompt-apply-failed', {
      promptId,
      promptState
    });
    throw new Error(`Prompt text was not accepted for prompt "${promptId}"`);
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

    const previousResultState = await this.readResultState();
    const triggerState = await this.triggerGeneration(promptId, previousResultState);
    if (!triggerState.attempted) {
      throw new Error(`Generation trigger could not be attempted for "${promptId}" variant ${variant}`);
    }

    if (!triggerState.started) {
      this.runArtifacts.recordFallback('generation-start-inferred', {
        promptId,
        variant
      });
    }

    await this.awaitResult(previousResultState, { promptId, variant, triggerState });
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

  async clearPromptField() {
    try {
      await this.page.keyboard.press('Meta+A');
    } catch {
      await this.page.keyboard.press('Control+A').catch(() => {});
    }
    await this.page.keyboard.press('Backspace').catch(() => {});
  }

  async injectPromptText(promptText) {
    return this.page.evaluate((text) => {
      const hosts = Array.from(document.querySelectorAll('firefly-prompt, [data-testid="prompt-bar-input"]'));
      const candidateRoots = [];

      hosts.forEach((host) => {
        candidateRoots.push(host);
        if (host.shadowRoot) {
          candidateRoots.push(host.shadowRoot);
          const nestedTextfield = host.shadowRoot.querySelector('firefly-textfield, sp-textfield');
          if (nestedTextfield?.shadowRoot) {
            candidateRoots.push(nestedTextfield.shadowRoot);
          }
        }
      });

      const editable = candidateRoots
        .flatMap((root) => Array.from(root.querySelectorAll?.('textarea, [contenteditable="true"], [role="textbox"]') || []))
        .find((element) => {
          const rect = element.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });

      if (!editable) {
        return false;
      }

      if ('value' in editable) {
        editable.focus();
        editable.value = text;
        editable.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
        editable.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
        return true;
      }

      editable.focus();
      editable.textContent = text;
      editable.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        composed: true,
        data: text,
        inputType: 'insertText'
      }));
      return true;
    }, promptText);
  }

  async readPromptState() {
    return this.page.evaluate(() => {
      const hosts = Array.from(document.querySelectorAll('firefly-prompt, [data-testid="prompt-bar-input"]'));
      const texts = [];

      const readEditable = (root) => {
        const editable = root?.querySelector?.('textarea, [contenteditable="true"], [role="textbox"]');
        if (!editable) return;
        const value = 'value' in editable ? editable.value : (editable.textContent || '');
        if (value) {
          texts.push(value.trim());
        }
      };

      hosts.forEach((host) => {
        readEditable(host);
        if (host.shadowRoot) {
          readEditable(host.shadowRoot);
          const nestedTextfield = host.shadowRoot.querySelector('firefly-textfield, sp-textfield');
          if (nestedTextfield?.shadowRoot) {
            readEditable(nestedTextfield.shadowRoot);
          }
        }
      });

      const activeElement = document.activeElement;
      return {
        values: texts.filter(Boolean),
        activeTag: activeElement?.tagName || '',
        activeRole: activeElement?.getAttribute?.('role') || '',
        activeAriaLabel: activeElement?.getAttribute?.('aria-label') || '',
        bodyPreview: document.body.innerText.slice(0, 4000)
      };
    });
  }

  promptStateContains(promptState, normalizedNeedle) {
    if (!promptState || !normalizedNeedle) {
      return false;
    }

    const valuesMatch = (promptState.values || []).some((value) => value.toLowerCase().includes(normalizedNeedle));
    const bodyMatch = String(promptState.bodyPreview || '').toLowerCase().includes(normalizedNeedle);
    return valuesMatch || bodyMatch;
  }

  async waitForPromptAccepted(promptText, previousPromptState = null) {
    const normalizedNeedle = String(promptText || '').trim().toLowerCase().slice(0, 32);
    const startedAt = Date.now();
    const previousMatched = this.promptStateContains(previousPromptState, normalizedNeedle);
    const previousHadEvidence = Boolean(previousPromptState?.values?.length || previousPromptState?.bodyPreview);

    while (Date.now() - startedAt < 15000) {
      const promptState = await this.readPromptState();
      const matched = this.promptStateContains(promptState, normalizedNeedle);
      if (matched) {
        this.runArtifacts.recordEvent('prompt-accepted', {
          promptState
        });
        return true;
      }

      const button = await this.findGenerateButton({ timeoutMs: 200 });
      if (button && await this.isGenerateButtonReady(button)) {
        if (previousHadEvidence && previousMatched) {
          await this.page.waitForTimeout(200);
          continue;
        }

        this.runArtifacts.recordEvent('prompt-accepted-generate-ready', {
          strategy: button.strategy.name
        });
        return true;
      }

      await this.page.waitForTimeout(200);
    }

    return false;
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
    const button = await this.findGenerateButton({ timeoutMs: 1500 });
    if (!button) {
      throw new Error('Generate button not found');
    }

    this.runArtifacts.recordSelector('generate-button', button.strategy.name);
    await this.page.waitForTimeout(100);

    const startedAt = Date.now();
    while (Date.now() - startedAt < 10000) {
      try {
        const isReady = await this.isGenerateButtonReady(button);

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

  async isGenerateButtonReady(button) {
    return button.locator.evaluate((buttonElement) =>
      !buttonElement.hasAttribute('disabled') &&
      buttonElement.getAttribute('aria-disabled') !== 'true' &&
      buttonElement.getAttribute('aria-busy') !== 'true'
    );
  }

  async findGenerateButton(options = {}) {
    const directMatch = await findFirstVisibleLocator(this.page, GENERATE_BUTTON_SELECTORS, { timeoutMs: options.timeoutMs ?? 1500 });
    if (directMatch && await this.isLikelyPromptGenerateControl(directMatch.locator)) {
      return directMatch;
    }

    const handle = await this.page.evaluateHandle(() => {
      const isVisible = (element) => {
        if (!element) return false;
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.visibility !== 'hidden' && style.display !== 'none' && rect.width > 0 && rect.height > 0;
      };

      const queue = [document];
      while (queue.length > 0) {
        const root = queue.shift();
        const elements = Array.from(root.querySelectorAll?.('*') || []);

        for (const element of elements) {
          if (element.shadowRoot) {
            queue.push(element.shadowRoot);
          }

          const isButtonLike = element.matches?.('button, [role="button"], sp-button, sp-action-button') ||
            Boolean(element.getAttribute?.('aria-label')) ||
            Boolean(element.getAttribute?.('data-testid'));
          if (!isButtonLike) continue;
          if (!isVisible(element)) continue;
          const rect = element.getBoundingClientRect();
          if (rect.top < window.innerHeight * 0.55) continue;
          const text = `${element.textContent || ''} ${element.getAttribute('aria-label') || ''} ${element.getAttribute('data-testid') || ''}`.toLowerCase();
          if (/generate|create/.test(text)) {
            return element;
          }
        }
      }

      return null;
    });

    const element = handle.asElement();
    if (!element) {
      await handle.dispose();
      return null;
    }

    return {
      strategy: { name: 'generate-deep-search', selector: 'deep-search' },
      locator: element
    };
  }

  async isLikelyPromptGenerateControl(locator) {
    return locator.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      const testId = element.getAttribute('data-testid') || '';
      const text = `${element.textContent || ''} ${element.getAttribute('aria-label') || ''}`.toLowerCase();

      if (testId === 'generate-button') {
        return true;
      }

      if (!/generate|create/.test(text)) {
        return false;
      }

      return rect.top >= window.innerHeight * 0.55;
    }).catch(() => false);
  }

  async triggerGeneration(promptId, previousResultState = {}) {
    const generateButton = await this.waitForGenerateEnabled();
    const promptField = await this.findPromptField();
    let attempted = false;
    const strategies = [
      {
        name: 'meta-enter',
        run: async () => {
          if (!promptField) return false;
          await promptField.locator.click({ force: true });
          await this.page.keyboard.press('Meta+Enter');
          return true;
        }
      },
      {
        name: 'control-enter',
        run: async () => {
          if (!promptField) return false;
          await promptField.locator.click({ force: true });
          await this.page.keyboard.press('Control+Enter');
          return true;
        }
      },
      {
        name: generateButton.strategy.name,
        run: async () => {
          await generateButton.locator.click({ force: true });
          return true;
        }
      }
    ];

    for (const strategy of strategies) {
      try {
        const didRun = await strategy.run();
        if (didRun === false) {
          continue;
        }
        attempted = true;
        if (await this.waitForGenerationStart(previousResultState)) {
          this.runArtifacts.recordSelector('generation-trigger', strategy.name, { promptId });
          return {
            attempted: true,
            started: true,
            strategy: strategy.name
          };
        }

        if (await this.hasLikelyRenderedResult(previousResultState)) {
          this.runArtifacts.recordSelector('generation-trigger', `${strategy.name}-result-visible`, { promptId });
          return {
            attempted: true,
            started: true,
            strategy: `${strategy.name}-result-visible`
          };
        }
      } catch (error) {
        this.runArtifacts.recordFallback('trigger-strategy-failed', {
          promptId,
          strategy: strategy.name,
          message: error.message
        });
      }
    }

    return {
      attempted,
      started: false,
      strategy: null
    };
  }

  async waitForGenerationStart(previousResultState = {}) {
    const previousResultCount = Number(previousResultState.count || 0);
    try {
      await this.page.waitForFunction(
        (previousCount) => {
          const isVisible = (element) => {
            if (!element) return false;
            const style = window.getComputedStyle(element);
            const rect = element.getBoundingClientRect();
            return style.visibility !== 'hidden' &&
              style.display !== 'none' &&
              rect.width > 0 &&
              rect.height > 0;
          };

          const roots = [document];
          const buttonCandidates = [];

          while (roots.length > 0) {
            const root = roots.shift();
            const elements = Array.from(root.querySelectorAll?.('*') || []);

            for (const element of elements) {
              if (element.shadowRoot) {
                roots.push(element.shadowRoot);
              }

              const isButtonLike = element.matches?.('button, [role="button"], sp-button, sp-action-button') ||
                Boolean(element.getAttribute?.('aria-label')) ||
                Boolean(element.getAttribute?.('data-testid'));
              if (!isButtonLike || !isVisible(element)) {
                continue;
              }

              const rect = element.getBoundingClientRect();
              const text = `${element.textContent || ''} ${element.getAttribute('aria-label') || ''} ${element.getAttribute('data-testid') || ''}`.toLowerCase();
              if (rect.top >= window.innerHeight * 0.55 && /generate|create|generating|creating/.test(text)) {
                buttonCandidates.push(element);
              }
            }
          }

          const isBusy = buttonCandidates.some((button) =>
            button.hasAttribute('disabled') ||
            button.getAttribute('aria-disabled') === 'true' ||
            button.getAttribute('aria-busy') === 'true' ||
            /generating|creating/i.test(button.textContent || '')
          );
          const loader = document.querySelector(
            '[data-testid*="progress"], [data-testid*="loader"], [class*="loader"], [class*="Loader"], [class*="spinner"], [class*="Spinner"], [class*="skeleton"], [class*="Skeleton"], [class*="placeholder"]'
          );
          const generatingCopy = Array.from(document.querySelectorAll('button, span, div'))
            .some((element) => /generating|working|creating/i.test(element?.textContent?.trim() || ''));
          const results = document.querySelectorAll(
            'img[src^="blob:"], img[src*="firefly"], img[src*="adobe"], [data-testid*="result"] img, [class*="result"] img, canvas'
          );
          return isBusy || Boolean(loader) || generatingCopy || results.length > previousCount;
        },
        previousResultCount,
        { timeout: 20000 }
      );
      return true;
    } catch {
      return false;
    }
  }

  async hasLikelyRenderedResult(previousResultState = {}) {
    const currentState = await this.readResultState();
    if (hasFreshResult(previousResultState, currentState)) {
      return true;
    }

    const previousResultCount = Number(previousResultState.count || 0);
    return this.page.evaluate((previousCount) => {
      const isVisible = (element) => {
        if (!element) return false;
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          rect.width > 0 &&
          rect.height > 0;
      };

      const resultCandidates = Array.from(document.querySelectorAll(
        'img[src^="blob:"], img[src*="firefly"], img[src*="adobe"], [data-testid*="result"] img, [class*="result"] img, [class*="ResultsGrid"] img, main img, section img, article img, canvas'
      )).filter((element) => {
        if (!isVisible(element)) return false;
        const rect = element.getBoundingClientRect();
        return rect.width >= 220 && rect.height >= 180 && rect.top < window.innerHeight * 0.8;
      });

      if (resultCandidates.length > previousCount) {
        return true;
      }

      return resultCandidates.some((element) => {
        const rect = element.getBoundingClientRect();
        return rect.width >= 280 && rect.height >= 220;
      });
    }, previousResultCount).catch(() => false);
  }

  async awaitResult(previousResultCount, context = {}) {
    this.emitProgress({ phase: 'await-result' });
    const startedAt = Date.now();
    const timeoutMs = this.config.waitForResultTimeoutMs;

    while (Date.now() - startedAt < timeoutMs) {
      if (await this.hasLikelyRenderedResult(previousResultCount)) {
        this.runArtifacts.recordEvent('result-ready', {
          promptId: context.promptId || null,
          variant: context.variant || null,
          triggerStarted: Boolean(context.triggerState?.started),
          triggerStrategy: context.triggerState?.strategy || null
        });
        return;
      }

      await this.page.waitForTimeout(400);
    }

    const resultCount = await this.countResultCandidates().catch(() => null);
    throw new Error(
      `Result did not appear for "${context.promptId || 'unknown'}" variant ${context.variant || '?'}` +
      (resultCount !== null ? ` (resultCount=${resultCount}, previous=${Number(previousResultCount?.count || 0)})` : '')
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

  async readResultState() {
    return this.page.evaluate(() => {
      const isVisible = (element) => {
        if (!element) return false;
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          rect.width > 0 &&
          rect.height > 0;
      };

      const isMediaLike = (element) => {
        const style = window.getComputedStyle(element);
        if (/(IMG|CANVAS|VIDEO|PICTURE)$/.test(element.tagName)) {
          return true;
        }

        if (style.backgroundImage && style.backgroundImage !== 'none') {
          return true;
        }

        return Boolean(element.querySelector?.('img, canvas, video, picture'));
      };

      const roots = [document];
      const candidates = [];

      while (roots.length > 0) {
        const root = roots.shift();
        const elements = Array.from(root.querySelectorAll?.('*') || []);

        for (const element of elements) {
          if (element.shadowRoot) {
            roots.push(element.shadowRoot);
          }

          if (!isVisible(element) || !isMediaLike(element)) {
            continue;
          }

          const rect = element.getBoundingClientRect();
          if (rect.width < 220 || rect.height < 180) {
            continue;
          }

          if (rect.top > window.innerHeight * 0.82 || rect.left < 180) {
            continue;
          }

          const area = rect.width * rect.height;
          const mediaChild = element.matches?.('img, canvas, video, picture')
            ? element
            : element.querySelector?.('img, canvas, video, picture');
          const style = window.getComputedStyle(element);
          const mediaSource = mediaChild?.currentSrc ||
            mediaChild?.src ||
            mediaChild?.getAttribute?.('src') ||
            (mediaChild?.tagName === 'CANVAS'
              ? (() => {
                try {
                  return mediaChild.toDataURL('image/png').slice(0, 128);
                } catch {
                  return '';
                }
              })()
              : '');
          const fingerprint = [
            element.tagName,
            mediaChild?.tagName || '',
            mediaSource,
            style.backgroundImage !== 'none' ? style.backgroundImage : '',
            element.getAttribute('data-testid') || '',
            element.getAttribute('aria-label') || '',
            Math.round(rect.width),
            Math.round(rect.height),
            Math.round(rect.left),
            Math.round(rect.top)
          ].join('|');

          candidates.push({
            area,
            fingerprint,
            tagName: element.tagName,
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height
          });
        }
      }

      candidates.sort((left, right) => right.area - left.area);
      const primary = candidates[0] || null;

      return {
        count: candidates.length,
        primaryFingerprint: primary?.fingerprint || null,
        fingerprints: candidates.map((candidate) => candidate.fingerprint),
        primary
      };
    }).catch(() => ({
      count: 0,
      primaryFingerprint: null,
      fingerprints: [],
      primary: null
    }));
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

    const downloadButton = await this.findDownloadButton(image);
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

  async findDownloadButton(image) {
    const direct = await findFirstVisibleLocator(this.page, DOWNLOAD_BUTTON_SELECTORS, { timeoutMs: 1200 });
    if (direct) {
      return direct;
    }

    const imageBox = await image?.locator?.boundingBox().catch(() => null);
    const handle = await this.page.evaluateHandle((box) => {
      const isVisible = (element) => {
        if (!element) return false;
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          rect.width > 0 &&
          rect.height > 0;
      };

      const queue = [document];
      let best = null;

      while (queue.length > 0) {
        const root = queue.shift();
        const elements = Array.from(root.querySelectorAll?.('*') || []);

        for (const element of elements) {
          if (element.shadowRoot) {
            queue.push(element.shadowRoot);
          }

          const isButtonLike = element.matches?.('button, [role="button"], sp-action-button, a[download]') ||
            Boolean(element.getAttribute?.('aria-label')) ||
            Boolean(element.getAttribute?.('data-testid')) ||
            Boolean(element.getAttribute?.('title'));
          if (!isButtonLike || !isVisible(element)) {
            continue;
          }

          const text = [
            element.textContent || '',
            element.getAttribute('aria-label') || '',
            element.getAttribute('data-testid') || '',
            element.getAttribute('title') || '',
            element.getAttribute('label') || ''
          ].join(' ').toLowerCase();

          if (!/download|herunterladen/.test(text)) {
            continue;
          }

          const rect = element.getBoundingClientRect();
          let score = 0;
          if ((element.getAttribute('data-testid') || '').includes('download')) {
            score += 100;
          }
          if ((element.getAttribute('aria-label') || '').toLowerCase().includes('download') ||
            (element.getAttribute('aria-label') || '').toLowerCase().includes('herunterladen')) {
            score += 60;
          }

          if (box) {
            const withinHorizontal = rect.left >= box.x - 80 && rect.right <= box.x + box.width + 120;
            const withinVertical = rect.top >= box.y - 80 && rect.bottom <= box.y + box.height + 120;
            if (withinHorizontal && withinVertical) {
              score += 80;
            }

            if (rect.left >= box.x + box.width * 0.6 && rect.top <= box.y + box.height * 0.35) {
              score += 40;
            }
          }

          if (!best || score > best.score) {
            best = { element, score };
          }
        }
      }

      return best?.element || null;
    }, imageBox);

    const deepElement = handle.asElement();
    if (deepElement) {
      return {
        strategy: { name: 'download-deep-search', selector: 'deep-download-search' },
        locator: deepElement
      };
    }

    await handle.dispose();
    return null;
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
    const deepHandle = await this.page.evaluateHandle(() => {
      const isVisible = (element) => {
        if (!element) return false;
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.visibility !== 'hidden' &&
          style.display !== 'none' &&
          rect.width > 0 &&
          rect.height > 0;
      };

      const isMediaLike = (element) => {
        const style = window.getComputedStyle(element);
        if (/(IMG|CANVAS|VIDEO|PICTURE)$/.test(element.tagName)) {
          return true;
        }

        if (style.backgroundImage && style.backgroundImage !== 'none') {
          return true;
        }

        return Boolean(element.querySelector?.('img, canvas, video, picture'));
      };

      const roots = [document];
      let best = null;

      while (roots.length > 0) {
        const root = roots.shift();
        const elements = Array.from(root.querySelectorAll?.('*') || []);

        for (const element of elements) {
          if (element.shadowRoot) {
            roots.push(element.shadowRoot);
          }

          if (!isVisible(element) || !isMediaLike(element)) {
            continue;
          }

          const rect = element.getBoundingClientRect();
          if (rect.width < 220 || rect.height < 180) {
            continue;
          }

          if (rect.top > window.innerHeight * 0.82 || rect.left < 180) {
            continue;
          }

          const area = rect.width * rect.height;
          if (!best || area > best.area) {
            best = {
              area,
              element
            };
          }
        }
      }

      return best?.element || null;
    });

    const deepElement = deepHandle.asElement();
    if (deepElement) {
      return {
        strategy: { name: 'result-deep-surface', selector: 'deep-result-surface' },
        locator: deepElement
      };
    }

    await deepHandle.dispose();
    let bestMatch = null;
    const viewportHeight = await this.page.evaluate(() => window.innerHeight).catch(() => 0);

    for (const strategy of RESULT_IMAGE_SELECTORS) {
      const candidates = this.page.locator(strategy.selector);
      const count = await candidates.count().catch(() => 0);

      for (let index = 0; index < count; index++) {
        const locator = candidates.nth(index);
        try {
          if (!(await locator.isVisible({ timeout: 250 }))) {
            continue;
          }

          const metrics = await locator.evaluate((element) => {
            const rect = element.getBoundingClientRect();
            return {
              width: rect.width,
              height: rect.height,
              top: rect.top
            };
          });

          const area = (metrics.width || 0) * (metrics.height || 0);
          if (area < 30000 || (viewportHeight && metrics.top > 0.82 * viewportHeight)) {
            continue;
          }

          if (!bestMatch || area > bestMatch.area) {
            bestMatch = {
              area,
              strategy,
              locator
            };
          }
        } catch {
          // Ignore stale or hidden nodes.
        }
      }
    }

    if (bestMatch) {
      return {
        strategy: bestMatch.strategy,
        locator: bestMatch.locator
      };
    }

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
