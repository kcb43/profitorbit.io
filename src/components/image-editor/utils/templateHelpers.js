const TEMPLATES_KEY = 'orben_editor_templates';
const MAX_TEMPLATES = 20;

// Extract only reusable, image-agnostic fields from an image state
export function extractTemplateFields(imageState) {
  if (!imageState) return {};
  return {
    finetune: imageState.finetune ? { ...imageState.finetune } : undefined,
    crop: imageState.crop
      ? { aspect: imageState.crop.aspect, aspectLabel: imageState.crop.aspectLabel }
      : undefined,
    rotation: imageState.rotation || 0,
    flipH: imageState.flipH || false,
    flipV: imageState.flipV || false,
  };
}

export function loadTemplates() {
  try {
    return JSON.parse(localStorage.getItem(TEMPLATES_KEY) || '[]');
  } catch {
    return [];
  }
}

export function persistTemplates(list) {
  localStorage.setItem(TEMPLATES_KEY, JSON.stringify(list.slice(0, MAX_TEMPLATES)));
}

export function createTemplate(name, imageState) {
  return {
    id: `tpl_${Date.now()}`,
    name: name.trim(),
    createdAt: Date.now(),
    ...extractTemplateFields(imageState),
  };
}

export { TEMPLATES_KEY, MAX_TEMPLATES };
