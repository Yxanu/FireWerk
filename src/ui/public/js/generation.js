import { showStatus, showEmbers, hideEmbers } from './ui-utils.js';
import { saveToHistory, updateHistoryStatus } from './history.js';

/**
 * @fileoverview Generation control and prompt management module for FireWerk UI
 * @module generation
 */

/**
 * Array of available prompt sets
 * @type {Array<Object>}
 */
let promptSets = [];

/**
 * ID of the currently running generation
 * @type {string|null}
 */
let currentGenerationId = null;

/**
 * Loads available prompt files from the server
 * @description Fetches prompt files from `/api/prompts` endpoint and populates `promptSets`.
 * Updates form fields after loading.
 * @returns {Promise<void>}
 */
export async function loadPromptFiles() {
  try {
    const response = await fetch('/api/prompts');
    promptSets = await response.json();
    updateFormFields();
  } catch (err) {
    showStatus('error', `Failed to load prompts: ${err.message}`);
  }
}

/**
 * Updates form fields based on generation type
 * @description Shows/hides type-specific form fields based on the selected generation type.
 * Filters and populates the prompt file dropdown with prompts matching the selected type.
 * @returns {void}
 */
export function updateFormFields() {
  const type = document.getElementById('generation-type').value;
  const select = document.getElementById('prompt-file');

  // Show/hide type-specific fields
  document.getElementById('variants-row').style.display = type === 'images' ? 'grid' : 'none';
  document.getElementById('capture-mode-row').style.display = type === 'images' ? 'grid' : 'none';
  document.getElementById('global-style-row').style.display = type === 'images' ? 'grid' : 'none';
  document.getElementById('aspect-row').style.display = type === 'images' ? 'grid' : 'none';
  document.getElementById('style-row').style.display = type === 'images' ? 'grid' : 'none';
  document.getElementById('model-row').style.display = type === 'images' ? 'grid' : 'none';

  select.innerHTML = '<option value="">Select prompts...</option>';
  const filtered = promptSets.filter(p => p.type === type);
  filtered.forEach(set => {
    const option = document.createElement('option');
    option.value = set.file;
    option.textContent = `${set.name} (${set.count})`;
    select.appendChild(option);
  });
}

/**
 * Loads and displays a preview of the selected prompt file
 * @description Fetches prompts from `/api/prompts/:filename` and displays a preview
 * showing the first 3 prompts. Hides preview if no file is selected.
 * @returns {Promise<void>}
 */
export async function loadPromptPreview() {
  const filename = document.getElementById('prompt-file').value;
  const preview = document.getElementById('prompt-preview');

  if (!filename) {
    preview.classList.remove('show');
    return;
  }

  try {
    const response = await fetch(`/api/prompts/${filename}`);
    const prompts = await response.json();

    preview.innerHTML = `<div class="preview-title">${prompts.length} Prompts</div>`;
    prompts.slice(0, 3).forEach(p => {
      const text = p.prompt_text || p.text || JSON.stringify(p);
      preview.innerHTML += `<div class="preview-item">${text.substring(0, 120)}${text.length > 120 ? '...' : ''}</div>`;
    });

    if (prompts.length > 3) {
      preview.innerHTML += `<div style="text-align: center; margin-top: 1rem; color: var(--text-dim); font-size: 0.75rem;">+${prompts.length - 3} more</div>`;
    }

    preview.classList.add('show');
  } catch (err) {
    showStatus('error', `Failed to load preview: ${err.message}`);
  }
}

/**
 * Starts a new generation job
 * @description Collects form values and starts a generation job via `/api/generate/:type`.
 * Saves the generation to history and begins polling for status updates.
 * @param {string} [type] - Generation type ('images' or 'speech'). If not provided, reads from form.
 * @param {string} [promptFile] - Prompt file name. If not provided, reads from form.
 * @param {string} [outputDir] - Output directory path. If not provided, reads from form.
 * @param {number} [variants] - Number of variants per prompt. If not provided, reads from form.
 * @param {string} [captureMode] - Capture mode ('screenshot' or 'download'). If not provided, reads from form.
 * @param {string} [globalStyle] - Global style to append to all prompts. If not provided, reads from form.
 * @param {string} [aspectRatio] - Aspect ratio. If not provided, reads from form.
 * @param {string} [style] - Style. If not provided, reads from form.
 * @param {string} [model] - Model to use. If not provided, reads from form.
 * @returns {Promise<void>}
 */
