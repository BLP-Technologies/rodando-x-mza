import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  buildJunctions,
  buildTramos,
  selectGridWays,
  type Tramo,
} from './importer.service.js';
import { readOsm, type OsmExtract } from './osm.reader.js';

const FIXTURE = fileURLToPath(new URL('./fixtures/two-blocks.osm', import.meta.url));

/** El tramo como texto, para comparar la lista entera de una vez. */
const describeTramo = (tramo: Tramo): string =>
  `${tramo.wayIds.join('+')} ${tramo.nodeIds.join('-')} ${tramo.startCut}|${tramo.endCut}`;

/** Los tramos de la grilla: sin el boulevard, que el importador excluye antes. */
const gridTramos = (extract: OsmExtract): Tramo[] => {
  const { ways } = selectGridWays(extract);
  return buildTramos(ways.filter((way) => way.id !== 108 && way.id !== 109)).tramos;
};

let extract: OsmExtract;

beforeAll(async () => {
  extract = await readOsm(FIXTURE);
});

describe('selectGridWays', () => {
  it('deja pasar las clases de la grilla y cuenta lo que descarta', () => {
    const selection = selectGridWays(extract);

    // 101 a 109 más la 114: las cuatro de Calle A, Ancha, Uno, Corta, la sin nombre y
    // las dos del boulevard. Las peatonales y el area de plaza se cuentan aparte.
    expect(selection.ways.map((way) => way.id)).toEqual([
      101, 102, 103, 104, 105, 106, 114, 107, 108, 109,
    ]);
    expect([...selection.skippedByClass]).toEqual([
      ['service', 1],
      ['footway', 1],
    ]);
    expect(selection.pedestrian).toBe(1);
    expect(selection.pedestrianAreas).toBe(1);
  });
});

describe('buildTramos', () => {
  it('parte las calles en tramos entre intersecciones', () => {
    const { warnings } = buildTramos(
      selectGridWays(extract).ways.filter((way) => way.id !== 108 && way.id !== 109),
    );

    expect(warnings).toEqual([]);
    expect(gridTramos(extract).map(describeTramo).sort()).toEqual(
      [
        '101 1-2 boundary|junction',
        '102+103 2-3-4 junction|junction',
        '104 4-5 junction|boundary',
        '105 6-7 boundary|junction',
        '105 7-8 junction|junction',
        '105 8-9 junction|boundary',
        '106 10-26 boundary|junction',
        '106 26-2 junction|junction',
        '106 2-7 junction|junction',
        '106 7-11 junction|boundary',
        '107 12-4 boundary|junction',
        '107 4-8 junction|junction',
        '107 8-13 junction|boundary',
        '114 27-26 boundary|junction',
      ].sort(),
    );
  });

  it('une las way partidas para que el tramo no quede duplicado', () => {
    const calleA = gridTramos(extract).filter((tramo) => tramo.wayIds.includes(102));
    expect(calleA).toHaveLength(1);
    expect(calleA[0]?.wayIds).toEqual([102, 103]);
    expect(calleA[0]?.nodeIds).toEqual([2, 3, 4]);
  });

  it('deja el nombre en null cuando la vía no lo trae', () => {
    const sinNombre = gridTramos(extract).filter((tramo) => tramo.wayIds.includes(107));

    expect(sinNombre).toHaveLength(3);
    expect(sinNombre.every((tramo) => tramo.streetName === null)).toBe(true);
  });

  it('deja el boulevard como dos líneas sueltas mientras no se detecte', () => {
    const { ways } = selectGridWays(extract);

    const { tramos } = buildTramos(ways);

    expect(tramos).toHaveLength(16);
    const doble = tramos.filter((tramo) => tramo.streetName === 'Avenida Doble');
    expect(doble.map(describeTramo).sort()).toEqual([
      '108 14-15 boundary|boundary',
      // La 109 se trazó en sentido contrario: el tramo conserva ese orden, y como el
      // lado no se guarda, la dirección de la `way` no llega a ningún lado.
      '109 17-16 boundary|boundary',
    ]);
  });
});

describe('buildJunctions', () => {
  it('clasifica cuatro cruces y una T', () => {
    const { junctions, warnings } = buildJunctions(gridTramos(extract), extract.nodes);

    expect(warnings).toEqual([]);
    expect(
      junctions.map((junction) => `${junction.nodeId}:${junction.kind}`).sort(),
    ).toEqual(['26:tee', '2:cross', '4:cross', '7:cross', '8:cross']);
  });

  it('en la T identifica el brazo que termina', () => {
    const tramos = gridTramos(extract);
    const { junctions } = buildJunctions(tramos, extract.nodes);

    const tee = junctions.find((junction) => junction.nodeId === 26);
    expect(tee?.arms).toHaveLength(3);

    const stem = tramos[tee?.stemTramoId ?? -1];
    expect(stem?.wayIds).toEqual([114]);
    expect(stem?.streetName).toBe('Calle Corta');
  });

  it('un nodo del borde del extracto no es intersección', () => {
    const { junctions } = buildJunctions(gridTramos(extract), extract.nodes);

    expect(junctions.some((junction) => junction.nodeId === 1)).toBe(false);
  });
});
