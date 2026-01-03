// Helpers for hiding Base44 import tags from UI while preserving them in the DB.

const TAG_LINE_RE = /^\s*Base44\s+.*$/i;
const LINKED_INV_RE = /^\s*Base44\s+linked\s+inventory\s+ID:\s*.*$/i;

export function splitBase44Tags(notes) {
  const raw = String(notes || '');
  if (!raw.trim()) return { clean: '', tags: '' };

  const lines = raw.split(/\r?\n/);
  const cleanLines = [];
  const tagLines = [];

  for (const line of lines) {
    if (TAG_LINE_RE.test(line) || LINKED_INV_RE.test(line)) {
      tagLines.push(line.trim());
    } else {
      cleanLines.push(line);
    }
  }

  return {
    clean: cleanLines.join('\n').trim(),
    tags: tagLines.join('\n').trim(),
  };
}

export function mergeBase44Tags(cleanNotes, tags) {
  const clean = String(cleanNotes || '').trim();
  const t = String(tags || '').trim();
  if (!t) return clean;
  if (!clean) return t;
  // Ensure tags are appended at bottom for compatibility with existing dedupe regexes.
  return `${clean}\n${t}`.trim();
}


