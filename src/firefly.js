import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs/promises';
import { SEL } from './selectors.js';
import { info, warn, error } from './utils/logger.js';
import { delay, jitter } from './utils/wait.js';
import { ensureDir, buildOutPath } from './utils/files.js';
import { loadCookiesFromFile, applyCookies, dumpAllCookies } from './auth/cookies.js';

const IMG_MIME = new Set(['image/jpeg','image/png','image/webp','image/jpg']);
const MAX_LISTEN_PER_PROMPT = 8;

async function saveStorage(page, dir = './data') {
  try {
    const { ls, ss } = await page.evaluate(() => ({
      ls: (() => {
        try {
          const entries = {};
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            entries[key] = localStorage.getItem(key);
          }
          return entries;
        } catch {
          return {};
        }
      })(),
      ss: (() => {
        try {
          const entries = {};
          for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            entries[key] = sessionStorage.getItem(key);
          }
          return entries;
        } catch {
          return {};
        }
      })(),
    }));

    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'localStorage.json'), JSON.stringify(ls, null, 2));
    await fs.writeFile(path.join(dir, 'sessionStorage.json'), JSON.stringify(ss, null, 2));
    info(`Saved storage state to ${dir}`);
  } catch (e) {
    warn(`Failed to save storage state: ${e.message}`);
  }
}

async function restoreStorage(page, dir = './data') {
  try {
    const lsPath = path.join(dir, 'localStorage.json');
    const ssPath = path.join(dir, 'sessionStorage.json');
    const [lsRaw, ssRaw] = await Promise.all([
      fs.readFile(lsPath, 'utf8').catch(() => null),
      fs.readFile(ssPath, 'utf8').catch(() => null),
    ]);

    if (!lsRaw && !ssRaw) return;

    const lsObj = lsRaw ? JSON.parse(lsRaw) : {};
    const ssObj = ssRaw ? JSON.parse(ssRaw) : {};
    await page.evaluate((localValues, sessionValues) => {
      try {
        Object.entries(localValues || {}).forEach(([key, value]) => {
          if (typeof value === 'string') localStorage.setItem(key, value);
        });
      } catch {}
      try {
        Object.entries(sessionValues || {}).forEach(([key, value]) => {
          if (typeof value === 'string') sessionStorage.setItem(key, value);
        });
      } catch {}
    }, lsObj, ssObj);
    info(`Restored storage state from ${dir}`);
  } catch (e) {
    warn(`Failed to restore storage state: ${e.message}`);
  }
}

async function findPromptField(page, timeoutMs = 20000) {
  const promptHostSelector = SEL.promptHost || 'firefly-prompt[data-testid="prompt-bar-input"]';
  const strategies = [
    {
      name: 'firefly shadow textarea',
      fn: (selector) => {
        const host = document.querySelector(selector);
        const fromTextfield = host?.shadowRoot
          ?.querySelector('firefly-textfield')
          ?.shadowRoot
          ?.querySelector('textarea');
        if (fromTextfield) return fromTextfield;
        return host?.shadowRoot?.querySelector('textarea') ?? null;
      },
      args: [promptHostSelector]
    },
    {
      name: 'firefly shadow rich text',
      fn: (selector) => {
        const host = document.querySelector(selector);
        return host?.shadowRoot
          ?.querySelector('[contenteditable="true"], [role="textbox"]') ?? null;
      },
      args: [promptHostSelector]
    },
    {
      name: 'global textarea',
      fn: () => document.querySelector('textarea[aria-label*="prompt" i]')
        || document.querySelector('textarea[placeholder*="prompt" i]')
        || document.querySelector('textarea')
    },
    {
      name: 'global contenteditable',
      fn: () => document.querySelector('[contenteditable="true"][aria-label*="prompt" i]')
        || document.querySelector('[contenteditable="true"][placeholder*="prompt" i]')
        || document.querySelector('[role="textbox"]')
    },
  ];

  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    for (const { name, fn, args = [] } of strategies) {
      const handle = await page.evaluateHandle(fn, ...args);
      const element = handle.asElement();
      if (element) {
        return { element, strategy: name };
      }
      await handle.dispose();
    }
    await delay(250);
  }
  return null;
}

