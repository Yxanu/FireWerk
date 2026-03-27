#!/usr/bin/env node
import path from 'path';
import { ImageGenerator } from './generators/ImageGenerator.mjs';
import { SpeechGenerator } from './generators/SpeechGenerator.mjs';
import { loadPrompts } from '../lib/utils/promptLoader.mjs';
import { validateImageRequest } from './models/imageModelCatalog.mjs';
import { planImageBatches } from './batch/imageBatchPlanner.mjs';

const usage = `
🔥 FireWerk - Adobe Firefly Automation CLI

Usage:
  node src/cli.mjs images --prompts <path> [options]
  node src/cli.mjs speech --prompts <path> [options]
  node src/cli.mjs plan-batches --prompts <path> [options]
  node src/cli.mjs submit-batches --prompts <path> --output <dir> [options]

Options:
  --prompts <path>         Path to prompts file (CSV or JSON)
  --output <dir>           Output directory (default: ./output)
  --email <email>          Adobe email for login (default: from env)
  --model <value>          Model label, alias, or modelId
  --aspect-ratio <value>   Global aspect ratio override
  --style <value>          Global style override
  --variants <n>           Variants per prompt for images (default: 1)
  --server <url>           FireWerk API base URL (default: http://localhost:3000)
  --capture-mode <value>   download|screenshot
  --headless <bool>        Run in headless mode (default: false)
  --debug-run-dir <dir>    Directory for run artifacts
  --save-artifacts <mode>  failures|all|none (default: failures)

Commands:
  images                   Run the Playwright image generator directly
  speech                   Run the speech generator directly
  plan-batches             Split prompts into FireWerk-compatible jobs
  submit-batches           Plan jobs and submit them to a local FireWerk API
`;

function parseArgs(argv) {
  const command = argv[0];
  const options = {};

  for (let i = 1; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const value = argv[i + 1];
    if (value && !value.startsWith('--')) {
      options[key] = value;
      i += 1;
    } else {
      options[key] = 'true';
    }
  }

  return { command, options };
}

function printJson(payload) {
  console.log(JSON.stringify(payload, null, 2));
}

function requirePrompts(command, promptsPath) {
  if (!promptsPath) {
    throw new Error(`--prompts option is required for "${command}"`);
  }
}

function buildPlanDefaults(options) {
  return {
    modelId: options.model || process.env.MODEL || '',
    model: options.model || process.env.MODEL || '',
    aspectRatio: options['aspect-ratio'] || process.env.ASPECT_RATIO || '',
    style: options.style || process.env.STYLE || ''
  };
}

