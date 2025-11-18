#!/usr/bin/env node
import { ImageGenerator } from './src/generators/ImageGenerator.mjs';

async function testFluxPro() {
  const generator = new ImageGenerator({
    outputDir: './output/flux-test',
    model: 'Flux 1.1 Pro',
    captureMode: 'download',
    variantsPerPrompt: 1
  });

  const testPrompts = [
    {
      prompt_id: 'test_flux_pro',
      prompt_text: 'A futuristic cityscape at sunset with flying cars and neon lights',
      aspect_ratio: '1:1'  // Will fail gracefully for FLUX
    }
  ];

  console.log('='.repeat(80));
  console.log('TESTING: Flux 1.1 Pro Model');
  console.log('='.repeat(80));
  console.log('\nExpected flow:');
  console.log('  1. ✓ Click firefly-link-info-card banner');
  console.log('  2. ✓ Click firefly-image-generation to unlock');
  console.log('  3. ✓ All partner models available');
  console.log('  4. ✓ Select Flux 1.1 Pro model');
  console.log('  5. ℹ  Aspect ratio not available (graceful)');
  console.log('  6. ✓ Generate image');
  console.log('='.repeat(80) + '\n');

  try {
    await generator.generate(testPrompts);
    console.log('\n' + '='.repeat(80));
    console.log('✓✓✓ TEST PASSED - Flux 1.1 Pro works!');
    console.log('='.repeat(80) + '\n');
  } catch (err) {
    console.error('\n' + '='.repeat(80));
    console.error('✗ TEST FAILED:', err.message);
    console.error('='.repeat(80) + '\n');
    throw err;
  }
}

testFluxPro();
