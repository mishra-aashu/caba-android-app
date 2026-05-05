/**
 * Extracts dominant colors from an image URL using Canvas API.
 * Returns a promise that resolves to an array of HSL color strings.
 */
export const extractColorsFromImage = (imageUrl, count = 5) => {
  return new Promise((resolve) => {
    if (!imageUrl) {
      resolve(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    
    // Timeout to prevent hanging
    const timeout = setTimeout(() => {
      img.src = '';
      resolve(null);
    }, 3000);

    img.onload = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        
        // Small size for performance
        const size = 50;
        canvas.width = size;
        canvas.height = size;
        
        ctx.drawImage(img, 0, 0, size, size);
        const imageData = ctx.getImageData(0, 0, size, size).data;
        
        const pixels = [];
        for (let i = 0; i < imageData.length; i += 4) {
          const r = imageData[i];
          const g = imageData[i + 1];
          const b = imageData[i + 2];
          const a = imageData[i + 3];
          
          if (a > 125) { // Only semi-opaque pixels
            pixels.push({ r, g, b });
          }
        }

        if (pixels.length === 0) {
          resolve(null);
          return;
        }

        // Simple Quantization / Clustering
        const buckets = {};
        pixels.forEach(p => {
          const rB = Math.floor(p.r / 64);
          const gB = Math.floor(p.g / 64);
          const bB = Math.floor(p.b / 64);
          const key = `${rB},${gB},${bB}`;
          if (!buckets[key]) {
            buckets[key] = { r: 0, g: 0, b: 0, count: 0, maxV: 0 };
          }
          buckets[key].r += p.r;
          buckets[key].g += p.g;
          buckets[key].b += p.b;
          buckets[key].count++;
          
          // Track "vibrancy" (max - min) to find colorful buckets
          const v = Math.max(p.r, p.g, p.b) - Math.min(p.r, p.g, p.b);
          if (v > buckets[key].maxV) buckets[key].maxV = v;
        });

        const dominantColors = Object.values(buckets)
          // Sort by a mix of population and vibrancy
          .sort((a, b) => (b.count * (1 + b.maxV/255)) - (a.count * (1 + a.maxV/255)))
          .slice(0, count)
          .map(b => ({
            r: Math.round(b.r / b.count),
            g: Math.round(b.g / b.count),
            b: Math.round(b.b / b.count)
          }));

        // Convert RGB to HSL for easier manipulation
        const hslColors = dominantColors.map(rgb => {
          const r = rgb.r / 255;
          const g = rgb.g / 255;
          const b = rgb.b / 255;
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          let h, s, l = (max + min) / 2;

          if (max === min) {
            h = s = 0; // achromatic
          } else {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
              case r: h = (g - b) / d + (g < b ? 6 : 0); break;
              case g: h = (b - r) / d + 2; break;
              case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
          }

          return {
            h: Math.round(h * 360),
            s: Math.round(s * 100),
            l: Math.round(l * 100)
          };
        });

        // Ensure we have enough colors by shifting hues if needed
        while (hslColors.length < count) {
          const base = hslColors[0] || { h: 220, s: 70, l: 40 };
          hslColors.push({
            h: (base.h + (hslColors.length * 40)) % 360,
            s: base.s,
            l: base.l
          });
        }

        resolve(hslColors.map(c => `hsl(${c.h}, ${c.s}%, ${c.l}%)`));
      } catch (err) {
        console.error('Color extraction failed:', err);
        resolve(null);
      }
    };

    img.onerror = () => {
      clearTimeout(timeout);
      resolve(null);
    };

    img.src = imageUrl;
  });
};
