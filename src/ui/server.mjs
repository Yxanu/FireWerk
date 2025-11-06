/**
 * @module server
 * @description Express server for FireWerk UI providing API endpoints for prompt management, generation control, and output handling
 */

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { ImageGenerator } from '../generators/ImageGenerator.mjs';
import { SpeechGenerator } from '../generators/SpeechGenerator.mjs';
import { loadPrompts } from '../../lib/utils/promptLoader.mjs';
import fs from 'fs/promises';
import { exec } from 'child_process';
import { promisify } from 'util';

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
  const { promptFile, email, outputDir, variantsPerPrompt, aspectRatio, style, model, captureMode, globalStyle } = req.body;

  console.log('[DEBUG] Received request:', { aspectRatio, style, model, captureMode });

  try {
    const filePath = path.join(process.cwd(), 'examples', 'prompts', promptFile);
    let prompts = await loadPrompts(filePath);

    // Append global style to all prompts if provided
    if (globalStyle && globalStyle.trim()) {
      prompts = prompts.map(p => ({
        ...p,
        prompt_text: p.prompt_text + ', ' + globalStyle.trim()
      }));
    }

    // Apply global aspect ratio and style to all prompts if provided
    if (aspectRatio || style) {
      console.log('[DEBUG] Mapping aspect ratio and style to prompts');
      prompts = prompts.map(p => ({
        ...p,
        ...(aspectRatio && { aspect_ratio: aspectRatio }),
        ...(style && { style: style })
      }));
      console.log('[DEBUG] First prompt after mapping:', prompts[0]);
    }

    const generationId = `img_${Date.now()}`;

    // Start generation in background
    const generator = new ImageGenerator({
      outputDir: outputDir || './output',
      variantsPerPrompt: variantsPerPrompt || 1,
      model: model || null,
      aspectRatio: aspectRatio || null,
      style: style || null,
      captureMode: captureMode || 'screenshot',
      onProgress: (completed) => {
        const gen = activeGenerations.get(generationId);
        if (gen) {
          gen.completed = completed;
        }
      }
    });

    activeGenerations.set(generationId, {
      type: 'images',
      status: 'running',
      prompts: prompts.length,
      completed: 0,
      generator
    });

    // Run generation asynchronously
    (async () => {
      try {
        await generator.generate(prompts, email);
        const gen = activeGenerations.get(generationId);
        if (gen && gen.status !== 'stopped') {
          gen.status = 'completed';
        }
        await generator.close();
      } catch (err) {
        const gen = activeGenerations.get(generationId);
        if (gen && gen.status !== 'stopped') {
          gen.status = 'failed';
          gen.error = err.message;
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
  const { promptFile, email, outputDir } = req.body;

  try {
    const filePath = path.join(process.cwd(), 'examples', 'prompts', promptFile);
    const prompts = await loadPrompts(filePath);

    const generationId = `speech_${Date.now()}`;

    // Start generation in background
    const generator = new SpeechGenerator({
      outputDir: outputDir || './output'
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
        await generator.close();
      } catch (err) {
        activeGenerations.get(generationId).status = 'failed';
        activeGenerations.get(generationId).error = err.message;
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
