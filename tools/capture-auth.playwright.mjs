import { chromium } from 'playwright';
import fs from 'fs/promises';

const FIRE_URL = process.env.FIRELFY_URL || 'https://firefly.adobe.com/generate/images';

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext(); // fresh storage
const page = await context.newPage();

await page.goto(FIRE_URL);
// Manually sign in (2FA etc.). Wait until the Generate UI is present:
await page.getByRole('button', { name: /generate/i }).waitFor({ timeout: 120000 });

await fs.mkdir('./data', { recursive: true });
await context.storageState({ path: './data/storageState.json' });
console.log('✅ Saved ./data/storageState.json');
await browser.close();

