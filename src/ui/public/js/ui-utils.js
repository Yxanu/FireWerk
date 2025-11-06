import { loadOutputs } from './outputs.js';
import { loadHistory } from './history.js';
import { startGeneration } from './generation.js';

/**
 * @fileoverview UI utilities and helper functions module for FireWerk UI
 * @module ui-utils
 */

/**
 * Updates a segmented button group
 * @description Helper function that removes active class from all buttons in the segmented group,
 * adds active class to the clicked button, and updates the hidden input value with the button's data-value attribute.
 * @param {HTMLElement} button - The button element that was clicked
 * @param {string} inputId - The ID of the hidden input to update
 * @returns {void}
 */
function updateSegmentedGroup(button, inputId) {
  // Remove active class from all buttons in the segmented group
  const group = button.closest('.segmented-group');
  if (group) {
    group.querySelectorAll('.segmented-button').forEach(btn => {
      btn.classList.remove('active');
    });
  }
  
  // Add active class to clicked button
  button.classList.add('active');
  
  // Update hidden input value
  const hiddenInput = document.getElementById(inputId);
  if (hiddenInput) {
    hiddenInput.value = button.getAttribute('data-value');
  }
}

/**
 * Updates the variants segmented button group
 * @description Removes active class from all buttons in the segmented group, adds active class
 * to the clicked button, and updates the hidden input value with the button's data-value attribute.
 * @param {HTMLElement} button - The button element that was clicked
 * @returns {void}
 */
export function setVariants(button) {
  updateSegmentedGroup(button, 'variants');
}

/**
 * Updates the aspect ratio segmented button group
 * @description Removes active class from all buttons in the segmented group, adds active class
 * to the clicked button, and updates the hidden input value with the button's data-value attribute.
 * @param {HTMLElement} button - The button element that was clicked
 * @returns {void}
 */
export function setAspectRatio(button) {
  updateSegmentedGroup(button, 'aspect-ratio');
}

/**
 * Updates the style segmented button group
 * @description Removes active class from all buttons in the segmented group, adds active class
 * to the clicked button, and updates the hidden input value with the button's data-value attribute.
 * @param {HTMLElement} button - The button element that was clicked
 * @returns {void}
 */
export function setStyle(button) {
  updateSegmentedGroup(button, 'style');
}

/**
 * Switches between tabs with fade transition
 * @description Removes active class from all tabs and content, then adds active class to the
 * specified tab and its content with a fade transition. Automatically loads outputs or history
 * when switching to those tabs.
 * @param {string} tab - The tab to switch to ('generate', 'outputs', or 'history')
 * @returns {void}
 */
export function switchTab(tab) {
  // Remove active class from all tabs and content
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  
  // Fade out current active content
  const currentActiveContent = document.querySelector('.tab-content.active');
  if (currentActiveContent) {
    currentActiveContent.classList.remove('active');
  }

  // Find the tab button using data-tab attribute
  const tabButton = document.querySelector(`[data-tab="${tab}"]`);
  if (tabButton) {
    tabButton.classList.add('active');
  }

  // Add active class to new content with a slight delay for smooth transition
  setTimeout(() => {
    const tabContent = document.getElementById(`${tab}-tab`);
    if (tabContent) {
      tabContent.classList.add('active');
    }
  }, 50);

  if (tab === 'outputs') {
    loadOutputs();
  } else if (tab === 'history') {
    loadHistory();
  }
}

/**
 * Shows a status message to the user
 * @description Displays a status message in the status element with appropriate styling
 * based on the type. Supports progress bar display for generation progress and glow effects.
 * @param {string} type - Status type ('success', 'error', or 'info')
 * @param {string} message - The message text to display
 * @param {Object} [progress] - Optional progress data with completed and total
 * @param {number} [progress.completed] - Number of completed items
 * @param {number} [progress.total] - Total number of items
 * @param {Object} [options] - Optional configuration object
 * @param {boolean} [options.glow] - Whether to apply glow effect (default: false)
 * @returns {void}
 */
export function showStatus(type, message, progress = null, options = {}) {
  const status = document.getElementById('status');
  const isProgress = type === 'info' && progress !== null;
  const { glow = false } = options;
  
  if (isProgress) {
    const percentage = progress.total > 0 ? (progress.completed / progress.total) * 100 : 0;
    status.className = `status show ${type} progress`;
    status.innerHTML = `
      <div class="status-content">
        <div class="status-message">
          <span class="working-indicator"></span>
          <span>${message}</span>
        </div>
        <div class="progress-bar-container">
          <div class="progress-bar" style="width: ${percentage}%"></div>
        </div>
        <div class="progress-text">${progress.completed} / ${progress.total}</div>
      </div>
    `;
  } else {
    let className = `status show ${type}`;
    if (glow && (type === 'success' || type === 'error')) {
      className += ` ${type}-glow`;
    }
    status.className = className;
    status.textContent = message;
  }
}

/**
 * Shows the embers animation at the bottom of the viewport
 * @description Creates and displays embers flowing up animation when generation is active
 * @returns {void}
 */
