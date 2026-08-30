/**
 * Verifies the QR encoder produces codes a real decoder can read.
 *
 * Renders the component to SVG, rasterises the module grid by hand (the SVG is
 * one 1x1 rect per dark module, so this is exact rather than approximate), and
 * feeds it to jsQR.
 *
 *   npx tsx scripts/qr-check.ts
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { QrCode } from '../src/components/ui/QrCode';

/**
 * jsQR is a verification-only dependency and deliberately not in package.json:
 * shipping a decoder to prove an encoder works would double the bundle for no
 * runtime benefit. Install it when you want to run this:
 *
 *   npm install --no-save jsqr && npx tsx scripts/qr-check.ts
 */
type Decoder = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
) => { data: string } | null;

let jsQR: Decoder;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  jsQR = require('jsqr') as Decoder;
} catch {
  console.log('jsqr is not installed — skipping.');
  console.log('  npm install --no-save jsqr && npx tsx scripts/qr-check.ts');
  process.exit(0);
}

const CASES = [
  'https://boatbooker.com/direct?invite=abc123',
  'https://boatbooker.com/reviews/scan-qr-code/c_0001',
  'https://example.com/a/very/long/path/that/pushes/into/a/higher/qr/version/1234567890',
];

function decode(value: string): string | null {
  const svg = renderToStaticMarkup(createElement(QrCode, { value }));

  const viewBox = /viewBox="0 0 (\d+) \d+"/.exec(svg);
  if (!viewBox) return null;
  const total = Number(viewBox[1]);

  // Rebuild the module grid from the path commands.
  const grid: boolean[][] = Array.from({ length: total }, () => new Array(total).fill(false));
  for (const match of svg.matchAll(/M(\d+) (\d+)h1v1h-1z/g)) {
    grid[Number(match[2])][Number(match[1])] = true;
  }

  // Upscale so jsQR has enough pixels per module to lock on.
  const scale = 6;
  const side = total * scale;
  const data = new Uint8ClampedArray(side * side * 4);
  for (let y = 0; y < side; y += 1) {
    for (let x = 0; x < side; x += 1) {
      const dark = grid[Math.floor(y / scale)][Math.floor(x / scale)];
      const i = (y * side + x) * 4;
      const v = dark ? 0 : 255;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = v;
      data[i + 3] = 255;
    }
  }

  return jsQR(data, side, side)?.data ?? null;
}

let failed = 0;
for (const value of CASES) {
  const decoded = decode(value);
  const ok = decoded === value;
  if (!ok) failed += 1;
  console.log(`${ok ? '✓' : '✗'} ${value.slice(0, 60)}`);
  if (!ok) console.log(`  decoded: ${decoded ?? '(nothing)'}`);
}

console.log(failed ? `\n${failed} QR case(s) failed` : '\nAll QR cases decode correctly');
process.exit(failed ? 1 : 0);
