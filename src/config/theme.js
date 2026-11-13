/**
 * 1-2-1 Connect Official Brand Guidelines & Design Tokens
 * 
 * 1-2-1 Connect Colours:
 * - Connect Red: Digital: Hex #D8061B | RGB: 216, 6, 27 | CMYK: 0, 97, 88, 15
 *   Primary. Logo, app icon, hero backgrounds, the one key action.
 * - Deep Red: Digital: Hex #B00E29 | RGB: 176, 14, 41 | CMYK: 0, 92, 77, 31
 *   Buttons and pressed states; the darker end of red gradients.
 * - Coral: Digital: Hex #F04E66 | RGB: 240, 78, 102 | CMYK: 0, 68, 57, 6
 *   The lighter end of red gradients and the live round card. Never for text.
 * - Ink: Digital: Hex #17110F | RGB: 23, 17, 15 | CMYK: 0, 26, 35, 91
 *   Text and the one-colour logo.
 * - Paper: Digital: Hex #FAF7F6 | RGB: 250, 247, 246 | CMYK: 0, 1, 2, 2
 *   Page background. Warmer than white.
 * - Graphite: Digital: Hex #3A3F4A | RGB: 58, 63, 74 | CMYK: 22, 15, 0, 71
 *   Secondary text, dark sections, the glass-shard pattern.
 * - Gold: Digital: Hex #F4B740 | RGB: 244, 183, 64 | CMYK: 0, 25, 74, 4
 *   Small highlights only (a number, a badge). Never large areas.
 * 
 * Fonts:
 * - Official Font: Helvetica Neue
 * - Approved Substitute: Arial
 * - Approved Weights: Light (300), Regular/Roman (400), Bold (700) with Italic styles
 * - Ideal for headings: Helvetica Neue Bold or Arial Bold
 */

export const brandColors = {
  connectRed: {
    hex: '#D8061B',
    rgb: '216, 6, 27',
    cmyk: '0, 97, 88, 15',
    name: 'Connect Red',
    description: 'Primary. Logo, app icon, hero backgrounds, the one key action.',
  },
  deepRed: {
    hex: '#B00E29',
    rgb: '176, 14, 41',
    cmyk: '0, 92, 77, 31',
    name: 'Deep Red',
    description: 'Buttons and pressed states; the darker end of red gradients.',
  },
  coral: {
    hex: '#F04E66',
    rgb: '240, 78, 102',
    cmyk: '0, 68, 57, 6',
    name: 'Coral',
    description: 'The lighter end of red gradients and the live round card. Never for text.',
  },
  ink: {
    hex: '#17110F',
    rgb: '23, 17, 15',
    cmyk: '0, 26, 35, 91',
    name: 'Ink',
    description: 'Text and the one-colour logo.',
  },
  paper: {
    hex: '#FAF7F6',
    rgb: '250, 247, 246',
    cmyk: '0, 1, 2, 2',
    name: 'Paper',
    description: 'Page background. Warmer than white.',
  },
  graphite: {
    hex: '#3A3F4A',
    rgb: '58, 63, 74',
    cmyk: '22, 15, 0, 71',
    name: 'Graphite',
    description: 'Secondary text, dark sections, the glass-shard pattern.',
  },
  gold: {
    hex: '#F4B740',
    rgb: '244, 183, 64',
    cmyk: '0, 25, 74, 4',
    name: 'Gold',
    description: 'Small highlights only (a number, a badge). Never large areas.',
  },

  // Aliases for backward compatibility
  bniRed: {
    hex: '#D8061B',
    rgb: '216, 6, 27',
    cmyk: '0, 97, 88, 15',
    name: 'Connect Red',
  },
  sterlingGrey: {
    hex: '#C8C8C8',
    rgb: '200, 200, 200',
    cmyk: '20, 15, 15, 0',
    name: 'Sterling Grey',
  },
  white: {
    hex: '#FFFFFF',
    rgb: '255, 255, 255',
    cmyk: '0, 0, 0, 0',
    name: 'White',
  },
  coolGreyLight: {
    hex: '#F2F2F2',
    rgb: '244, 244, 244',
    cmyk: '3, 3, 3, 0',
    name: 'Cool Grey Light',
  },
  coolGreyDark: {
    hex: '#64666A',
    rgb: '100, 102, 106',
    cmyk: '60, 50, 45, 20',
    name: 'Cool Grey Dark',
  },
  black: {
    hex: '#17110F',
    rgb: '23, 17, 15',
    cmyk: '0, 26, 35, 91',
    name: 'Ink',
  },
};