export function showEmbers() {
  let embersContainer = document.getElementById('embers-container');
  if (!embersContainer) {
    embersContainer = document.createElement('div');
    embersContainer.id = 'embers-container';
    document.body.appendChild(embersContainer);
  }
  embersContainer.classList.add('active');
  
  // Create ember particles
  let emberInterval = setInterval(() => {
    if (!embersContainer.classList.contains('active')) {
      clearInterval(emberInterval);
      return;
    }
    
    createEmber(embersContainer);
  }, 200);
  
  // Store interval ID for cleanup
  embersContainer._emberInterval = emberInterval;
}

/**
 * Creates a single ember particle
 * @description Creates an ember element with random position and animation
 * @param {HTMLElement} container - The container element to add the ember to
 * @returns {void}
 */
function createEmber(container) {
  const ember = document.createElement('div');
  ember.className = 'ember';
  
  // Random starting position along the bottom
  const startX = Math.random() * 100;
  ember.style.left = `${startX}%`;
  ember.style.bottom = '0';
  
  // Random drift (horizontal movement) - will be applied via transform
  const driftX = (Math.random() - 0.5) * 100;
  
  // Random animation duration (3-6 seconds)
  const duration = 3 + Math.random() * 3;
  ember.style.animationDuration = `${duration}s`;
  
  // Random delay for staggered effect
  ember.style.animationDelay = `${Math.random() * 0.5}s`;
  
  // Apply drift via transform
  ember.style.setProperty('--drift-x', `${driftX}px`);
  
  container.appendChild(ember);
  
  // Remove ember after animation completes
  setTimeout(() => {
    if (ember.parentNode) {
      ember.remove();
    }
  }, (duration + 0.5) * 1000);
}

/**
 * Hides the embers animation
 * @description Removes the embers animation from view and cleans up intervals
 * @returns {void}
 */
export function hideEmbers() {
  const embersContainer = document.getElementById('embers-container');
  if (embersContainer) {
    embersContainer.classList.remove('active');
    
    // Clear ember creation interval
    if (embersContainer._emberInterval) {
      clearInterval(embersContainer._emberInterval);
      embersContainer._emberInterval = null;
    }
    
    // Remove all embers after a short delay
    setTimeout(() => {
      if (embersContainer && !embersContainer.classList.contains('active')) {
        embersContainer.innerHTML = '';
      }
    }, 500);
  }
}

/**
 * Initializes global keyboard shortcuts for the application
 * @description Sets up keyboard event listeners for common shortcuts like Cmd+Enter to generate,
 * Cmd+K to focus prompt selector, Cmd+/ to show shortcuts panel, and Esc to close panels.
 * @returns {void}
 */
export function initKeyboardShortcuts() {
  document.addEventListener('keydown', (event) => {
    // Don't trigger shortcuts when typing in inputs/textarea
    const tagName = event.target.tagName;
    if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT') {
      return;
    }

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;

    // Cmd/Ctrl + Enter: Start generation
    if (cmdOrCtrl && event.key === 'Enter') {
      event.preventDefault();
      startGeneration();
      return;
    }

    // Cmd/Ctrl + K: Focus prompt selector
    if (cmdOrCtrl && event.key === 'k') {
      event.preventDefault();
      const promptFile = document.getElementById('prompt-file');
      if (promptFile) {
        promptFile.focus();
      }
      return;
    }

    // Cmd/Ctrl + /: Toggle shortcuts panel
    if (cmdOrCtrl && event.key === '/') {
      event.preventDefault();
      toggleShortcutsPanel();
      return;
    }

    // Esc: Close shortcuts panel
    if (event.key === 'Escape') {
      const panel = document.getElementById('shortcuts-panel');
      if (panel && panel.classList.contains('show')) {
        event.preventDefault();
        toggleShortcutsPanel();
      }
    }
  });
}

/**
 * Toggles the visibility of the keyboard shortcuts panel
 * @description Shows or hides the keyboard shortcuts panel with proper focus management
 * for accessibility. When opening, focuses the close button. When closing, returns focus
 * to the previously focused element.
 * @returns {void}
 */
export function toggleShortcutsPanel() {
  const panel = document.getElementById('shortcuts-panel');
  const overlay = document.getElementById('shortcuts-overlay');
  
  if (!panel || !overlay) return;

  const isOpen = panel.classList.contains('show');
  let previousFocus = null;

  if (isOpen) {
    // Closing: store current focus if it's within the panel
    if (panel.contains(document.activeElement)) {
      previousFocus = document.activeElement;
    }
    panel.classList.remove('show');
    overlay.classList.remove('show');
    panel.style.display = 'none';
    overlay.style.display = 'none';
    
    // Return focus to trigger button or previous element
    const triggerButton = document.querySelector('[onclick="toggleShortcutsPanel()"]');
    if (triggerButton && previousFocus === null) {
      triggerButton.focus();
    } else if (previousFocus) {
      previousFocus.focus();
    }
  } else {
    // Opening: store current focus
    previousFocus = document.activeElement;
    panel.style.display = 'block';
    overlay.style.display = 'block';
    
    // Use setTimeout to ensure display change is applied before animation
    setTimeout(() => {
      panel.classList.add('show');
      overlay.classList.add('show');
      
      // Focus the close button for accessibility
      const closeButton = panel.querySelector('button[aria-label="Close shortcuts panel"]');
      if (closeButton) {
        closeButton.focus();
      }
    }, 10);
  }
}

