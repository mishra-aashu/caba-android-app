/**
 * Utility to dynamically colorize SVG patterns for chat backgrounds.
 * This works by taking an SVG string and injecting a fill color.
 */

export function colorizeSVG(svgString, fill) {
    if (!svgString) return '';

    if (!fill) fill = 'currentColor';

    let processedSvg = svgString;

    // 1. Replace common hex and rgb patterns in styles/attributes, excluding "none"
    processedSvg = processedSvg.replace(/(fill|stroke):\s*(?!none)[^;!}]*/gi, `$1: ${fill}`);
    processedSvg = processedSvg.replace(/(fill|stroke)="(?!none)[^"]*"/gi, `$1="${fill}"`);
    
    // 2. Fallback: search for any solid hex colors in the SVG text
    processedSvg = processedSvg.replace(/#[0-9a-fA-F]{3,6}(?=[^>]*>)/g, fill);

    // 3. Inject a style tag to catch paths that inherit or use the common .stX classes
    const styleTag = `<style>
        svg * { 
            fill: inherit !important; 
            stroke: inherit !important; 
        }
        [fill="none"], .st-none { fill: none !important; }
        [stroke="none"] { stroke: none !important; }
    </style>`;
    
    if (processedSvg.includes('<svg')) {
        // Correctly inject properties into the <svg> tag and handle xmlns if missing
        processedSvg = processedSvg.replace(/<svg([^>]*)>/, (match, attrs) => {
            let newAttrs = attrs;
            if (!newAttrs.includes('fill=')) newAttrs += ` fill="${fill}"`;
            if (!newAttrs.includes('stroke=')) newAttrs += ` stroke="${fill}"`;
            return `<svg${newAttrs}>${styleTag}`;
        });
    }

    // Convert to Base64 data URI (much more stable for large SVGs and CSS variables)
    try {
        const base64 = btoa(unescape(encodeURIComponent(processedSvg)));
        return `data:image/svg+xml;base64,${base64}`;
    } catch (e) {
        // Fallback to URI encoding if btoa fails
        return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(processedSvg)}`;
    }
}
;

/**
 * Specifically for the pattern.svg, since it's large, 
 * we might want to handle it as a template or use CSS masks.
 */
export const getPatternDataUri = (svgPath, color) => {
    // This is a placeholder for when we have the actual SVG string loaded
    // For now, it provides the logic to generate the URI
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(svgPath.replace('fill="none"', `fill="${color}"`))}")`;
};
