#!/usr/bin/env node
/**
 * Test script to verify that UI parameters are passed correctly to Firefly
 */

const BASE_URL = 'http://localhost:3000';

async function testGeneration() {
  console.log('🧪 Testing FireWerk UI parameter passing...\n');

  const testParams = {
    promptFile: 'debug-test.csv',
    email: process.env.FIREFLY_EMAIL || 'web@adam-medien.de',
    outputDir: './output/debug-test',
    variantsPerPrompt: 1,
    aspectRatio: '16:9',
    style: 'Art',
    model: 'Firefly Image 4',
    captureMode: 'screenshot'
  };

  console.log('📋 Test Parameters:');
  console.log(JSON.stringify(testParams, null, 2));
  console.log('');

  try {
    const response = await fetch(`${BASE_URL}/api/generate/images`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testParams)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('✅ Generation started:', result);
    console.log('\n📸 Screenshots will be saved to ./data/');
    console.log('🖼️  Generated images will be saved to ./output/debug-test/');
    console.log('\n⏳ Monitor the generation progress...\n');

    // Poll for status
    const generationId = result.generationId;
    let lastStatus = null;

    const pollInterval = setInterval(async () => {
      try {
        const statusResponse = await fetch(`${BASE_URL}/api/status/${generationId}`);
        const status = await statusResponse.json();

        if (JSON.stringify(status) !== JSON.stringify(lastStatus)) {
          console.log(`📊 Status: ${status.status} - ${status.completed}/${status.prompts} completed`);
          lastStatus = status;
        }

        if (status.status === 'completed' || status.status === 'failed') {
          clearInterval(pollInterval);
          if (status.status === 'completed') {
            console.log('\n✅ Generation completed!');
            console.log('\n🔍 Check the screenshots in ./data/ to verify parameters were applied:');
            console.log('  - debug-before-ratio-*.png (before setting aspect ratio)');
            console.log('  - debug-after-ratio-*.png (after setting aspect ratio)');
            console.log('  - debug-before-style-*.png (before setting style)');
            console.log('  - debug-after-style-*.png (after setting style)');
            console.log('  - debug-before-generation-*.png (final state before clicking generate)');
          } else {
            console.log(`\n❌ Generation failed: ${status.error}`);
          }
          process.exit(status.status === 'completed' ? 0 : 1);
        }
      } catch (err) {
        console.error('Error polling status:', err.message);
      }
    }, 2000);

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

testGeneration();
