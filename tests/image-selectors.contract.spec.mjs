import fs from 'fs/promises';
import path from 'path';
import { test, expect } from '@playwright/test';
import {
  PROMPT_INPUT_SELECTORS,
  MODEL_PICKER_SELECTORS,
  DOWNLOAD_BUTTON_SELECTORS,
  findFirstVisibleLocator,
  findPickerByHints,
  findPartnerConsentButton
} from '../src/generators/imageSelectors.mjs';

const fixturesDir = path.join(process.cwd(), 'tests', 'fixtures');

async function loadFixture(name) {
  return fs.readFile(path.join(fixturesDir, name), 'utf8');
}

test('detects prompt input and model picker from stored Firefly fixture', async ({ page }) => {
  await page.setContent(await loadFixture('firefly-prompt-page.html'));

  const prompt = await findFirstVisibleLocator(page, PROMPT_INPUT_SELECTORS);
  const modelPicker = await findPickerByHints(page, ['model']);

  expect(prompt?.strategy.name).toBe('prompt-host-textarea');
  expect(modelPicker?.locator).toBeTruthy();

  const fallbackPicker = await findFirstVisibleLocator(page, MODEL_PICKER_SELECTORS);
  expect(fallbackPicker?.locator).toBeTruthy();
});

test('detects partner consent action from stored Firefly fixture', async ({ page }) => {
  await page.setContent(await loadFixture('firefly-partner-consent.html'));

  const consent = await findPartnerConsentButton(page);
  expect(consent?.action).toBe('Continue');
});

test('detects download control from stored Firefly fixture', async ({ page }) => {
  await page.setContent(await loadFixture('firefly-download-result.html'));

  const button = await findFirstVisibleLocator(page, DOWNLOAD_BUTTON_SELECTORS);
  expect(button?.strategy.name).toBe('thumbnail-download-testid');
});
