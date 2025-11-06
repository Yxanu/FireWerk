import { showStatus } from './ui-utils.js';

/**
 * @fileoverview Outputs display and management module for FireWerk UI
 * @module outputs
 */

/**
 * Current output data array
 * @type {Array<Object>}
 */
let currentOutputData = [];

/**
 * Set of selected image paths
 * @type {Set<string>}
 */
let selectedImages = new Set();

/**
 * Index of the last selected checkbox (for shift-click range selection)
 * @type {number}
 */
let lastSelectedIndex = -1;

/**
 * Array of all image file paths
 * @type {Array<string>}
 */
let allImagePaths = [];

/**
 * Displays loading skeleton in the outputs grid while fetching data
 * @description Creates skeleton loader elements to show while outputs are being fetched.
 * Sets aria-busy attribute on the grid for screen reader announcements.
 * @returns {void}
 */
function showLoadingSkeleton() {
  const grid = document.getElementById('outputs-grid');
  if (!grid) return;
  
  grid.setAttribute('aria-busy', 'true');
  grid.innerHTML = '';
  
  // Create 6 skeleton items
  for (let i = 0; i < 6; i++) {
    const skeletonItem = document.createElement('div');
    skeletonItem.className = 'skeleton-item skeleton-shimmer';
    skeletonItem.innerHTML = `
      <div class="skeleton-image skeleton-shimmer"></div>
      <div class="skeleton-text skeleton-shimmer"></div>
      <div class="skeleton-text skeleton-shimmer"></div>
    `;
    grid.appendChild(skeletonItem);
  }
}

/**
 * Loads outputs from the server and populates the grid
 * @description Fetches output files from `/api/outputs` endpoint and displays them in the outputs grid.
 * Resets selection state and applies default sorting (newest first).
 * @returns {Promise<void>}
 */
