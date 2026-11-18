import type {
  Feature,
  FeatureCollection,
  LineString,
  MultiLineString,
  Point,
  Position,
} from "geojson";
import greatCircle from "@turf/great-circle";
import { GeoJSONSource, LngLatBounds, Map, setWorkerUrl } from "maplibre-gl";
import maplibreWorkerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";

// Vite bundles maplibre-gl away from its worker, so the default
// sibling URL 404s. Point at the worker asset explicitly.
setWorkerUrl(maplibreWorkerUrl);
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
    <h2>Triangle</h2>
    <div id="map" role="region" aria-label="Map of the current triangle"></div>
    <p class="muted">
      The cell’s sides follow great circles. Corners and the centroid are marked;
      encoding also marks the input point.
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

type Probe = { lat: number; lon: number };
type Arc = Feature<LineString | MultiLineString>;

const EMPTY: FeatureCollection = { type: "FeatureCollection", features: [] };

const map = new Map({
  container: "map",
  style: "https://tiles.openfreemap.org/styles/liberty",
  center: [0, 20],
  zoom: 1,
});

let mapReady = false;
let pendingView: { result: DecodeResult; probe?: Probe } | null = null;

function pointFeature(lon: number, lat: number, kind: string): Feature<Point> {
  return {
    type: "Feature",
    properties: { kind },
    geometry: { type: "Point", coordinates: [lon, lat] },
  };
}

function edgeArcs(
  bounds: DecodeResult["bounds"],
): Arc[] {
  const corners: Position[] = bounds.map((c) => [c.lon, c.lat]);
  return [0, 1, 2].map((i) =>
    greatCircle(corners[i]!, corners[(i + 1) % 3]!, { npoints: 128 }),
  );
}

function arcParts(arc: Arc): Position[][] {
  return arc.geometry.type === "LineString"
    ? [arc.geometry.coordinates]
    : arc.geometry.coordinates;
}

/**
 * Frame the cell. Longitudes are shifted toward the centroid so a date-line
 * split stays one box. Samples at the pole are ignored for longitude: that
 * corner's longitude is arbitrary and would stretch the view the wrong way.
 */
function fitToArcs(arcs: Arc[], refLon: number): void {
  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  let count = 0;

  for (const arc of arcs) {
    for (const part of arcParts(arc)) {
      for (const pos of part) {
        const lon = pos[0];
        const lat = pos[1];
        if (lon === undefined || lat === undefined) continue;
        south = Math.min(south, lat);
        north = Math.max(north, lat);
        if (Math.abs(lat) >= 89.9) continue;
        let x = lon;
        while (x - refLon > 180) x -= 360;
        while (refLon - x > 180) x += 360;
        west = Math.min(west, x);
        east = Math.max(east, x);
        count += 1;
      }
    }
  }

  if (count === 0) return;

  // Web Mercator cannot represent the pole. Clamping keeps fitBounds finite.
  const maxLat = 85;
  south = Math.max(-maxLat, south);
  north = Math.min(maxLat, north);
  if (north - south < 0.05) {
    const mid = (north + south) / 2;
    south = mid - 0.05;
    north = mid + 0.05;
  }

  while (west <= -180) {
    west += 360;
    east += 360;
  }
  while (west > 180) {
    west -= 360;
    east -= 360;
  }

  const bounds =
    east > 180
      ? new LngLatBounds([west, south], [east - 360, north]).adjustAntiMeridian()
      : new LngLatBounds([west, south], [east, north]);

  map.fitBounds(bounds, { padding: 40 });
}

function showTriangle(result: DecodeResult, probe?: Probe): void {
  if (!mapReady) {
    pendingView = { result, probe };
    return;
  }

  const arcs = edgeArcs(result.bounds);
  const points: Feature<Point>[] = [
    ...result.bounds.map((c) => pointFeature(c.lon, c.lat, "corner")),
    pointFeature(result.lon, result.lat, "centroid"),
  ];
  if (probe) points.push(pointFeature(probe.lon, probe.lat, "probe"));

  (map.getSource("edges") as GeoJSONSource).setData({
    type: "FeatureCollection",
    features: arcs,
  });
  (map.getSource("points") as GeoJSONSource).setData({
    type: "FeatureCollection",
    features: points,
  });
  fitToArcs(arcs, result.lon);
}

map.on("load", () => {
  map.setProjection({ type: "globe" });
  map.addSource("edges", { type: "geojson", data: EMPTY });
  map.addSource("points", { type: "geojson", data: EMPTY });
  map.addLayer({
    id: "edges",
    type: "line",
    source: "edges",
    paint: {
      "line-color": "#0f6b4c",
      "line-width": 2,
    },
  });
  map.addLayer({
    id: "points",
    type: "circle",
    source: "points",
    paint: {
      "circle-radius": ["match", ["get", "kind"], "centroid", 5, 4],
      "circle-color": [
        "match",
        ["get", "kind"],
        "centroid",
        "#1a1f1c",
        "probe",
        "#8b2e2e",
        "#0f6b4c",
      ],
      "circle-stroke-width": 1,
      "circle-stroke-color": "#fffdf8",
    },
  });
  mapReady = true;
  if (pendingView) {
    const view = pendingView;
    pendingView = null;
    showTriangle(view.result, view.probe);
  }
});

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
  showTriangle(result, probe);
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
