/**
 * @fileoverview Main entry point for FireWerk UI
 * @description Orchestrates all modules and exposes functions to the global window object
 * for backward compatibility with inline event handlers in HTML.
 * @module app
 */

// Import history management functions
import { loadHistory } from './history.js';

// Import outputs display and management functions
import { loadOutputs, sortOutputs, toggleView, handleCheckboxClick, toggleImageSelection, removeBackgroundBatch } from './outputs.js';

// Import generation control functions
import { loadPromptFiles, updateFormFields, loadPromptPreview, startGeneration, stopGeneration } from './generation.js';

// Import UI utility functions
import { setVariants, setAspectRatio, setStyle, switchTab, showStatus, showEmbers, hideEmbers, initKeyboardShortcuts, toggleShortcutsPanel } from './ui-utils.js';

// Expose functions globally for inline event handlers
window.setVariants = setVariants;
window.setAspectRatio = setAspectRatio;
window.setStyle = setStyle;
window.switchTab = switchTab;
window.loadPromptPreview = loadPromptPreview;
window.updateFormFields = updateFormFields;
window.startGeneration = startGeneration;
window.stopGeneration = stopGeneration;
window.loadOutputs = loadOutputs;
window.sortOutputs = sortOutputs;
window.toggleView = toggleView;
window.removeBackgroundBatch = removeBackgroundBatch;
window.toggleImageSelection = toggleImageSelection;
window.handleCheckboxClick = handleCheckboxClick;
window.loadHistory = loadHistory;
window.loadPromptFiles = loadPromptFiles;
window.toggleShortcutsPanel = toggleShortcutsPanel;

// Initialize threshold slider
document.addEventListener('DOMContentLoaded', () => {
  const slider = document.getElementById('bg-threshold');
  const valueDisplay = document.getElementById('bg-threshold-value');

  if (slider && valueDisplay) {
    slider.addEventListener('input', (e) => {
      valueDisplay.textContent = e.target.value + '%';
    });
  }

  // Initialize keyboard shortcuts
  initKeyboardShortcuts();

  // Load history on page load
  loadHistory();

  // Listen for custom events from history module
  document.addEventListener('history:openOutputs', () => {
    switchTab('outputs');
    loadOutputs();
  });
});

// Initialize on page load
loadPromptFiles();
