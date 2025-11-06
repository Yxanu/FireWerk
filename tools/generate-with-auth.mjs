import 'dotenv/config';
import { chromium } from 'playwright';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

const FIRE_URL = process.env.FIRELFY_URL || 'https://firefly.adobe.com/generate/images';
const PROMPT_FILE = process.env.PROMPT_FILE || './data/prompts.csv';
const OUTPUT_DIR = process.env.OUTPUT_DIR || './output';
const STORAGE_STATE = process.env.STORAGE_STATE || './data/storageState.json';
const HEADLESS = (process.env.PW_HEADLESS ?? process.env.HEADLESS ?? 'true') === 'true';
const VARIANTS = Number(process.env.VARIANTS_PER_PROMPT || 1);
const WAIT_AFTER_CLICK = Number(process.env.POST_CLICK_WAIT_MS || 15000); // Increased to 15s for generation

const IMG_MIME = new Set(['image/jpeg','image/png','image/webp','image/jpg']);

function safeName(v) {
  return String(v).replace(/[^\w\d-_]+/g, '_').slice(0, 120);
}

function loadPromptsSync(filePath) {
  const raw = fsSync.readFileSync(filePath, 'utf8');
  if (filePath.endsWith('.json')) return JSON.parse(raw);
  return parse(raw, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    escape: '"'
  });
}

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

const prompts = loadPromptsSync(PROMPT_FILE);
console.log(`[INFO] Loaded ${prompts.length} prompts from ${PROMPT_FILE}`);
await ensureDir(OUTPUT_DIR);

const browser = await chromium.launch({ headless: HEADLESS });
const contextOptions = { viewport: { width: 1366, height: 900 } };

// Try to load storage state if it exists
let hasStorageState = false;
try {
  await fs.access(STORAGE_STATE);
  contextOptions.storageState = STORAGE_STATE;
  hasStorageState = true;
  console.log(`[INFO] Using storage state from ${STORAGE_STATE}`);
} catch {
  console.log('[INFO] No storage state found - will need to login');
}

const context = await browser.newContext(contextOptions);
const page = await context.newPage();

// Move window off-screen if not headless
if (!HEADLESS) {
  try {
    await page.evaluate(() => {
      window.moveTo(2000, 0);
    });
  } catch {}
}

// Network capture - track ALL images during generation and filter intelligently
const captured = [];
let isGenerating = false;
const capturedDuringGeneration = [];

page.on('response', async (res) => {
  try {
    const url = res.url();
    const ct = (res.headers()['content-type'] || '').toLowerCase();

    // Must be an image type
    if (!IMG_MIME.has(ct)) return;

    const buf = await res.body();

    // If we're actively generating, capture EVERYTHING to debug
    if (isGenerating && buf && buf.length > 1024) {
      const isUI = url.includes('/image-styles/') ||
                   url.includes('/structure-match/') ||
                   url.includes('/image-style-zeros/') ||
                   url.includes('firefly-app-icons') ||
                   url.includes('favicon');

      console.log(`[DEBUG] Image response (${isUI ? 'UI' : 'POTENTIAL GEN'}): ${url} (${Math.round(buf.length/1024)} KB)`);

      if (!isUI && buf.length > 10240) {
        capturedDuringGeneration.push({ buf, ct, size: buf.length, url: res.url(), timestamp: Date.now() });
      }
    }
  } catch {}
});

