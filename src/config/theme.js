/**
 * BNI Official Brand Guidelines & Design Tokens
 * 
 * Brand Colors:
 * - BNI Red: Digital: Hex #CF2030 | Print: CMYK 12, 100, 90, 3 | PMS: Pantone 186 | RGB: 207, 32, 48
 * - Sterling Grey: Digital: Hex #C8C8C8 | Print: CMYK 20, 15, 15, 0 | PMS: Pantone Cool Grey 3 | RGB: 200, 200, 200
 * - White: Digital: Hex #FFFFFF | Print: CMYK 0, 0, 0, 0 | RGB: 255, 255, 255
 * - Cool Grey 3 (20% Opacity): Digital: Hex #F2F2F2 | Print: CMYK 3, 3, 3, 0 | RGB: 244, 244, 244
 * - Cool Grey 10: Digital: Hex #64666A | Print: CMYK 60, 50, 45, 20 | PMS: Pantone Cool Grey 10 | RGB: 100, 102, 106
 * - Process Black: Digital: Hex #000000 | Print: CMYK 0, 0, 0, 100 | PMS: Pantone Process Black | RGB: 0, 0, 0
 * 
 * Fonts:
 * - Official Font: Helvetica Neue
 * - Approved Substitute: Arial
 * - Approved Weights: Light (300), Regular/Roman (400), Bold (700) with Italic styles
 * - Ideal for headings: Helvetica Neue Bold or Arial Bold
 */

export const brandColors = {
  bniRed: {
    hex: '#CF2030',
    rgb: '207, 32, 48',
    cmyk: '12, 100, 90, 3',
    pantone: 'Pantone 186',
    name: 'BNI Red',
  },
  sterlingGrey: {
    hex: '#C8C8C8',
    rgb: '200, 200, 200',
    cmyk: '20, 15, 15, 0',
    pantone: 'Pantone Cool Grey 3',
    name: 'Sterling Grey',
  },
  white: {
    hex: '#FFFFFF',
    rgb: '255, 255, 255',
    cmyk: '0, 0, 0, 0',
    pantone: 'White',
    name: 'White',
  },
  coolGreyLight: {
    hex: '#F2F2F2',
    rgb: '244, 244, 244',
    cmyk: '3, 3, 3, 0',
    pantone: 'Pantone Cool Grey 3 / Opacity 20',
    name: 'Cool Grey Light',
  },
  coolGreyDark: {
    hex: '#64666A',
    rgb: '100, 102, 106',
    cmyk: '60, 50, 45, 20',
    pantone: 'Pantone Cool Grey 10',
    name: 'Cool Grey Dark',
  },
  black: {
    hex: '#000000',
    rgb: '0, 0, 0',
    cmyk: '0, 0, 0, 100',
    pantone: 'Process Black',
    name: 'Process Black',
  },
};

/** Direct hex access for UI, Recharts charts, inline styles & canvas */
export const colors = {
  brandRed: brandColors.bniRed.hex,
  bniRed: brandColors.bniRed.hex,
  sterlingGrey: brandColors.sterlingGrey.hex,
  white: brandColors.white.hex,
  coolGreyLight: brandColors.coolGreyLight.hex,
  coolGreyDark: brandColors.coolGreyDark.hex,
  black: brandColors.black.hex,

  // Semantic mappings
  primary: brandColors.bniRed.hex,
  primaryHover: '#B01B29',
  surface: brandColors.white.hex,
  background: brandColors.white.hex,
  surfaceAlt: brandColors.coolGreyLight.hex,
  border: brandColors.sterlingGrey.hex,
  borderLight: '#E8E8E8',
  textPrimary: brandColors.black.hex,
  textSecondary: brandColors.coolGreyDark.hex,
  textMuted: brandColors.coolGreyDark.hex,
  textLight: brandColors.sterlingGrey.hex,
  cardBorder: 'rgba(207, 32, 48, 0.22)',
};

/** Official Typography */
export const fonts = {
  primary: '"Helvetica Neue", Arial, sans-serif',
  sans: '"Helvetica Neue", Arial, sans-serif',
  display: '"Helvetica Neue", Arial, sans-serif',
  heading: '"Helvetica Neue", Arial, sans-serif',
};

export const fontWeights = {
  light: 300,
  regular: 400,
  roman: 400,
  bold: 700,
};

/**
 * Standardized Font Sizes & Typography Styles
 * Accessible programmatically across components
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
    fontWeight: fontWeights.regular,
  },
  labelMd: {
    fontSize: '11px',
    lineHeight: '14px',
    fontWeight: fontWeights.bold,
  },

  // Body text
  bodySm: {
    fontSize: '12px',
    lineHeight: '16px',
    fontWeight: fontWeights.regular,
  },
  body: {
    fontSize: '12px',
    lineHeight: '16px',
    fontWeight: fontWeights.regular,
  },
  bodyMd: {
    fontSize: '13px',
    lineHeight: '18px',
    fontWeight: fontWeights.regular,
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

  // Headings & Titles (All default to Helvetica Neue Bold)
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
  headlineMd: {
    fontSize: '15px',
    lineHeight: '20px',
    fontWeight: fontWeights.bold,
  },
  moduleTitle: {
    fontSize: '16px',
    lineHeight: '22px',
    fontWeight: fontWeights.bold,
  },
  headlineLg: {
    fontSize: '18px',
    lineHeight: '24px',
    fontWeight: fontWeights.bold,
  },
  displaySm: {
    fontSize: '20px',
    lineHeight: '26px',
    fontWeight: fontWeights.bold,
  },
  dashboardTitle: {
    fontSize: '26px',
    lineHeight: '28px',
    fontWeight: fontWeights.bold,
  },
  displayLg: {
    fontSize: '32px',
    lineHeight: '36px',
    fontWeight: fontWeights.bold,
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
