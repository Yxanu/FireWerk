import { test, expect } from '@playwright/test';
import { parsePrompts } from '../lib/utils/promptLoader.mjs';

test('parses inline CSV prompts with quoted commas and normalizes fields', async () => {
  const prompts = await parsePrompts(
    'id,prompt,aspect_ratio\nhero,"bright, cinematic product shot",1:1\n',
    'inline.csv'
  );

  expect(prompts).toEqual([
    {
      id: 'hero',
      prompt: 'bright, cinematic product shot',
      aspect_ratio: '1:1',
      prompt_text: 'bright, cinematic product shot',
      prompt_id: 'hero'
    }
  ]);
});
