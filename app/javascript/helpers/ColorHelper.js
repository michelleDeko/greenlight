export const CUSTOM_FORMAT_COLORS = [
  { bg: '#fff1f2', fg: '#e11d48' }, // Rose
  { bg: '#fdf4ff', fg: '#c026d3' }, // Fuchsia
  { bg: '#fefce8', fg: '#ca8a04' }, // Yellow
  { bg: '#f0fdf4', fg: '#16a34a' }, // Green
  { bg: '#f0fdfa', fg: '#0d9488' }, // Teal
  { bg: '#ecfeff', fg: '#0891b2' }, // Cyan
  { bg: '#eff6ff', fg: '#2563eb' }, // Blue
  { bg: '#f5f3ff', fg: '#7c3aed' }, // Violet
  { bg: '#faf5ff', fg: '#9333ea' }, // Purple
  { bg: '#fff7ed', fg: '#ea580c' }, // Orange
];

export const getCustomFormatColor = (formatName) => {
  let hash = 0;
  for (let i = 0; i < formatName.length; i++) {
    hash = formatName.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);
  return CUSTOM_FORMAT_COLORS[hash % CUSTOM_FORMAT_COLORS.length];
};

export const isStandardFormat = (formatName) => {
  const standardFormats = ['presentation', 'video', 'podcast', 'screenshare', 'notes', 'capture'];
  return standardFormats.includes(formatName.toLowerCase());
};
