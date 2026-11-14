/**
 * Lightweight Zero-Dependency QR Code Generator
 * Generates ISO/IEC 18004 compliant Version 1 (21x21) and Version 2 (25x25) QR codes
 * optimized for 6-digit numeric check-in codes and short payloads.
 */

// GF(256) Math with primitive polynomial 0x11d (285)
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);

(function initGaloisField() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 256) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    EXP[i] = EXP[i - 255];
  }
})();

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

function rsGeneratorPoly(degree: number): Uint8Array {
  const poly = new Uint8Array(degree + 1);
  poly[0] = 1;
  for (let i = 0; i < degree; i++) {
    const root = EXP[i];
    for (let j = i + 1; j > 0; j--) {
      poly[j] = poly[j] ^ gfMul(poly[j - 1], root);
    }
  }
  return poly;
}

function rsComputeRemainder(data: Uint8Array, ecCount: number): Uint8Array {
  const gen = rsGeneratorPoly(ecCount);
  const remainder = new Uint8Array(ecCount);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ remainder[0];
    for (let j = 0; j < ecCount - 1; j++) {
      remainder[j] = remainder[j + 1] ^ gfMul(gen[j + 1], factor);
    }
    remainder[ecCount - 1] = gfMul(gen[ecCount], factor);
  }
  return remainder;
}

/**
 * Encodes data into QR codewords.
 * Uses Numeric Mode if data is all digits; otherwise Byte Mode.
 */
function encodeData(
  text: string,
  version: 1 | 2,
  dataCodewordCount: number
): Uint8Array {
  const isNumeric = /^\d+$/.test(text);
  const bits: number[] = [];

  const pushBits = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) {
      bits.push((value >> i) & 1);
    }
  };

  if (isNumeric) {
    // Mode indicator: 0001 (Numeric)
    pushBits(0b0001, 4);
    // Character count indicator: 10 bits for v1 & v2 numeric
    pushBits(text.length, 10);

    // Group into 3 digits (10 bits), 2 digits (7 bits), or 1 digit (4 bits)
    let i = 0;
    while (i < text.length) {
      const remaining = text.length - i;
      if (remaining >= 3) {
        const val = parseInt(text.slice(i, i + 3), 10);
        pushBits(val, 10);
        i += 3;
      } else if (remaining === 2) {
        const val = parseInt(text.slice(i, i + 2), 10);
        pushBits(val, 7);
        i += 2;
      } else {
        const val = parseInt(text.slice(i, i + 1), 10);
        pushBits(val, 4);
        i += 1;
      }
    }
  } else {
    // Mode indicator: 0100 (Byte)
    pushBits(0b0100, 4);
    // Character count indicator: 8 bits for v1 & v2 byte
    const utf8 = new TextEncoder().encode(text);
    pushBits(utf8.length, 8);
    for (const b of utf8) {
      pushBits(b, 8);
    }
  }

  // Terminator (up to 4 zero bits)
  const maxBits = dataCodewordCount * 8;
  const terminatorLength = Math.min(4, maxBits - bits.length);
  pushBits(0, terminatorLength);

  // Pad to byte boundary
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  // Pad bytes: alternate 0xEC and 0x11
  const result = new Uint8Array(dataCodewordCount);
  let byteIndex = 0;
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) {
      b = (b << 1) | bits[i + j];
    }
    result[byteIndex++] = b;
  }

  const padBytes = [0xec, 0x11];
  let padToggle = 0;
  while (byteIndex < dataCodewordCount) {
    result[byteIndex++] = padBytes[padToggle];
    padToggle ^= 1;
  }

  return result;
}

/**
 * Builds the 2D QR matrix for Version 1 (21x21) or Version 2 (25x25) with Error Correction Level M.
 */
