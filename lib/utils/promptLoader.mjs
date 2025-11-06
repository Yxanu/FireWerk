import fs from 'fs';
import { parse } from 'csv-parse/sync';

export function loadPromptsSync(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');

  if (filePath.endsWith('.json')) {
    return JSON.parse(raw);
  }

  if (filePath.endsWith('.csv')) {
    return parse(raw, {
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      escape: '"'
    });
  }

  throw new Error(`Unsupported file format: ${filePath}`);
}

export async function loadPrompts(filePath) {
  return loadPromptsSync(filePath);
}
