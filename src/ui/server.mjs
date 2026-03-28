/**
 * @module server
 * @description Express server for FireWerk UI providing API endpoints for prompt management, generation control, and output handling
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { ImageGenerator } from '../generators/ImageGenerator.mjs';
import { SpeechGenerator } from '../generators/SpeechGenerator.mjs';
import { loadPrompts, parsePrompts } from '../../lib/utils/promptLoader.mjs';
import fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';
import {
  getImageModelUiPayload,
  normalizeAspectRatio,
  normalizeStyle,
  validateImageRequest
} from '../models/imageModelCatalog.mjs';
import { planImageBatches } from '../batch/imageBatchPlanner.mjs';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
/**
 * @constant {number} PORT - Server port number from environment or default 3000
 */
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

/**
 * @type {Map<string, Object>} activeGenerations - Map storing active generation processes by ID
 */
const activeGenerations = new Map();

function parseBooleanOption(value, fallback) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return false;
  }

  return fallback;
}

function applyGlobalImageOptions(prompts, { aspectRatio, style, modelId, model, globalStyle }) {
  return prompts.map((prompt) => ({
    ...prompt,
    ...(globalStyle ? { prompt_text: `${prompt.prompt_text}, ${globalStyle}` } : {}),
    ...(aspectRatio ? { aspect_ratio: aspectRatio } : {}),
    ...(style ? { style } : {}),
    ...(modelId ? { modelId } : {}),
    ...(!modelId && model ? { model } : {})
  }));
}

function validateImagePrompts(prompts) {
  const errors = [];

  prompts.forEach((prompt, index) => {
    const validation = validateImageRequest({
      modelId: prompt.modelId,
      model: prompt.model,
      aspectRatio: prompt.aspect_ratio,
      style: prompt.style
    });

    if (!validation.ok) {
      errors.push(`Prompt ${index + 1}${prompt.prompt_id ? ` (${prompt.prompt_id})` : ''}: ${validation.errors.join('; ')}`);
    } else {
      prompt.modelId = validation.normalized.modelId || prompt.modelId || '';
      prompt.model = validation.normalized.model?.label || prompt.model || '';
      prompt.aspect_ratio = normalizeAspectRatio(prompt.aspect_ratio);
      prompt.style = normalizeStyle(prompt.style);
    }
  });

  return errors;
}

async function loadImagePromptsFromRequest(body = {}) {
  const { promptFile, customPrompts, customPromptCsv } = body;

  if (customPromptCsv && customPromptCsv.trim()) {
    const prompts = await parsePrompts(customPromptCsv, 'inline.csv');
    return { prompts, source: 'inline-csv' };
  }

  if (Array.isArray(customPrompts) && customPrompts.length > 0) {
    return { prompts: customPrompts, source: 'custom-prompts' };
  }

  if (promptFile) {
    const filePath = path.join(process.cwd(), 'examples', 'prompts', promptFile);
    const prompts = await loadPrompts(filePath);
    return { prompts, source: promptFile };
  }

  throw new Error('No prompts provided');
}

// API Routes

/**
 * @route GET /api/prompts
 * @description Fetches all available prompt files from the examples/prompts directory
 * @returns {Array<Object>} Array of prompt set objects with name, file, count, and type properties
 * @throws {500} If reading prompt directory fails
 */