await page.goto(FIRE_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(5000);

// Dismiss cookie banner
async function dismissCookieBanner() {
  try {
    const consentButton = page.locator('#onetrust-accept-btn-handler, button:has-text("Accept"), button:has-text("Enable all")').first();
    if (await consentButton.isVisible({ timeout: 2000 })) {
      await consentButton.click({ force: true });
      console.log('[INFO] Dismissed cookie consent banner');
      await page.waitForTimeout(1000);
      return true;
    }
  } catch {}
  return false;
}

await dismissCookieBanner();

// Take a debug screenshot before checking login
await page.screenshot({ path: './data/debug-before-generation.png', fullPage: true });
console.log('[DEBUG] Screenshot saved to ./data/debug-before-generation.png');

// Check if we're actually logged in - improved detection
await page.waitForTimeout(2000);
const signInBtnVisible = await page.locator('button:has-text("Sign in")').isVisible({ timeout: 3000 }).catch(() => false);
const generateBtnVisible = await page.getByTestId('generate-button').isVisible({ timeout: 3000 }).catch(() => false);

// If generate button is visible, we're definitely logged in
const needsLogin = !generateBtnVisible && signInBtnVisible;

console.log(`[DEBUG] Sign in button visible: ${signInBtnVisible}`);
console.log(`[DEBUG] Generate button visible: ${generateBtnVisible}`);
console.log(`[DEBUG] Login required: ${needsLogin ? 'YES' : 'NO'}`);

if (needsLogin) {
  console.log('\n==============================================');
  console.log('🔐 Starting automated login...');
  console.log('==============================================\n');

  // Step 1: Click "Continue with email" button
  try {
    const continueWithEmailBtn = page.locator('button:has-text("Continue with email")').first();
    await continueWithEmailBtn.waitFor({ timeout: 5000, state: 'visible' });
    await continueWithEmailBtn.click();
    console.log('[INFO] Clicked "Continue with email"');
    await page.waitForTimeout(2000);
  } catch (err) {
    console.log('[WARN] Could not find "Continue with email" button, trying direct email input...');
  }

  // Step 2: Fill in email
  const LOGIN_EMAIL = process.env.FIREFLY_EMAIL || 'web@adam-medien.de';
  try {
    const emailInput = page.locator('input[type="email"], input[name="username"]').first();
    await emailInput.waitFor({ timeout: 10000, state: 'visible' });
    await emailInput.fill(LOGIN_EMAIL);
    console.log(`[INFO] Filled email: ${LOGIN_EMAIL}`);
    await page.waitForTimeout(1000);

    // Step 3: Click Continue button
    const continueBtn = page.locator('button:has-text("Continue"), button[type="submit"]').first();
    await continueBtn.click();
    console.log('[INFO] Clicked "Continue" button');
    await page.waitForTimeout(2000);
  } catch (err) {
    console.log(`[ERROR] Failed to fill email or click continue: ${err.message}`);
  }

  // Step 4: Wait for 2FA approval
  console.log('\n==============================================');
  console.log('📱 PLEASE APPROVE IN ADOBE ACCESS APP');
  console.log('Press the number shown on screen in your Access app');
  console.log('==============================================\n');

  // Send Vybit notification
  try {
    await fetch('https://vybit.net/trigger/jrlyj4am4a90pa0c', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '📱 Approve Adobe login in Access app' })
    });
  } catch {}

  // Wait for the "Sign in" button to disappear (means logged in)
  await page.locator('button:has-text("Sign in")').waitFor({ state: 'hidden', timeout: 120000 });

  console.log('✅ Login successful!');

  // Save storage state
  await context.storageState({ path: STORAGE_STATE });
  console.log(`[INFO] Saved storage state to ${STORAGE_STATE}`);
}

// Verify the prompt box is actually visible and usable
console.log('[DEBUG] Verifying prompt textarea is ready...');
const promptBox = page.locator('textarea').first();
await promptBox.waitFor({ timeout: 10000, state: 'visible' });
console.log('[DEBUG] Prompt textarea is visible and ready');

