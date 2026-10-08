/**
 * Design Tokens to CSS Variables Converter
 * Converts design-tokens.tokens.json into standard CSS Custom Properties (:root).
 *
 * Color System Architecture:
 * 1. Primitives (--primitives-*): Base values. Not consumed directly by UI code.
 * 2. Color Roles (--color-roles-*): Semantic tokens mapped via var(--primitives-*).
 *    Used directly in UI components.
 * 3. Effects (--effect-*): Drop shadows and elevation.
 * 4. Typography (--typography-*): Font sizes, line heights, weights, and letter spacing.
 */

const fs = require('fs');
const path = require('path');

// Target file paths
const inputPath = process.argv[2] || path.join(__dirname, 'design-tokens.tokens.json');
const outputPath = process.argv[3] || path.join(__dirname, 'tokens.css');

/**
 * Slugifies string keys into kebab-case formatting
 * Example: "color palettes" -> "color-palettes"
 */
function slugify(str) {
  return str
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Converts a path array to a CSS variable name
 * Example: ["primitives", "color palettes", "primary", "primary40"] -> "--primitives-color-palettes-primary-primary40"
 */
function toVarName(pathKeys) {
  return '--' + pathKeys.map(slugify).join('-');
}

/**
 * Resolves JSON token aliases like "{primitives.color palettes.primary.primary40}"
 * into CSS variable references: "var(--primitives-color-palettes-primary-primary40)"
 */
function resolveValue(val) {
  if (typeof val === 'string' && val.startsWith('{') && val.endsWith('}')) {
    const rawPath = val.slice(1, -1);
    const pathKeys = rawPath.split('.');
    return `var(${toVarName(pathKeys)})`;
  }
  return val;
}

/**
 * Formats custom shadow objects to valid CSS box-shadow syntax
 */
function formatShadow(shadowObj) {
  const { offsetX = 0, offsetY = 0, radius = 0, spread = 0, color = 'rgba(0,0,0,0)' } = shadowObj;
  return `${offsetX}px ${offsetY}px ${radius}px ${spread}px ${color}`;
}

function parseTokens(tokens) {
  const cssVars = {
    primitives: [],
    colorRoles: [],
    effects: [],
    typography: []
  };

  // 1. Process Primitives (Palettes & Key Colors)
  if (tokens.primitives) {
    function traversePrimitives(obj, currentPath) {
      for (const key in obj) {
        const item = obj[key];
        const nextPath = [...currentPath, key];
        if (item && typeof item === 'object' && item.type === 'color') {
          const varName = toVarName(nextPath);
          cssVars.primitives.push(`  ${varName}: ${item.value};`);
        } else if (item && typeof item === 'object') {
          traversePrimitives(item, nextPath);
        }
      }
    }
    traversePrimitives(tokens.primitives, ['primitives']);
  }

  // 2. Process Color Roles (Semantic Tokens referencing Primitives)
  if (tokens['color roles']) {
    const roles = tokens['color roles'];
    for (const roleName in roles) {
      const roleObj = roles[roleName];
      if (roleObj && roleObj.type === 'color') {
        const varName = toVarName(['color-roles', roleName]);
        const cssVal = resolveValue(roleObj.value);
        cssVars.colorRoles.push(`  ${varName}: ${cssVal};`);
      }
    }
  }

  // 3. Process Effects (Shadows)
  if (tokens.effect) {
    for (const effectName in tokens.effect) {
      const effectObj = tokens.effect[effectName];
      if (effectObj && effectObj.type === 'custom-shadow' && effectObj.value) {
        const varName = toVarName(['effect', effectName]);
        const shadowVal = formatShadow(effectObj.value);
        cssVars.effects.push(`  ${varName}: ${shadowVal};`);
      }
    }
  }

  // 4. Process Typography
  if (tokens.typography) {
    for (const styleName in tokens.typography) {
      const styleObj = tokens.typography[styleName];
      const baseSlug = slugify(styleName);

      for (const propName in styleObj) {
        const prop = styleObj[propName];
        if (prop && prop.value !== undefined) {
          const propSlug = slugify(propName);
          const varName = `--typography-${baseSlug}-${propSlug}`;
          let val = prop.value;
          if (prop.type === 'dimension') {
            val = typeof val === 'number' ? `${val}px` : val;
          } else if (prop.type === 'string') {
            val = typeof val === 'string' && val.includes(' ') ? `"${val}"` : val;
          }
          cssVars.typography.push(`  ${varName}: ${val};`);
        }
      }
    }
  }

  return cssVars;
}

function generateCSS(cssVars) {
  return `/* AUTO-GENERATED DESIGN SYSTEM TOKENS - DO NOT MODIFY DIRECTLY */
/* Source of Truth: design-tokens.tokens.json */

:root {
  /* ========================================================
   * 1. PRIMITIVE COLORS (Internal Layer - Do not use directly in UI)
   * ======================================================== */
${cssVars.primitives.join('\n')}

  /* ========================================================
   * 2. COLOR ROLES (UI Layer - Use these directly in UI styles)
   * ======================================================== */
${cssVars.colorRoles.join('\n')}

  /* ========================================================
   * 3. EFFECTS & SHADOWS
   * ======================================================== */
${cssVars.effects.join('\n')}

  /* ========================================================
   * 4. TYPOGRAPHY
   * ======================================================== */
${cssVars.typography.join('\n')}
}
`;
}

function main() {
  try {
    console.log(`Reading design tokens from: ${inputPath}`);
    const rawData = fs.readFileSync(inputPath, 'utf-8');
    const tokens = JSON.parse(rawData);

    const cssVars = parseTokens(tokens);
    const outputCSS = generateCSS(cssVars);

    fs.writeFileSync(outputPath, outputCSS, 'utf-8');
    console.log(`Successfully generated CSS variables at: ${outputPath}`);
  } catch (error) {
    console.error(`Error converting design tokens: ${error.message}`);
    process.exit(1);
  }
}

main();
