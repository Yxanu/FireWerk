import 'dotenv/config';
import { chromium } from 'playwright';
import fs from 'fs/promises';

const FIRE_URL = process.env.FIRELFY_URL || 'https://firefly.adobe.com/generate/images';
const LOGIN_EMAIL = process.env.ADOBE_LOGIN_EMAIL || 'web@adam-medien.de';
const FORCE_FRESH = process.env.FORCE_FRESH_LOGIN === 'true';
const VYBIT_WEBHOOK = process.env.VYBIT_WEBHOOK || 'https://vybit.net/trigger/jrlyj4am4a90pa0c';

// Helper to send webhook notification
async function sendVybitNotification(message) {
  try {
    const response = await fetch(VYBIT_WEBHOOK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    console.log(`📲 Vybit notification sent: ${message}`);
  } catch (err) {
    console.log(`Could not send vybit notification: ${err.message}`);
  }
}

const launchOptions = {
  headless: false,
  // Position window off-screen (right side of primary display or on secondary monitor)
  args: FORCE_FRESH ? ['--incognito'] : []
};

if (FORCE_FRESH) {
  console.log('Using fresh browser profile for testing login flow...');
}

const browser = await chromium.launch(launchOptions);

// Create context with window positioned off to the side
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  // Position window far to the right (works for multi-monitor or just moves it off main workspace)
  screen: { width: 1280, height: 800 },
});

const page = await context.newPage();

// Move window to the right side/second screen
await page.evaluate(() => {
  window.moveTo(2000, 0); // Move window 2000px to the right
});

await page.goto(FIRE_URL);
await page.waitForTimeout(3000);

// Function to dismiss cookie consent banner
async function dismissCookieBanner() {
  try {
    const consentButton = page.locator('#onetrust-accept-btn-handler, button:has-text("Accept"), button:has-text("Enable all")').first();
    if (await consentButton.isVisible({ timeout: 2000 })) {
      await consentButton.click({ force: true });
      console.log('Dismissed cookie consent');
      await page.waitForTimeout(1000);
      return true;
    }
  } catch {}
  return false;
}

await dismissCookieBanner();

// Check if we're already logged in by checking for "Sign in" button
const signInBtnExists = await page.getByRole('button', { name: /sign in/i }).or(page.getByRole('link', { name: /sign in/i })).isVisible({ timeout: 3000 }).catch(() => false);
const hasGenerateButton = await page.getByTestId('generate-button').isVisible({ timeout: 3000 }).catch(() => false);

console.log('=== DEBUG INFO ===');
console.log(`Current URL: ${page.url()}`);
console.log(`Sign in button visible: ${signInBtnExists}`);
console.log(`Generate button visible: ${hasGenerateButton}`);

// Check if generate button is enabled
let generateBtnEnabled = false;
if (hasGenerateButton) {
  generateBtnEnabled = await page.evaluate(() => {
    const btn = document.querySelector('[data-testid="generate-button"]');
    return btn && !btn.hasAttribute('aria-disabled') && btn.getAttribute('aria-disabled') !== 'true';
  });
  console.log(`Generate button enabled: ${generateBtnEnabled}`);
}

// Take screenshot for debugging
try {
  await page.screenshot({ path: './data/debug-page.png', fullPage: false });
  console.log('Screenshot saved to ./data/debug-page.png');
} catch {}

const needsLogin = signInBtnExists || !generateBtnEnabled;
console.log(`Needs login: ${needsLogin}`);
console.log('==================\n');

if (needsLogin) {
  console.log('Not logged in. Attempting automatic login...');

  // Click the Sign in button to open the modal
  try {
    const signInBtn = page.getByRole('button', { name: /^sign in$/i }).first();
    if (await signInBtn.isVisible({ timeout: 3000 })) {
      console.log('Clicking "Sign in" button in header...');
      await signInBtn.click();
      await page.waitForTimeout(3000); // Wait for modal/iframe to load
      console.log('Login interface should now be visible');
    }
  } catch (err) {
    console.log(`Could not click sign in button: ${err.message}`);
  }

  // Check if there's an iframe (Adobe often uses iframes for login)
  const frames = page.frames();
  console.log(`Found ${frames.length} frames on page`);
  let authFrame = null;
  let authFrameIndex = -1;

  for (let i = 0; i < frames.length; i++) {
    const frame = frames[i];
    const url = frame.url();
    console.log(`Frame ${i}: ${url}`);

    // Look for Adobe auth iframe
    if (url.includes('auth-light.identity.adobe.com') || url.includes('auth.services.adobe.com')) {
      authFrame = frame;
      authFrameIndex = i;
      console.log(`✓ Found Adobe auth frame at index ${i}`);
    }
  }

  // Take screenshot
  await page.screenshot({ path: './data/debug-before-email.png' });
  console.log('Screenshot saved: ./data/debug-before-email.png');

  // Notify user to complete login manually
  console.log('\n==============================================');
  console.log('📋 PLEASE COMPLETE LOGIN IN BROWSER');
  console.log('1. Click "Sign in" (blue link under "Continue with email")');
  console.log(`2. Enter email: ${LOGIN_EMAIL}`);
  console.log('3. Click "Continue"');
  console.log('4. Approve in Adobe Access app (press the number)');
  console.log('This is ONLY needed once - future runs will be automatic!');
  console.log('==============================================\n');

  await sendVybitNotification('🔐 Please complete Adobe login in browser');

  // Wait for login to complete by checking for generate button
  console.log('Waiting for you to complete the login...');
  try {
    await page.getByTestId('generate-button').waitFor({ timeout: 120000, state: 'visible' });
    console.log('✓ Login successful! Generate button appeared.');
    await sendVybitNotification('✅ Adobe login successful!');
  } catch (e) {
    console.error(`Login timeout: ${e.message}`);
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

