const BADGE_COLORS = [
  '#b45309', // amber-700
  '#0f766e', // teal-700
  '#1d4ed8', // blue-700
  '#7c3aed', // violet-600
  '#be185d', // pink-700
  '#15803d', // green-700
  '#c2410c', // orange-700
  '#0369a1', // sky-700
  '#6d28d9', // purple-700
  '#047857', // emerald-700
  '#b91c1c', // red-700
  '#0e7490', // cyan-700
];

export function teamInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '??';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function teamColorFromName(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return BADGE_COLORS[hash % BADGE_COLORS.length];
}
