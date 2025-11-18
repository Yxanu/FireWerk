#!/usr/bin/env node
import { chromium } from 'playwright';
import fs from 'fs/promises';
import path from 'path';

async function testGPTImage() {
  console.log('Testing GPT Image generation with aspect ratio control\n');

  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized']
  });

  const context = await browser.newContext({
    viewport: null,
    storageState: './data/storageState.json'
  });

  const page = await context.newPage();
  const outputDir = './output/gpt-test';

  // Ensure output directory exists
  await fs.mkdir(outputDir, { recursive: true });

  try {
    // Navigate to the page
    console.log('[1] Navigating to https://firefly.adobe.com/generate/image');
    await page.goto('https://firefly.adobe.com/generate/image', {
      waitUntil: 'domcontentloaded',
      timeout: 60000
    });
    await page.waitForTimeout(5000);

    // Wait for prompt textarea
    console.log('[2] Waiting for UI to load...');
    const promptBox = page.locator('textarea').first();
    await promptBox.waitFor({ timeout: 15000, state: 'visible' });

    // Find and click model selector
    console.log('[3] Opening model selector...');
    const modelPicker = page.locator('sp-picker').first();
    await modelPicker.click();
    await page.waitForTimeout(1500);

    // Wait for menu items to appear
    await page.waitForSelector('sp-menu-item', { timeout: 5000 });

    // Click GPT Image
    console.log('[4] Selecting GPT Image...');
    const gptOption = page.locator('sp-menu-item:has-text("GPT Image")').first();
    await gptOption.waitFor({ timeout: 3000, state: 'visible' });
    await gptOption.click();
    await page.waitForTimeout(2000);
    console.log('    ✓ GPT Image selected');

    // Verify model is selected
    const selectedModel = await page.locator('sp-picker').first().textContent();
    console.log(`    Current model: ${selectedModel.trim().split('\n')[0]}`);

    // Set aspect ratio to Square (1:1)
    console.log('[5] Setting aspect ratio to Square (1:1)...');
    const aspectRatioPicker = page.locator('sp-picker').nth(1); // Second picker is aspect ratio
    await aspectRatioPicker.click();
    await page.waitForTimeout(500);

    const squareOption = page.locator('sp-menu-item:has-text("Square (1:1)")').first();
    await squareOption.click();
    await page.waitForTimeout(500);
    console.log('    ✓ Aspect ratio set to Square (1:1)');

    // Fill prompt
    console.log('[6] Filling prompt...');
    const prompt = 'A serene mountain landscape with a crystal clear lake';
    await promptBox.click();
    await page.waitForTimeout(500);
    await promptBox.fill(prompt);
    console.log(`    Prompt: "${prompt}"`);
    await page.waitForTimeout(1000);

    // Take screenshot before generation
    await page.screenshot({
      path: './data/gpt-before-generation.png',
      fullPage: true
    });
    console.log('    Screenshot: ./data/gpt-before-generation.png');

    // Click generate button
    console.log('[7] Generating image...');
    const genBtn = page.getByTestId('generate-button');
    await genBtn.click();
    console.log('    Waiting 20 seconds for generation...');
    await page.waitForTimeout(20000);

    // Take screenshot after generation
    await page.screenshot({
      path: './data/gpt-after-generation.png',
      fullPage: true
    });
    console.log('    Screenshot: ./data/gpt-after-generation.png');

    // Try to capture the image
    console.log('[8] Capturing generated image...');
    try {
      await page.waitForSelector('img[src^="blob:"]', { timeout: 10000 });
      const firstImage = page.locator('img[src^="blob:"]').first();
      const imgBuffer = await firstImage.screenshot({ type: 'png' });

      const outPath = path.join(outputDir, 'gpt-test-image.png');
      await fs.writeFile(outPath, imgBuffer);
      console.log(`    ✓ Image saved: ${outPath} (${Math.round(imgBuffer.length/1024)} KB)`);
    } catch (err) {
      console.log(`    ⚠ Could not capture image: ${err.message}`);
    }

    console.log('\n' + '='.repeat(80));
    console.log('✓ Test complete!');
    console.log('Browser will remain open for 30 seconds for inspection...');
    console.log('='.repeat(80) + '\n');

    await page.waitForTimeout(30000);

  } catch (err) {
    console.error('\nError:', err.message);
    await page.screenshot({ path: './data/gpt-error.png', fullPage: true });
    console.error('Screenshot saved: ./data/gpt-error.png\n');
    throw err;
  } finally {
    await browser.close();
  }
}

testGPTImage().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
