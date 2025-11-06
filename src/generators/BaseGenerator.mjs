import { chromium } from 'playwright';
import fs from 'fs/promises';

export class BaseGenerator {
  constructor(config = {}) {
    this.config = {
      headless: (process.env.PW_HEADLESS ?? process.env.HEADLESS ?? 'true') === 'true',
      storageState: process.env.STORAGE_STATE || './data/storageState.json',
      outputDir: process.env.OUTPUT_DIR || './output',
      ...config
    };

    this.browser = null;
    this.context = null;
    this.page = null;
  }

  async init() {
    this.browser = await chromium.launch({ headless: this.config.headless });

    const contextOptions = { viewport: { width: 1366, height: 900 } };

    // Try to load storage state if it exists
    try {
      await fs.access(this.config.storageState);
      contextOptions.storageState = this.config.storageState;
      console.log(`[INFO] Using storage state from ${this.config.storageState}`);
    } catch {
      console.log('[INFO] No storage state found - will need to login');
    }

    this.context = await this.browser.newContext(contextOptions);
    this.page = await this.context.newPage();

    // Move window off-screen if not headless
    if (!this.config.headless) {
      try {
        await this.page.evaluate(() => {
          window.moveTo(2000, 0);
        });
      } catch {}
    }
  }

  async dismissCookieBanner() {
    try {
      const consentButton = this.page.locator('#onetrust-accept-btn-handler, button:has-text("Accept"), button:has-text("Enable all")').first();
      if (await consentButton.isVisible({ timeout: 2000 })) {
        await consentButton.click({ force: true });
        console.log('[INFO] Dismissed cookie consent banner');
        await this.page.waitForTimeout(1000);
        return true;
      }
    } catch {}
    return false;
  }

  async checkLogin() {
    // Wait a bit for page to settle after navigation
    await this.page.waitForTimeout(2000);

    // Check multiple indicators of being logged in
    const signInSelectors = [
      'button:has-text("Sign in")',
      'a:has-text("Sign in")',
      '[data-testid="sign-in-button"]',
      '[aria-label*="Sign in"]'
    ];

    let signInVisible = false;
    for (const selector of signInSelectors) {
      try {
        const el = this.page.locator(selector).first();
        if (await el.isVisible({ timeout: 1500 })) {
          signInVisible = true;
          break;
        }
      } catch {}
    }

    if (signInVisible) {
      console.log('[INFO] Sign in control visible - not logged in');
      return false;
    }

    const generateBtnVisible = await this.page.getByTestId('generate-button').isVisible({ timeout: 3000 }).catch(() => false);
    const avatarVisible = await this.page.locator('[aria-label*="account"], [aria-label*="profile"], [data-testid*="avatar"], [data-testid*="account"]').isVisible({ timeout: 2000 }).catch(() => false);

    // If we see the generate button, we're logged in
    if (generateBtnVisible || avatarVisible) {
      console.log('[INFO] Already logged in - authenticated UI detected');
      return true;
    }

    // If no sign in button and no generate button yet, might be loading
    await this.page.waitForTimeout(3000);
    const genBtnAfterWait = await this.page.getByTestId('generate-button').isVisible({ timeout: 5000 }).catch(() => false);
    if (genBtnAfterWait) {
      console.log('[INFO] Already logged in - generate button appeared after wait');
      return true;
    }

    console.log('[INFO] Not logged in - will need to authenticate');
    return false;
  }

  async login(email) {
    console.log('\n==============================================');
    console.log('🔐 Starting automated login...');
    console.log('==============================================\n');

    // Step 1: Click "Continue with email" button
    try {
      const continueWithEmailBtn = this.page.locator('button:has-text("Continue with email")').first();
      await continueWithEmailBtn.waitFor({ timeout: 5000, state: 'visible' });
      await continueWithEmailBtn.click();
      console.log('[INFO] Clicked "Continue with email"');
      await this.page.waitForTimeout(2000);
    } catch (err) {
      console.log('[WARN] Could not find "Continue with email" button, trying direct email input...');
    }

    // Step 2: Fill in email
    try {
      const emailInput = this.page.locator('input[type="email"], input[name="username"]').first();
      await emailInput.waitFor({ timeout: 10000, state: 'visible' });
      await emailInput.fill(email);
      console.log(`[INFO] Filled email: ${email}`);
      await this.page.waitForTimeout(1000);

      // Step 3: Click Continue button
      const continueBtn = this.page.locator('button:has-text("Continue"), button[type="submit"]').first();
      await continueBtn.click();
      console.log('[INFO] Clicked "Continue" button');
      await this.page.waitForTimeout(2000);
    } catch (err) {
      console.log(`[ERROR] Failed to fill email or click continue: ${err.message}`);
    }

    // Step 4: Extract 2FA number and wait for approval
    await this.page.waitForTimeout(3000);

    let twoFANumber = 'unknown';
    try {
      // Try to extract the 2FA number from the page
      twoFANumber = await this.page.evaluate(() => {
        // Look for various patterns that might contain the number
        const bodyText = document.body.innerText;

        // Pattern: "Press XX on your device"
        let match = bodyText.match(/(?:Press|Enter|Type)\s+(\d{2})/i);
        if (match) return match[1];

        // Pattern: standalone 2-digit number in large text
        const elements = document.querySelectorAll('h1, h2, h3, .number, [class*="code"], [class*="number"]');
        for (const el of elements) {
          const text = el.textContent.trim();
          if (/^\d{2}$/.test(text)) return text;
        }

        return null;
      });
    } catch (err) {
      console.log('[WARN] Could not extract 2FA number from page');
    }

    console.log('\n==============================================');
    console.log('📱 PLEASE APPROVE IN ADOBE ACCESS APP');
    if (twoFANumber && twoFANumber !== 'unknown') {
      console.log(`🔢 Press the number: ${twoFANumber}`);
    } else {
      console.log('Press the number shown on screen in your Access app');
    }
    console.log('==============================================\n');

    // Wait for the "Sign in" button to disappear (means logged in)
    try {
      await this.page.locator('button:has-text("Sign in"), [data-testid="sign-in-button"], [aria-label*="Sign in"]').waitFor({ state: 'hidden', timeout: 120000 });
    } catch {}

    console.log('✅ Login successful!');

    // Save storage state
    await this.context.storageState({ path: this.config.storageState });
    console.log(`[INFO] Saved storage state to ${this.config.storageState}`);
  }

  async ensureDir(path) {
    await fs.mkdir(path, { recursive: true });
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
    }
  }

  safeName(name) {
    return String(name).replace(/[^\w\d-_]+/g, '_').slice(0, 120);
  }
}
