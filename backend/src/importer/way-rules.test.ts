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

  it('falla si la clase no tiene offset: esa vía no debía llegar acá', () => {
    expect(() => sidewalkOffset(way({ highway: 'service' }))).toThrow(/highway=service/);
  });
});

describe('detectBoulevards', () => {
  it('detecta las dos calzadas opuestas del fixture y las agrupa en un boulevard', () => {
    const { pairs, groups, boulevardWayIds } = detectBoulevards(extract.ways, extract.nodes);

    expect(pairs).toHaveLength(1);
    expect(pairs[0]?.name).toBe('Avenida Doble');
    expect(groups).toHaveLength(1);
    // Un par no es una avenida: la unidad de derivación es el grupo, que es la cadena de
    // pares y lleva una sola mediana (docs/11 §3.6).
    expect(groups[0]?.name).toBe('Avenida Doble');
    expect([...(groups[0]?.wayIds ?? [])].sort()).toEqual([108, 109]);
    expect(groups[0]?.sides.map((side) => [...side].sort())).toEqual([[108], [109]]);
    // Las calzadas están a 0,00016 de longitud, unos 15 m en esta latitud.
    expect(groups[0]?.distanceRangeM.min).toBeCloseTo(15, -0.5);
    expect([...boulevardWayIds].sort()).toEqual([108, 109]);
  });

  it('no detecta una calle común: no es mano única', () => {
    const { boulevardWayIds } = detectBoulevards(extract.ways, extract.nodes);

    expect(boulevardWayIds.has(101)).toBe(false);
  });

  it('reporta las dos calzadas del mismo sentido como posible boulevard', () => {
    // Dos calzadas paralelas y en el mismo sentido no son un boulevard por el criterio de
    // sentido opuesto; se reportan en vez de derivar cuatro veredas sin decirlo.
    const copies: OsmWay[] = [
      { id: 901, nodeIds: [14, 15], tags: new Map([['highway', 'residential'], ['name', 'Avenida Uno'], ['oneway', 'yes']]) },
      { id: 902, nodeIds: [16, 17], tags: new Map([['highway', 'residential'], ['name', 'Avenida Uno'], ['oneway', 'yes']]) },
    ];

    const { pairs, sameSensePairs, groups } = detectBoulevards(copies, extract.nodes);

    expect(pairs).toEqual([]);
    expect(groups).toEqual([]);
    expect(sameSensePairs.map((pair) => pair.name)).toEqual(['Avenida Uno']);
  });
});
