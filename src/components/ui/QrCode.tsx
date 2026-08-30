import { cx } from './cx';

/**
 * QR code renderer.
 *
 * A complete byte-mode QR encoder in ~200 lines rather than a dependency,
 * because the alternative is shipping a general-purpose library to draw one
 * fixed-size square. Version is chosen from the payload length, error
 * correction is fixed at level M (recovers ~15%), which is the right trade for
 * a code printed on a decal or shown on a phone screen.
 *
 * Output is an inline SVG so it scales, prints, and works with no JavaScript.
 */

/* ------------------------------------------------------- Galois field maths */

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);

{
  let x = 1;
  for (let i = 0; i < 255; i += 1) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    // Reduce modulo the QR generator polynomial x^8 + x^4 + x^3 + x^2 + 1.
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i += 1) EXP[i] = EXP[i - 255];
}

const mul = (a: number, b: number): number => (a === 0 || b === 0 ? 0 : EXP[LOG[a] + LOG[b]]);

/** Reed–Solomon generator polynomial of the given degree. */
function generatorPoly(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i += 1) {
    const next = new Array<number>(poly.length + 1).fill(0);
    for (let j = 0; j < poly.length; j += 1) {
      next[j] ^= mul(poly[j], 1);
      next[j + 1] ^= mul(poly[j], EXP[i]);
    }
    poly = next;
  }
  return poly;
}

function errorCorrection(data: number[], ecLength: number): number[] {
  const generator = generatorPoly(ecLength);
  const remainder = new Array<number>(ecLength).fill(0);

  for (const byte of data) {
    const factor = byte ^ remainder[0];
    remainder.shift();
    remainder.push(0);
    for (let i = 0; i < ecLength; i += 1) {
      remainder[i] ^= mul(generator[i + 1], factor);
    }
  }
  return remainder;
}

/* ------------------------------------------------------------ version table */

/**
 * Block layout at error-correction level M.
 *
 * Each entry is `[version, ecBytesPerBlock, group1Blocks, group1DataBytes,
 * group2Blocks, group2DataBytes]`. Total data capacity is derived rather than
 * listed, so the two can never disagree — which is exactly the bug a
 * hand-copied capacity column invites.
 *
 * Stops at version 6. Versions 7 and up carry two extra version-information
 * blocks that would have to be reserved and encoded, and 108 data bytes is far
 * more than any booking or review link needs.
 */
const VERSIONS: [number, number, number, number, number, number][] = [
  [1, 10, 1, 16, 0, 0],
  [2, 16, 1, 28, 0, 0],
  [3, 26, 1, 44, 0, 0],
  [4, 18, 2, 32, 0, 0],
  [5, 24, 2, 43, 0, 0],
  [6, 16, 4, 27, 0, 0],
];

const dataCapacity = (v: (typeof VERSIONS)[number]): number => v[2] * v[3] + v[4] * v[5];

const ALIGNMENT: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
  6: [6, 34],
};

/** Pre-computed format bits for level M and each mask, per the spec. */
const FORMAT_BITS = [
  0x5412, 0x5125, 0x5e7c, 0x5b4b, 0x45f9, 0x40ce, 0x4f97, 0x4aa0,
];