async function loadPlan(promptsPath, options) {
  const prompts = await loadPrompts(path.resolve(promptsPath));
  return planImageBatches(prompts, buildPlanDefaults(options));
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed: ${response.status}`);
  }

  return data;
}

async function fetchJson(url) {
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || `Request failed: ${response.status}`);
  }
  return data;
}

async function waitForGeneration(serverBaseUrl, generationId) {
  while (true) {
    const status = await fetchJson(`${serverBaseUrl}/api/status/${generationId}`);
    if (status.status === 'completed') {
      return status;
    }
    if (status.status === 'failed' || status.status === 'stopped') {
      throw new Error(status.error || `Generation ${generationId} ended with status ${status.status}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

async function runImagesCommand(promptsPath, outputDir, email, options) {
  const modelValidation = validateImageRequest({
    modelId: options.model || process.env.MODEL || '',
    model: options.model || process.env.MODEL || ''
  });

  if (!modelValidation.ok) {
    throw new Error(modelValidation.errors.join('; '));
  }

  const prompts = await loadPrompts(path.resolve(promptsPath));
  const generator = new ImageGenerator({
    outputDir,
    variantsPerPrompt: parseInt(options.variants || process.env.VARIANTS_PER_PROMPT || 1, 10),
    headless: options.headless !== undefined ? options.headless === 'true' : undefined,
    modelId: modelValidation.normalized.modelId || '',
    model: modelValidation.normalized.model?.label || process.env.MODEL || null,
    aspectRatio: options['aspect-ratio'] || process.env.ASPECT_RATIO || null,
    style: options.style || process.env.STYLE || null,
    captureMode: options['capture-mode'] || process.env.CAPTURE_MODE || 'download',
    debugRunDir: options['debug-run-dir'] || process.env.DEBUG_RUN_DIR || '',
    saveArtifacts: options['save-artifacts'] || process.env.SAVE_ARTIFACTS || 'failures'
  });

  await generator.generate(prompts, email);
  await generator.close();
}

async function runSpeechCommand(promptsPath, outputDir, email, options) {
  const prompts = await loadPrompts(path.resolve(promptsPath));
  const generator = new SpeechGenerator({
    outputDir,
    headless: options.headless !== undefined ? options.headless === 'true' : undefined
  });

  await generator.generate(prompts, email);
  await generator.close();
}

async function runPlanBatchesCommand(promptsPath, options) {
  const plan = await loadPlan(promptsPath, options);
  printJson(plan);
}

async function runSubmitBatchesCommand(promptsPath, outputDir, email, options) {
  const serverBaseUrl = (options.server || process.env.FIREWERK_API_URL || 'http://localhost:3000').replace(/\/$/, '');
  const plan = await loadPlan(promptsPath, options);

  if (plan.rejectedPrompts.length > 0) {
    console.error(`Rejected prompts: ${plan.rejectedPrompts.length}`);
    plan.rejectedPrompts.forEach((entry) => {
      console.error(`- ${entry.sourcePromptId || 'unknown'}: ${entry.reason}`);
    });
  }

  if (plan.jobs.length === 0) {
    throw new Error('No valid jobs produced by batch planner');
  }

  const results = [];
  for (const job of plan.jobs) {
    console.log(`Submitting ${job.jobId} (${job.promptCount} prompts, ${job.modelLabel}, ${job.appliedAspectRatio})`);

    const submission = await postJson(`${serverBaseUrl}/api/generate/images`, {
      customPrompts: job.prompts,
      email,
      outputDir,
      variantsPerPrompt: parseInt(options.variants || process.env.VARIANTS_PER_PROMPT || 1, 10),
      captureMode: options['capture-mode'] || process.env.CAPTURE_MODE || 'download',
      debugRunDir: options['debug-run-dir'] || process.env.DEBUG_RUN_DIR || '',
      saveArtifacts: options['save-artifacts'] || process.env.SAVE_ARTIFACTS || 'failures'
    });

    const status = await waitForGeneration(serverBaseUrl, submission.generationId);
    results.push({
      jobId: job.jobId,
      generationId: submission.generationId,
      status: status.status,
      completed: status.completed,
      progress: status.progress || null,
      warnings: job.warnings,
      droppedFields: job.droppedFields
    });
  }

  printJson({
    summary: plan.summary,
    rejectedPrompts: plan.rejectedPrompts,
    results
  });
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));

  if (!command || command === '--help' || command === '-h') {
    console.log(usage);
    process.exit(0);
  }

  const promptsPath = options.prompts || process.env.PROMPT_FILE;
  const outputDir = options.output || process.env.OUTPUT_DIR || './output';
  const email = options.email || process.env.FIREFLY_EMAIL || 'web@adam-medien.de';

  try {
    switch (command) {
      case 'images':
        requirePrompts(command, promptsPath);
        await runImagesCommand(promptsPath, outputDir, email, options);
        break;
      case 'speech':
        requirePrompts(command, promptsPath);
        await runSpeechCommand(promptsPath, outputDir, email, options);
        break;
      case 'plan-batches':
        requirePrompts(command, promptsPath);
        await runPlanBatchesCommand(promptsPath, options);
        break;
      case 'submit-batches':
        requirePrompts(command, promptsPath);
        await runSubmitBatchesCommand(promptsPath, outputDir, email, options);
        break;
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  } catch (error) {
    console.error(`\n❌ Error: ${error.message}\n`);
    if (error?.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