export async function loadOutputs() {
  const grid = document.getElementById('outputs-grid');
  showLoadingSkeleton();

  try {
    const response = await fetch('/api/outputs');
    const outputs = await response.json();

    grid.innerHTML = '';
    selectedImages.clear();
    lastSelectedIndex = -1;
    allImagePaths = [];
    grid.setAttribute('aria-busy', 'false');

    if (outputs.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🎨</div>
          <div class="empty-state-title">No Outputs Yet</div>
          <div class="empty-state-description">Generated images and audio will appear here. Start by creating your first generation in the Generate tab.</div>
        </div>
      `;
      updateBatchButton();
      return;
    }

    // Flatten and store output data for sorting
    currentOutputData = [];
    outputs.forEach(output => {
      output.files.forEach(file => {
        currentOutputData.push({
          ...file,
          dirName: output.name
        });
      });
    });

    // Apply default sorting (newest first)
    sortOutputs();
    grid.setAttribute('aria-busy', 'false');
  } catch (err) {
    grid.setAttribute('aria-busy', 'false');
    grid.innerHTML = `<p style="color: var(--error); font-size: 0.875rem;">Error: ${err.message}</p>`;
  }
}

/**
 * Renders the current output data to the DOM
 * @description Renders `currentOutputData` into the outputs grid. Creates output items for images,
 * audio files, and other file types. Resets selection state before rendering.
 * @returns {void}
 */
export function renderOutputs() {
  const grid = document.getElementById('outputs-grid');
  grid.innerHTML = '';
  selectedImages.clear();
  lastSelectedIndex = -1;
  allImagePaths = [];

  let imageIndex = 0;
  currentOutputData.forEach(file => {
        const item = document.createElement('div');
        item.className = 'output-item';

        const isImage = /\.(png|jpg|jpeg|webp)$/i.test(file.name);
        const isAudio = /\.(mp3|wav)$/i.test(file.name);

        if (isImage) {
          allImagePaths.push(file.path);
          const currentIndex = imageIndex++;

          item.innerHTML = `
            <div style="position: relative;">
              <input type="checkbox"
                class="image-checkbox"
                data-path="${file.path}"
                data-index="${currentIndex}"
                onchange="toggleImageSelection(event)"
                onclick="handleCheckboxClick(event)"
                style="position: absolute; top: 8px; left: 8px; width: 20px; height: 20px; cursor: pointer; z-index: 10;">
              <img src="${file.path}" alt="${file.name}">
            </div>
            <a href="${file.path}" download="${file.name}">${file.name}</a>
          `;
        } else if (isAudio) {
          item.innerHTML = `
            <audio controls src="${file.path}"></audio>
            <a href="${file.path}" download="${file.name}">${file.name}</a>
          `;
        } else {
          item.innerHTML = `<a href="${file.path}" download="${file.name}">${file.name}</a>`;
        }

        grid.appendChild(item);
  });

  updateBatchButton();
}

/**
 * Sorts the output data based on the selected sort option
 * @description Sorts `currentOutputData` by the value selected in the sort dropdown.
 * Supported options: 'name-asc', 'name-desc', 'date-newest', 'date-oldest'.
 * Re-renders outputs after sorting.
 * @returns {void}
 */
export function sortOutputs() {
  const sortBy = document.getElementById('sort-outputs')?.value || 'date-newest';

  currentOutputData.sort((a, b) => {
    switch (sortBy) {
      case 'name-asc':
        return a.name.localeCompare(b.name);
      case 'name-desc':
        return b.name.localeCompare(a.name);
      case 'date-newest':
        // Use mtime from file stats
        return (b.mtime || 0) - (a.mtime || 0);
      case 'date-oldest':
        return (a.mtime || 0) - (b.mtime || 0);
      default:
        return 0;
    }
  });

  renderOutputs();
}

/**
 * Toggles between grid and list view
 * @description Adds or removes the 'list-view' class from the outputs grid based on
 * the view toggle checkbox state.
 * @returns {void}
 */
export function toggleView() {
  const grid = document.getElementById('outputs-grid');
  const isListView = document.getElementById('view-toggle').checked;

  if (isListView) {
    grid.classList.add('list-view');
  } else {
    grid.classList.remove('list-view');
  }
}

/**
 * Handles checkbox click events with shift-click range selection
 * @description When shift-clicking, selects/deselects all checkboxes between the last
 * selected index and the current index. Updates the selection state and batch button.
 * @param {Event} event - The click event
 * @returns {void}
 */
export function handleCheckboxClick(event) {
  const checkbox = event.target;
  const currentIndex = parseInt(checkbox.dataset.index);

  if (event.shiftKey && lastSelectedIndex !== -1) {
    event.preventDefault();

    const start = Math.min(lastSelectedIndex, currentIndex);
    const end = Math.max(lastSelectedIndex, currentIndex);

    const checkboxes = document.querySelectorAll('.image-checkbox');
    const shouldCheck = checkbox.checked;

    for (let i = start; i <= end; i++) {
      const cb = checkboxes[i];
      if (cb) {
        cb.checked = shouldCheck;
        const path = cb.dataset.path;
        if (shouldCheck) {
          selectedImages.add(path);
        } else {
          selectedImages.delete(path);
        }
      }
    }

    updateBatchButton();
  }

  lastSelectedIndex = currentIndex;
}

/**
 * Toggles image selection state
 * @description Adds or removes an image path from the selectedImages set based on
 * checkbox state. Updates the batch button.
 * @param {Event} event - The change event from the checkbox
 * @returns {void}
 */
export function toggleImageSelection(event) {
  const checkbox = event.target;
  const path = checkbox.dataset.path;

  if (checkbox.checked) {
    selectedImages.add(path);
  } else {
    selectedImages.delete(path);
  }

  updateBatchButton();
}

/**
 * Updates the batch remove background button state
 * @description Enables/disables the button and updates its text to show the number
 * of selected images.
 * @returns {void}
 */
function updateBatchButton() {
  const btn = document.getElementById('remove-bg-batch-btn');
  if (!btn) return;

  if (selectedImages.size > 0) {
    btn.disabled = false;
    btn.querySelector('span').textContent = `Remove Background (${selectedImages.size})`;
  } else {
    btn.disabled = true;
    btn.querySelector('span').textContent = 'Remove Background';
  }
}

/**
 * Removes background from selected images in batch
 * @description Processes all selected images sequentially, calling the background removal
 * API for each. Shows progress updates and final status message. Refreshes outputs after completion.
 * @param {string} [threshold='10'] - Threshold value for background removal (default: '10')
 * @returns {Promise<void>}
 */
export async function removeBackgroundBatch() {
  if (selectedImages.size === 0) {
    showStatus('error', 'No images selected');
    return;
  }

  const btn = document.getElementById('remove-bg-batch-btn');
  const originalText = btn.querySelector('span').textContent;
  btn.disabled = true;

  const threshold = document.getElementById('bg-threshold').value;
  const imagePaths = Array.from(selectedImages);
  let completed = 0;
  let failed = 0;

  for (const filePath of imagePaths) {
    try {
      btn.querySelector('span').textContent = `Processing ${completed + 1}/${imagePaths.length}...`;

      const response = await fetch('/api/remove-background', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath, threshold })
      });

      const result = await response.json();

      if (response.ok) {
        completed++;
      } else {
        failed++;
        console.error(`Failed to process ${filePath}:`, result.error);
      }
    } catch (err) {
      failed++;
      console.error(`Error processing ${filePath}:`, err);
    }
  }

  btn.querySelector('span').textContent = originalText;

  if (failed === 0) {
    showStatus('success', `Successfully removed background from ${completed} image(s)`, null, { glow: true });
  } else {
    showStatus('info', `Completed: ${completed} succeeded, ${failed} failed`);
  }

  await loadOutputs();
}

