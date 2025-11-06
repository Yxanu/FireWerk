# FireWerk — Migration Guide: Puppeteer ➜ Playwright

This guide migrates your current Puppeteer-based FireWerk to a Playwright edition that's more reliable for auth, selectors, and downloads. It's written to be drop-in with minimal changes to your workflow and environment.

## Why migrate

- **Auth persistence in one line**: `storageState()` (cookies + local/sessionStorage).
- **Auto-waiting & robust locators** reduce flaky timeouts.
- **Trace viewer** makes debugging DOM/auth issues easy.
- **Parallel contexts** if you later want multiple accounts/runs.

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   npx playwright install chromium
   ```

2. **Capture authentication (one-time):**
   ```bash
   npm run capture:auth
   ```
   This opens a browser - manually sign in, wait for the Generate button to appear, then it saves your auth state.

3. **Run with Playwright:**
   ```bash
   npm run dev   # visible browser, good for first test
   npm start     # headless batch run
   ```

## Environment Variables

Add to your `.env`:

```bash
# Playwright auth state
STORAGE_STATE=./data/storageState.json
PW_HEADLESS=true
PW_VIEWPORT_W=1366
PW_VIEWPORT_H=900
```

## Scripts

- `npm start` - Run with Playwright (default)
- `npm run dev` - Run with visible browser
- `npm run capture:auth` - Capture authentication state
- `npm run start:puppeteer` - Use legacy Puppeteer version
- `npm run dev:puppeteer` - Use legacy Puppeteer with visible browser

## Troubleshooting

- **Still asks to sign in**: Re-run `npm run capture:auth` and wait until the Generate button is visible before saving state.
- **Captures only tiny files**: Increase `POST_CLICK_WAIT_MS` (e.g., 12000–15000).
- **Selectors change**: Playwright's `getByRole` and `getByText` are more robust than CSS selectors.

## Docker

The Dockerfile now uses the official Playwright base image which includes all necessary dependencies.

