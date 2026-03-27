import fs from 'fs/promises';
import path from 'path';
import { test, expect } from '@playwright/test';
import { detectFireflyGeneratePageState, FIREFLY_PAGE_STATES } from '../src/generators/fireflyPageState.mjs';

const fixturesDir = path.join(process.cwd(), 'tests', 'fixtures');

async function loadFixture(name) {
  return fs.readFile(path.join(fixturesDir, name), 'utf8');
}

test('treats prompt shell plus Get Credits as ready_for_prompt', async ({ page }) => {
  await page.setContent(await loadFixture('firefly-prompt-shell-ready.html'));

  const pageState = await detectFireflyGeneratePageState(page);

  expect(pageState.matchedState).toBe(FIREFLY_PAGE_STATES.READY_FOR_PROMPT);
  expect(pageState.creditsButtonVisible).toBe(true);
  expect(pageState.hasPromptShell).toBe(true);
});

test('detects blocking credit gate separately from prompt-ready state', async ({ page }) => {
  await page.setContent(await loadFixture('firefly-credit-gate.html'));

  const pageState = await detectFireflyGeneratePageState(page);

  expect(pageState.matchedState).toBe(FIREFLY_PAGE_STATES.CREDIT_GATE);
  expect(pageState.creditDialogVisible).toBe(true);
  expect(pageState.hasPromptShell).toBe(false);
});
