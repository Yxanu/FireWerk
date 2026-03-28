function isVisible(element) {
  if (!element) return false;
  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.visibility !== 'hidden' &&
    style.display !== 'none' &&
    rect.width > 0 &&
    rect.height > 0;
}

function findShadowEditable(host) {
  if (!host?.shadowRoot) return null;

  const candidates = [
    host.shadowRoot.querySelector('textarea'),
    host.shadowRoot.querySelector('[contenteditable="true"]'),
    host.shadowRoot.querySelector('[role="textbox"]'),
    host.shadowRoot.querySelector('firefly-textfield')?.shadowRoot?.querySelector('textarea'),
    host.shadowRoot.querySelector('sp-textfield')?.shadowRoot?.querySelector('textarea')
  ].filter(Boolean);

  return candidates.find((candidate) => isVisible(candidate)) || null;
}

export const FIREFLY_PAGE_STATES = {
  READY_FOR_PROMPT: 'ready_for_prompt',
  CREDIT_GATE: 'credit_gate',
  AUTH_GATE: 'auth_gate',
  LOADING: 'loading',
  UNKNOWN: 'unknown'
};

export async function detectFireflyGeneratePageState(page) {
  const hasAuthFrame = page.frames().some((frame) => {
    const url = frame.url();
    return url.includes('auth-light.identity.adobe.com') ||
      url.includes('auth.services.adobe.com') ||
      url.includes('adobeid.adobe.com');
  });

  const pageState = await page.evaluate((pageStates) => {
    function isVisibleInPage(element) {
      if (!element) return false;
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== 'hidden' &&
        style.display !== 'none' &&
        rect.width > 0 &&
        rect.height > 0;
    }

    function findShadowEditableInPage(host) {
      if (!host?.shadowRoot) return null;

      const candidates = [
        host.shadowRoot.querySelector('textarea'),
        host.shadowRoot.querySelector('[contenteditable="true"]'),
        host.shadowRoot.querySelector('[role="textbox"]'),
        host.shadowRoot.querySelector('firefly-textfield')?.shadowRoot?.querySelector('textarea'),
        host.shadowRoot.querySelector('sp-textfield')?.shadowRoot?.querySelector('textarea')
      ].filter(Boolean);

      return candidates.find((candidate) => isVisibleInPage(candidate)) || null;
    }

    const bodyText = document.body.innerText || '';
    const lowerText = bodyText.toLowerCase();
    const promptHosts = Array.from(document.querySelectorAll('firefly-prompt, [data-testid="prompt-bar-input"]'));
    const visiblePromptHost = promptHosts.find((host) => isVisibleInPage(host)) || null;
    const shadowEditable = visiblePromptHost ? findShadowEditableInPage(visiblePromptHost) : null;
    const authIframes = Array.from(document.querySelectorAll('iframe'))
      .filter((element) => /auth-light\.identity\.adobe\.com|auth\.services\.adobe\.com|adobeid\.adobe\.com/i.test(element.getAttribute('src') || ''));
    const visibleAuthIframes = authIframes.filter((element) => isVisibleInPage(element));

    const visibleTextareas = Array.from(document.querySelectorAll('textarea')).filter((element) => isVisibleInPage(element));
    const visibleContentEditable = Array.from(document.querySelectorAll('[contenteditable="true"], [role="textbox"]'))
      .filter((element) => isVisibleInPage(element));

    const generateButtons = Array.from(document.querySelectorAll('button, [role="button"]'))
      .filter((element) => isVisibleInPage(element))
      .filter((element) => /generate|create/i.test(element.textContent || '') || element.getAttribute('data-testid') === 'generate-button');

    const promptLabels = Array.from(document.querySelectorAll('label, span, div, p'))
      .filter((element) => isVisibleInPage(element))
      .filter((element) => (element.textContent || '').trim() === 'Prompt');

    const generalSettingsVisible = lowerText.includes('general settings') && lowerText.includes('model');
    const creditsButtonVisible = lowerText.includes('get credits');
    const authCopyVisible = lowerText.includes('sign in') || lowerText.includes('continue with email');
    const loadingVisible = Array.from(document.querySelectorAll('[aria-busy="true"], [role="progressbar"], [class*="loader"], [class*="spinner"]'))
      .some((element) => isVisibleInPage(element)) || lowerText.includes('loading');

    const creditDialogVisible = Array.from(document.querySelectorAll('[role="dialog"], [class*="modal"], [class*="dialog"]'))
      .filter((element) => isVisibleInPage(element))
      .some((element) => /credits|upgrade|buy|purchase|premium|get credits/i.test(element.textContent || ''));

    const hasPromptShell = Boolean(visiblePromptHost) || promptLabels.some((label) => {
      const rect = label.getBoundingClientRect();
      return rect.top > window.innerHeight * 0.55;
    });

    const hasEditableField = Boolean(shadowEditable) || visibleTextareas.length > 0 || visibleContentEditable.length > 0;
    const hasGenerateButton = generateButtons.length > 0;
    const generateButtonDisabled = generateButtons.every((button) =>
      button.hasAttribute('disabled') ||
      button.getAttribute('aria-disabled') === 'true'
    );

    let matchedState = pageStates.UNKNOWN;
    let reason = 'No known state matched';

    if (authCopyVisible) {
      matchedState = pageStates.AUTH_GATE;
      reason = 'Authentication copy is visible on the page';
    } else if (creditDialogVisible && !hasPromptShell && !hasEditableField) {
      matchedState = pageStates.CREDIT_GATE;
      reason = 'A visible credit or upgrade dialog is blocking the page';
    } else if ((hasPromptShell || hasEditableField) && hasGenerateButton && generalSettingsVisible) {
      matchedState = pageStates.READY_FOR_PROMPT;
      reason = hasEditableField
        ? 'Prompt surface and editable field are visible'
        : 'Prompt shell is visible with settings and generate button';
    } else if (loadingVisible) {
      matchedState = pageStates.LOADING;
      reason = 'A loading indicator is visible';
    } else if (creditsButtonVisible && hasGenerateButton && generalSettingsVisible && hasPromptShell) {
      matchedState = pageStates.READY_FOR_PROMPT;
      reason = 'Credits CTA is visible but prompt shell is also present';
    }

    return {
      matchedState,
      reason,
      hasPromptShell,
      hasEditableField,
      hasVisiblePromptHost: Boolean(visiblePromptHost),
      hasShadowEditable: Boolean(shadowEditable),
      hasGenerateButton,
      generateButtonDisabled,
      generalSettingsVisible,
      creditsButtonVisible,
      creditDialogVisible,
      authCopyVisible,
      loadingVisible,
      promptLabelCount: promptLabels.length,
      visibleTextareaCount: visibleTextareas.length,
      visibleContentEditableCount: visibleContentEditable.length,
      authFrameCount: authIframes.length,
      visibleAuthFrameCount: visibleAuthIframes.length,
      hasVisibleAuthFrame: visibleAuthIframes.length > 0,
      bodyPreview: bodyText.slice(0, 500)
    };
  }, FIREFLY_PAGE_STATES);

  return {
    ...pageState,
    hasAuthFrame
  };
}
