#!/usr/bin/env node
import { ImageGenerator } from './src/generators/ImageGenerator.mjs';

async function testIdeogram() {
  const generator = new ImageGenerator({
    outputDir: './output/ideogram-test',
    model: 'Ideogram 3.0',
    captureMode: 'download',
    variantsPerPrompt: 1
  });

  const testPrompts = [
    {
      prompt_id: 'test_ideogram',
      prompt_text: 'A serene mountain landscape with a crystal clear lake',
      aspect_ratio: '1:1'
    }
  ];

  console.log('='.repeat(80));
  console.log('TESTING: Ideogram 3.0 with Square (1:1) aspect ratio');
  console.log('='.repeat(80));

  try {
    await generator.generate(testPrompts);
    console.log('\n' + '='.repeat(80));
    console.log('✓ TEST PASSED - Ideogram 3.0 works!');
    console.log('='.repeat(80) + '\n');
  } catch (err) {
    console.error('\n' + '='.repeat(80));
    console.error('✗ TEST FAILED:', err.message);
    console.error('='.repeat(80) + '\n');
    throw err;
  }
}

testIdeogram();
