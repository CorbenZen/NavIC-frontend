/* Read actual shell/auth CSS tokens, composite their glass over sampled
 * backgrounds, then check text and icon contrast against those surfaces. */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const css = await readFile(fileURLToPath(new URL('../css-styles/global/styles.css', import.meta.url)), 'utf8');
const ambientSamples = {
  light: ['#f8fafc', '#e0f2fe', '#ccfbf1', '#e0e7ff'],
  dark: ['#101419', '#143145', '#17332f', '#20243d'],
};

function themeTokens(theme) {
  const tokens = {};
  const blocks = css.matchAll(/(:root(?:\[data-theme=['"]dark['"]\])?)\s*\{([^}]*)\}/g);
  for (const [, selector, body] of blocks) {
    const isDark = selector.includes("data-theme='dark'") || selector.includes('data-theme="dark"');
    if ((theme === 'dark') !== isDark) continue;
    for (const [, name, value] of body.matchAll(/(--(?:glass-bg|glass-bg-strong|glass-hover|glass-border|sidebar-text|sidebar-muted|sidebar-icon|sidebar-accent|sidebar-rail-surface|sidebar-count-bg|sidebar-status-(?:online|pending|offline)|ink|brand|danger|menu-danger|topbar-foreground|topbar-icon|topbar-pill-bg|topbar-pill-text|topbar-pill-border|avatar-fill|avatar-ink|success-ink|success-soft|info-ink|info-soft|danger-ink|danger-soft|warning-ink|warning-soft|neutral-ink|neutral-soft|violet-ink|violet-soft|status-(?:on-move|stopped|idle|out-of-network|toing)(?:-ink)?))\s*:\s*([^;]+);/g)) {
      tokens[name] = value.trim();
    }
  }
  return tokens;
}
const tokens = { light: themeTokens('light'), dark: themeTokens('dark') };

function parseColor(value) {
  const hex = value.match(/^#([0-9a-f]{6})$/i);
  if (hex) return [...hex[1].match(/../g).map((part) => Number.parseInt(part, 16)), 1];
  const rgba = value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
  if (rgba) return [Number(rgba[1]), Number(rgba[2]), Number(rgba[3]), Number(rgba[4] ?? 1)];
  throw new Error(`Unsupported CSS color token: ${value}`);
}
function opaqueRgb(color) { return color.slice(0, 3); }
function composite(foreground, background) {
  const [r, g, b, alpha] = foreground;
  return [r, g, b].map((value, index) => value * alpha + background[index] * (1 - alpha));
}
function luminance(color) {
  const linear = color.map((value) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}
function contrast(a, b) {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
}

let failures = 0;
for (const [theme, value] of Object.entries(tokens)) {
  const backdrops = ambientSamples[theme].map((sample) => opaqueRgb(parseColor(sample)));
  const glass = parseColor(value['--glass-bg']);
  const glassSurfaces = backdrops.map((backdrop) => composite(glass, backdrop));
  const avatarFill = opaqueRgb(parseColor(value['--avatar-fill']));
  const avatarInk = opaqueRgb(parseColor(value['--avatar-ink']));
  const avatarRatio = contrast(avatarInk, avatarFill);
  const avatarPass = avatarRatio >= 4.5;
  console.log(`${avatarPass ? 'PASS' : 'FAIL'} ${theme} avatar initials: ${avatarRatio.toFixed(2)}:1 (required 4.5:1)`);
  if (!avatarPass) failures += 1;
  const railSurface = opaqueRgb(parseColor(value['--sidebar-rail-surface']));
  const countFill = opaqueRgb(parseColor(value['--sidebar-count-bg']));
  const countContrast = contrast(countFill, railSurface);
  const countPass = countContrast >= 3;
  console.log(`${countPass ? 'PASS' : 'FAIL'} ${theme} collapsed navigation count dot: ${countContrast.toFixed(2)}:1 (required 3:1)`);
  if (!countPass) failures += 1;
  for (const [label, token] of [['connected footer dot', '--sidebar-status-online'], ['reconnecting footer dot', '--sidebar-status-pending'], ['offline footer dot', '--sidebar-status-offline']]) {
    const ratio = contrast(opaqueRgb(parseColor(value[token])), railSurface);
    const pass = ratio >= 3;
    console.log(`${pass ? 'PASS' : 'FAIL'} ${theme} ${label}: ${ratio.toFixed(2)}:1 (required 3:1)`);
    if (!pass) failures += 1;
  }
  for (const [label, background, foreground] of [
    ['success badge', value['--success-soft'], value['--success-ink']],
    ['info badge', value['--info-soft'], value['--info-ink']],
    ['danger badge', value['--danger-soft'], value['--danger-ink']],
    ['warning badge', value['--warning-soft'], value['--warning-ink']],
    ['neutral badge', value['--neutral-soft'], value['--neutral-ink']],
    ['violet badge', value['--violet-soft'], value['--violet-ink']],
  ]) {
    const ratio = contrast(opaqueRgb(parseColor(foreground)), opaqueRgb(parseColor(background)));
    const pass = ratio >= 4.5;
    console.log(`${pass ? 'PASS' : 'FAIL'} ${theme} ${label}: ${ratio.toFixed(2)}:1 (required 4.5:1)`);
    if (!pass) failures += 1;
  }
  const statusSurface = opaqueRgb(parseColor(theme === 'light' ? '#ffffff' : '#131518'));
  for (const [label, suffix] of [['On Move', 'on-move'], ['Stopped', 'stopped'], ['Idle', 'idle'], ['Out of N/W', 'out-of-network'], ['Toing', 'toing']]) {
    const ratio = contrast(opaqueRgb(parseColor(value[`--status-${suffix}-ink`])), statusSurface);
    const pass = ratio >= 4.5;
    console.log(`${pass ? 'PASS' : 'FAIL'} ${theme} ${label} status text: ${ratio.toFixed(2)}:1 (required 4.5:1)`);
    if (!pass) failures += 1;
  }
  const primaryRatio = contrast([255, 255, 255], opaqueRgb(parseColor(value['--brand'])));
  const primaryPass = primaryRatio >= 4.5;
  console.log(`${primaryPass ? 'PASS' : 'FAIL'} ${theme} primary button text: ${primaryRatio.toFixed(2)}:1 (required 4.5:1)`);
  if (!primaryPass) failures += 1;
  const authBackdrops = [...backdrops, [62, 166, 255], [255, 255, 255]];
  const authSurfaces = authBackdrops.map((backdrop) => composite(glass, backdrop));
  const authTextRatio = Math.min(...authSurfaces.map((surface) => contrast(opaqueRgb(parseColor(value['--ink'])), surface)));
  const authTextPass = authTextRatio >= 4.5;
  console.log(`${authTextPass ? 'PASS' : 'FAIL'} ${theme} auth glass text: ${authTextRatio.toFixed(2)}:1 (required 4.5:1)`);
  if (!authTextPass) failures += 1;
  const authIconRatio = Math.min(...authSurfaces.map((surface) => contrast(opaqueRgb(parseColor(value['--sidebar-accent'])), surface)));
  const authIconPass = authIconRatio >= 3;
  console.log(`${authIconPass ? 'PASS' : 'FAIL'} ${theme} auth glass icon: ${authIconRatio.toFixed(2)}:1 (required 3:1)`);
  if (!authIconPass) failures += 1;
  const foregrounds = [
    ['body text', opaqueRgb(parseColor(value['--sidebar-text'])), 4.5],
    ['section label', opaqueRgb(parseColor(value['--sidebar-muted'])), 4.5],
    ['icon', opaqueRgb(parseColor(value['--sidebar-icon'])), 3],
    ['active icon/focus', opaqueRgb(parseColor(value['--sidebar-accent'])), 3],
    ['badge text', [255, 255, 255], 4.5],
    ['topbar text', opaqueRgb(parseColor(value['--topbar-foreground'])), 4.5],
    ['topbar icon', opaqueRgb(parseColor(value['--topbar-icon'])), 3],
  ];
  for (const [label, foreground, minimum] of foregrounds) {
    const targets = label === 'badge text' ? [countFill] : glassSurfaces;
    const ratio = Math.min(...targets.map((surface) => contrast(foreground, surface)));
    const pass = ratio >= minimum;
    console.log(`${pass ? 'PASS' : 'FAIL'} ${theme} ${label}: ${ratio.toFixed(2)}:1 (required ${minimum}:1)`);
    if (!pass) failures += 1;
  }
  const pillBackground = parseColor(value['--topbar-pill-bg']);
  const pillText = opaqueRgb(parseColor(value['--topbar-pill-text']));
  const pillSurfaces = glassSurfaces.map((surface) => composite(pillBackground, surface));
  const pillRatio = Math.min(...pillSurfaces.map((surface) => contrast(pillText, surface)));
  const pillPass = pillRatio >= 4.5;
  console.log(`${pillPass ? 'PASS' : 'FAIL'} ${theme} topbar status pill text: ${pillRatio.toFixed(2)}:1 (required 4.5:1)`);
  if (!pillPass) failures += 1;
  const pillBorder = parseColor(value['--topbar-pill-border']);
  const pillBorderRatio = Math.min(...pillSurfaces.map((surface) => contrast(composite(pillBorder, surface), surface)));
  const pillBorderPass = pillBorderRatio >= 3;
  console.log(`${pillBorderPass ? 'PASS' : 'FAIL'} ${theme} topbar pill border: ${pillBorderRatio.toFixed(2)}:1 (required 3:1)`);
  if (!pillBorderPass) failures += 1;
  const border = parseColor(value['--glass-border']);
  const borderColors = backdrops.map((backdrop) => composite(border, backdrop));
  const borderRatio = Math.min(...glassSurfaces.map((surface, index) => contrast(borderColors[index], surface)));
  const borderPass = borderRatio >= 3;
  console.log(`${borderPass ? 'PASS' : 'FAIL'} ${theme} control border: ${borderRatio.toFixed(2)}:1 (required 3:1)`);
  if (!borderPass) failures += 1;

  // Menu surfaces sit above saturated map tiles and bright cards, so measure
  // their layered alpha against both worst-case backdrops instead of the shell.
  const menuGlass = parseColor(value['--glass-bg-strong']);
  const menuSurfaces = [[62, 166, 255], [255, 255, 255]].map((backdrop) => composite(menuGlass, backdrop));
  const hover = parseColor(value['--glass-hover']);
  const hoverSurfaces = menuSurfaces.map((surface) => composite(hover, surface));
  const menuChecks = [
    ['menu text', opaqueRgb(parseColor(value['--sidebar-text'])), menuSurfaces, 4.5],
    ['menu icon', opaqueRgb(parseColor(value['--sidebar-icon'])), menuSurfaces, 3],
    ['menu danger text', opaqueRgb(parseColor(value['--menu-danger'])), menuSurfaces, 4.5],
    ['menu hover text', opaqueRgb(parseColor(value['--sidebar-text'])), hoverSurfaces, 4.5],
    ['menu hover icon', opaqueRgb(parseColor(value['--sidebar-icon'])), hoverSurfaces, 3],
  ];
  for (const [label, foreground, surfaces, minimum] of menuChecks) {
    const ratio = Math.min(...surfaces.map((surface) => contrast(foreground, surface)));
    const pass = ratio >= minimum;
    console.log(`${pass ? 'PASS' : 'FAIL'} ${theme} ${label}: ${ratio.toFixed(2)}:1 (required ${minimum}:1)`);
    if (!pass) failures += 1;
  }
}
if (failures) process.exitCode = 1;
