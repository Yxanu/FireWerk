import fs from 'fs/promises';
import path from 'path';

function sanitize(value) {
  return String(value || 'artifact').replace(/[^\w.-]+/g, '_').slice(0, 120);
}

export class RunArtifacts {
  constructor(config = {}) {
    this.outputDir = config.outputDir || './output';
    this.baseDir = config.baseDir || path.join(this.outputDir, '_runs');
    this.saveArtifacts = config.saveArtifacts || 'failures';
    this.runId = config.runId || `run-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    this.runDir = config.runDir || path.join(this.baseDir, this.runId);
    this.summary = {
      runId: this.runId,
      startedAt: new Date().toISOString(),
      saveArtifacts: this.saveArtifacts,
      prompts: [],
      selectorStrategies: [],
      fallbacks: [],
      errors: []
    };
  }

  async init(extra = {}) {
    await fs.mkdir(this.runDir, { recursive: true });
    this.summary = {
      ...this.summary,
      ...extra
    };
  }

  recordEvent(type, data = {}) {
    if (!this.summary.events) {
      this.summary.events = [];
    }

    this.summary.events.push({
      type,
      timestamp: new Date().toISOString(),
      ...data
    });
  }

  recordSelector(area, strategy, data = {}) {
    this.summary.selectorStrategies.push({
      area,
      strategy,
      timestamp: new Date().toISOString(),
      ...data
    });
  }

  recordFallback(kind, data = {}) {
    this.summary.fallbacks.push({
      kind,
      timestamp: new Date().toISOString(),
      ...data
    });
  }

  recordError(error, data = {}) {
    this.summary.errors.push({
      message: error?.message || String(error),
      stack: error?.stack || null,
      timestamp: new Date().toISOString(),
      ...data
    });
  }

  upsertPromptEntry(promptId, updater) {
    const key = sanitize(promptId);
    let entry = this.summary.prompts.find((item) => item.promptId === key);
    if (!entry) {
      entry = {
        promptId: key,
        phases: [],
        variants: []
      };
      this.summary.prompts.push(entry);
    }

    updater(entry);
    return entry;
  }

  recordPromptPhase(promptId, phase, data = {}) {
    this.upsertPromptEntry(promptId, (entry) => {
      entry.phases.push({
        phase,
        timestamp: new Date().toISOString(),
        ...data
      });
    });
  }

  recordVariantResult(promptId, variant, data = {}) {
    this.upsertPromptEntry(promptId, (entry) => {
      const existing = entry.variants.find((item) => item.variant === variant);
      const payload = {
        variant,
        timestamp: new Date().toISOString(),
        ...data
      };

      if (existing) {
        Object.assign(existing, payload);
      } else {
        entry.variants.push(payload);
      }
    });
  }

  async maybeSaveScreenshot(page, name, options = {}) {
    const mode = options.mode || 'all';
    const shouldSave =
      this.saveArtifacts === 'all' ||
      options.force === true ||
      (this.saveArtifacts === 'failures' && mode === 'failure');

    if (!shouldSave) {
      return null;
    }

    const fileName = `${sanitize(name)}.png`;
    const filePath = path.join(this.runDir, fileName);
    await page.screenshot({ path: filePath, fullPage: options.fullPage ?? true });
    return filePath;
  }

  async maybeSaveJson(name, data, options = {}) {
    const mode = options.mode || 'all';
    const shouldSave =
      this.saveArtifacts === 'all' ||
      options.force === true ||
      (this.saveArtifacts === 'failures' && mode === 'failure');

    if (!shouldSave) {
      return null;
    }

    const fileName = `${sanitize(name)}.json`;
    const filePath = path.join(this.runDir, fileName);
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
    return filePath;
  }

  async writeSummary(extra = {}) {
    this.summary.finishedAt = new Date().toISOString();
    Object.assign(this.summary, extra);
    const filePath = path.join(this.runDir, 'run-summary.json');
    await fs.writeFile(filePath, JSON.stringify(this.summary, null, 2));
    return filePath;
  }
}