export async function startGeneration() {
  const type = document.getElementById('generation-type').value;
  const promptFile = document.getElementById('prompt-file').value;
  const outputDir = document.getElementById('output-dir').value;
  const variants = document.getElementById('variants').value;
  const captureMode = document.getElementById('capture-mode').value;
  const globalStyle = document.getElementById('global-style').value;
  const aspectRatio = document.getElementById('aspect-ratio').value;
  const style = document.getElementById('style').value;
  const model = document.getElementById('model').value;

  if (!promptFile) {
    showStatus('error', 'Please select a prompt file');
    return;
  }

  const btn = document.getElementById('generate-btn');
  btn.disabled = true;
  btn.innerHTML = '<span>Starting...</span>';

  const body = { promptFile, outputDir };
  if (type === 'images') {
    body.variantsPerPrompt = parseInt(variants);
    body.captureMode = captureMode;
    if (aspectRatio) body.aspectRatio = aspectRatio;
    if (style) body.style = style;
    if (model) body.model = model;
    if (globalStyle) body.globalStyle = globalStyle;
  }

  try {
    const response = await fetch(`/api/generate/${type}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    const result = await response.json();

    if (response.ok) {
      currentGenerationId = result.generationId;

      // Save to history
      saveToHistory({
        generationId: result.generationId,
        promptFile,
        type,
        outputDir,
        imageCount: 0
      });

      showStatus('success', `Started: ${result.generationId}`, null, { glow: true });
      showEmbers();
      pollStatus(result.generationId);
    } else {
      showStatus('error', result.error, null, { glow: true });
      btn.disabled = false;
      btn.innerHTML = '<span>Start Generation</span>';
    }
  } catch (err) {
    showStatus('error', err.message, null, { glow: true });
    btn.disabled = false;
    btn.innerHTML = '<span>Start Generation</span>';
  }
}

/**
 * Stops the currently running generation
 * @description Sends a stop request to `/api/stop/:id` for the current generation.
 * Updates history status to 'stopped'.
 * @returns {Promise<void>}
 */
export async function stopGeneration() {
  if (!currentGenerationId) {
    showStatus('error', 'No active generation to stop');
    return;
  }

  try {
    const response = await fetch(`/api/stop/${currentGenerationId}`, {
      method: 'POST'
    });

    const result = await response.json();

    if (response.ok) {
      hideEmbers();
      showStatus('info', 'Generation stopped');
      updateHistoryStatus(currentGenerationId, 'stopped');
    } else {
      showStatus('error', result.error);
    }
  } catch (err) {
    showStatus('error', err.message);
  }
}

/**
 * Polls the server for generation status updates
 * @description Polls `/api/status/:generationId` every 2000ms to check generation progress.
 * Updates UI and history based on status changes. Stops polling when generation completes, fails, or is stopped.
 * @param {string} generationId - The generation ID to poll
 * @returns {void}
 */
export async function pollStatus(generationId) {
  const stopBtn = document.getElementById('stop-btn');
  const generateBtn = document.getElementById('generate-btn');

  // Show stop button when polling starts
  stopBtn.style.display = 'inline-block';

  const interval = setInterval(async () => {
    try {
      const response = await fetch(`/api/status/${generationId}`);
      const status = await response.json();

      if (status.status === 'completed') {
        clearInterval(interval);
        hideEmbers();
        showStatus('success', 'Completed', null, { glow: true });
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<span>Start Generation</span>';
        stopBtn.style.display = 'none';
        currentGenerationId = null;

        // Update history
        updateHistoryStatus(generationId, 'completed', {
          imageCount: status.completed || 0
        });
      } else if (status.status === 'failed') {
        clearInterval(interval);
        hideEmbers();
        showStatus('error', `Failed: ${status.error}`, null, { glow: true });
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<span>Start Generation</span>';
        stopBtn.style.display = 'none';
        currentGenerationId = null;

        // Update history
        updateHistoryStatus(generationId, 'failed', {
          error: status.error
        });
      } else if (status.status === 'stopped') {
        clearInterval(interval);
        hideEmbers();
        showStatus('info', 'Stopped');
        generateBtn.disabled = false;
        generateBtn.innerHTML = '<span>Start Generation</span>';
        stopBtn.style.display = 'none';
        currentGenerationId = null;

        // Update history
        updateHistoryStatus(generationId, 'stopped', {
          imageCount: status.completed || 0
        });
      } else {
        showStatus('info', `Generating images...`, {
          completed: status.completed || 0,
          total: status.prompts || 0
        });

        // Update running status with current progress
        updateHistoryStatus(generationId, 'running', {
          imageCount: status.completed || 0
        });
      }
    } catch (err) {
      console.error('Status poll error:', err);
    }
  }, 2000);
}

