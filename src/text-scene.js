import { sceneSchema } from './schema.js';

// Five-column bitmap glyphs. Geometry stays data-only and uses the normal scene contract.
const font = {
  A: '01110 10001 10001 11111 10001 10001 10001',
  B: '11110 10001 10001 11110 10001 10001 11110',
  C: '01111 10000 10000 10000 10000 10000 01111',
  D: '11110 10001 10001 10001 10001 10001 11110',
  E: '11111 10000 10000 11110 10000 10000 11111',
  F: '11111 10000 10000 11110 10000 10000 10000',
  G: '01111 10000 10000 10111 10001 10001 01111',
  H: '10001 10001 10001 11111 10001 10001 10001',
  I: '11111 00100 00100 00100 00100 00100 11111',
  J: '00111 00010 00010 00010 10010 10010 01100',
  K: '10001 10010 10100 11000 10100 10010 10001',
  L: '10000 10000 10000 10000 10000 10000 11111',
  M: '10001 11011 10101 10101 10001 10001 10001',
  N: '10001 11001 10101 10011 10001 10001 10001',
  O: '01110 10001 10001 10001 10001 10001 01110',
  P: '11110 10001 10001 11110 10000 10000 10000',
  Q: '01110 10001 10001 10001 10101 10010 01101',
  R: '11110 10001 10001 11110 10100 10010 10001',
  S: '01111 10000 10000 01110 00001 00001 11110',
  T: '11111 00100 00100 00100 00100 00100 00100',
  U: '10001 10001 10001 10001 10001 10001 01110',
  V: '10001 10001 10001 10001 10001 01010 00100',
  W: '10001 10001 10001 10101 10101 10101 01010',
  X: '10001 10001 01010 00100 01010 10001 10001',
  Y: '10001 10001 01010 00100 00100 00100 00100',
  Z: '11111 00001 00010 00100 01000 10000 11111',
  0: '01110 10001 10011 10101 11001 10001 01110',
  1: '00100 01100 00100 00100 00100 00100 01110',
  2: '01110 10001 00001 00010 00100 01000 11111',
  3: '11110 00001 00001 01110 00001 00001 11110',
  4: '00010 00110 01010 10010 11111 00010 00010',
  5: '11111 10000 10000 11110 00001 00001 11110',
  6: '01110 10000 10000 11110 10001 10001 01110',
  7: '11111 00001 00010 00100 01000 01000 01000',
  8: '01110 10001 10001 01110 10001 10001 01110',
  9: '01110 10001 10001 01111 00001 00001 01110',
  '-': '00000 00000 00000 11111 00000 00000 00000',
  '.': '00000 00000 00000 00000 00000 00110 00110',
  '?': '01110 10001 00001 00010 00100 00000 00100',
  '!': '00100 00100 00100 00100 00100 00000 00100',
};

export function textScene(input) {
  const text = input.toUpperCase().trim();
  if (!text || text.length > 144) throw new Error('Text requires 1–144 characters.');
  const rows = [];
  for (const line of text.split('\n')) {
    const count = Math.max(1, Math.ceil(line.length / 8));
    const width = Math.floor(line.length / count);
    let offset = 0;
    for (let row = 0; row < count; row++) {
      const length = width + (row < line.length % count ? 1 : 0);
      rows.push(line.slice(offset, offset + length));
      offset += length;
    }
  }
  if (rows.length > 12) throw new Error('Text must fit in 12 rows of up to 8 characters.');
  const colors = ['#70e0ed', '#a8a4ff', '#f6bc76', '#a4efbc'];
  const objects = rows.flatMap((row, r) => {
    const points = [];
    [...row].forEach((letter, i) => {
      if (letter === ' ') return;
      if (!font[letter])
        throw new Error(
          `Unsupported text character: ${letter}. Use A–Z, 0–9, spaces, newlines, or - . ? !`,
        );
      font[letter].split(' ').forEach((line, y) =>
        [...line].forEach((bit, x) => {
          if (bit === '1')
            for (let dx = 0; dx < 3; dx++)
              for (let dy = 0; dy < 3; dy++)
                for (let dz = 0; dz < 2; dz++)
                  points.push([
                    +(i * 2.65 + x * 0.36 + dx * 0.095 - (row.length - 1) * 1.325 - 0.815).toFixed(
                      3,
                    ),
                    +(1.175 - y * 0.36 - dy * 0.095).toFixed(3),
                    dz * 0.1 - 0.05,
                  ]);
        }),
      );
    });
    return points.length
      ? [
          {
            id: `text-row-${r}`,
            shape: 'pointcloud',
            label: row,
            show_label: false,
            description: row,
            position: [0, ((rows.length - 1) / 2 - r) * 2.21, 0],
            scale: 0.65,
            color: colors[r % colors.length],
            points,
          },
        ]
      : [];
  });
  return sceneSchema.parse({
    title: 'Particle text',
    explanation: `${text}\n\nDrag to rotate, scroll to zoom, or use Fit scene to see the full text. Lowercase letters are rendered in uppercase.`,
    objects,
    connections: [],
    camera: { view: 'front' },
    assembly: { mode: 'morph', duration: 1.6 },
  });
}
