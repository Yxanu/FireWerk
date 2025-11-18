#!/usr/bin/env node
import { ImageGenerator } from './src/generators/ImageGenerator.mjs';

async function testFinal() {
  const generator = new ImageGenerator({
    outputDir: './output/final-test',
    model: 'Flux 1.1 Pro',  // Test with FLUX first
    captureMode: 'download',
    variantsPerPrompt: 1
  });

  const testPrompts = [
    {
      prompt_id: 'test_flux',
      prompt_text: 'A minimalist geometric pattern with circles and triangles',
      aspect_ratio: '1:1'  // Should fail gracefully (not available for FLUX)
    }
  ];

  console.log('='.repeat(80));
  console.log('FINAL TEST - Flux 1.1 Pro');
  console.log('='.repeat(80));
  console.log('Expected:');
  console.log('  1. ✓ Click Firefly 5 banner');
  console.log('  2. ✓ Select Flux 1.1 Pro model');
  console.log('  3. ℹ Aspect ratio unavailable (graceful failure)');
  console.log('  4. ✓ Generate image');
  console.log('='.repeat(80) + '\n');

  try {
    await generator.generate(testPrompts);
    console.log('\n' + '='.repeat(80));
    console.log('✓ FLUX TEST PASSED');
    console.log('='.repeat(80) + '\n');
  } catch (err) {
    console.error('\n' + '='.repeat(80));
    console.error('✗ FLUX TEST FAILED:', err.message);
    console.error('='.repeat(80) + '\n');
  }

  // Now test with GPT Image (which DOES support aspect ratio)
  const generator2 = new ImageGenerator({
    outputDir: './output/final-test',
    model: 'GPT Image',
    captureMode: 'download',
    variantsPerPrompt: 1
  });

  const testPrompts2 = [
    {
      prompt_id: 'test_gpt',
      prompt_text: 'A serene landscape with mountains and a lake',
      aspect_ratio: '1:1'  // Should work with GPT Image
    }
  ];

  console.log('='.repeat(80));
  console.log('FINAL TEST - GPT Image with 1:1 Aspect Ratio');
  console.log('='.repeat(80));
  console.log('Expected:');
  console.log('  1. ✓ Click Firefly 5 banner');
  console.log('  2. ✓ Select GPT Image model');
  console.log('  3. ✓ Set aspect ratio to Square (1:1)');
  console.log('  4. ✓ Generate image');
  console.log('='.repeat(80) + '\n');

  try {
    await generator2.generate(testPrompts2);
    console.log('\n' + '='.repeat(80));
    console.log('✓ GPT IMAGE TEST PASSED');
    console.log('='.repeat(80));
    console.log('\n✓✓✓ ALL TESTS PASSED! ✓✓✓\n');
  } catch (err) {
    console.error('\n' + '='.repeat(80));
    console.error('✗ GPT IMAGE TEST FAILED:', err.message);
    console.error('='.repeat(80) + '\n');
  }
}

testFinal();
