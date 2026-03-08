/**
 * Utility to dynamically colorize SVG patterns for chat backgrounds.
 * This works by taking an SVG string and injecting a fill color.
 */

export const colorizeSVG = (svgString, fill) => {
    if (!svgString) return '';

    // Ensure the fill is properly formatted for XML
    const escapedFill = fill.replace('#', '%23');

    // Inject fill attribute into the svg tag or add a style block
    let processedSvg = svgString;

    if (svgString.includes('<style')) {
        // If there's already a style tag, we might want to override it
        processedSvg = svgString.replace(/fill:[^;]*;/g, `fill:${fill};`);
    } else {
        // Add a global fill to the SVG tag
        processedSvg = svgString.replace('<svg', `<svg fill="${fill}"`);
    }

    // Convert to data URI
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(processedSvg)}`;
};

/**
 * Specifically for the pattern.svg, since it's large, 
 * we might want to handle it as a template or use CSS masks.
 */
export const getPatternDataUri = (svgPath, color) => {
    // This is a placeholder for when we have the actual SVG string loaded
    // For now, it provides the logic to generate the URI
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(svgPath.replace('fill="none"', `fill="${color}"`))}")`;
};