async function logPromptDiagnostics(page) {
  try {
    const data = await page.evaluate(() => {
      const collect = (selector, type) => Array.from(document.querySelectorAll(selector)).map((el, idx) => ({
        type,
        index: idx,
        placeholder: el.placeholder || '',
        ariaLabel: el.getAttribute('aria-label') || '',
        id: el.id || '',
        className: el.className || '',
        visible: el.offsetParent !== null,
      }));

      const promptHosts = Array.from(document.querySelectorAll('firefly-prompt')).map((host, idx) => {
        const shadow = host.shadowRoot;
        const textareaCount = shadow ? shadow.querySelectorAll('textarea').length : 0;
        const ceCount = shadow ? shadow.querySelectorAll('[contenteditable="true"]').length : 0;
        const textfieldCount = shadow ? shadow.querySelectorAll('firefly-textfield, sp-textfield').length : 0;
        return {
          index: idx,
          dataTestId: host.getAttribute('data-testid') || '',
          hasShadow: Boolean(shadow),
          textareaCount,
          contentEditableCount: ceCount,
          textfieldCount,
        };
      });

      return {
        counts: {
          textareas: document.querySelectorAll('textarea').length,
          textInputs: document.querySelectorAll('input[type="text"]').length,
          allInputs: document.querySelectorAll('input').length,
          contentEditable: document.querySelectorAll('[contenteditable="true"]').length,
          roleTextboxes: document.querySelectorAll('[role="textbox"]').length,
        },
        buttons: Array.from(document.querySelectorAll('button')).map(btn => btn.textContent.trim()).filter(Boolean).slice(0, 6),
        bodyPreview: document.body.innerText.substring(0, 300),
        promptHosts,
        potentialFields: [
          ...collect('textarea', 'textarea'),
          ...collect('[contenteditable="true"]', 'contenteditable'),
          ...collect('[role="textbox"]', 'role=textbox'),
        ],
      };
    });

    warn('Page diagnostics:');
    warn(`  - ${data.counts.textareas} textareas, ${data.counts.textInputs} text inputs, ${data.counts.allInputs} total inputs`);
    warn(`  - ${data.counts.contentEditable} contentEditable, ${data.counts.roleTextboxes} role="textbox" elements`);
    warn(`  - First buttons: ${data.buttons.join(' | ') || 'none found'}`);
    warn(`Page content preview: ${data.bodyPreview}...`);
    if (data.promptHosts.length) {
      info('Prompt host details:');
      data.promptHosts.forEach(host => {
        info(`  - host[${host.index}] data-testid="${host.dataTestId}" shadow=${host.hasShadow} textareas=${host.textareaCount} contentEditable=${host.contentEditableCount} textfields=${host.textfieldCount}`);
      });
    }
    if (data.potentialFields.length) {
      info('Potential input fields:');
      data.potentialFields.forEach(field => {
        info(`  - ${field.type}[${field.index}] visible=${field.visible} id="${field.id}" placeholder="${field.placeholder}" aria-label="${field.ariaLabel}"`);
      });
    }
  } catch (diagErr) {
    warn(`Failed to collect prompt diagnostics: ${diagErr.message}`);
  }
}

