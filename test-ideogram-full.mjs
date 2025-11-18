#!/usr/bin/env node
import { ImageGenerator } from './src/generators/ImageGenerator.mjs';

async function testIdeogramFull() {
  const generator = new ImageGenerator({
    outputDir: './output/ideogram-full-test',
    model: 'Ideogram 3.0',
    captureMode: 'download',
    variantsPerPrompt: 1
  });

  const testPrompts = [
    {
      prompt_id: 'test_ideogram_1',
      prompt_text: 'A serene mountain landscape with a crystal clear lake',
      aspect_ratio: '1:1'
    },
    {
      prompt_id: 'test_ideogram_2',
      prompt_text: 'A vibrant sunset over the ocean',
      aspect_ratio: '1:1'
    }
  ];

  console.log('='.repeat(80));
  console.log('TESTING: Ideogram 3.0 with 2 prompts');
  console.log('='.repeat(80));

  try {
    await generator.generate(testPrompts);
    console.log('\n' + '='.repeat(80));
    console.log('✓ TEST PASSED - Generated 2 images with Ideogram 3.0!');
    console.log('='.repeat(80) + '\n');
  } catch (err) {
    console.error('\n' + '='.repeat(80));
    console.error('✗ TEST FAILED:', err.message);
    console.error('='.repeat(80) + '\n');
    throw err;
  }
}

testIdeogramFull();
