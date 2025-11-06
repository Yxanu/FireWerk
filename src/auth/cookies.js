import fs from 'fs/promises';
import path from 'path';
import { info, warn } from '../utils/logger.js';

function toUrlLike(domain, cookiePath = '/') {
  const host = (domain || 'firefly.adobe.com').replace(/^\./, '');
  const normalizedPath = cookiePath?.startsWith('/') ? cookiePath : `/${cookiePath || ''}`;
  return `https://${host}${normalizedPath}`;
}

export async function loadCookiesFromFile(filePath) {
  try {
    const absolutePath = path.resolve(filePath);
    const raw = await fs.readFile(absolutePath, 'utf8');
    const cookies = JSON.parse(raw);
    if (!Array.isArray(cookies) || !cookies.length) {
      warn(`Cookies file at ${absolutePath} contains no valid cookies`);
      return null;
    }
    info(`Loaded ${cookies.length} cookies from ${absolutePath}`);
    return cookies;
  } catch (e) {
    if (e.code === 'ENOENT') {
      warn(`Cookies file does not exist at ${filePath}. You may need to login manually.`);
    } else if (e instanceof SyntaxError) {
      warn(`Invalid JSON in cookies file at ${filePath}: ${e.message}`);
    } else {
      warn(`Error loading cookies from ${filePath}: ${e.message}`);
    }
    return null;
  }
}

export async function applyCookies(page, cookies) {
  if (!cookies || !cookies.length) return;
  const client = await page.target().createCDPSession();
  await client.send('Network.enable');

  let successCount = 0;
  for (const c of cookies) {
    const hasLeadingDot = Boolean(c.domain && c.domain.startsWith('.'));
    const payload = {
      name: c.name,
      value: c.value,
      path: c.path || '/',
      secure: Boolean(c.secure),
      httpOnly: Boolean(c.httpOnly),
      sameSite: c.sameSite || 'None',
      expires: typeof c.expires === 'number' ? c.expires : undefined,
    };

    if (c.domain) {
      if (hasLeadingDot) {
        payload.domain = c.domain;
      } else {
        payload.url = toUrlLike(c.domain, c.path);
      }
    } else {
      payload.url = 'https://firefly.adobe.com/';
    }

    try {
      await client.send('Network.setCookie', payload);
      successCount++;
    } catch {
      // ignore individual failures
    }
  }
  info(`Successfully set ${successCount} of ${cookies.length} cookies`);
}

export async function dumpAllCookies(page, outPath) {
  const client = await page.target().createCDPSession();
  await client.send('Network.enable');
  const { cookies } = await client.send('Network.getAllCookies');
  const dir = path.dirname(outPath);
  if (dir && dir !== '.') {
    await fs.mkdir(dir, { recursive: true });
  }
  await fs.writeFile(outPath, JSON.stringify(cookies, null, 2));
  info(`💾 Saved ${cookies.length} cookies to ${outPath}`);
}
