import { readFile } from 'node:fs/promises';

/** Un nodo del extracto. Solo interesan las coordenadas: sus tags no se leen. */
export type OsmNode = { id: number; lon: number; lat: number };

/** Una vía del extracto, con sus nodos en orden y todos sus tags. */
export type OsmWay = {
  id: number;
  nodeIds: readonly number[];
  tags: ReadonlyMap<string, string>;
};

export type OsmExtract = {
  nodes: ReadonlyMap<number, OsmNode>;
  ways: readonly OsmWay[];
};

const ATTRIBUTE = /(\w+)="([^"]*)"/g;

function parseAttributes(text: string): Map<string, string> {
  const attributes = new Map<string, string>();

  for (const match of text.matchAll(ATTRIBUTE)) {
    const key = match[1];
    const value = match[2];
    if (key !== undefined && value !== undefined) attributes.set(key, value);
  }

  return attributes;
}

function numeric(attributes: Map<string, string>, key: string, line: string): number {
  const raw = attributes.get(key);
  const value = raw === undefined ? Number.NaN : Number(raw);

  if (!Number.isFinite(value)) {
    throw new Error(`Invalid OSM element, missing or non-numeric "${key}": ${line}`);
  }

  return value;
}

/**
 * Lee un `.osm` (XML de Overpass) y devuelve sus nodos y vías.
 *
 * No es un parser de XML general: el extracto es salida de máquina de Overpass
 * (`out body; >; out skel qt;`), un elemento por línea, y así se lee. La forma se
 * verifica contra el archivo: si la cantidad de `<node>` no coincide con la de nodos
 * leídos, se falla en vez de devolver un grafo incompleto y silencioso.
 *
 * Un nodo puede aparecer dos veces en el archivo: Overpass lo emite con sus tags en el
 * primer `out` y otra vez sin tags en el `skel`, y las coordenadas son las mismas. Por
 * eso se cuentan los elementos leídos y no los ids distintos.
 */
export function parseOsm(xml: string): OsmExtract {
  const nodes = new Map<number, OsmNode>();
  const ways: OsmWay[] = [];
  let nodeElements = 0;
  let current: { id: number; nodeIds: number[]; tags: Map<string, string> } | undefined;

  for (const line of xml.split('\n')) {
    const text = line.trim();

    if (text.startsWith('<node')) {
      nodeElements += 1;
      const attributes = parseAttributes(text);
      const id = numeric(attributes, 'id', text);
      nodes.set(id, {
        id,
        lon: numeric(attributes, 'lon', text),
        lat: numeric(attributes, 'lat', text),
      });
      continue;
    }

    if (text.startsWith('<way')) {
      const attributes = parseAttributes(text);
      current = { id: numeric(attributes, 'id', text), nodeIds: [], tags: new Map() };
      continue;
    }

    // Fuera de una vía no hay nada que leer: los tags de un nodo son accesibilidad,
    // que no viene de OpenStreetMap (docs/12 §2).
    if (current === undefined) continue;

    if (text.startsWith('<nd')) {
      current.nodeIds.push(numeric(parseAttributes(text), 'ref', text));
      continue;
    }

    if (text.startsWith('<tag')) {
      const attributes = parseAttributes(text);
      const key = attributes.get('k');
      const value = attributes.get('v');
      if (key !== undefined && value !== undefined) current.tags.set(key, value);
      continue;
    }

    if (text.startsWith('</way')) {
      ways.push({ id: current.id, nodeIds: current.nodeIds, tags: current.tags });
      current = undefined;
    }
  }

  const declared = xml.match(/<node\b/g)?.length ?? 0;
  if (declared !== nodeElements) {
    throw new Error(
      `OSM parse mismatch: ${declared} <node> in the file, ${nodeElements} parsed. The extract format probably changed.`,
    );
  }

  if (ways.length === 0) {
    throw new Error('OSM extract has no <way>: is this really an Overpass response?');
  }

  return { nodes, ways };
}

export async function readOsm(filePath: string): Promise<OsmExtract> {
  let xml: string;

  try {
    xml = await readFile(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(
        `OSM extract not found: ${filePath}. Generate it with \`node scripts/fetch-pilot-zone-osm.mjs\``,
      );
    }
    throw error;
  }

  return parseOsm(xml);
}
