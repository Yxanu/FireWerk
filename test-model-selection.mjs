#!/usr/bin/env node
import { ImageGenerator } from './src/generators/ImageGenerator.mjs';

async function testModelSelection() {
  const generator = new ImageGenerator({
    outputDir: './output/test',
    model: 'Flux 1.1 Pro',  // This should map to 'FLUX1.1 [pro]'
    captureMode: 'download',
    variantsPerPrompt: 1
  });

  const testPrompts = [
    {
      prompt_id: 'test_flux_model',
      prompt_text: 'A simple test image of a red circle on white background',
      aspect_ratio: '1:1',  // This won't work with FLUX but should fail gracefully
      style: 'Art'
    }
  ];

  try {
    console.log('[TEST] Starting model selection test...');
    console.log('[TEST] Expected behavior:');
    console.log('  1. Model "Flux 1.1 Pro" should map to "FLUX1.1 [pro]"');
    console.log('  2. General settings should expand to reveal model selector');
    console.log('  3. Model should be selected successfully');
    console.log('  4. Aspect ratio should fail gracefully (not available for FLUX)\n');

    await generator.generate(testPrompts);

    console.log('\n[TEST] ✓ Test completed successfully!');
  } catch (err) {
    console.error('[TEST] ✗ Test failed:', err);
  }
}

testModelSelection();
