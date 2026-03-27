const IMAGE_MODEL_DEFINITIONS = [
  {
    id: 'firefly-image-5-preview',
    label: 'Firefly Image 5 (Preview)',
    aliases: ['Firefly Image 5', 'Firefly 5', 'Firefly Image 5 (Vorschau)', 'firefly image 5 (preview)'],
    family: 'adobe',
    tier: 'core',
    activationStrategy: 'native',
    supportedAspectRatios: ['1:1', '4:5', '16:9'],
    supportsStyleControl: true,
    notes: ['Preview model']
  },
  {
    id: 'firefly-image-4-ultra',
    label: 'Firefly Image 4 Ultra',
    aliases: ['firefly image 4 ultra'],
    family: 'adobe',
    tier: 'core',
    activationStrategy: 'native',
    supportedAspectRatios: ['1:1', '4:5', '16:9'],
    supportsStyleControl: true,
    notes: []
  },
  {
    id: 'firefly-image-4',
    label: 'Firefly Image 4',
    aliases: ['firefly image 4'],
    family: 'adobe',
    tier: 'core',
    activationStrategy: 'native',
    supportedAspectRatios: ['1:1', '4:5', '16:9'],
    supportsStyleControl: true,
    notes: []
  },
  {
    id: 'firefly-image-3',
    label: 'Firefly Image 3',
    aliases: ['firefly image 3'],
    family: 'adobe',
    tier: 'secondary',
    activationStrategy: 'native',
    supportedAspectRatios: ['1:1', '4:5', '16:9'],
    supportsStyleControl: true,
    notes: []
  },
  {
    id: 'flux-kontext-max',
    label: 'Flux Kontext Max',
    aliases: ['FLUX Kontext Max', 'flux kontext max'],
    family: 'partner',
    tier: 'core',
    activationStrategy: 'partner-consent',
    supportedAspectRatios: ['1:1', '4:5', '16:9'],
    supportsStyleControl: false,
    notes: ['Partner model']
  },
  {
    id: 'flux-kontext-pro',
    label: 'Flux Kontext Pro',
    aliases: ['FLUX Kontext Pro', 'flux kontext pro'],
    family: 'partner',
    tier: 'secondary',
    activationStrategy: 'partner-consent',
    supportedAspectRatios: ['1:1', '4:5', '16:9'],
    supportsStyleControl: false,
    notes: ['Partner model']
  },
  {
    id: 'flux-1-1-pro',
    label: 'Flux 1.1 Pro',
    aliases: ['FLUX1.1 [pro]', 'flux 1.1 pro'],
    family: 'partner',
    tier: 'secondary',
    activationStrategy: 'partner-consent',
    supportedAspectRatios: null,
    supportsStyleControl: false,
    notes: ['Partner model']
  },
  {
    id: 'flux-1-1-ultra',
    label: 'Flux 1.1 Ultra',
    aliases: ['FLUX1.1 [pro] Ultra', 'flux 1.1 ultra'],
    family: 'partner',
    tier: 'secondary',
    activationStrategy: 'partner-consent',
    supportedAspectRatios: null,
    supportsStyleControl: false,
    notes: ['Partner model']
  },
  {
    id: 'flux-1-1-ultra-raw',
    label: 'Flux 1.1 Ultra (Raw)',
    aliases: ['FLUX1.1 [pro] Ultra (Raw)', 'flux 1.1 ultra raw', 'flux 1.1 ultra (raw)'],
    family: 'partner',
    tier: 'secondary',
    activationStrategy: 'partner-consent',
    supportedAspectRatios: null,
    supportsStyleControl: false,
    notes: ['Partner model']
  },
  {
    id: 'gemini-2-5-nano-banana',
    label: 'Gemini 2.5 (Nano Banana)',
    aliases: ['Nano Banana', 'Gemini 2.5 Flash Image', 'gemini 2.5 (nano banana)'],
    family: 'partner',
    tier: 'secondary',
    activationStrategy: 'partner-consent',
    supportedAspectRatios: null,
    supportsStyleControl: false,
    notes: ['Partner model']
  },
  {
    id: 'imagen-4',
    label: 'Imagen 4',
    aliases: ['Imagen 4 (Preview)', 'imagen 4'],
    family: 'partner',
    tier: 'core',
    activationStrategy: 'partner-consent',
    supportedAspectRatios: ['1:1', '4:5', '16:9'],
    supportsStyleControl: false,
    notes: ['Partner model']
  },
  {
    id: 'imagen-3',
    label: 'Imagen 3',
    aliases: ['imagen 3'],
    family: 'partner',
    tier: 'secondary',
    activationStrategy: 'partner-consent',
    supportedAspectRatios: ['1:1', '4:5', '16:9'],
    supportsStyleControl: false,
    notes: ['Partner model']
  },
  {
    id: 'gpt-image',
    label: 'GPT Image',
    aliases: ['gpt image', 'GPT Image 1.5'],
    family: 'partner',
    tier: 'core',
    activationStrategy: 'partner-consent',
    supportedAspectRatios: ['1:1', '4:5'],
    supportsStyleControl: false,
    notes: ['Partner model']
  },
  {
    id: 'ideogram-3-0',
    label: 'Ideogram 3.0',
    aliases: ['ideogram 3.0'],
    family: 'partner',
    tier: 'secondary',
    activationStrategy: 'partner-consent',
    supportedAspectRatios: ['1:1', '4:5', '16:9'],
    supportsStyleControl: false,
    notes: ['Partner model']
  },
  {
    id: 'runway-gen-4-image',
    label: 'Runway Gen-4 Image',
    aliases: ['runway gen-4 image', 'Runway Gen 4 Image'],
    family: 'partner',
    tier: 'secondary',
    activationStrategy: 'partner-consent',
    supportedAspectRatios: null,
    supportsStyleControl: false,
    notes: ['Partner model']
  }
];

