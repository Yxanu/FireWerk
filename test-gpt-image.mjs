#!/usr/bin/env node
import { ImageGenerator } from './src/generators/ImageGenerator.mjs';

async function testGPTImage() {
  const generator = new ImageGenerator({
    outputDir: './output/gpt-test',
    model: 'GPT Image',
    captureMode: 'download',
    variantsPerPrompt: 1
  });

  const testPrompts = [
    {
      prompt_id: 'test_gpt_square',
      prompt_text: 'A serene mountain landscape with a crystal clear lake',
      aspect_ratio: '1:1'
    }
  ];

  console.log('='.repeat(80));
  console.log('TESTING: GPT Image with Square (1:1) aspect ratio');
  console.log('='.repeat(80));
  console.log('\nExpected flow:');
  console.log('  1. ✓ Click firefly-link-info-card banner');
  console.log('  2. ✓ All partner models unlocked');
  console.log('  3. ✓ Select GPT Image model');
  console.log('  4. ✓ Aspect ratio controls appear');
  console.log('  5. ✓ Set aspect ratio to Square (1:1)');
  console.log('  6. ✓ Generate image');
  console.log('='.repeat(80) + '\n');

  try {
    await generator.generate(testPrompts);
    console.log('\n' + '='.repeat(80));
    console.log('✓✓✓ TEST PASSED - GPT Image with aspect ratio works!');
    console.log('='.repeat(80) + '\n');
  } catch (err) {
    console.error('\n' + '='.repeat(80));
    console.error('✗ TEST FAILED:', err.message);
    console.error('='.repeat(80) + '\n');
    throw err;
  }
}

testGPTImage();
