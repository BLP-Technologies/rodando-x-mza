import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  buildJunctions,
  buildTramos,
  planCorners,
  selectGridWays,
  type Junction,
  type Tramo,
} from './importer.service.js';
import { readOsm, type OsmExtract } from './osm.reader.js';
import { detectBoulevards } from './way-rules.js';

const FIXTURE = fileURLToPath(new URL('./fixtures/two-blocks.osm', import.meta.url));
const PEDESTRIAN_FIXTURE = fileURLToPath(
  new URL('./fixtures/pedestrian-street.osm', import.meta.url),
);

/** El tramo como texto, para comparar la lista entera de una vez. */
const describeTramo = (tramo: Tramo): string =>
  `${tramo.wayIds.join('+')} ${tramo.nodeIds.join('-')} ${tramo.startCut}|${tramo.endCut}`;

/** Los tramos de la grilla: sin el boulevard, que el importador excluye antes. */
const gridTramos = (extract: OsmExtract): Tramo[] => {
  const { ways } = selectGridWays(extract);
  const { excludedWayIds } = detectBoulevards(ways, extract.nodes);

  return buildTramos(ways.filter((way) => !excludedWayIds.has(way.id))).tramos;
};

let extract: OsmExtract;
let pedestrianExtract: OsmExtract;

beforeAll(async () => {
  extract = await readOsm(FIXTURE);
  pedestrianExtract = await readOsm(PEDESTRIAN_FIXTURE);
});

describe('selectGridWays', () => {
  it('deja pasar las clases de la grilla y cuenta lo que descarta', () => {
    const selection = selectGridWays(extract);

    // 101 a 109 más la 114: las cuatro de Calle A, Ancha, Uno, Corta, la sin nombre y
    // las dos del boulevard. La plaza se cuenta aparte, porque queda afuera.
    expect(selection.ways.map((way) => way.id)).toEqual([
      101, 102, 103, 104, 105, 106, 114, 107, 108, 109,
    ]);
    expect([...selection.skippedByClass]).toEqual([
      ['service', 1],
      ['footway', 1],
    ]);
    expect(selection.pedestrian).toBe(0);
    expect(selection.pedestrianAreas).toBe(1);
    // Lo que queda afuera son sólo las clases descartadas: una peatonal no está ahí.
    expect(selection.outsideWays.map((way) => way.tags.get('highway'))).toEqual([
      'service',
      'footway',
    ]);
  });

  it('deja pasar la peatonal sin area y no la plaza', () => {
    const selection = selectGridWays(pedestrianExtract);

    expect(selection.ways.map((way) => way.id)).toEqual([201, 202, 203, 204]);
    expect(selection.pedestrian).toBe(1);
    expect(selection.pedestrianAreas).toBe(0);
    expect(selection.outsideWays).toEqual([]);
  });
});

describe('buildTramos', () => {
  it('parte las calles en tramos entre intersecciones', () => {
    const { ways } = selectGridWays(extract);
    const { excludedWayIds } = detectBoulevards(ways, extract.nodes);

    const { warnings } = buildTramos(ways.filter((way) => !excludedWayIds.has(way.id)));

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

    // Los dieciséis de la grilla, con el boulevard todavía como dos líneas sueltas.
    expect(tramos).toHaveLength(16);
    const doble = tramos.filter((tramo) => tramo.streetName === 'Avenida Doble');
    expect(doble.map(describeTramo).sort()).toEqual([
      '108 14-15 boundary|boundary',
      '109 16-17 boundary|boundary',
    ]);
  });

  it('corta la peatonal en cada calle que la cruza', () => {
    const { tramos } = buildTramos(selectGridWays(pedestrianExtract).ways);

    // Dos tramos de peatonal —antes y después de Calle Media— y las tres calles
    // cortadas en su cruce con ella.
    expect(
      tramos.filter((tramo) => tramo.streetName === 'Peatonal Centro').map(describeTramo).sort(),
    ).toEqual(['204 2-5 junction|junction', '204 5-8 junction|junction']);
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

  it('en la T con la peatonal como brazo que termina, el brazo es la peatonal', () => {
    const tramos = buildTramos(selectGridWays(pedestrianExtract).ways).tramos;
    const { junctions, warnings } = buildJunctions(tramos, pedestrianExtract.nodes);

    expect(warnings).toEqual([]);
    expect(
      junctions.map((junction) => `${junction.nodeId}:${junction.kind}`).sort(),
    ).toEqual(['2:tee', '5:cross', '8:tee']);

    const tee = junctions.find((junction) => junction.nodeId === 2);
    expect(tramos[tee?.stemTramoId ?? -1]?.streetName).toBe('Peatonal Centro');
  });
});

/** Las intersecciones de la grilla del fixture, en el orden en que se derivan. */
const gridJunctions = (): Junction[] =>
  buildJunctions(gridTramos(extract), extract.nodes).junctions;

describe('planCorners', () => {
  it('da cuatro nodos por intersección y un cruce por brazo', () => {
    const junctions = gridJunctions();
    const { corners, crossings } = planCorners(junctions);

    // Cuatro cruces de cuatro brazos y una T: 4 nodos cada una (las dos esquinas y los dos
    // de la boca) y tantos cruces como brazos (docs/11 §3.2 y §3.7).
    expect(junctions).toHaveLength(5);
    expect(corners).toHaveLength(20);
    expect(crossings).toHaveLength(4 * 4 + 3);
    expect(crossings.every((crossing) => crossing.cornerIds[0] !== crossing.cornerIds[1])).toBe(
      true,
    );
  });

  it('en una T separa las dos esquinas de los dos nodos de la boca', () => {
    const junctions = gridJunctions();
    const teeId = junctions.findIndex((junction) => junction.kind === 'tee');
    const tee = junctions[teeId];
    const { corners } = planCorners(junctions);

    const own = corners.filter((corner) => corner.junctionId === teeId);
    expect(own).toHaveLength(4);
    expect(own.filter((corner) => corner.kind === 'corner')).toHaveLength(2);
    expect(own.filter((corner) => corner.kind === 'boca')).toHaveLength(2);

    // Los dos nodos de la boca los pone el brazo que termina, cruzado con una de las dos
    // líneas de la calle que pasa.
    for (const boca of own.filter((corner) => corner.kind === 'boca')) {
      expect([boca.first.tramoId, boca.second.tramoId]).toContain(tee?.stemTramoId);
    }
  });

  it('en un cruce cada brazo pone una línea en cada esquina que bordea', () => {
    const junctions = gridJunctions();
    const { corners } = planCorners(junctions);

    // Es la propiedad que hace que haya una sola esquina por cuadrante: el brazo aporta
    // una línea a la esquina de un lado y la otra a la del otro, y nunca las dos al mismo
    // cuadrante (docs/11 §3.2).
    const crosses = junctions
      .map((junction, junctionId) => ({ junction, junctionId }))
      .filter(({ junction }) => junction.kind === 'cross');

    expect(crosses).toHaveLength(4);
    for (const { junction, junctionId } of crosses) {
      const lines = corners
        .filter((corner) => corner.junctionId === junctionId)
        .flatMap((corner) => [corner.first, corner.second]);

      expect(lines).toHaveLength(8);
      expect(new Set(lines.map((line) => `${line.tramoId}:${line.side}`)).size).toBe(8);
      for (const arm of junction.arms) {
        const own = lines.filter((line) => line.tramoId === arm.tramoId);
        expect(own).toHaveLength(2);
        expect(new Set(own.map((line) => line.side)).size).toBe(2);
      }
    }
  });
});
