import 'dotenv/config';
import { chromium } from 'playwright';
import fs from 'fs/promises';

const FIRE_URL = process.env.FIRELFY_URL || 'https://firefly.adobe.com/generate/images';
const LOGIN_EMAIL = process.env.ADOBE_LOGIN_EMAIL || 'web@adam-medien.de';

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext(); // fresh storage
const page = await context.newPage();

await page.goto(FIRE_URL);
await page.waitForTimeout(3000);

// Dismiss cookie consent if present
try {
  const consentButton = page.locator('#onetrust-accept-btn-handler, button:has-text("Accept"), button:has-text("Enable all")');
  if (await consentButton.isVisible({ timeout: 3000 })) {
    await consentButton.click();
    console.log('Dismissed cookie consent');
    await page.waitForTimeout(1000);
  }
} catch {}

// Check if we need to login
const isSignInPage = await page.evaluate(() => {
  const bodyText = document.body.innerText.toLowerCase();
  return bodyText.includes('sign in') || bodyText.includes('sign in to') || bodyText.includes('log in');
});

if (isSignInPage) {
  console.log(`Attempting automatic login with ${LOGIN_EMAIL}...`);
  try {
    // Find and fill email input
    const emailInput = page.locator('input[type="email"], input[name="email"], input[id*="email"], input[placeholder*="email" i]').first();
    await emailInput.waitFor({ timeout: 10000, state: 'visible' });
    await emailInput.fill(LOGIN_EMAIL);
    console.log(`Filled email: ${LOGIN_EMAIL}`);
    await page.waitForTimeout(1000);
    
    // Click continue/submit button
    const continueBtn = page.getByRole('button', { name: /continue|sign in|next|submit/i }).first();
    await continueBtn.click({ timeout: 5000 });
    console.log('Clicked continue - waiting for 2FA approval in Adobe access app...');
    console.log('Please approve the login request in your Adobe access app (press the number).');
    
    // Wait for login to complete
    await page.waitForFunction(
      () => {
        const bodyText = document.body.innerText.toLowerCase();
        return !bodyText.includes('sign in') && !bodyText.includes('sign in to');
      },
      { timeout: 120000 }
    );
    console.log('Login successful!');
    await page.waitForTimeout(2000);
  } catch (e) {
    console.warn(`Automatic login failed: ${e.message}`);
    console.log('Please login manually...');
  }
}

// Wait until the Generate UI is present:
await page.getByTestId('generate-button').waitFor({ timeout: 120000, state: 'visible' });
// Wait a bit more to ensure page is fully loaded
await page.waitForTimeout(2000);

await fs.mkdir('./data', { recursive: true });
await context.storageState({ path: './data/storageState.json' });
console.log('✅ Saved ./data/storageState.json');
await browser.close();