/** Direct hex access for UI, Recharts charts, inline styles & canvas */
export const colors = {
  // 1-2-1 Connect tokens
  connectRed: brandColors.connectRed.hex,
  deepRed: brandColors.deepRed.hex,
  coral: brandColors.coral.hex,
  ink: brandColors.ink.hex,
  paper: brandColors.paper.hex,
  graphite: brandColors.graphite.hex,
  gold: brandColors.gold.hex,

  // Direct hex aliases
  brandRed: brandColors.connectRed.hex,
  bniRed: brandColors.connectRed.hex,
  sterlingGrey: brandColors.sterlingGrey.hex,
  white: brandColors.white.hex,
  coolGreyLight: brandColors.coolGreyLight.hex,
  coolGreyDark: brandColors.coolGreyDark.hex,
  black: brandColors.ink.hex,

  // Semantic mappings
  primary: brandColors.connectRed.hex,
  primaryHover: brandColors.deepRed.hex,
  sidebarBg: brandColors.deepRed.hex,
  surface: brandColors.white.hex,
  background: brandColors.paper.hex,
  surfaceAlt: brandColors.paper.hex,
  border: '#E8E8E8',
  borderLight: '#F0EAE8',
  textPrimary: brandColors.ink.hex,
  textSecondary: brandColors.graphite.hex,
  textMuted: brandColors.graphite.hex,
  textLight: '#8A8D93',
  cardBorder: 'rgba(216, 6, 27, 0.18)',
  accentGold: brandColors.gold.hex,
  liveRoundCoral: brandColors.coral.hex,
};

/** Official Typography - Plus Jakarta Sans */
export const fonts = {
  primary: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  sans: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  display: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  heading: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

export const fontWeights = {
  light: 300,
  regular: 400,
  medium: 500,
  semiBold: 600,
  bold: 700,
  extraBold: 800,
  // Semantic weights from 1-2-1 Connect guidelines
  headline: 800,
  subhead: 700,
  body: 500,
};

/**
 * Standardized Font Sizes & Typography Styles
 * - Headlines: ExtraBold (800) with -2% tight tracking (-0.02em)
 * - Subheads: Bold (700)
 * - Body: Medium (500) or Regular (400)
 */
export const fontSizes = {
  // Ultra-compact / Labels
  labelXs: {
    fontSize: '10px',
    lineHeight: '12px',
    letterSpacing: '0.04em',
    fontWeight: fontWeights.bold,
  },
  caption: {
    fontSize: '11px',
    lineHeight: '14px',
    fontWeight: fontWeights.regular,
  },
  label: {
    fontSize: '11px',
    lineHeight: '14px',
    letterSpacing: '0.02em',
    fontWeight: fontWeights.medium,
  },
  labelMd: {
    fontSize: '11px',
    lineHeight: '14px',
    fontWeight: fontWeights.bold,
  },

  // Body text (Medium 500 or Regular 400)
  bodySm: {
    fontSize: '12px',
    lineHeight: '16px',
    fontWeight: fontWeights.medium,
  },
  body: {
    fontSize: '12px',
    lineHeight: '16px',
    fontWeight: fontWeights.medium,
  },
  bodyMd: {
    fontSize: '13px',
    lineHeight: '18px',
    fontWeight: fontWeights.medium,
  },
  button: {
    fontSize: '12px',
    lineHeight: '16px',
    fontWeight: fontWeights.bold,
  },
  sidebar: {
    fontSize: '13px',
    lineHeight: '18px',
    fontWeight: fontWeights.bold,
  },

  // Subheads (Bold 700)
  cardTitle: {
    fontSize: '13px',
    lineHeight: '18px',
    fontWeight: fontWeights.bold,
  },
  titleLg: {
    fontSize: '14px',
    lineHeight: '18px',
    fontWeight: fontWeights.bold,
  },
  sectionHeading: {
    fontSize: '14px',
    lineHeight: '18px',
    fontWeight: fontWeights.bold,
  },

  // Headlines (ExtraBold 800 with -2% tight tracking)
  headlineMd: {
    fontSize: '15px',
    lineHeight: '20px',
    fontWeight: fontWeights.extraBold,
    letterSpacing: '-0.02em',
  },
  moduleTitle: {
    fontSize: '16px',
    lineHeight: '22px',
    fontWeight: fontWeights.extraBold,
    letterSpacing: '-0.02em',
  },
  headlineLg: {
    fontSize: '18px',
    lineHeight: '24px',
    fontWeight: fontWeights.extraBold,
    letterSpacing: '-0.02em',
  },
  displaySm: {
    fontSize: '20px',
    lineHeight: '26px',
    fontWeight: fontWeights.extraBold,
    letterSpacing: '-0.02em',
  },
  dashboardTitle: {
    fontSize: '26px',
    lineHeight: '28px',
    fontWeight: fontWeights.extraBold,
    letterSpacing: '-0.02em',
  },
  displayLg: {
    fontSize: '32px',
    lineHeight: '36px',
    fontWeight: fontWeights.extraBold,
    letterSpacing: '-0.02em',
  },
};

/** Convenience function to get style object for any font size token */
export function getTypographyStyle(token) {
  const spec = fontSizes[token];
  if (!spec) return { fontFamily: fonts.primary };
  return {
    fontFamily: fonts.primary,
    fontSize: spec.fontSize,
    lineHeight: spec.lineHeight,
    fontWeight: spec.fontWeight,
    ...(spec.letterSpacing ? { letterSpacing: spec.letterSpacing } : {}),
  };
}

export default {
  brandColors,
  colors,
  fonts,
  fontWeights,
  fontSizes,
  getTypographyStyle,
};
