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
const VIEWPORT_W = Number(process.env.PW_VIEWPORT_W || 1366);
const VIEWPORT_H = Number(process.env.PW_VIEWPORT_H || 900);

const VARIANTS = Number(process.env.VARIANTS_PER_PROMPT || 1);
const WAIT_AFTER_CLICK = Number(process.env.POST_CLICK_WAIT_MS || 9000);
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 60000);
const BASE_DELAY_MS = Number(process.env.BASE_DELAY_MS || 1500);
const JITTER_MS = Number(process.env.JITTER_MS || 800);
const RETRY = Number(process.env.RETRY || 2);

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

function jitter(base, j) {
  return base + Math.floor(Math.random() * j);
}

async function main() {
  const prompts = loadPromptsSync(PROMPT_FILE);
  console.log(`[INFO] Loaded ${prompts.length} prompts from ${PROMPT_FILE}`);
  await ensureDir(OUTPUT_DIR);

  // Check if storage state exists
  try {
    await fs.access(STORAGE_STATE);
    console.log(`[INFO] Using storage state from ${STORAGE_STATE}`);
  } catch {
    console.warn(`[WARN] Storage state not found at ${STORAGE_STATE}. Run 'npm run capture:auth' first.`);
  }

  const browser = await chromium.launch({ headless: HEADLESS });
  const contextOptions = {
    viewport: { width: VIEWPORT_W, height: VIEWPORT_H }
  };
  
  // Load storage state if it exists
  try {
    contextOptions.storageState = STORAGE_STATE;
  } catch {
    // Storage state doesn't exist, continue without it
  }
  
  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  // Network capture for generated images
  const captured = [];
  page.on('response', async (res) => {
    try {
      const ct = (res.headers()['content-type'] || '').toLowerCase();
      if (!IMG_MIME.has(ct)) return;
      const buf = await res.body();
      if (buf && buf.length > 1024) {
        captured.push({ buf, ct, size: buf.length, url: res.url() });
      }
    } catch {}
  });

  await page.goto(FIRE_URL, { waitUntil: 'networkidle' });
  
  // Wait a bit for React SPA to fully render
  await page.waitForTimeout(3000);
  
  // Dismiss cookie consent banner if present
  try {
    const consentButton = page.locator('#onetrust-accept-btn-handler, button:has-text("Accept"), button:has-text("Enable all")');
    if (await consentButton.isVisible({ timeout: 3000 })) {
      await consentButton.click();
      console.log('[INFO] Dismissed cookie consent banner');
      await page.waitForTimeout(1000);
    }
  } catch {
    // No consent banner, continue
  }
  
  // Check if we're on a sign-in page
  const isSignInPage = await page.evaluate(() => {
    const bodyText = document.body.innerText.toLowerCase();
    return bodyText.includes('sign in') || bodyText.includes('sign in to') || bodyText.includes('log in');
  });
  
  if (isSignInPage) {
    console.warn('[WARN] Page shows sign-in prompt. Authentication may have failed.');
    console.warn('[WARN] Re-run "npm run capture:auth" to refresh your authentication state.');
    console.warn('[WARN] Waiting 20 seconds in case manual login is needed...');
    await page.waitForTimeout(20000);
  }

  for (const item of prompts) {
    const id = item.prompt_id || item.id || `item_${Math.random().toString(36).slice(2,8)}`;
    console.log(`[INFO] 🪄 Prompt: ${id}`);

    // Fill prompt (prefer robust locator)
    const promptBox = page.locator('textarea').first();
    try {
      await promptBox.waitFor({ timeout: TIMEOUT_MS, state: 'visible' });
    } catch (e) {
      console.error(`[ERROR] Failed to find prompt textarea. Page may not be loaded or authentication may have failed.`);
      console.error(`[ERROR] Current URL: ${page.url()}`);
      // Try to take a screenshot for debugging
      try {
        await page.screenshot({ path: path.join(OUTPUT_DIR, 'debug-page.png'), fullPage: true });
        console.log(`[INFO] Debug screenshot saved to ${path.join(OUTPUT_DIR, 'debug-page.png')}`);
      } catch {}
      throw new Error(`Cannot find prompt textarea. Check authentication and page load. Original error: ${e.message}`);
    }
    
    // Set aspect ratio BEFORE filling prompt (as per Geckio guide)
    if (item.aspect_ratio) {
      try {
        // Try multiple strategies for aspect ratio
        const ratioSelectors = [
          page.getByLabel(/aspect|ratio/i),
          page.locator('[aria-label*="Aspect"]'),
          page.locator('[data-testid*="aspect"]'),
          page.locator('button:has-text("Aspect")'),
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
          page.locator('[data-testid*="content"]'),
          page.locator('button:has-text("Content")'),
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
    
    // Now fill the prompt
    await promptBox.fill(item.prompt_text);
    await page.waitForTimeout(1000); // Let the prompt settle and trigger validation
    
    // Wait for generate button to be enabled (it's disabled until prompt is valid)
    const genBtn = page.getByTestId('generate-button');
    try {
      await genBtn.waitFor({ state: 'visible', timeout: 5000 });
      // Wait for button to be enabled (not disabled)
      await page.waitForFunction(
        () => {
          const btn = document.querySelector('[data-testid="generate-button"]');
          return btn && !btn.hasAttribute('aria-disabled') && btn.getAttribute('aria-disabled') !== 'true';
        },
        { timeout: 10000 }
      );
      console.log('[INFO] Generate button is enabled');
    } catch (e) {
      console.warn('[WARN] Generate button may still be disabled, attempting click anyway...');
    }

    for (let v = 1; v <= VARIANTS; v++) {
      captured.length = 0;

      // Use the actual generate button (not the tab button)
      await genBtn.click({ timeout: 30000 });

      await page.waitForTimeout(WAIT_AFTER_CLICK);

      if (!captured.length) {
        // small grace polling (Playwright auto-waits most things, so keep this short)
        const t0 = Date.now();
        while (Date.now() - t0 < Math.min(10000, TIMEOUT_MS) && !captured.length) {
          await page.waitForTimeout(600);
        }
      }

      if (!captured.length) {
        console.warn(`[WARN] No image captured for ${id} variant ${v}. Retrying (${RETRY}x)...`);
        let attempts = 0;
        while (attempts < RETRY && !captured.length) {
          attempts++;
          captured.length = 0;
          await page.waitForTimeout(jitter(BASE_DELAY_MS, JITTER_MS));
          await genBtn.first().click();
          await page.waitForTimeout(WAIT_AFTER_CLICK);
        }
      }

      if (!captured.length) {
        console.error(`[ERROR] Failed to capture image for ${id} variant ${v}.`);
        continue;
      }

      captured.sort((a,b) => b.size - a.size);
      const best = captured[0];
      const ext = best.ct.includes('png') ? 'png' : (best.ct.includes('webp') ? 'webp' : 'jpg');
      const outPath = path.join(OUTPUT_DIR, `${safeName(id)}_${v}.${ext}`);
      await fs.writeFile(outPath, best.buf);
      console.log(`[INFO] 💾 Saved ${path.basename(outPath)} (${Math.round(best.size/1024)} KB)`);
      
      await page.waitForTimeout(jitter(BASE_DELAY_MS, JITTER_MS));
    }

    await page.waitForTimeout(jitter(BASE_DELAY_MS * 2, JITTER_MS * 2));
  }

  console.log('✅ All prompts processed');
  console.log('[INFO] Keeping browser open for 5 seconds to verify results...');
  await page.waitForTimeout(5000);
  await browser.close();
}

main().catch((e) => {
  console.error(e.stack || e.message);
  process.exit(1);
});