app.get('/api/prompts', async (req, res) => {
  try {
    const promptsDir = path.join(process.cwd(), 'examples', 'prompts');
    const files = await fs.readdir(promptsDir);
    const promptFiles = files.filter(f => f.endsWith('.csv') || f.endsWith('.json'));

    const promptSets = await Promise.all(
      promptFiles.map(async (file) => {
        const filePath = path.join(promptsDir, file);
        const prompts = await loadPrompts(filePath);
        return {
          name: file.replace(/\.(csv|json)$/, ''),
          file,
          count: prompts.length,
          type: prompts[0]?.prompt_text ? 'images' : 'speech'
        };
      })
    );

    res.json(promptSets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/models', async (req, res) => {
  res.json(getImageModelUiPayload());
});

/**
 * @route GET /api/prompts/:filename
 * @param {string} req.params.filename - Name of the prompt file to load
 * @description Loads and returns prompts from a specific file
 * @returns {Array<Object>} Array of prompt objects
 * @throws {404} If prompt file not found
 */
app.get('/api/prompts/:filename', async (req, res) => {
  try {
    const filePath = path.join(process.cwd(), 'examples', 'prompts', req.params.filename);
    const prompts = await loadPrompts(filePath);
    res.json(prompts);
  } catch (err) {
    res.status(404).json({ error: 'Prompt file not found' });
  }
});

app.post('/api/prompts/parse', async (req, res) => {
  try {
    const prompts = await parsePrompts(req.body?.csv || '', 'inline.csv');
    res.json(prompts);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/batches/plan', async (req, res) => {
  try {
    const { prompts } = await loadImagePromptsFromRequest(req.body || {});
    const planned = planImageBatches(prompts, {
      modelId: req.body?.modelId || '',
      model: req.body?.model || '',
      aspectRatio: req.body?.aspectRatio || '',
      style: req.body?.style || ''
    });
    res.json(planned);
  } catch (err) {
    const status = err.message === 'No prompts provided' ? 400 : 500;
    res.status(status).json({ error: err.message });
  }
});

/**
 * @route POST /api/generate/images
 * @param {Object} req.body - Generation parameters
 * @param {string} req.body.promptFile - Name of the prompt file
 * @param {string} [req.body.email] - Optional email for authentication
 * @param {string} [req.body.outputDir] - Output directory path
 * @param {number} [req.body.variantsPerPrompt] - Number of variants per prompt
 * @param {string} [req.body.aspectRatio] - Image aspect ratio
 * @param {string} [req.body.style] - Image style
 * @param {string} [req.body.model] - Model to use
 * @param {string} [req.body.captureMode] - Capture mode (screenshot/download)
 * @param {string} [req.body.globalStyle] - Global style to append to all prompts
 * @description Starts an image generation job in the background
 * @returns {Object} Object with generationId and status
 * @throws {500} If generation fails to start
 */
app.post('/api/generate/images', async (req, res) => {
  const { promptFile, customPrompts, customPromptCsv, email, outputDir, variantsPerPrompt, aspectRatio, style, modelId, model, captureMode, globalStyle, debugRunDir, saveArtifacts, headless } = req.body;

  console.log('[DEBUG] Received request:', { aspectRatio, style, model, captureMode });

  try {
    const loaded = await loadImagePromptsFromRequest({ promptFile, customPrompts, customPromptCsv });
    let prompts = loaded.prompts;
    console.log(`[INFO] Using ${prompts.length} prompts from ${loaded.source}`);

    prompts = applyGlobalImageOptions(prompts, {
      aspectRatio,
      style,
      modelId,
      model,
      globalStyle: globalStyle?.trim()
    });

    const validationErrors = validateImagePrompts(prompts);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: validationErrors.join('\n')
      });
    }

    const generationId = `img_${Date.now()}`;

    // Start generation in background
    const generator = new ImageGenerator({
      outputDir: outputDir || './output',
      variantsPerPrompt: variantsPerPrompt || 1,
      headless: parseBooleanOption(headless, true),
      modelId: modelId || '',
      model: model || null,
      aspectRatio: aspectRatio || null,
      style: style || null,
      captureMode: captureMode || 'download',
      debugRunDir: debugRunDir || '',
      saveArtifacts: saveArtifacts || 'failures',
      onProgress: (progress) => {
        const gen = activeGenerations.get(generationId);
        if (gen) {
          gen.completed = progress.capturesSucceeded || 0;
          gen.progress = progress;
        }
      }
    });

    activeGenerations.set(generationId, {
      type: 'images',
      status: 'running',
      prompts: prompts.length,
      completed: 0,
      progress: {
        totalPrompts: prompts.length,
        totalVariants: prompts.length * (variantsPerPrompt || 1),
        processedPrompts: 0,
        generatedVariants: 0,
        capturesSucceeded: 0,
        fallbackCount: 0,
        phase: 'queued'
      },
      generator
    });

    // Run generation asynchronously
    (async () => {
      try {
        await generator.generate(prompts, email);
        const gen = activeGenerations.get(generationId);
        if (gen && gen.status !== 'stopped') {
          gen.status = 'completed';
          gen.progress = {
            ...(gen.progress || {}),
            status: 'completed',
            phase: 'completed'
          };
        }
        await generator.close();
      } catch (err) {
        const gen = activeGenerations.get(generationId);
        if (gen && gen.status !== 'stopped') {
          gen.status = 'failed';
          gen.error = err.message;
          gen.progress = {
            ...(gen.progress || {}),
            status: 'failed',
            phase: 'failed'
          };
        }
        await generator.close();
      }
    })();

    res.json({ generationId, status: 'started' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route POST /api/generate/speech
 * @param {Object} req.body - Generation parameters
 * @param {string} req.body.promptFile - Name of the prompt file
 * @param {string} [req.body.email] - Optional email for authentication
 * @param {string} [req.body.outputDir] - Output directory path
 * @description Starts a speech generation job in the background
 * @returns {Object} Object with generationId and status
 * @throws {500} If generation fails to start
 */
app.post('/api/generate/speech', async (req, res) => {
  const { promptFile, email, outputDir, headless } = req.body;

  try {
    const filePath = path.join(process.cwd(), 'examples', 'prompts', promptFile);
    const prompts = await loadPrompts(filePath);

    const generationId = `speech_${Date.now()}`;

    // Start generation in background
    const generator = new SpeechGenerator({
      outputDir: outputDir || './output',
      headless: parseBooleanOption(headless, true)
    });

    activeGenerations.set(generationId, {
      type: 'speech',
      status: 'running',
      prompts: prompts.length,
      completed: 0
    });

    // Run generation asynchronously
    (async () => {
      try {
        await generator.generate(prompts, email);
        activeGenerations.get(generationId).status = 'completed';
        activeGenerations.get(generationId).progress = {
          ...(activeGenerations.get(generationId).progress || {}),
          status: 'completed',
          phase: 'completed'
        };
        await generator.close();
      } catch (err) {
        activeGenerations.get(generationId).status = 'failed';
        activeGenerations.get(generationId).error = err.message;
        activeGenerations.get(generationId).progress = {
          ...(activeGenerations.get(generationId).progress || {}),
          status: 'failed',
          phase: 'failed'
        };
        await generator.close();
      }
    })();

    res.json({ generationId, status: 'started' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route GET /api/status/:generationId
 * @param {string} req.params.generationId - ID of the generation to check
 * @description Returns the current status of a generation job
 * @returns {Object} Status object with type, status, prompts, completed properties
 * @throws {404} If generation not found
 */
app.get('/api/status/:generationId', (req, res) => {
  const gen = activeGenerations.get(req.params.generationId);
  if (!gen) {
    return res.status(404).json({ error: 'Generation not found' });
  }
  // Don't send the generator object to the client
  const { generator, ...status } = gen;
  res.json(status);
});

/**
 * @route POST /api/stop/:generationId
 * @param {string} req.params.generationId - ID of the generation to stop
 * @description Stops a running generation job
 * @returns {Object} Object with status: 'stopped'
 * @throws {404} If generation not found
 * @throws {500} If stopping fails
 */
app.post('/api/stop/:generationId', async (req, res) => {
  const gen = activeGenerations.get(req.params.generationId);
  if (!gen) {
    return res.status(404).json({ error: 'Generation not found' });
  }

  try {
    gen.status = 'stopped';
    gen.progress = {
      ...(gen.progress || {}),
      status: 'stopped',
      phase: 'stopped'
    };
    if (gen.generator && gen.generator.close) {
      await gen.generator.close();
    }
    res.json({ status: 'stopped' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route GET /api/outputs
 * @description Fetches all output files from the output directory
 * @returns {Array<Object>} Array of output directory objects with name and files array
 * @throws {500} If reading output directory fails
 */
app.get('/api/outputs', async (req, res) => {
  try {
    const outputDir = path.join(process.cwd(), 'output');
    const dirs = await fs.readdir(outputDir, { withFileTypes: true });

    const outputs = await Promise.all(
      dirs
        .filter(d => d.isDirectory())
        .map(async (dir) => {
          const dirPath = path.join(outputDir, dir.name);
          const files = await fs.readdir(dirPath);
          const filesWithStats = await Promise.all(
            files.map(async (f) => {
              const filePath = path.join(dirPath, f);
              const stats = await fs.stat(filePath);
              return {
                name: f,
                path: `/output/${dir.name}/${f}`,
                mtime: stats.mtimeMs
              };
            })
          );
          return {
            name: dir.name,
            files: filesWithStats
          };
        })
    );

    res.json(outputs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @route POST /api/remove-background
 * @param {Object} req.body - Background removal parameters
 * @param {string} req.body.filePath - Path to the image file
 * @param {string} [req.body.threshold] - Threshold value for background removal (default: '10')
 * @description Removes background from an image using Python script
 * @returns {Object} Object with success, outputPath, and message properties
 * @throws {400} If filePath is missing
 * @throws {500} If background removal fails
 */
app.post('/api/remove-background', async (req, res) => {
  const { filePath, threshold } = req.body;

  if (!filePath) {
    return res.status(400).json({ error: 'File path is required' });
  }

  try {
    const fullPath = path.join(process.cwd(), filePath.replace(/^\//, ''));
    const parsedPath = path.parse(fullPath);
    const outputPath = path.join(parsedPath.dir, `${parsedPath.name}_nobg.png`);

    // Call Python script with threshold parameter
    const scriptPath = path.join(process.cwd(), 'scripts', 'remove_bg.py');
    const thresholdArg = threshold ? threshold : '10';
    const { stdout, stderr } = await execAsync(`python3 "${scriptPath}" "${fullPath}" "${outputPath}" "${thresholdArg}"`);

    if (stderr && !stderr.includes('rembg not available')) {
      console.warn('Background removal warning:', stderr);
    }

    const relativePath = path.relative(process.cwd(), outputPath);
    res.json({
      success: true,
      outputPath: `/${relativePath}`,
      message: stdout.trim()
    });
  } catch (err) {
    console.error('Background removal error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Serve output files
app.use('/output', express.static(path.join(process.cwd(), 'output')));

// Serve index page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🔥 FireWerk UI running at http://localhost:${PORT}`);
  console.log(`\nOpen your browser to manage prompts and trigger generations.\n`);
});
