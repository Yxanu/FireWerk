import { test } from '@playwright/test';
import { ImageGenerator } from '../../src/generators/ImageGenerator.mjs';
import { getImageModelUiPayload } from '../../src/models/imageModelCatalog.mjs';

const liveEnabled = process.env.FIREFLY_LIVE === '1';
const email = process.env.FIREFLY_EMAIL || process.env.ADOBE_LOGIN_EMAIL || '';

async function runLiveBatch(models, prompts, variantsPerPrompt) {
  for (const model of models) {
    const generator = new ImageGenerator({
      headless: false,
      variantsPerPrompt,
      captureMode: 'download',
      saveArtifacts: 'all'
    });

    try {
      await generator.generate(
        prompts.map((prompt, index) => ({
          prompt_id: `${prompt.prompt_id}-${model.id}-${index + 1}`,
          prompt_text: prompt.prompt_text,
          modelId: model.id,
          aspect_ratio: prompt.aspect_ratio || '',
          style: prompt.style || ''
        })),
        email
      );
    } finally {
      await generator.close();
    }
  }
}

test.describe('live Firefly matrix', () => {
  test.skip(!liveEnabled, 'Set FIREFLY_LIVE=1 and a reusable session before running live Firefly tests.');

  const catalog = getImageModelUiPayload().models;
  const coreModels = catalog.filter((model) => model.tier === 'core');

  test('@live-smoke core model smoke matrix', async () => {
    await runLiveBatch(
      coreModels,
      [{ prompt_id: 'smoke', prompt_text: 'editorial product photograph of a ceramic mug', aspect_ratio: '1:1' }],
      1
    );
  });

  test('@live-deep deep matrix', async () => {
    await runLiveBatch(
      coreModels.filter((model) => ['firefly-image-5-preview', 'firefly-image-4-ultra', 'flux-kontext-max', 'gpt-image'].includes(model.id)),
      [
        { prompt_id: 'deep-a', prompt_text: 'clean studio shot of a perfume bottle', aspect_ratio: '1:1' },
        { prompt_id: 'deep-b', prompt_text: 'architectural facade in warm evening light', aspect_ratio: '4:5' }
      ],
      2
    );
  });

  test('@live-soak soak matrix', async () => {
    await runLiveBatch(
      coreModels.filter((model) => ['firefly-image-5-preview', 'gpt-image'].includes(model.id)),
      Array.from({ length: 20 }, (_, index) => ({
        prompt_id: `soak-${index + 1}`,
        prompt_text: `minimal product composition ${index + 1}`,
        aspect_ratio: '1:1'
      })),
      1
    );
  });
});
