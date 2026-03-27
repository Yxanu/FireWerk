import { test, expect } from '@playwright/test';
import {
  getImageModelUiPayload,
  resolveImageModel,
  validateImageRequest
} from '../src/models/imageModelCatalog.mjs';

test('resolves legacy and localized model aliases', async () => {
  expect(resolveImageModel('Firefly Image 5 (Vorschau)')?.id).toBe('firefly-image-5-preview');
  expect(resolveImageModel('FLUX1.1 [pro]')?.id).toBe('flux-1-1-pro');
  expect(resolveImageModel('GPT Image')?.id).toBe('gpt-image');
});

test('rejects unsupported model and aspect ratio combinations', async () => {
  const validation = validateImageRequest({
    model: 'GPT Image',
    aspectRatio: '16:9'
  });

  expect(validation.ok).toBe(false);
  expect(validation.errors[0]).toContain('does not support aspect ratio');
});

test('returns UI payload with both Adobe and partner models', async () => {
  const payload = getImageModelUiPayload();

  expect(payload.models.some((model) => model.family === 'adobe')).toBe(true);
  expect(payload.models.some((model) => model.family === 'partner')).toBe(true);
  expect(payload.aspectRatios.map((ratio) => ratio.value)).toContain('1:1');
});
