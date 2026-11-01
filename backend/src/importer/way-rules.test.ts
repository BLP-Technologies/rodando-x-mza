import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { readOsm, type OsmExtract, type OsmWay } from './osm.reader.js';
import { detectBoulevards, sidewalkOffset } from './way-rules.js';

const FIXTURE = fileURLToPath(new URL('./fixtures/two-blocks.osm', import.meta.url));

let extract: OsmExtract;

beforeAll(async () => {
  extract = await readOsm(FIXTURE);
});

/** Una vía suelta con los tags que le pasemos: alcanza para probar la tabla de offsets. */
const way = (tags: Record<string, string>): OsmWay => ({
  id: 1,
  nodeIds: [1, 2],
  tags: new Map(Object.entries(tags)),
});

describe('sidewalkOffset', () => {
  it('sale de la clase de la vía', () => {
    expect(sidewalkOffset(way({ highway: 'primary' }))).toBe(10);
    expect(sidewalkOffset(way({ highway: 'secondary' }))).toBe(8.5);
    expect(sidewalkOffset(way({ highway: 'tertiary' }))).toBe(7.5);
    expect(sidewalkOffset(way({ highway: 'residential' }))).toBe(6.5);
    expect(sidewalkOffset(way({ highway: 'unclassified' }))).toBe(6.5);
    expect(sidewalkOffset(way({ highway: 'living_street' }))).toBe(6.5);
  });

  it('deja que lanes gane sobre la clase', () => {
    // 4 × 3 m / 2 + 1,5 m: media calzada más el cordón, no el ancho de la clase.
    expect(sidewalkOffset(way({ highway: 'residential', lanes: '4' }))).toBe(7.5);
    expect(sidewalkOffset(way({ highway: 'primary', lanes: '2' }))).toBe(4.5);
  });

  it('ignora un lanes que no es un número', () => {
    expect(sidewalkOffset(way({ highway: 'tertiary', lanes: '1;2' }))).toBe(7.5);
  });

  it('una peatonal no tiene offset: se camina en todo el ancho (docs/11 §3.5)', () => {
    expect(sidewalkOffset(way({ highway: 'pedestrian' }))).toBe(0);
  });

  it('falla si la clase no tiene offset: esa vía no debía llegar acá', () => {
    expect(() => sidewalkOffset(way({ highway: 'service' }))).toThrow(/highway=service/);
  });
});

describe('detectBoulevards', () => {
  it('detecta las dos calzadas opuestas del fixture', () => {
    const { boulevards, excludedWayIds } = detectBoulevards(
      extract.ways,
      extract.nodes,
    );

    expect(boulevards).toHaveLength(1);
    expect(boulevards[0]?.name).toBe('Avenida Doble');
    expect([...(boulevards[0]?.wayIds ?? [])].sort()).toEqual([108, 109]);
    // Las calzadas están a 0,00016 de longitud, unos 15 m en esta latitud.
    expect(boulevards[0]?.distanceM).toBeCloseTo(15, -0.5);
    expect([...excludedWayIds].sort()).toEqual([108, 109]);
  });

  it('no detecta una calle común: no es mano única', () => {
    const { excludedWayIds } = detectBoulevards(extract.ways, extract.nodes);

    expect(excludedWayIds.has(101)).toBe(false);
  });
});