export const IMAGE_STYLE_OPTIONS = [
  { value: '', label: 'Default' },
  { value: 'photographic', label: 'Photographic' },
  { value: 'art', label: 'Art' },
  { value: 'graphic', label: 'Graphic' }
];

export const IMAGE_ASPECT_RATIO_OPTIONS = [
  { value: '', label: 'Default' },
  { value: '1:1', label: '1:1' },
  { value: '4:5', label: '4:5' },
  { value: '16:9', label: '16:9' }
];

export function getImageModelCatalog() {
  return IMAGE_MODEL_DEFINITIONS.map((model) => ({
    ...model,
    aliases: [...model.aliases],
    supportedAspectRatios: model.supportedAspectRatios ? [...model.supportedAspectRatios] : null,
    supportsAspectRatioControl: Array.isArray(model.supportedAspectRatios) && model.supportedAspectRatios.length > 0
  }));
}

function normalizeLookupValue(value) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

export function resolveImageModel(value) {
  const normalized = normalizeLookupValue(value);
  if (!normalized) return null;

  return getImageModelCatalog().find((model) => {
    const names = [model.id, model.label, ...model.aliases];
    return names.some((name) => normalizeLookupValue(name) === normalized);
  }) || null;
}

export function normalizeAspectRatio(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';

  const aliasMap = new Map([
    ['1:1', '1:1'],
    ['square', '1:1'],
    ['4:5', '4:5'],
    ['portrait', '4:5'],
    ['16:9', '16:9'],
    ['widescreen', '16:9'],
    ['landscape', '16:9']
  ]);

  return aliasMap.get(normalized) || String(value).trim();
}

export function normalizeStyle(value) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';

  const aliasMap = new Map([
    ['photographic', 'photographic'],
    ['photo', 'photographic'],
    ['art', 'art'],
    ['graphic', 'graphic'],
    ['editorial', 'graphic']
  ]);

  return aliasMap.get(normalized) || String(value).trim().toLowerCase();
}

export function normalizeImageRequest(request = {}) {
  const model = resolveImageModel(request.modelId || request.model);
  const aspectRatio = normalizeAspectRatio(request.aspectRatio ?? request.aspect_ratio);
  const style = normalizeStyle(request.style);

  return {
    ...request,
    modelId: model?.id || '',
    modelLabel: model?.label || '',
    model,
    aspectRatio,
    style
  };
}

export function validateImageRequest(request = {}) {
  const normalized = normalizeImageRequest(request);
  const errors = [];

  if ((request.modelId || request.model) && !normalized.model) {
    errors.push(`Unknown image model: ${request.modelId || request.model}`);
  }

  if (normalized.model && normalized.aspectRatio) {
    const supportedAspectRatios = normalized.model.supportedAspectRatios;
    if (Array.isArray(supportedAspectRatios) && !supportedAspectRatios.includes(normalized.aspectRatio)) {
      errors.push(`Model "${normalized.model.label}" does not support aspect ratio "${normalized.aspectRatio}"`);
    }
  }

  if (normalized.model && normalized.style && !normalized.model.supportsStyleControl) {
    errors.push(`Model "${normalized.model.label}" does not support style/content type control`);
  }

  return {
    ok: errors.length === 0,
    errors,
    normalized
  };
}

export function getImageModelUiPayload() {
  const catalog = getImageModelCatalog();
  return {
    models: catalog.map((model) => ({
      id: model.id,
      label: model.label,
      family: model.family,
      tier: model.tier,
      activationStrategy: model.activationStrategy,
      supportedAspectRatios: model.supportedAspectRatios,
      supportsStyleControl: model.supportsStyleControl,
      notes: model.notes
    })),
    aspectRatios: IMAGE_ASPECT_RATIO_OPTIONS,
    styles: IMAGE_STYLE_OPTIONS
  };
}