export async function generateImages(prompts) {
  const headless = process.env.HEADLESS === 'true';
  const userDataDir = process.env.USER_DATA_DIR || undefined;
  const launchOptions = {
    headless,
    slowMo: Number(process.env.SLOW_MO_MS || 0),
    args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage'],
    defaultViewport: { width: Number(process.env.VIEWPORT_W || 1366), height: Number(process.env.VIEWPORT_H || 900) }
  };
  if (userDataDir) {
    launchOptions.userDataDir = userDataDir;
    info(`Using persistent Chrome profile at ${userDataDir}`);
  }
  const browser = await puppeteer.launch(launchOptions);

  const page = await browser.newPage();
  const storageDir = process.env.STORAGE_DIR || './data';
  const saveArtifacts = process.env.SAVE_COOKIES_ON_EXIT === 'true';

  // Auth via cookies
  const cookiesPath = process.env.COOKIES_PATH || './data/cookies.adobe.json';
  const cookies = await loadCookiesFromFile(cookiesPath);
  const hasCookies = cookies && cookies.length > 0;
  
  const fireflyUrl = process.env.FIRELFY_URL || 'https://firefly.adobe.com/generate/images';
  const fireflyOrigin = (() => {
    try {
      return new URL(fireflyUrl).origin;
    } catch {
      return 'https://firefly.adobe.com';
    }
  })();

  // Attempt to restore storage before applying cookies
  try {
    await page.goto(fireflyOrigin, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await restoreStorage(page, storageDir);
  } catch (restoreErr) {
    warn(`Storage restore skipped: ${restoreErr.message}`);
  }
  await page.goto('about:blank').catch(() => {});

  if (hasCookies) {
    // Apply cookies before navigating - they'll work on any Adobe domain
    info(`Applying ${cookies.length} cookies for authentication...`);
    try {
      await applyCookies(page, cookies);
      info(`Successfully applied cookies`);
    } catch (e) {
      warn(`Error applying cookies: ${e.message}. Continuing anyway...`);
    }
  } else {
    warn('No cookies applied. Login manually in the visible browser if HEADLESS=false.');
  }

  info(`Navigating to ${fireflyUrl}...`);
  await page.goto(fireflyUrl, { waitUntil: 'networkidle2', timeout: 60000 });
  
  // Wait for page to be fully interactive (React SPA needs time to render)
  info('Waiting for page to fully load...');
  await delay(5000); // Increased wait time for React SPA

  if (!headless) {
    try {
      const needsLogin = await page.evaluate(() => {
        const hasLoginText = document.body.innerText?.toLowerCase().includes('sign in');
        const hasLoginButton = Array.from(document.querySelectorAll('a,button')).some(el => /sign in|log in|anmelden/i.test(el.textContent || ''));
        return hasLoginText || hasLoginButton;
      });
      if (needsLogin) {
        info('⏸  Detected sign-in UI. Please log in manually within the browser window...');
        try {
          await page.waitForFunction(
            () => Boolean(document.querySelector('[data-testid="generate-button"]')),
            { timeout: 60000 }
          );
          info('✅ Manual login detected. Continuing automation.');
        } catch (waitErr) {
          warn(`Manual login timeout reached (${waitErr.message}). Continuing anyway.`);
        }
      }
    } catch (loginCheckErr) {
      warn(`Manual login check failed: ${loginCheckErr.message}`);
    }
  }
  
  // Check if we're on a login page or if there are errors
  const pageTitle = await page.title();
  const pageUrl = page.url();
  info(`Page loaded: ${pageTitle} at ${pageUrl}`);
  
  // Check if we're seeing a sign-in page
  const isSignInPage = await page.evaluate(() => {
    const bodyText = document.body.innerText.toLowerCase();
    return bodyText.includes('sign in') || bodyText.includes('sign in to') || bodyText.includes('log in');
  });
  
  if (isSignInPage) {
    if (hasCookies) {
      error('Cookies were applied but page shows sign-in. Cookies may be expired or invalid.');
      error('Please refresh your cookies file with a new export from your browser.');
    } else {
      warn('Page shows sign-in prompt. No cookies were loaded.');
    }
    warn('Waiting 20 seconds in case manual login is needed...');
    await delay(20000);
  }
  
  if (!hasCookies && !isSignInPage) {
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

    let promptHandle = null;
    let promptStrategy = '';
    try {
      const found = await findPromptField(page, 25000);
      if (!found) {
        throw new Error('Prompt input not located via supported strategies');
      }
      promptHandle = found.element;
      promptStrategy = found.strategy;
      info(`Found prompt field using strategy: ${promptStrategy}`);
    } catch (e) {
      await logPromptDiagnostics(page);
      error('Failed to find prompt textarea. Page may not be loaded or authentication may have failed.');
      error(`Current URL: ${page.url()}`);
      try {
        await page.screenshot({ path: './output/debug-page.png', fullPage: true });
        info('Debug screenshot saved to ./output/debug-page.png');
      } catch {}
      throw new Error(`Cannot find prompt textarea. Check authentication and page load. Original error: ${e.message}`);
    }

    try {
      await page.evaluate(el => el.focus(), promptHandle);
      await page.evaluate((el, text) => {
        if ('value' in el) {
          el.value = text;
        } else {
          el.textContent = text;
        }
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }, promptHandle, item.prompt_text);
    } finally {
      await promptHandle?.dispose();
    }

    if (item.aspect_ratio) await setIfPresent(SEL.ratioDropdown, item.aspect_ratio);
    if (item.style)        await setIfPresent(SEL.styleDropdown, item.style);

    for (let v = 1; v <= variantsPerPrompt; v++) {
      captured = [];
      captureActive = true;

      const clickGenerate = async () => {
        const btnHandle = await page.$(SEL.generateBtn);
        if (btnHandle) {
          await btnHandle.click();
          await btnHandle.dispose();
          return true;
        }
        const clicked = await page.evaluate(() => {
          const host = document.querySelector('[data-testid="generate-button"]');
          if (host) {
            host.click();
            host.shadowRoot?.querySelector('button')?.click();
            return true;
          }
          const fallback = [...document.querySelectorAll('button')].find(b => /generate/i.test(b.textContent));
          fallback?.click();
          return Boolean(fallback);
        });
        return clicked;
      };

      const firstClick = await clickGenerate();
      if (!firstClick) {
        warn('Generate button click attempt did not locate a target element.');
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
          const retried = await clickGenerate();
          if (!retried) {
            warn('Retry click for generate button did not find a target element.');
          }
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

  if (saveArtifacts) {
    try {
      await dumpAllCookies(page, cookiesPath);
    } catch (cookieDumpErr) {
      warn(`Failed to save cookies on exit: ${cookieDumpErr.message}`);
    }
    await saveStorage(page, storageDir);
  }

  await browser.close();
}
