/**
 * Generate PNG icons for bTab Sync extension
 * Creates 16x16, 32x32, 48x48, and 128x128 PNG icons
 */

const fs = require('fs');
const { createCanvas } = require('canvas');

const sizes = [16, 32, 48, 128];

function generateIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');
  
  // Background - dark slate
  const radius = size * 0.22;
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, radius);
  ctx.fillStyle = '#1e1e2e';
  ctx.fill();
  
  // "b" letter - teal color
  ctx.fillStyle = '#1dd9b4';
  ctx.font = `bold ${size * 0.55}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('b', size * 0.45, size * 0.54);
  
  // Small accent bars (simplified for smaller sizes)
  if (size >= 32) {
    ctx.fillStyle = '#cdd6f4';
    // Horizontal bar
    const barWidth = size * 0.17;
    const barHeight = size * 0.03;
    const barX = size * 0.56;
    const barY = size * 0.30;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barWidth, barHeight, barHeight / 2);
    ctx.fill();
    
    // Vertical bar
    const vBarX = size * 0.63;
    const vBarY = size * 0.30;
    const vBarHeight = size * 0.23;
    ctx.beginPath();
    ctx.roundRect(vBarX, vBarY, barHeight, vBarHeight, barHeight / 2);
    ctx.fill();
  }
  
  return canvas.toBuffer('image/png');
}

// Generate all sizes
for (const size of sizes) {
  const buffer = generateIcon(size);
  fs.writeFileSync(`icons/icon-${size}.png`, buffer);
  console.log(`Generated icon-${size}.png`);
}

console.log('All icons generated!');
