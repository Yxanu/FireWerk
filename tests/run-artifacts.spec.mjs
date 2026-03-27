import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { test, expect } from '@playwright/test';
import { RunArtifacts } from '../src/utils/runArtifacts.mjs';

test('writes run summaries with fallback metadata', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'firewerk-run-artifacts-'));
  const artifacts = new RunArtifacts({
    outputDir: tempDir,
    saveArtifacts: 'failures'
  });

  await artifacts.init({ generator: 'unit-test' });
  artifacts.recordSelector('model-picker', 'semantic-picker-model');
  artifacts.recordFallback('capture-screenshot', { reason: 'download button missing' });
  artifacts.recordVariantResult('hero', 1, { captureMode: 'screenshot', fallbackUsed: true });
  const summaryPath = await artifacts.writeSummary({ status: 'completed' });

  const summary = JSON.parse(await fs.readFile(summaryPath, 'utf8'));
  expect(summary.status).toBe('completed');
  expect(summary.fallbacks[0].kind).toBe('capture-screenshot');
  expect(summary.prompts[0].variants[0].fallbackUsed).toBe(true);
});

test('writes json diagnostics artifacts when requested', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'firewerk-run-artifacts-'));
  const artifacts = new RunArtifacts({
    outputDir: tempDir,
    saveArtifacts: 'all'
  });

  await artifacts.init({ generator: 'unit-test' });
  const jsonPath = await artifacts.maybeSaveJson('page-state', { matchedState: 'ready_for_prompt' });
  const payload = JSON.parse(await fs.readFile(jsonPath, 'utf8'));

  expect(payload.matchedState).toBe('ready_for_prompt');
});
