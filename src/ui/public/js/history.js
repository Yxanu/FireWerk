
/**
 * @fileoverview History management module for FireWerk UI
 * @module history
 */

/**
 * LocalStorage key for storing generation history
 * @constant {string}
 */
const HISTORY_KEY = 'firewerk_history';

/**
 * Saves a generation entry to history
 * @description Adds a new generation entry to the history array in localStorage.
 * Keeps only the last 50 entries. Automatically refreshes the history display.
 * @param {Object} data - Generation data to save
 * @param {string} data.generationId - Unique identifier for the generation
 * @param {string} data.promptFile - Name of the prompt file used
 * @param {string} data.type - Type of generation ('images' or 'speech')
 * @param {number} [data.imageCount=0] - Number of images generated
 * @param {string} data.outputDir - Output directory path
 * @param {Object} [data] - Additional data to include in the entry
 * @returns {void}
 */
export function saveToHistory(data) {
  const history = getHistory();
  const entry = {
    id: data.generationId,
    timestamp: new Date().toISOString(),
    promptFile: data.promptFile,
    type: data.type,
    imageCount: data.imageCount || 0,
    status: 'running',
    outputDir: data.outputDir,
    ...data
  };
  history.unshift(entry);
  // Keep only last 50 entries
  if (history.length > 50) {
    history.pop();
  }
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  loadHistory();
}

/**
 * Retrieves the generation history from localStorage
 * @description Returns an array of history entries. Returns empty array if no history exists or on error.
 * @returns {Array<Object>} Array of history entries
 */
export function getHistory() {
  try {
    const data = localStorage.getItem(HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch (err) {
    console.error('Failed to load history:', err);
    return [];
  }
}

/**
 * Updates the status of a history entry
 * @description Finds a history entry by ID and updates its status and additional data.
 * Automatically refreshes the history display.
 * @param {string} id - The generation ID to update
 * @param {string} status - New status ('running', 'completed', 'failed', 'stopped')
 * @param {Object} [additionalData={}] - Additional data to merge into the entry
 * @returns {void}
 */
export function updateHistoryStatus(id, status, additionalData = {}) {
  const history = getHistory();
  const entry = history.find(h => h.id === id);
  if (entry) {
    entry.status = status;
    Object.assign(entry, additionalData);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    loadHistory();
  }
}

/**
 * Loads and renders the generation history
 * @description Fetches history from localStorage and renders it to the DOM element with id 'history-grid'.
 * Displays an empty state if no history exists. Adds click handlers to completed entries to view outputs.
 * @returns {void}
 */
export function loadHistory() {
  const container = document.getElementById('history-grid');
  if (!container) return;

  const history = getHistory();

  if (history.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📜</div>
        <div class="empty-state-title">No History Yet</div>
        <div class="empty-state-description">Your generation history will appear here. Each generation is automatically saved and tracked.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = '';
  history.forEach(entry => {
    const item = document.createElement('div');
    item.className = 'history-item';

    const timestamp = new Date(entry.timestamp).toLocaleString();
    const statusClass = entry.status === 'completed' ? 'completed' :
                        entry.status === 'failed' ? 'failed' : 'running';
    const statusText = entry.status.charAt(0).toUpperCase() + entry.status.slice(1);

    item.innerHTML = `
      <div class="history-header">
        <div class="history-prompt">${entry.promptFile || 'Unknown'}</div>
        <div class="history-badge ${statusClass}">${statusText}</div>
      </div>
      <div class="history-meta">
        <span>🕒 ${timestamp}</span>
        <span>📊 ${entry.imageCount || 0} images</span>
        ${entry.type ? `<span>🎨 ${entry.type}</span>` : ''}
      </div>
    `;

    // Add click handler to view outputs
    if (entry.status === 'completed' && entry.outputDir) {
      item.setAttribute('role', 'button');
      item.setAttribute('tabindex', '0');
      item.setAttribute('aria-label', `View outputs for ${entry.promptFile || 'Unknown'}`);
      
      const handleClick = () => {
        document.dispatchEvent(new CustomEvent('history:openOutputs'));
      };
      
      item.onclick = handleClick;
      
      // Add keyboard support
      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      });
    } else {
      // For non-clickable items, use article role
      item.setAttribute('role', 'article');
      const ariaLabel = `Generation: ${entry.promptFile || 'Unknown'}, Status: ${statusText}, ${timestamp}`;
      item.setAttribute('aria-label', ariaLabel);
    }

    container.appendChild(item);
  });
}

