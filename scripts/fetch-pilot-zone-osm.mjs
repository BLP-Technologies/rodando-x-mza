#!/usr/bin/env node
/**
 * Descarga el extracto de OpenStreetMap de la zona piloto.
 *
 * Lee data/pilot-zone.geojson, le suma un bufer (una cuadra por defecto) y pide
 * por Overpass todas las vias, las areas de esparcimiento y los nodos peatonales
 * de interes. Escribe data/pilot-zone.osm (XML) y verifica que el archivo tenga
 * lo que la zona necesita: las cuatro calles del perimetro y las cinco plazas.
 *
 * El extracto no se versiona (ver data/README.md): se regenera con
 *   node scripts/fetch-pilot-zone-osm.mjs
 * Los datos son de OpenStreetMap, bajo ODbL.
 */

import { createHash } from "node:crypto";
import { readFile, writeFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const zonePath = join(rootDir, "data", "pilot-zone.geojson");
const outPath = join(rootDir, "data", "pilot-zone.osm");

const BUFFER_M = 130; // una cuadra: trae las veredas del perimetro y nodos completos
const ENDPOINT = process.env.OVERPASS_URL ?? "https://overpass-api.de/api/interpreter";
const ATTEMPTS = 5;
// Lo que tiene que aparecer en el archivo para que la descarga cuente como buena.
const REQUIRED_STREETS = ["Mariano Necochea", "San Lorenzo", "Perú", "9 de Julio"];
const REQUIRED_SQUARES = ["Plaza Chile", "Plaza San Martín", "Plaza Italia", "Plaza España", "Plaza Independencia"];

const metersPerDegreeLat = 111_320;
const metersPerDegreeLon = (lat) => 111_320 * Math.cos((lat * Math.PI) / 180);

function bboxConBuffer(coords, bufferM) {
  const lats = coords.map(([, lat]) => lat);
  const lons = coords.map(([lon]) => lon);
  const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
  const dLat = bufferM / metersPerDegreeLat;
  const dLon = bufferM / metersPerDegreeLon(midLat);
  return {
    south: Math.min(...lats) - dLat,
    north: Math.max(...lats) + dLat,
    west: Math.min(...lons) - dLon,
    east: Math.max(...lons) + dLon,
  };
}

function buildQuery({ south, west, north, east }) {
  const box = `${south.toFixed(6)},${west.toFixed(6)},${north.toFixed(6)},${east.toFixed(6)}`;
  // out body + '>' trae los nodos de cada via; out geom los recortaria en el borde
  // y dejaria tramos sin nodo de interseccion.
  return `[out:xml][timeout:180];
(
  way["highway"](${box});
  way["leisure"](${box});
  node["kerb"](${box});
  node["highway"="crossing"](${box});
  node["barrier"](${box});
);
out body;
>;
out skel qt;`;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function download(query) {
  let lastError = "";
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": "rodando-x-mza/0.1 (extracto de la zona piloto)",
        },
        body: new URLSearchParams({ data: query }),
      });
      if (response.ok) return await response.text();
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error.message;
    }
    // Overpass devuelve 502 y 504 con frecuencia cuando esta cargado.
    if (attempt < ATTEMPTS) {
      const wait = attempt * 5000;
      console.warn(`  intento ${attempt} fallo (${lastError}), reintento en ${wait / 1000} s`);
      await sleep(wait);
    }
  }
  throw new Error(`Overpass no respondio despues de ${ATTEMPTS} intentos: ${lastError}`);
}

function inventory(xml) {
  const ways = xml.match(/<way\b[^>]*>.*?<\/way>/gs) ?? [];
  const nodes = (xml.match(/<node\b/g) ?? []).length;
  const highway = new Map();
  const sidewalkTags = new Map();
  const leisureNames = [];
  const names = new Set();
  let kerbNodes = 0;
  let crossingNodes = 0;

  for (const way of ways) {
    const tags = new Map([...way.matchAll(/<tag k="([^"]*)" v="([^"]*)"\/>/g)].map((m) => [m[1], m[2]]));
    const name = tags.get("name");
    if (name) names.add(name);
    const hw = tags.get("highway");
    if (hw) highway.set(hw, (highway.get(hw) ?? 0) + 1);
    for (const [key, value] of tags) {
      if (key.startsWith("sidewalk")) sidewalkTags.set(`${key}=${value}`, (sidewalkTags.get(`${key}=${value}`) ?? 0) + 1);
    }
    if (tags.has("leisure") && name) leisureNames.push(name);
  }
  for (const node of xml.matchAll(/<node\b[^>]*>(.*?)<\/node>/gs)) {
    const tags = node[1];
    if (/k="kerb"/.test(tags)) kerbNodes += 1;
    if (/k="highway" v="crossing"/.test(tags)) crossingNodes += 1;
  }
  return { ways: ways.length, nodes, highway, sidewalkTags, leisureNames, names, kerbNodes, crossingNodes };
}

const sorted = (map) => [...map.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v}`).join(" | ");

async function main() {
  const zone = JSON.parse(await readFile(zonePath, "utf8"));
  const box = bboxConBuffer(zone.geometry.coordinates[0], BUFFER_M);
  console.log(`Zona: ${zone.properties.name_es}`);
  console.log(`Bbox con ${BUFFER_M} m de bufer: ${box.south.toFixed(6)},${box.west.toFixed(6)},${box.north.toFixed(6)},${box.east.toFixed(6)}`);
  console.log(`Fuente: ${ENDPOINT}`);

  const xml = await download(buildQuery(box));
  if (!xml.includes("<osm")) throw new Error("la respuesta no es un archivo OSM");
  await writeFile(outPath, xml);

  const info = inventory(xml);
  const bytes = (await stat(outPath)).size;
  const hash = createHash("sha256").update(xml).digest("hex").slice(0, 16);

  console.log(`\nEscrito ${outPath} (${(bytes / 1024).toFixed(0)} KB, sha256 ${hash}…)`);
  console.log(`  ways ${info.ways} · nodos ${info.nodes} · nodos con kerb ${info.kerbNodes} · nodos con highway=crossing ${info.crossingNodes}`);
  console.log(`  highway: ${sorted(info.highway)}`);
  if (info.sidewalkTags.size) console.log(`  tags sidewalk: ${sorted(info.sidewalkTags)}`);
  console.log(`  areas de esparcimiento: ${info.leisureNames.sort().join(", ") || "ninguna"}`);

  const missing = [...REQUIRED_STREETS, ...REQUIRED_SQUARES].filter((name) => !info.names.has(name));
  if (missing.length) {
    throw new Error(`el extracto no trae: ${missing.join(", ")}. Revisar el bbox o los nombres en OSM.`);
  }
  console.log("\nProcedencia para data/README.md:");
  console.log(`  ${new Date().toISOString().slice(0, 10)} · ${ENDPOINT} · ${info.ways} ways, ${info.nodes} nodos · sha256 ${hash}`);
}

main().catch((error) => {
  console.error(`Error: ${error.message}`);
  process.exit(1);
});
