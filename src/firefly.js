import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs/promises';
import { SEL } from './selectors.js';
import { info, warn, error } from './utils/logger.js';
import { delay, jitter } from './utils/wait.js';
import { ensureDir, buildOutPath } from './utils/files.js';
import { loadCookiesFromFile, applyCookies } from './auth/cookies.js';

const IMG_MIME = new Set(['image/jpeg','image/png','image/webp','image/jpg']);
const MAX_LISTEN_PER_PROMPT = 8;

export async function generateImages(prompts) {
  const headless = process.env.HEADLESS === 'true';
  const browser = await puppeteer.launch({
    headless,
    slowMo: Number(process.env.SLOW_MO_MS || 0),
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage'],
    defaultViewport: { width: Number(process.env.VIEWPORT_W || 1366), height: Number(process.env.VIEWPORT_H || 900) }
  });

  const page = await browser.newPage();

  // Auth via cookies
  const cookiesPath = process.env.COOKIES_PATH || './data/cookies.adobe.json';
  const cookies = await loadCookiesFromFile(cookiesPath);
  const hasCookies = cookies && cookies.length > 0;
  
  if (hasCookies) {
    await page.goto('https://adobe.com', { waitUntil: 'domcontentloaded' });
    await applyCookies(page, cookies);
    info(`Applied ${cookies.length} cookies for authentication`);
    // Give cookies time to be processed
    await delay(1000);
  } else {
    warn('No cookies applied. Login manually in the visible browser if HEADLESS=false.');
  }

  const fireflyUrl = process.env.FIRELFY_URL || 'https://firefly.adobe.com/generate/images';
  info(`Navigating to ${fireflyUrl}...`);
  await page.goto(fireflyUrl, { waitUntil: 'networkidle2', timeout: 60000 });

  if (!hasCookies) {
    warn('Waiting 15 seconds for manual login...');
    await delay(15000);
  }

  const outDir = process.env.OUTPUT_DIR || './output';
  await ensureDir(outDir);

  const variantsPerPrompt = Number(process.env.VARIANTS_PER_PROMPT || 1);
  const baseDelay = Number(process.env.BASE_DELAY_MS || 1500);
  const jitterMs = Number(process.env.JITTER_MS || 800);
  const postClickWait = Number(process.env.POST_CLICK_WAIT_MS || 9000);
  const timeoutMs = Number(process.env.TIMEOUT_MS || 60000);
  const retries = Number(process.env.RETRY || 2);

  let captureActive = false;
  let captured = [];

  page.on('response', async (res) => {
    if (!captureActive) return;
    try {
      const ct = res.headers()['content-type'] || '';
      if (!IMG_MIME.has(ct.toLowerCase())) return;
      const buf = await res.buffer();
      if (buf && buf.length > 1024) captured.push({ buf, ct, size: buf.length, url: res.url() });
    } catch {}
  });

  async function setIfPresent(selector, valueLike) {
    try {
      await page.waitForSelector(selector, { timeout: 2000 });
      await page.click(selector);
      await page.waitForSelector(`text/${valueLike}`, { timeout: 2000 });
      await page.click(`text/${valueLike}`);
    } catch {}
  }

  for (const item of prompts) {
    const id = item.prompt_id || item.id || `item_${Math.random().toString(36).slice(2,8)}`;
    info(`🪄 Prompt: ${id}`);

    // Wait for page to be ready and check if we're logged in
    try {
      await page.waitForSelector(SEL.promptTextarea, { timeout: timeoutMs });
    } catch (e) {
      error(`Failed to find prompt textarea. Page may not be loaded or authentication may have failed.`);
      error(`Current URL: ${page.url()}`);
      // Try to take a screenshot for debugging
      try {
        await page.screenshot({ path: './output/debug-page.png', fullPage: true });
        info('Debug screenshot saved to ./output/debug-page.png');
      } catch {}
      throw new Error(`Cannot find prompt textarea. Check authentication and page load. Original error: ${e.message}`);
    }
    await page.evaluate((text, sel) => {
      const el = document.querySelector(sel);
      if (el) {
        el.value = text;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, item.prompt_text, SEL.promptTextarea);

    if (item.aspect_ratio) await setIfPresent(SEL.ratioDropdown, item.aspect_ratio);
    if (item.style)        await setIfPresent(SEL.styleDropdown, item.style);

    for (let v = 1; v <= variantsPerPrompt; v++) {
      captured = [];
      captureActive = true;

      const genBtn = await page.$(SEL.generateBtn);
      if (!genBtn) {
        await page.evaluate(() => {
          [...document.querySelectorAll('button')].find(b => /generate/i.test(b.textContent))?.click();
        });
      } else {
        await genBtn.click();
      }

      await delay(postClickWait);
      const t0 = Date.now();
      while (Date.now() - t0 < Math.min(timeoutMs, 20000) && captured.length < MAX_LISTEN_PER_PROMPT) {
        await delay(600);
      }
      captureActive = false;

      if (!captured.length) {
        warn(`No images intercepted for ${id} variant ${v}. Retrying (${retries}x)...`);
        let attempts = 0;
        while (attempts < retries && !captured.length) {
          attempts++;
          captured = [];
          captureActive = true;
          await delay(jitter(baseDelay, jitterMs));
          await genBtn?.click();
          await delay(postClickWait);
          captureActive = false;
        }
      }

      if (!captured.length) {
        error(`❌ Failed to capture image for ${id} variant ${v}.`);
        continue;
      }

      captured.sort((a,b) => b.size - a.size);
      const best = captured[0];
      const ext = best.ct.includes('png') ? 'png' : (best.ct.includes('webp') ? 'webp' : 'jpg');
      const outPath = buildOutPath(outDir, id, v, ext);
      await fs.writeFile(outPath, best.buf);
      info(`💾 Saved ${path.basename(outPath)} (${Math.round(best.size/1024)} KB)`);

      await delay(jitter(baseDelay, jitterMs));
    }

    await delay(jitter(baseDelay * 2, jitterMs * 2));
  }

  await browser.close();
}
