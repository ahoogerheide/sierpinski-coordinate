# Sierpinski Coordinate

TypeScript library + browser demo that encodes latitude/longitude into a variable-length binary string by recursively subdividing spherical triangles.

## Layout

- **4-bit header**: bit 0 always `0`; bits 1–3 = octant
- **2 bits per level**: child index `00`–`11`
- Bit length = `4 + 2*levels`

## Structure

```
src/                      # library (encode / decode)
examples/browser-demo/    # Vite demo UI
```

## Commands

```bash
npm install
npm test
npm run dev      # demo at http://127.0.0.1:5173/
npm run build
```

Library entry: [`src/index.ts`](./src/index.ts) (`encode`, `decode`, helpers).