function buildMatrix(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text);

  // Mode indicator (4 bits) + length (8 bits) = 1.5 bytes of header.
  const version = VERSIONS.find((v) => bytes.length + 2 <= dataCapacity(v));
  if (!version) throw new Error('QR payload too long');

  const [ver, ecPerBlock, g1Blocks, g1Bytes, g2Blocks, g2Bytes] = version;
  const capacity = dataCapacity(version);
  const size = ver * 4 + 17;

  // --- Bit stream: mode (0100) + length + data + terminator + padding -------
  const bits: number[] = [];
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i -= 1) bits.push((value >> i) & 1);
  };

  push(0b0100, 4);
  push(bytes.length, 8);
  for (const byte of bytes) push(byte, 8);
  push(0, Math.min(4, capacity * 8 - bits.length));
  while (bits.length % 8) bits.push(0);

  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    data.push(bits.slice(i, i + 8).reduce((acc, bit) => (acc << 1) | bit, 0));
  }
  // Alternating pad bytes, as the spec requires.
  const PAD = [0xec, 0x11];
  for (let i = 0; data.length < capacity; i += 1) data.push(PAD[i % 2]);

  // --- Split into blocks and interleave -------------------------------------
  const blocks: number[][] = [];
  let offset = 0;
  for (let i = 0; i < g1Blocks; i += 1) {
    blocks.push(data.slice(offset, offset + g1Bytes));
    offset += g1Bytes;
  }
  for (let i = 0; i < g2Blocks; i += 1) {
    blocks.push(data.slice(offset, offset + g2Bytes));
    offset += g2Bytes;
  }

  const ecBlocks = blocks.map((block) => errorCorrection(block, ecPerBlock));

  const interleaved: number[] = [];
  const maxData = Math.max(...blocks.map((b) => b.length));
  for (let i = 0; i < maxData; i += 1) {
    for (const block of blocks) if (i < block.length) interleaved.push(block[i]);
  }
  for (let i = 0; i < ecPerBlock; i += 1) {
    for (const block of ecBlocks) interleaved.push(block[i]);
  }

  // --- Lay out the matrix ---------------------------------------------------
  const matrix: (boolean | null)[][] = Array.from({ length: size }, () =>
    new Array<boolean | null>(size).fill(null),
  );

  /**
   * A 7x7 finder plus its one-module white separator.
   *
   * The pattern is concentric: dark outer ring, white ring, dark 3x3 core.
   * `Math.max(|dr|, |dc|)` from the centre gives the ring index directly,
   * which is both shorter and harder to get wrong than enumerating edges.
   */
  const setFinder = (top: number, left: number) => {
    for (let r = -1; r <= 7; r += 1) {
      for (let c = -1; c <= 7; c += 1) {
        const rr = top + r;
        const cc = left + c;
        if (rr < 0 || rr >= size || cc < 0 || cc >= size) continue;

        // Outside the 7x7 is the separator: always white.
        if (r < 0 || r > 6 || c < 0 || c > 6) {
          matrix[rr][cc] = false;
          continue;
        }

        const ring = Math.max(Math.abs(r - 3), Math.abs(c - 3));
        matrix[rr][cc] = ring !== 2;
      }
    }
  };

  setFinder(0, 0);
  setFinder(0, size - 7);
  setFinder(size - 7, 0);

  // Timing patterns.
  for (let i = 8; i < size - 8; i += 1) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  // Alignment patterns, skipping the ones that collide with finders.
  const centres = ALIGNMENT[ver] ?? [];
  for (const row of centres) {
    for (const col of centres) {
      if ((row === 6 && col === 6) || (row === 6 && col === size - 7) || (row === size - 7 && col === 6)) {
        continue;
      }
      for (let r = -2; r <= 2; r += 1) {
        for (let c = -2; c <= 2; c += 1) {
          matrix[row + r][col + c] = Math.max(Math.abs(r), Math.abs(c)) !== 1;
        }
      }
    }
  }

  // Dark module and reserved format areas.
  matrix[size - 8][8] = true;
  for (let i = 0; i < 9; i += 1) {
    if (matrix[8][i] === null) matrix[8][i] = false;
    if (matrix[i][8] === null) matrix[i][8] = false;
  }
  for (let i = 0; i < 8; i += 1) {
    if (matrix[8][size - 1 - i] === null) matrix[8][size - 1 - i] = false;
    if (matrix[size - 1 - i][8] === null) matrix[size - 1 - i][8] = false;
  }

  // --- Place data, zig-zagging up and down the two-column stripes -----------
  const MASK = 0; // (row + col) % 2 === 0
  let bitIndex = 0;
  let upward = true;

  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col -= 1; // Skip the vertical timing column.

    for (let step = 0; step < size; step += 1) {
      const row = upward ? size - 1 - step : step;
      for (const c of [col, col - 1]) {
        if (matrix[row][c] !== null) continue;

        const byte = interleaved[bitIndex >> 3];
        const bit = byte === undefined ? 0 : (byte >> (7 - (bitIndex & 7))) & 1;
        bitIndex += 1;

        const masked = (row + c) % 2 === MASK ? bit ^ 1 : bit;
        matrix[row][c] = masked === 1;
      }
    }
    upward = !upward;
  }

  // --- Format information ---------------------------------------------------
  const format = FORMAT_BITS[MASK];

  // Both copies, listed f14 (most significant) first.
  const copyOne: [number, number][] = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];
  const copyTwo: [number, number][] = [
    [size - 1, 8], [size - 2, 8], [size - 3, 8], [size - 4, 8],
    [size - 5, 8], [size - 6, 8], [size - 7, 8],
    [8, size - 8], [8, size - 7], [8, size - 6], [8, size - 5],
    [8, size - 4], [8, size - 3], [8, size - 2], [8, size - 1],
  ];

  for (let i = 0; i < 15; i += 1) {
    const bit = ((format >> (14 - i)) & 1) === 1;
    const [r1, c1] = copyOne[i];
    const [r2, c2] = copyTwo[i];
    matrix[r1][c1] = bit;
    matrix[r2][c2] = bit;
  }

  return matrix.map((row) => row.map((cell) => cell === true));
}

/**
 * Renders `value` as a scannable QR code.
 *
 * Falls back to nothing on an over-long payload rather than throwing — a
 * missing code is a degraded page, an exception is a broken one.
 */
export function QrCode({
  value,
  size = 168,
  className,
}: {
  value: string;
  size?: number;
  className?: string;
}) {
  let matrix: boolean[][];
  try {
    matrix = buildMatrix(value);
  } catch {
    return null;
  }

  const modules = matrix.length;
  // Four modules of quiet zone, as the spec requires for reliable scanning.
  const quiet = 4;
  const total = modules + quiet * 2;

  const path = matrix
    .flatMap((row, r) =>
      row.map((on, c) => (on ? `M${c + quiet} ${r + quiet}h1v1h-1z` : '')).filter(Boolean),
    )
    .join('');

  return (
    <svg
      viewBox={`0 0 ${total} ${total}`}
      width={size}
      height={size}
      role="img"
      aria-label={value}
      shapeRendering="crispEdges"
      className={cx('rounded-lg bg-white', className)}
    >
      <rect width={total} height={total} fill="#fff" />
      <path d={path} fill="#0f172a" />
    </svg>
  );
}
