import { test, expect } from '@playwright/test';
import { planImageBatches } from '../src/batch/imageBatchPlanner.mjs';

test('splits mixed prompts into strict FireWerk-compatible jobs', async () => {
  const plan = planImageBatches([
    {
      prompt_id: 'hero_firefly',
      prompt_text: 'lush terrarium hero shot',
      modelId: 'firefly-image-4-ultra',
      aspect_ratio: '16:9',
      style: 'photographic'
    },
    {
      prompt_id: 'detail_imagen',
      prompt_text: 'clean gecko care infographic',
      modelId: 'imagen-4',
      aspect_ratio: '16:9',
      style: 'graphic'
    },
    {
      prompt_id: 'invalid_ratio',
      prompt_text: 'terrarium side layout',
      modelId: 'firefly-image-4-ultra',
      aspect_ratio: '4:3'
    }
  ]);

  expect(plan.summary.plannedJobs).toBe(2);
  expect(plan.summary.rejectedPrompts).toBe(1);
  expect(plan.rejectedPrompts[0]).toMatchObject({
    sourcePromptId: 'invalid_ratio'
  });

  const imagenJob = plan.jobs.find((job) => job.modelId === 'imagen-4');
  expect(imagenJob).toBeTruthy();
  expect(imagenJob.droppedFields).toContain('style');
  expect(imagenJob.warnings[0]).toContain('Dropped style');
  expect(imagenJob.prompts[0].style).toBe('');
});
