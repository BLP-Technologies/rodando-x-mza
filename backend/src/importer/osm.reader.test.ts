import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readOsm, parseOsm } from './osm.reader.js';

const FIXTURE = fileURLToPath(new URL('./fixtures/two-blocks.osm', import.meta.url));

describe('parseOsm', () => {
  it('lee nodos y vías del extracto', async () => {
    const extract = await readOsm(FIXTURE);

    expect(extract.nodes.size).toBe(33);
    expect(extract.ways).toHaveLength(16);
    expect(extract.nodes.get(2)).toEqual({ id: 2, lon: -68.846, lat: -32.888 });
  });

  it('conserva el orden de los nodos y todos los tags de una vía', async () => {
    const extract = await readOsm(FIXTURE);
    const way = extract.ways.find((candidate) => candidate.id === 105);

    expect(way?.nodeIds).toEqual([6, 7, 8, 9]);
    expect(way?.tags.get('highway')).toBe('primary');
    expect(way?.tags.get('lanes')).toBe('4');
    expect(way?.tags.get('name')).toBe('Avenida Ancha');
  });

  it('tolera el nodo que Overpass repite sin tags en el segundo pase', () => {
    const xml = [
      '<osm>',
      '  <node id="1" lat="-32.8" lon="-68.8">',
      '    <tag k="highway" v="crossing"/>',
      '  </node>',
      '  <node id="2" lat="-32.9" lon="-68.9"/>',
      '  <node id="1" lat="-32.8" lon="-68.8"/>',
      '  <way id="10">',
      '    <nd ref="1"/>',
      '    <nd ref="2"/>',
      '  </way>',
      '</osm>',
    ].join('\n');

    const extract = parseOsm(xml);

    expect(extract.nodes.size).toBe(2);
    expect(extract.ways[0]?.nodeIds).toEqual([1, 2]);
  });

  it('falla si el archivo no trae un elemento por línea', () => {
    const xml = [
      '<osm>',
      '  <node id="1" lat="-32.8" lon="-68.8"/><node id="2" lat="-32.9" lon="-68.9"/>',
      '  <way id="10"><nd ref="1"/><nd ref="2"/></way>',
      '</osm>',
    ].join('\n');

    // Dos `<node` en una línea: uno solo se lee, la forma no es la esperada.
    expect(() => parseOsm(xml)).toThrow(/parse mismatch/);
  });

  it('falla con un nodo sin coordenadas', () => {
    const xml = ['<osm>', '  <node id="1" lat="-32.8"/>', '</osm>'].join('\n');

    expect(() => parseOsm(xml)).toThrow(/missing or non-numeric "lon"/);
  });

  it('falla si no hay ninguna vía', () => {
    const xml = ['<osm>', '  <node id="1" lat="-32.8" lon="-68.8"/>', '</osm>'].join('\n');

    expect(() => parseOsm(xml)).toThrow(/has no <way>/);
  });

  it('dice cómo generar el extracto cuando el archivo no existe', async () => {
    await expect(readOsm('/no/existe.osm')).rejects.toThrow(
      /fetch-pilot-zone-osm\.mjs/,
    );
  });
});
