import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createCanvas, loadImage } from 'canvas';

// Generate PWA square icons from the transparent tab mark rather than the
// larger sidebar artwork, keeping the same mark visible in browser surfaces.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const inputPath = path.join(__dirname, 'public/tab1.png');
const outputDir = path.join(__dirname, 'public/images');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

async function generateIcons() {
  try {
    const image = await loadImage(inputPath);
    
    for (const size of sizes) {
      const canvas = createCanvas(size, size);
      const ctx = canvas.getContext('2d');
      
      // Fill with theme color background for maskable icons
      ctx.fillStyle = '#0f766e';
      ctx.fillRect(0, 0, size, size);
      
      // Draw the logo centered
      const padding = size * 0.1;
      const drawSize = size - padding * 2;
      const aspectRatio = image.width / image.height;
      
      let drawWidth, drawHeight;
      if (aspectRatio > 1) {
        drawWidth = drawSize;
        drawHeight = drawSize / aspectRatio;
      } else {
        drawHeight = drawSize;
        drawWidth = drawSize * aspectRatio;
      }
      
      const x = (size - drawWidth) / 2;
      const y = (size - drawHeight) / 2;
      
      ctx.drawImage(image, x, y, drawWidth, drawHeight);
      
      const outputPath = path.join(outputDir, `icon-${size}.png`);
      const buffer = canvas.toBuffer('image/png');
      fs.writeFileSync(outputPath, buffer);
      console.log(`Generated icon-${size}.png`);
    }
    
    console.log('All icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);
    process.exit(1);
  }
}

generateIcons();
