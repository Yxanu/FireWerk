#!/usr/bin/env node
import { ImageGenerator } from './generators/ImageGenerator.mjs';
import { SpeechGenerator } from './generators/SpeechGenerator.mjs';
import { loadPrompts } from '../lib/utils/promptLoader.mjs';
import path from 'path';

const usage = `
🔥 FireWerk - Adobe Firefly Automation CLI

Usage:
  npm run generate:images -- [options]
  npm run generate:speech -- [options]

Options:
  --prompts <path>    Path to prompts file (CSV or JSON) [required]
  --output <dir>      Output directory (default: ./output)
  --email <email>     Adobe email for login (default: from env)
  --variants <n>      Variants per prompt for images (default: 1)
  --headless          Run in headless mode (default: true)

Environment Variables:
  FIREFLY_EMAIL       Default Adobe email
  OUTPUT_DIR          Default output directory
  STORAGE_STATE       Path to storage state file
  HEADLESS            Run in headless mode (true/false)
  POST_CLICK_WAIT_MS  Wait time after clicking generate
  VARIANTS_PER_PROMPT Number of variants per prompt

Examples:
  npm run generate:images -- --prompts ./examples/prompts/geckio.csv
  npm run generate:images -- --prompts ./prompts.json --output ./my-output --variants 3
  npm run generate:speech -- --prompts ./speech-prompts.csv
`;

async function main() {
  const args = process.argv.slice(2);

  // Show usage if no command
  const command = args[0];
  if (!command || command === '--help' || command === '-h') {
    console.log(usage);
    process.exit(0);
  }

  // Parse arguments
  const options = {};
  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const value = args[i + 1];
      options[key] = value;
      i++;
    }
  }

  // Validate required options
  if (!options.prompts && !process.env.PROMPT_FILE) {
    console.error('❌ Error: --prompts option is required\n');
    console.log(usage);
    process.exit(1);
  }

  const promptsPath = options.prompts || process.env.PROMPT_FILE;
  const outputDir = options.output || process.env.OUTPUT_DIR || './output';
  const email = options.email || process.env.FIREFLY_EMAIL || 'web@adam-medien.de';

  console.log('\n🔥 FireWerk Starting...\n');
  console.log(`Command: ${command}`);
  console.log(`Prompts: ${promptsPath}`);
  console.log(`Output: ${outputDir}`);
  console.log(`Email: ${email}\n`);

  try {
    // Load prompts
    const prompts = await loadPrompts(path.resolve(promptsPath));
    console.log(`✅ Loaded ${prompts.length} prompts\n`);

    // Execute command
    switch (command) {
      case 'images': {
        const generator = new ImageGenerator({
          outputDir,
          variantsPerPrompt: parseInt(options.variants || process.env.VARIANTS_PER_PROMPT || 1),
          headless: options.headless !== undefined ? options.headless === 'true' : undefined,
          model: process.env.MODEL || null,
          captureMode: process.env.CAPTURE_MODE || 'screenshot'
        });

        await generator.generate(prompts, email);
        await generator.close();
        break;
      }

      case 'speech': {
        const generator = new SpeechGenerator({
          outputDir,
          headless: options.headless !== undefined ? options.headless === 'true' : undefined
        });

        await generator.generate(prompts, email);
        await generator.close();
        break;
      }

      default:
        console.error(`❌ Unknown command: ${command}\n`);
        console.log(usage);
        process.exit(1);
    }

    console.log('\n✅ FireWerk Complete!\n');
    process.exit(0);

  } catch (err) {
    console.error(`\n❌ Error: ${err.message}\n`);
    console.error(err.stack);
    process.exit(1);
  }
}

main();
