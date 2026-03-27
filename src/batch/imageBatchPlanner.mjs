import { loadPrompts, parsePrompts } from '../../lib/utils/promptLoader.mjs';
import {
  normalizeAspectRatio,
  normalizeStyle,
  resolveImageModel,
  validateImageRequest
} from '../models/imageModelCatalog.mjs';

function csvEscape(value) {
  const stringValue = String(value ?? '');
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function promptsToCsv(prompts) {
  const headers = ['prompt_id', 'prompt_text', 'aspect_ratio', 'style', 'modelId'];
  const lines = [headers.join(',')];

  for (const prompt of prompts) {
    lines.push(headers.map((header) => csvEscape(prompt[header] || '')).join(','));
  }

  return lines.join('\n');
}

function toJobId(modelId, aspectRatio, index) {
  return `${modelId || 'unknown'}__${aspectRatio || 'default'}__${index + 1}`;
}

function normalizePromptForPlanning(prompt, defaults = {}) {
  const requestedModel = prompt.modelId || prompt.model || defaults.modelId || defaults.model || '';
  const model = resolveImageModel(requestedModel);

  if (!model) {
    return {
      ok: false,
      reason: `Unknown image model: ${requestedModel || 'missing model'}`,
      sourcePromptId: prompt.prompt_id || prompt.id || ''
    };
  }

  const normalizedAspectRatio = normalizeAspectRatio(prompt.aspect_ratio || prompt.aspectRatio || defaults.aspectRatio || '');
  const normalizedStyle = normalizeStyle(prompt.style || defaults.style || '');
  const warnings = [];
  const droppedFields = [];

  if (normalizedAspectRatio && Array.isArray(model.supportedAspectRatios) && !model.supportedAspectRatios.includes(normalizedAspectRatio)) {
    return {
      ok: false,
      reason: `Model "${model.label}" does not support aspect ratio "${normalizedAspectRatio}"`,
      sourcePromptId: prompt.prompt_id || prompt.id || ''
    };
  }

  let finalStyle = normalizedStyle;
  if (finalStyle && !model.supportsStyleControl) {
    warnings.push(`Dropped style for ${model.label}`);
    droppedFields.push('style');
    finalStyle = '';
  }

  const normalizedPrompt = {
    ...prompt,
    prompt_id: prompt.prompt_id || prompt.id || '',
    prompt_text: prompt.prompt_text || prompt.prompt || prompt.visual_prompt || '',
    modelId: model.id,
    model: model.label,
    aspect_ratio: normalizedAspectRatio,
    style: finalStyle
  };

  const validation = validateImageRequest({
    modelId: normalizedPrompt.modelId,
    aspectRatio: normalizedPrompt.aspect_ratio,
    style: normalizedPrompt.style
  });

  if (!validation.ok) {
    return {
      ok: false,
      reason: validation.errors.join('; '),
      sourcePromptId: normalizedPrompt.prompt_id
    };
  }

  return {
    ok: true,
    prompt: normalizedPrompt,
    warnings,
    droppedFields,
    sourcePromptId: normalizedPrompt.prompt_id
  };
}

export function planImageBatches(prompts, options = {}) {
  const defaults = {
    modelId: options.modelId || '',
    model: options.model || '',
    aspectRatio: options.aspectRatio || '',
    style: options.style || ''
  };

  const grouped = new Map();
  const rejectedPrompts = [];

  for (const prompt of prompts) {
    const normalized = normalizePromptForPlanning(prompt, defaults);
    if (!normalized.ok) {
      rejectedPrompts.push({
        sourcePromptId: normalized.sourcePromptId,
        reason: normalized.reason
      });
      continue;
    }

    const key = `${normalized.prompt.modelId}::${normalized.prompt.aspect_ratio || 'default'}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        modelId: normalized.prompt.modelId,
        modelLabel: normalized.prompt.model,
        appliedAspectRatio: normalized.prompt.aspect_ratio || '',
        prompts: [],
        warnings: [],
        droppedFields: []
      });
    }

    const group = grouped.get(key);
    group.prompts.push(normalized.prompt);
    group.warnings.push(...normalized.warnings);
    group.droppedFields.push(...normalized.droppedFields);
  }

  const jobs = Array.from(grouped.values()).map((group, index) => ({
    jobId: toJobId(group.modelId, group.appliedAspectRatio, index),
    modelId: group.modelId,
    modelLabel: group.modelLabel,
    promptCount: group.prompts.length,
    appliedAspectRatio: group.appliedAspectRatio || 'default',
    droppedFields: [...new Set(group.droppedFields)],
    warnings: [...new Set(group.warnings)],
    sourcePromptIds: group.prompts.map((prompt) => prompt.prompt_id),
    prompts: group.prompts,
    customPromptCsv: promptsToCsv(group.prompts)
  }));

  return {
    summary: {
      totalPrompts: prompts.length,
      plannedJobs: jobs.length,
      acceptedPrompts: jobs.reduce((sum, job) => sum + job.promptCount, 0),
      rejectedPrompts: rejectedPrompts.length
    },
    jobs,
    rejectedPrompts
  };
}

export async function loadPromptsForBatchPlanning(input, options = {}) {
  if (options.inlineCsv) {
    return parsePrompts(options.inlineCsv, 'inline.csv');
  }

  return loadPrompts(input);
}
