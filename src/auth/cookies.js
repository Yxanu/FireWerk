import fs from 'fs/promises';
import { info, warn } from '../utils/logger.js';

export async function loadCookiesFromFile(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    const cookies = JSON.parse(raw);
    info(`Loaded ${cookies.length} cookies from ${filePath}`);
    return cookies;
  } catch (e) {
    warn(`No cookies file found at ${filePath}. You may need to login manually.`);
    return null;
  }
}

export async function applyCookies(page, cookies) {
  if (!cookies || !cookies.length) return;
  const client = await page.target().createCDPSession();
  await client.send('Network.enable');
  for (const c of cookies) {
    await client.send('Network.setCookie', {
      name: c.name,
      value: c.value,
      domain: c.domain?.replace(/^\./, '') || 'adobe.com',
      path: c.path || '/',
      secure: Boolean(c.secure),
      httpOnly: Boolean(c.httpOnly),
      sameSite: (c.sameSite || 'None'),
      expires: c.expires && Number.isFinite(c.expires) ? c.expires : undefined
    }).catch(() => {});
  }
}
