import { chromium } from 'playwright';
import fs from 'fs/promises';

const AUTH_FRAME_HOSTS = [
  'auth-light.identity.adobe.com',
  'auth.services.adobe.com',
  'adobeid.adobe.com'
];

const SIGN_IN_SELECTORS = [
  'button:has-text("Sign in")',
  'a:has-text("Sign in")',
  'button:has-text("Sign In")',
  'a:has-text("Sign In")',
  '[data-testid="sign-in-button"]',
  '[aria-label*="Sign in"]',
  '[aria-label*="Sign In"]',
  'firefly-sign-in-dialog'
];

export class BaseGenerator {
  constructor(config = {}) {
    const defaultHeadless = (process.env.PW_HEADLESS ?? process.env.HEADLESS ?? 'true') === 'true';
    this.config = {
      headless: config.headless ?? defaultHeadless,
      storageState: process.env.STORAGE_STATE || './data/storageState.json',
      outputDir: process.env.OUTPUT_DIR || './output',
      viewport: {
        width: Number(process.env.PW_VIEWPORT_W || 1440),
        height: Number(process.env.PW_VIEWPORT_H || 960)
      },
      ...config
    };

    this.browser = null;
    this.context = null;
    this.page = null;
  }

  async init() {
    this.browser = await chromium.launch({ headless: this.config.headless });

    const contextOptions = {
      viewport: this.config.viewport,
      acceptDownloads: true
    };

    try {
      await fs.access(this.config.storageState);
      contextOptions.storageState = this.config.storageState;
      console.log(`[INFO] Using storage state from ${this.config.storageState}`);
    } catch {
      console.log('[INFO] No storage state found - will need to login');
    }

    this.context = await this.browser.newContext(contextOptions);
    this.page = await this.context.newPage();
  }

  async openPage(url, options = {}) {
    const waitUntil = options.waitUntil || 'domcontentloaded';
    const timeout = options.timeout || 60000;
    await this.page.goto(url, { waitUntil, timeout });
  }

  async dismissCookieBanner() {
    try {
      const consentButton = this.page.locator('#onetrust-accept-btn-handler, button:has-text("Accept"), button:has-text("Enable all")').first();
      if (await consentButton.isVisible({ timeout: 2000 })) {
        await consentButton.click({ force: true });
        await this.page.waitForTimeout(500);
        console.log('[INFO] Dismissed cookie consent banner');
        return true;
      }
    } catch {
      // Ignore cookie-banner misses.
    }

    return false;
  }

  getAuthenticationFrames() {
    return this.page.frames().filter((frame) =>
      AUTH_FRAME_HOSTS.some((host) => frame.url().includes(host))
    );
  }

  async getAuthenticationState() {
    const authFrames = this.getAuthenticationFrames();
    const frameStates = await Promise.all(authFrames.map(async (frame) => {
      let visible = false;
      let interactive = false;

      try {
        const frameElement = await frame.frameElement();
        visible = await frameElement.isVisible({ timeout: 500 }).catch(() => false);
      } catch {
        visible = false;
      }

      if (visible) {
        try {
          interactive = await frame.locator(
            'input[type="email"], input[name="username"], button:has-text("Continue"), button:has-text("Sign in"), a:has-text("Continue with email")'
          ).first().isVisible({ timeout: 500 }).catch(() => false);
        } catch {
          interactive = false;
        }
      }

      return {
        url: frame.url(),
        visible,
        interactive
      };
    }));

    return {
      hasAuthFrame: frameStates.length > 0,
      hasVisibleAuthFrame: frameStates.some((frame) => frame.visible),
      hasInteractiveAuthFrame: frameStates.some((frame) => frame.visible && frame.interactive),
      frameStates
    };
  }

  async isSignInVisible(timeout = 1000) {
    for (const selector of SIGN_IN_SELECTORS) {
      try {
        if (await this.page.locator(selector).first().isVisible({ timeout })) {
          return true;
        }
      } catch {
        // Try next selector.
      }
    }

    return false;
  }

  async hasAuthenticatedUi(timeout = 2000) {
    const checks = await Promise.allSettled([
      this.page.getByTestId('generate-button').isVisible({ timeout }),
      this.page.locator('textarea, [role="textbox"][contenteditable="true"]').first().isVisible({ timeout }),
      this.page.locator('[aria-label*="account"], [aria-label*="profile"], [data-testid*="avatar"], [data-testid*="account"]').first().isVisible({ timeout })
    ]);

    return checks.some((result) => result.status === 'fulfilled' && result.value === true);
  }

  async checkLogin() {
    await this.page.waitForTimeout(1000);
    const authState = await this.getAuthenticationState();

    if (await this.hasAuthenticatedUi(1800)) {
      console.log('[INFO] Authenticated UI detected');
      return true;
    }

    if (await this.isSignInVisible(1200)) {
      console.log('[INFO] Sign-in UI visible - not logged in');
      return false;
    }

    if (authState.hasInteractiveAuthFrame || authState.hasVisibleAuthFrame) {
      console.log('[INFO] Visible authentication iframe detected - not logged in');
      return false;
    }

    await this.page.waitForTimeout(2000);
    if (await this.hasAuthenticatedUi(1800)) {
      console.log('[INFO] Authenticated UI detected after wait');
      return true;
    }

    const authStateAfterWait = await this.getAuthenticationState();
    return !authStateAfterWait.hasVisibleAuthFrame && !(await this.isSignInVisible(800));
  }

