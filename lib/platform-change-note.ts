const MAX_CHANGE_NOTE_LENGTH = 1000;

export function sanitizePlatformChangeNote(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, MAX_CHANGE_NOTE_LENGTH);
}
