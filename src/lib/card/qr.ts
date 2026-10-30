import QRCode from "qrcode";
import jsQR from "jsqr";
import type { QrErrorLevel } from "./types";

export interface QrMatrix {
  /** Number of data modules per side (without quiet zone). */
  size: number;
  /** Row-major, true = dark module. */
  modules: boolean[];
  version: number;
}

export function createQrMatrix(text: string, errorCorrectionLevel: QrErrorLevel): QrMatrix {
  const qr = QRCode.create(text, { errorCorrectionLevel });
  const size = qr.modules.size;
  const modules: boolean[] = new Array(size * size);
  for (let i = 0; i < size * size; i++) modules[i] = qr.modules.data[i] === 1;
  return { size, modules, version: qr.version };
}

/**
 * A single SVG path covering all dark modules, in module units with the quiet zone
 * included as an offset. Horizontal runs are merged so the path stays compact and the
 * PDF output is pure vector rectangles without hairline seams.
 */
export function qrPath(matrix: QrMatrix, quietZone: number): string {
  const { size, modules } = matrix;
  let d = "";
  for (let y = 0; y < size; y++) {
    let x = 0;
    while (x < size) {
      if (!modules[y * size + x]) {
        x++;
        continue;
      }
      const start = x;
      while (x < size && modules[y * size + x]) x++;
      d += `M${start + quietZone} ${y + quietZone}h${x - start}v1h${start - x}z`;
    }
  }
  return d;
}

/** Render the matrix at an integer scale and decode it back with jsQR. */
export function verifyQrMatrix(matrix: QrMatrix, expected: string, quietZone = 4): boolean {
  const scale = 6;
  const dim = (matrix.size + quietZone * 2) * scale;
  const data = new Uint8ClampedArray(dim * dim * 4).fill(255);
  for (let y = 0; y < matrix.size; y++) {
    for (let x = 0; x < matrix.size; x++) {
      if (!matrix.modules[y * matrix.size + x]) continue;
      for (let dy = 0; dy < scale; dy++) {
        const row = (y + quietZone) * scale + dy;
        for (let dx = 0; dx < scale; dx++) {
          const i = (row * dim + (x + quietZone) * scale + dx) * 4;
          data[i] = data[i + 1] = data[i + 2] = 0;
        }
      }
    }
  }
  return decodeQr(data, dim, dim) === expected;
}

export function decodeQr(data: Uint8ClampedArray, width: number, height: number): string | null {
  const result = jsQR(data, width, height, { inversionAttempts: "dontInvert" });
  return result ? result.data : null;
}