  async getAuthFrame() {
    const authFrames = this.getAuthenticationFrames();
    const authState = await this.getAuthenticationState();
    const visibleFrameUrl = authState.frameStates.find((frame) => frame.visible)?.url;
    if (visibleFrameUrl) {
      return authFrames.find((frame) => frame.url() === visibleFrameUrl) || authFrames[0] || null;
    }

    return authFrames[0] || null;
  }

  async login(email) {
    console.log('\n==============================================');
    console.log('🔐 Starting automated login...');
    console.log('==============================================\n');

    try {
      const signInBtn = this.page.getByRole('button', { name: /^sign\s*in$/i }).first();
      if (await signInBtn.isVisible({ timeout: 3000 })) {
        await signInBtn.click();
        await this.page.waitForTimeout(2000);
      }
    } catch {
      // The page may already be on the auth step.
    }

    const authFrame = await this.getAuthFrame();
    const scope = authFrame || this.page;

    try {
      const continueWithEmailBtn = scope.locator('button:has-text("Continue with email"), a:has-text("Continue with email")').first();
      if (await continueWithEmailBtn.isVisible({ timeout: 3000 })) {
        await continueWithEmailBtn.click();
        await this.page.waitForTimeout(1500);
      }
    } catch {
      // Some auth states land directly on the email field.
    }

    try {
      const emailInput = scope.locator('input[type="email"], input[name="username"], input[id*="email"]').first();
      await emailInput.waitFor({ timeout: 10000, state: 'visible' });
      await emailInput.fill(email);

      const continueBtn = scope.locator('button:has-text("Continue"), button[type="submit"]').first();
      if (await continueBtn.isVisible({ timeout: 3000 })) {
        await continueBtn.click();
      }
    } catch (error) {
      console.log(`[WARN] Email autofill/login continue failed: ${error.message}`);
    }

    const twoFANumber = await this.extractTwoFactorNumber(authFrame);
    console.log('\n==============================================');
    console.log('📱 PLEASE APPROVE IN ADOBE ACCESS APP');
    if (twoFANumber) {
      console.log(`🔢 Press the number: ${twoFANumber}`);
    } else {
      console.log('Press the number shown on screen in your Access app');
    }
    console.log('==============================================\n');

    await this.waitForLoginCompletion();
    await this.saveStorageState();
  }

  async extractTwoFactorNumber(authFrame) {
    const scopes = [authFrame, this.page].filter(Boolean);

    for (const scope of scopes) {
      try {
        const code = await scope.evaluate(() => {
          const bodyText = document.body.innerText;
          const match = bodyText.match(/(?:Press|Enter|Type)\s+(\d{2})/i);
          if (match) return match[1];

          const elements = document.querySelectorAll('h1, h2, h3, .number, [class*="code"], [class*="number"]');
          for (const element of elements) {
            const text = element.textContent.trim();
            if (/^\d{2}$/.test(text)) return text;
          }

          return null;
        });

        if (code) {
          return code;
        }
      } catch {
        // Try the next scope.
      }
    }

    return null;
  }

  async waitForLoginCompletion() {
    try {
      await this.page.waitForFunction(
        () => {
          const hasGenerateBtn = Boolean(document.querySelector('[data-testid="generate-button"]'));
          const hasPrompt = Boolean(document.querySelector('textarea, [role="textbox"][contenteditable="true"]'));
          const signInCopy = document.body.innerText.toLowerCase().includes('sign in');
          return (hasGenerateBtn || hasPrompt) && !signInCopy;
        },
        { timeout: 120000 }
      );
      console.log('✅ Login successful!');
      return;
    } catch {
      // Fall back to slower checks below.
    }

    await this.page.waitForTimeout(3000);
    if (await this.checkLogin()) {
      console.log('✅ Login successful!');
      return;
    }

    console.log('[WARN] Login completion check timed out, continuing with current session state');
  }

  async ensureAuthenticatedSession(email, url) {
    await this.openPage(url);
    await this.dismissCookieBanner();

    if (await this.checkLogin()) {
      await this.saveStorageState();
      return true;
    }

    if (this.config.headless) {
      throw new Error('Headless mode requires a valid Firefly session. Run `npm run auth:refresh` or start with `PW_HEADLESS=false` for interactive auth/debug.');
    }

    await this.login(email);
    await this.openPage(url);
    await this.dismissCookieBanner();

    if (await this.checkLogin()) {
      await this.saveStorageState();
      return true;
    }

    await this.page.waitForTimeout(1500);
    await this.page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await this.dismissCookieBanner();

    const authenticated = await this.checkLogin();
    if (authenticated) {
      await this.saveStorageState();
    }

    return authenticated;
  }

  async saveStorageState() {
    try {
      const storageStatePath = this.config.storageState;
      const dir = storageStatePath.includes('/') ? storageStatePath.slice(0, storageStatePath.lastIndexOf('/')) : '.';
      await fs.mkdir(dir, { recursive: true });
      await this.context.storageState({ path: storageStatePath });
      console.log(`[INFO] Saved storage state to ${storageStatePath}`);
    } catch (error) {
      console.log(`[WARN] Could not save storage state: ${error.message}`);
    }
  }

  async ensureDir(targetPath) {
    await fs.mkdir(targetPath, { recursive: true });
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  safeName(name) {
    return String(name).replace(/[^\w\d-_]+/g, '_').slice(0, 120);
  }
}
