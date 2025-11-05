import fs from 'fs/promises';
import path from 'path';
import { info, warn } from '../utils/logger.js';

export async function loadCookiesFromFile(filePath) {
  try {
    // Resolve to absolute path for better error messages
    const absolutePath = path.resolve(filePath);
    
    // Check if file exists first
    try {
      await fs.access(absolutePath);
    } catch (accessError) {
      warn(`Cookies file does not exist at ${absolutePath}`);
      // Try to list data directory contents for debugging
      const dataDir = path.dirname(absolutePath);
      try {
        const files = await fs.readdir(dataDir);
        info(`Files in ${dataDir}: ${files.join(', ')}`);
      } catch {}
      return null;
    }
    
    const raw = await fs.readFile(absolutePath, 'utf8');
    if (!raw || !raw.trim()) {
      warn(`Cookies file at ${absolutePath} is empty`);
      return null;
    }
    
    const cookies = JSON.parse(raw);
    if (!Array.isArray(cookies) || cookies.length === 0) {
      warn(`Cookies file at ${absolutePath} contains no valid cookies`);
      return null;
    }
    
    info(`Loaded ${cookies.length} cookies from ${absolutePath}`);
    return cookies;
  } catch (e) {
    if (e.code === 'ENOENT') {
      warn(`No cookies file found at ${filePath}. You may need to login manually.`);
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
    try {
      // Chrome DevTools Protocol expects domain without leading dot
      const domain = c.domain?.replace(/^\./, '') || 'adobe.com';
      await client.send('Network.setCookie', {
        name: c.name,
        value: c.value,
        domain: domain,
        path: c.path || '/',
        secure: Boolean(c.secure),
        httpOnly: Boolean(c.httpOnly),
        sameSite: (c.sameSite || 'None'),
        expires: c.expires && Number.isFinite(c.expires) ? c.expires : undefined
      });
      successCount++;
    } catch (e) {
      // Silently skip invalid cookies
    }
  }
  info(`Successfully set ${successCount} of ${cookies.length} cookies`);
}
