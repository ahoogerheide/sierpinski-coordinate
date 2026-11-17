import "./style.css";
import {
  HEADER_WIDTH,
  OCTANT_WIDTH,
  decode,
  encode,
  formatCoordinate,
  parseCoordinate,
  toBitString,
  type DecodeResult,
} from "../../src/index.ts";

const app = document.querySelector<HTMLDivElement>("#app")!;

app.innerHTML = `
  <header>
    <h1>Sierpinski Coordinate</h1>
    <p>
      Encode latitude/longitude into a variable-length binary string by
      recursively quartering spherical triangles. Header is
      <code>0</code> + 3-bit octant, then 2 bits per level.
    </p>
  </header>

  <div class="grid">
    <section>
      <h2>Encode</h2>
      <div class="row">
        <div>
          <label for="lat">Latitude (°)</label>
          <input id="lat" type="number" step="any" value="45" />
        </div>
        <div>
          <label for="lon">Longitude (°)</label>
          <input id="lon" type="number" step="any" value="45" />
        </div>
        <div>
          <label for="levels">Levels</label>
          <input id="levels" type="number" min="0" max="24" step="1" value="6" />
        </div>
      </div>
      <button type="button" id="btn-encode">Encode</button>
      <p class="muted" id="encode-error" hidden></p>
      <p class="muted" style="margin-top:0.85rem">Bit string</p>
      <div class="out" id="encode-out" aria-live="polite"></div>
    </section>

    <section>
      <h2>Decode</h2>
      <div class="row-2">
        <div>
          <label for="bits">Bit string</label>
          <textarea id="bits" spellcheck="false" placeholder="0000…"></textarea>
        </div>
        <button type="button" id="btn-decode">Decode</button>
      </div>
      <p class="muted" id="decode-error" hidden></p>
      <div class="meta" id="decode-meta"></div>
    </section>
  </div>

  <section class="sketch-wrap">
    <h2>Triangle sketch</h2>
    <canvas id="sketch" width="900" height="420" aria-label="Equirectangular sketch of current triangle"></canvas>
    <p class="muted">
      Equirectangular preview of the decoded cell (corners + centroid).
      Great-circle sides are drawn as straight chords in lon/lat — approximate near poles.
    </p>
  </section>
`;

const latInput = document.querySelector<HTMLInputElement>("#lat")!;
const lonInput = document.querySelector<HTMLInputElement>("#lon")!;
const levelsInput = document.querySelector<HTMLInputElement>("#levels")!;
const encodeOut = document.querySelector<HTMLDivElement>("#encode-out")!;
const encodeError = document.querySelector<HTMLParagraphElement>("#encode-error")!;
const bitsInput = document.querySelector<HTMLTextAreaElement>("#bits")!;
const decodeError = document.querySelector<HTMLParagraphElement>("#decode-error")!;
const decodeMeta = document.querySelector<HTMLDivElement>("#decode-meta")!;
const canvas = document.querySelector<HTMLCanvasElement>("#sketch")!;
const ctx = canvas.getContext("2d")!;

function showError(el: HTMLElement, message: string | null): void {
  if (!message) {
    el.hidden = true;
    el.textContent = "";
    return;
  }
  el.hidden = false;
  el.textContent = message;
  el.className = "error";
}

function formatCoord(n: number): string {
  return n.toFixed(6);
}

function project(lat: number, lon: number): { x: number; y: number } {
  const pad = 24;
  const w = canvas.width - pad * 2;
  const h = canvas.height - pad * 2;
  const x = pad + ((lon + 180) / 360) * w;
  const y = pad + ((90 - lat) / 180) * h;
  return { x, y };
}

function drawSketch(result: DecodeResult | null, probe?: { lat: number; lon: number }): void {
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  // Grid
  ctx.strokeStyle = "#ddd4c4";
  ctx.lineWidth = 1;
  for (let lon = -180; lon <= 180; lon += 30) {
    const { x } = project(0, lon);
    ctx.beginPath();
    ctx.moveTo(x, 12);
    ctx.lineTo(x, h - 12);
    ctx.stroke();
  }
  for (let lat = -90; lat <= 90; lat += 30) {
    const { y } = project(lat, 0);
    ctx.beginPath();
    ctx.moveTo(12, y);
    ctx.lineTo(w - 12, y);
    ctx.stroke();
  }

  // Equator / prime meridian
  ctx.strokeStyle = "#b7aa94";
  ctx.beginPath();
  const eq = project(0, 0);
  ctx.moveTo(12, eq.y);
  ctx.lineTo(w - 12, eq.y);
  ctx.moveTo(eq.x, 12);
  ctx.lineTo(eq.x, h - 12);
  ctx.stroke();

  if (!result) return;

  const corners = result.bounds.map((c) => project(c.lat, c.lon));
  const cen = project(result.lat, result.lon);

  ctx.fillStyle = "rgba(15, 107, 76, 0.18)";
  ctx.strokeStyle = "#0f6b4c";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(corners[0]!.x, corners[0]!.y);
  for (let i = 1; i < corners.length; i++) {
    ctx.lineTo(corners[i]!.x, corners[i]!.y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  for (const c of corners) {
    ctx.fillStyle = "#0f6b4c";
    ctx.beginPath();
    ctx.arc(c.x, c.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.fillStyle = "#1a1f1c";
  ctx.beginPath();
  ctx.arc(cen.x, cen.y, 5, 0, Math.PI * 2);
  ctx.fill();

  if (probe) {
    const p = project(probe.lat, probe.lon);
    ctx.fillStyle = "#8b2e2e";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function runEncode(): void {
  try {
    const lat = Number(latInput.value);
    const lon = Number(lonInput.value);
    const levels = Number(levelsInput.value);
    const coordinate = encode(lat, lon, levels);
    const bits = formatCoordinate(coordinate, levels);
    encodeOut.textContent = bits;
    bitsInput.value = bits;
    showError(encodeError, null);
    const result = decode(coordinate, levels);
    renderDecode(result, { lat, lon });
  } catch (err) {
    showError(encodeError, err instanceof Error ? err.message : String(err));
  }
}

function renderDecode(
  result: DecodeResult,
  probe?: { lat: number; lon: number },
): void {
  decodeMeta.innerHTML = `
    <span><strong>lat</strong> ${formatCoord(result.lat)}°</span>
    <span><strong>lon</strong> ${formatCoord(result.lon)}°</span>
    <span><strong>levels</strong> ${result.levels}</span>
    <span><strong>header</strong> ${toBitString(result.header, HEADER_WIDTH)}</span>
    <span><strong>octant</strong> ${toBitString(result.octant, OCTANT_WIDTH)}</span>
  `;
  drawSketch(result, probe);
}

function runDecode(): void {
  try {
    const bits = bitsInput.value.trim().replace(/\s+/g, "");
    const { coordinate, levels } = parseCoordinate(bits);
    const result = decode(coordinate, levels);
    showError(decodeError, null);
    encodeOut.textContent = bits;
    renderDecode(result);
  } catch (err) {
    showError(decodeError, err instanceof Error ? err.message : String(err));
  }
}

document.querySelector("#btn-encode")!.addEventListener("click", runEncode);
document.querySelector("#btn-decode")!.addEventListener("click", runDecode);

for (const el of [latInput, lonInput, levelsInput]) {
  el.addEventListener("keydown", (e) => {
    if (e.key === "Enter") runEncode();
  });
}

runEncode();