export function generateQrMatrix(text: string): boolean[][] {
  const isNumeric = /^\d+$/.test(text);
  // Version 1-M holds 34 numeric digits or 14 bytes.
  // Version 2-M holds 61 numeric digits or 26 bytes.
  const version: 1 | 2 =
    (isNumeric && text.length <= 34) || (!isNumeric && text.length <= 14) ? 1 : 2;

  const size = version === 1 ? 21 : 25;
  const dataCodewords = version === 1 ? 16 : 28;
  const ecCodewords = version === 1 ? 10 : 16;

  // Initialize matrix and reserved flags
  const matrix: boolean[][] = Array.from({ length: size }, () =>
    Array(size).fill(false)
  );
  const reserved: boolean[][] = Array.from({ length: size }, () =>
    Array(size).fill(false)
  );

  const setModule = (r: number, c: number, val: boolean) => {
    matrix[r][c] = val;
    reserved[r][c] = true;
  };

  // 1. Finder patterns (7x7) + 1-module separators
  const placeFinder = (row: number, col: number) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const mr = row + r;
        const mc = col + c;
        if (mr >= 0 && mr < size && mc >= 0 && mc < size) {
          if (r >= 0 && r <= 6 && c >= 0 && c <= 6) {
            const isDark =
              r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4);
            setModule(mr, mc, isDark);
          } else {
            setModule(mr, mc, false); // Separator
          }
        }
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // 2. Alignment pattern for Version 2 (at row 18, col 18)
  if (version === 2) {
    const ar = 18;
    const ac = 18;
    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {
        const isDark =
          Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0);
        setModule(ar + r, ac + c, isDark);
      }
    }
  }

  // 3. Timing patterns (alternating along row 6 and col 6)
  for (let i = 8; i < size - 8; i++) {
    if (!reserved[6][i]) setModule(6, i, i % 2 === 0);
    if (!reserved[i][6]) setModule(i, 6, i % 2 === 0);
  }

  // 4. Dark module
  setModule(4 * version + 9, 8, true);

  // 5. Reserve format information areas
  for (let i = 0; i < 9; i++) {
    if (i !== 6) {
      reserved[8][i] = true;
      reserved[i][8] = true;
    }
  }
  for (let i = 0; i < 8; i++) {
    reserved[8][size - 1 - i] = true;
    reserved[size - 1 - i][8] = true;
  }

  // 6. Data Encoding & Reed-Solomon Error Correction
  const dataBytes = encodeData(text, version, dataCodewords);
  const ecBytes = rsComputeRemainder(dataBytes, ecCodewords);

  // Interleave data + ec (for v1 and v2 with 1 block, it's just concatenation)
  const allCodewords = new Uint8Array(dataCodewords + ecCodewords);
  allCodewords.set(dataBytes, 0);
  allCodewords.set(ecBytes, dataCodewords);

  // Flatten codewords to bitstream
  const allBits: number[] = [];
  for (const byte of allCodewords) {
    for (let i = 7; i >= 0; i--) {
      allBits.push((byte >> i) & 1);
    }
  }

  // 7. Place data bits using Mask 0 ((row + col) % 2 === 0)
  let bitIndex = 0;
  let upwards = true;

  for (let right = size - 1; right > 0; right -= 2) {
    if (right === 6) right--; // Skip vertical timing column

    const rows = upwards
      ? Array.from({ length: size }, (_, i) => size - 1 - i)
      : Array.from({ length: size }, (_, i) => i);

    for (const r of rows) {
      for (const c of [right, right - 1]) {
        if (!reserved[r][c]) {
          const bit = bitIndex < allBits.length ? allBits[bitIndex++] : 0;
          // Apply Mask 0: invert if (r + c) % 2 === 0
          const mask = (r + c) % 2 === 0;
          matrix[r][c] = (bit ^ (mask ? 1 : 0)) === 1;
        }
      }
    }
    upwards = !upwards;
  }

  // 8. Place Format Information (EC Level M: 00, Mask 0: 000 -> 0x5412)
  // Format 15-bit value for Level M (00) and Mask 0 (000) with XOR mask 0x5412 = 0x5412
  const formatBits = 0x5412;

  // Format bits around top-left finder
  const formatPosTopLeft = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5],
    [8, 7], [8, 8], [7, 8],
    [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8],
  ];

  for (let i = 0; i < 15; i++) {
    const bit = ((formatBits >> (14 - i)) & 1) === 1;
    const [r, c] = formatPosTopLeft[i];
    matrix[r][c] = bit;
  }

  // Format bits around bottom-left & top-right finders
  for (let i = 0; i < 7; i++) {
    const bit = ((formatBits >> i) & 1) === 1;
    matrix[size - 1 - i][8] = bit;
  }
  for (let i = 0; i < 8; i++) {
    const bit = ((formatBits >> (7 + i)) & 1) === 1;
    matrix[8][size - 8 + i] = bit;
  }

  return matrix;
}

/**
 * Generates clean standalone SVG markup for a QR code.
 */
export function generateQrSvg(
  text: string,
  options?: {
    size?: number;
    quietZone?: number;
    darkColor?: string;
    lightColor?: string;
  }
): string {
  const matrix = generateQrMatrix(text);
  const matrixSize = matrix.length;
  const quietZone = options?.quietZone ?? 2;
  const totalSize = matrixSize + quietZone * 2;
  const displaySize = options?.size ?? 180;
  const darkColor = options?.darkColor ?? '#0f172a';
  const lightColor = options?.lightColor ?? '#ffffff';

  let pathData = '';
  for (let r = 0; r < matrixSize; r++) {
    for (let c = 0; c < matrixSize; c++) {
      if (matrix[r][c]) {
        const x = c + quietZone;
        const y = r + quietZone;
        pathData += `M${x},${y}h1v1h-1z `;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalSize} ${totalSize}" width="${displaySize}" height="${displaySize}" shape-rendering="crispEdges">
    <rect width="${totalSize}" height="${totalSize}" fill="${lightColor}" />
    <path d="${pathData.trim()}" fill="${darkColor}" />
  </svg>`;
}