// Now generate images
for (const item of prompts) {
  const id = item.prompt_id || item.id || `item_${Math.random().toString(36).slice(2,8)}`;
  console.log(`\n[INFO] 🪄 Prompt: ${id}`);

  // Set aspect ratio BEFORE filling prompt
  if (item.aspect_ratio) {
    try {
      const ratioSelectors = [
        page.getByLabel(/aspect|ratio/i),
        page.locator('[aria-label*="Aspect"]'),
      ];
      for (const selector of ratioSelectors) {
        try {
          await selector.first().click({ timeout: 2000 });
          await page.getByText(item.aspect_ratio, { exact: false }).first().click({ timeout: 2000 });
          console.log(`[INFO] Set aspect ratio to ${item.aspect_ratio}`);
          await page.waitForTimeout(500);
          break;
        } catch {}
      }
    } catch {}
  }

  // Set content type/style if specified
  if (item.style) {
    try {
      const styleSelectors = [
        page.getByLabel(/content type|style/i),
        page.locator('[aria-label*="Content Type"]'),
      ];
      for (const selector of styleSelectors) {
        try {
          await selector.first().click({ timeout: 2000 });
          await page.getByText(item.style, { exact: false }).first().click({ timeout: 2000 });
          console.log(`[INFO] Set content type to ${item.style}`);
          await page.waitForTimeout(500);
          break;
        } catch {}
      }
    } catch {}
  }

  // Re-acquire prompt box after settings changes and fill it
  const promptBox = page.locator('textarea[placeholder*="Describe"], textarea').first();
  await promptBox.waitFor({ timeout: 10000, state: 'visible' });
  await promptBox.click(); // Focus it first
  await page.waitForTimeout(500);
  await promptBox.fill(''); // Clear any existing text
  await promptBox.fill(item.prompt_text);
  console.log(`[DEBUG] Filled prompt: ${item.prompt_text.substring(0, 80)}...`);
  await page.waitForTimeout(1000);

  // Wait for generate button to be enabled
  const genBtn = page.getByTestId('generate-button');
  try {
    await page.waitForFunction(
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

  for (let v = 1; v <= VARIANTS; v++) {
    capturedDuringGeneration.length = 0;

    // Dismiss cookie banner before clicking
    await dismissCookieBanner();

    // Start capturing
    isGenerating = true;

    // Click the generate button directly
    console.log('[DEBUG] Clicking generate button...');
    await genBtn.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await genBtn.click({ force: true });
    console.log('[DEBUG] Generate button clicked');

    // Wait for the "Start generating images" text to disappear (means generation started)
    try {
      await page.waitForFunction(
        () => !document.body.textContent.includes('Start generating images'),
        { timeout: 5000 }
      );
      console.log('[DEBUG] Generation started - UI changed');
    } catch {
      console.log('[WARN] UI did not change after clicking generate button');
      // Take a screenshot to see what's blocking
      await page.screenshot({ path: `./data/debug-click-failed-${safeName(id)}.png` });
      console.log(`[DEBUG] Saved screenshot: ./data/debug-click-failed-${safeName(id)}.png`);
    }

    console.log(`[INFO] Waiting ${WAIT_AFTER_CLICK/1000}s for image generation...`);
    await page.waitForTimeout(WAIT_AFTER_CLICK);

    // Stop capturing network responses
    isGenerating = false;

    // Take a debug screenshot after generation
    await page.screenshot({ path: `./data/debug-after-gen-${safeName(id)}-${v}.png` });
    console.log(`[DEBUG] Post-generation screenshot saved to ./data/debug-after-gen-${safeName(id)}-${v}.png`);

    // Use the download button to get full-resolution image
    console.log('[INFO] Looking for download button...');

    try {
      // Wait for results container with download button
      await page.waitForSelector('[data-testid="results-container"], [class*="result"], [class*="ResultsGrid"]', { timeout: 10000 });
      await page.waitForTimeout(2000); // Wait for UI to stabilize

      // Look for the download button
      const downloadBtn = page.locator('sp-action-button[label="Download"], button[aria-label="Download"]').first();

      // Set up download listener before clicking
      const downloadPromise = page.waitForEvent('download', { timeout: 30000 });

      // Click the download button
      await downloadBtn.click();
      console.log('[DEBUG] Clicked download button');

      // Wait for download to complete
      const download = await downloadPromise;
      const downloadPath = await download.path();

      if (downloadPath) {
        // Move the downloaded file to our output directory
        const fileName = download.suggestedFilename() || `${safeName(id)}_${v}.jpg`;
        const outPath = path.join(OUTPUT_DIR, `${safeName(id)}_${v}.jpg`);

        await fs.copyFile(downloadPath, outPath);
        const stats = await fs.stat(outPath);
        console.log(`[INFO] 💾 Saved ${path.basename(outPath)} (${Math.round(stats.size/1024)} KB)`);
      } else {
        console.warn(`[WARN] Download path not available for ${id} variant ${v}`);
      }

    } catch (err) {
      console.error(`[ERROR] Failed to download image: ${err.message}`);
      console.warn(`[WARN] No image captured for ${id} variant ${v}`);
      continue;
    }

    await page.waitForTimeout(1500);
  }

  await page.waitForTimeout(2000);
}

console.log('\n✅ All prompts processed');
console.log('[INFO] Keeping browser open for 5 seconds...');
await page.waitForTimeout(5000);
await browser.close();
