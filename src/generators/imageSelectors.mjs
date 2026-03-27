function textToPattern(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const PROMPT_INPUT_SELECTORS = [
  { name: 'prompt-host-textarea', selector: 'firefly-prompt[data-testid="prompt-bar-input"] textarea' },
  { name: 'prompt-host-rich-text', selector: 'firefly-prompt[data-testid="prompt-bar-input"] [contenteditable="true"]' },
  { name: 'prompt-host-generic', selector: 'firefly-prompt, [data-testid="prompt-bar-input"]' },
  { name: 'descriptive-textarea', selector: 'textarea[placeholder*="Describe" i]' },
  { name: 'prompt-textarea', selector: 'textarea[aria-label*="prompt" i]' },
  { name: 'generic-textarea', selector: 'textarea' },
  { name: 'textbox-role', selector: '[role="textbox"][contenteditable="true"]' }
];

export const MODEL_PICKER_SELECTORS = [
  { name: 'model-aria-picker', selector: 'sp-picker[aria-label*="Model" i]' },
  { name: 'model-testid-picker', selector: '[data-testid*="model"][role="button"], [data-testid*="model"] sp-picker, sp-picker[data-testid*="model"]' },
  { name: 'model-labeled-picker', selector: 'label:has-text("Model") + sp-picker' },
  { name: 'generic-picker-fallback', selector: 'sp-picker' }
];

export const ASPECT_RATIO_PICKER_SELECTORS = [
  { name: 'aspect-aria-picker', selector: 'sp-picker[aria-label*="Aspect" i]' },
  { name: 'aspect-testid-picker', selector: '[data-testid*="aspect"] sp-picker, sp-picker[data-testid*="aspect"]' },
  { name: 'aspect-labeled-picker', selector: 'label:has-text("Aspect") + sp-picker' }
];

export const STYLE_PICKER_SELECTORS = [
  { name: 'style-aria-picker', selector: 'sp-picker[aria-label*="Style" i], sp-picker[aria-label*="Content Type" i]' },
  { name: 'style-testid-picker', selector: '[data-testid*="style"] sp-picker, [data-testid*="content"] sp-picker, sp-picker[data-testid*="style"]' },
  { name: 'style-labeled-picker', selector: 'label:has-text("Style") + sp-picker, label:has-text("Content") + sp-picker' }
];

export const GENERATE_BUTTON_SELECTORS = [
  { name: 'generate-testid', selector: '[data-testid="generate-button"]' },
  { name: 'generate-aria', selector: 'button[aria-label*="Generate" i]' },
  { name: 'generate-text', selector: 'button:has-text("Generate"), button:has-text("Create")' }
];

export const RESULT_IMAGE_SELECTORS = [
  { name: 'result-image-blob', selector: 'img[src^="blob:"]' },
  { name: 'result-image-firefly', selector: 'img[src*="firefly"], img[src*="adobe"]' },
  { name: 'result-image-testid', selector: '[data-testid*="result"] img' },
  { name: 'result-image-class', selector: '[class*="result"] img, [class*="ResultsGrid"] img' },
  { name: 'result-canvas', selector: 'canvas' }
];

export const DOWNLOAD_BUTTON_SELECTORS = [
  { name: 'thumbnail-download-testid', selector: '[data-testid="thumbnail-button-download"]' },
  { name: 'download-spectrum', selector: 'sp-action-button[label*="Download"], sp-action-button[label*="erunterladen"]' },
  { name: 'download-button-aria', selector: 'button[aria-label*="Download" i], button[aria-label*="erunterladen" i]' },
  { name: 'download-generic', selector: '[data-testid*="download"], button[title*="Download" i], a[download]' }
];

export const PARTNER_CONSENT_SELECTORS = [
  { name: 'partner-consent-dialog', selector: '[data-testid*="partner"], [data-testid*="consent"], [role="dialog"]' }
];

export const PARTNER_CONSENT_ACTION_TEXTS = ['OK', 'Continue', 'Start', 'Add', 'Agree'];

export async function findFirstVisibleLocator(page, strategies, options = {}) {
  const timeoutMs = options.timeoutMs ?? 1500;

  for (const strategy of strategies) {
    const locator = page.locator(strategy.selector).first();
    try {
      if (await locator.isVisible({ timeout: timeoutMs })) {
        return { strategy, locator };
      }
    } catch {
      // Keep trying fallbacks.
    }
  }

  return null;
}

export async function findPickerByHints(page, hints = [], options = {}) {
  const timeoutMs = options.timeoutMs ?? 1500;
  const normalizedHints = hints.map((hint) => String(hint || '').toLowerCase()).filter(Boolean);
  const pickers = page.locator('sp-picker');
  const count = await pickers.count().catch(() => 0);

  for (let index = 0; index < count; index++) {
    const locator = pickers.nth(index);
    try {
      if (!(await locator.isVisible({ timeout: timeoutMs }))) {
        continue;
      }

      const text = ((await locator.textContent()) || '').toLowerCase();
      const ariaLabel = ((await locator.getAttribute('aria-label')) || '').toLowerCase();
      const combined = `${text} ${ariaLabel}`;

      if (normalizedHints.some((hint) => combined.includes(hint))) {
        return {
          strategy: { name: `semantic-picker-${normalizedHints[0] || 'generic'}`, selector: 'sp-picker' },
          locator
        };
      }
    } catch {
      // Try next picker.
    }
  }

  return null;
}

export async function findOptionByTexts(page, texts, options = {}) {
  const timeoutMs = options.timeoutMs ?? 2000;
  const uniqueTexts = [...new Set((texts || []).filter(Boolean))];

  for (const text of uniqueTexts) {
    const escaped = textToPattern(text);
    const candidates = [
      { name: `sp-menu-item:${text}`, locator: page.locator(`sp-menu-item:has-text("${text}")`).first() },
      { name: `role-option:${text}`, locator: page.getByRole('option', { name: new RegExp(`^${escaped}$`, 'i') }).first() },
      { name: `text:${text}`, locator: page.getByText(new RegExp(escaped, 'i')).first() }
    ];

    for (const candidate of candidates) {
      try {
        if (await candidate.locator.isVisible({ timeout: timeoutMs })) {
          return candidate;
        }
      } catch {
        // Keep trying variants.
      }
    }
  }

  return null;
}

export function buildModelOptionTexts(model) {
  return [model?.label, ...(model?.aliases || [])].filter(Boolean);
}

export async function collectVisibleText(page, selector) {
  try {
    return await page.locator(selector).first().textContent();
  } catch {
    return '';
  }
}

export async function findPartnerConsentButton(page, options = {}) {
  const timeoutMs = options.timeoutMs ?? 1200;

  for (const text of PARTNER_CONSENT_ACTION_TEXTS) {
    try {
      const locator = page.getByRole('button', { name: new RegExp(text, 'i') }).first();
      if (await locator.isVisible({ timeout: timeoutMs })) {
        return {
          action: text,
          locator
        };
      }
    } catch {
      // Continue to next action.
    }
  }

  return null;
}
