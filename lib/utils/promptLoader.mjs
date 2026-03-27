import fs from 'fs';
import { parse } from 'csv-parse/sync';

function parseCsv(raw) {
  return parse(raw, {
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    escape: '"'
  });
}

function normalizePrompt(prompt) {
  return {
    ...prompt,
    prompt_text: prompt.prompt_text || prompt.prompt || prompt.visual_prompt || '',
    prompt_id: prompt.prompt_id || prompt.id || ''
  };
}

export function loadPromptsSync(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return parsePromptsText(raw, filePath);
}

export function parsePromptsText(raw, sourceName = 'inline.csv') {
  if (sourceName.endsWith('.json')) {
    return JSON.parse(raw);
  }

  if (sourceName.endsWith('.csv') || sourceName === 'inline.csv') {
    return parseCsv(raw);
  }

  throw new Error(`Unsupported file format: ${sourceName}`);
}

export async function loadPrompts(filePath) {
  const prompts = loadPromptsSync(filePath);
  return prompts.map(normalizePrompt);
}

export async function parsePrompts(raw, sourceName = 'inline.csv') {
  const prompts = parsePromptsText(raw, sourceName);
  return prompts.map(normalizePrompt);
}
