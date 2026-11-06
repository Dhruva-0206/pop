// Prints WCAG contrast ratios for the design tokens (docs/design-tokens.md). Usage: node scripts/contrast.js
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return ((x + 0.05) / (y + 0.05)).toFixed(2);
};
const T = {
  bg: "#FFFFFF", surface: "#F6F7F9", line: "#DADCE3", lineStrong: "#7A7F8E", ink: "#0B1020", ink2: "#3D4354", muted: "#596072",
  accent: "#0A6B45", accentStrong: "#07553A", accentSoft: "#E6F4EC", warn: "#7A4B00", warnSoft: "#FFF4D6", danger: "#A31515", dangerSoft: "#FDECEC", focus: "#1D4ED8",
};
const pairs = [
  ["ink on bg", T.ink, T.bg], ["ink2 on bg", T.ink2, T.bg], ["muted on bg", T.muted, T.bg], ["muted on surface", T.muted, T.surface],
  ["white on accent", "#FFFFFF", T.accent], ["white on accentStrong", "#FFFFFF", T.accentStrong], ["accent on bg", T.accent, T.bg],
  ["accentStrong on bg", T.accentStrong, T.bg], ["accentStrong on accentSoft", T.accentStrong, T.accentSoft], ["ink on accentSoft", T.ink, T.accentSoft],
  ["warn on warnSoft", T.warn, T.warnSoft], ["warn on bg", T.warn, T.bg], ["danger on bg", T.danger, T.bg], ["danger on dangerSoft", T.danger, T.dangerSoft],
  ["white on danger", "#FFFFFF", T.danger], ["focus on bg", T.focus, T.bg], ["lineStrong on bg", T.lineStrong, T.bg], ["line on bg", T.line, T.bg],
  ["ink on surface", T.ink, T.surface],
];
for (const [n, a, b] of pairs) console.log(`${n.padEnd(30)} ${ratio(a, b)}`);
