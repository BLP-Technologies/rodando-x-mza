import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import {
  buildJunctions,
  buildTramos,
  planCorners,
  planLines,
  selectGridWays,
  type Junction,
  type PlannedTramo,
  type WalkableLine,
} from './importer.service.js';
import { readOsm, type OsmExtract } from './osm.reader.js';
import { detectBoulevards } from './way-rules.js';

const FIXTURE = fileURLToPath(new URL('./fixtures/two-blocks.osm', import.meta.url));

/** El tramo como texto, para comparar la lista entera de una vez. */
const describeTramo = (tramo: PlannedTramo): string =>
  `${tramo.wayIds.join('+')} ${tramo.nodeIds.join('-')} ${tramo.startCut}|${tramo.endCut}`;

/** Planifica el fixture entero: tramos, líneas, boulevards e intersecciones. */
const planFixture = (extract: OsmExtract) => {
  const { ways } = selectGridWays(extract);
  const boulevard = detectBoulevards(ways, extract.nodes);
  const waysById = new Map(ways.map((way) => [way.id, way]));
  const { tramos } = buildTramos(ways);
  const planned = planLines(tramos, waysById, extract.nodes, boulevard.groups);

  return { ...planned, detection: boulevard };
};

/** Las líneas del fixture, con la intersección y los cruces ya armados. */
const gridJunctions = (extract: OsmExtract): Junction[] =>
  buildJunctions(planFixture(extract).tramos, extract.nodes).junctions;

/** Cómo se nombra una línea en los tests: su tramo y su lado, o que es una mediana. */
const describeLine = (lines: readonly WalkableLine[], lineId: number): string => {
  const line = lines.find((candidate) => candidate.lineId === lineId);
  if (line === undefined) return `?${lineId}`;

  return line.kind === 'median' ? `median:${line.boulevardId}` : `${line.tramoId}:${line.side}`;
};

let extract: OsmExtract;

beforeAll(async () => {
  extract = await readOsm(FIXTURE);
});

describe('selectGridWays', () => {
  it('deja pasar las clases de la grilla y cuenta lo que descarta', () => {
    const selection = selectGridWays(extract);

    // 101 a 109, la 112, la 114 y las dos calles que tocan el boulevard: las cuatro de
    // Calle A, Ancha, Uno, Corta, la sin nombre, las dos del boulevard, la peatonal —que
    // entra con una sola línea sobre su eje—, Calle Nueva y Calle Corta Dos.
    expect(selection.ways.map((way) => way.id)).toEqual([
      101, 102, 103, 104, 105, 106, 115, 116, 114, 107, 108, 109, 112,
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
    const { warnings } = buildTramos(selectGridWays(extract).ways);

    expect(warnings).toEqual([]);
    expect(planFixture(extract).tramos.map(describeTramo).sort()).toEqual(
      [
        '101 1-2 boundary|junction',
        '102+103 2-3-4 junction|junction',
        '104 4-5 junction|boundary',
        '105 6-7 boundary|junction',
        '105 7-8 junction|junction',
        '105 8-9 junction|boundary',
        // Calle Uno se nombra Calle Nueva en el nodo 10, así que ahí corta sin esquina;
        // y la peatonal la parte en 33, que sí es un cruce.
        '106 10-26 name-change|junction',
        '106 26-2 junction|junction',
        '106 2-7 junction|junction',
        '106 7-33 junction|junction',
        '106 33-11 junction|boundary',
        '107 12-4 boundary|junction',
        '107 4-8 junction|junction',
        '107 8-13 junction|boundary',
        // El boulevard se parte donde lo cruza Calle Nueva (28 y 29) y donde termina
        // Calle Corta Dos (32): son los nodos que le dan a la mediana sus cortes.
        '108 14-32 boundary|junction',
        '108 32-28 junction|junction',
        '108 28-15 junction|boundary',
        '109 16-29 boundary|junction',
        '109 29-17 junction|boundary',
        '112 22-33 boundary|junction',
        '112 33-23 junction|boundary',
        '114 27-26 boundary|junction',
        '115 30-28 boundary|junction',
        '115 28-29 junction|junction',
        '115 29-10 junction|name-change',
        '116 31-32 boundary|junction',
      ].sort(),
    );
  });

  it('une las way partidas para que el tramo no quede duplicado', () => {
    const calleA = planFixture(extract).tramos.filter((tramo) => tramo.wayIds.includes(102));

    expect(calleA).toHaveLength(1);
    expect(calleA[0]?.wayIds).toEqual([102, 103]);
    expect(calleA[0]?.nodeIds).toEqual([2, 3, 4]);
  });

  it('deja el nombre en null cuando la vía no lo trae', () => {
    const sinNombre = planFixture(extract).tramos.filter((tramo) => tramo.wayIds.includes(107));

    expect(sinNombre).toHaveLength(3);
    expect(sinNombre.every((tramo) => tramo.streetName === null)).toBe(true);
  });
});

describe('planLines', () => {
  it('da dos líneas a una calle común, una a la peatonal y una a cada calzada', () => {
    const { tramos, lines, detection } = planFixture(extract);

    // Las dos calzadas del boulevard del fixture están a 15 m: una sola avenida con dos
    // calzadas, cada una con su vereda exterior.
    expect(detection.groups).toHaveLength(1);

    const linesOf = (wayId: number): number =>
      tramos.filter((tramo) => tramo.wayIds.includes(wayId)).reduce(
        (total, tramo) => total + tramo.lines.length,
        0,
      );

    // Calle A es común: dos veredas por tramo, y son cuatro tramos.
    expect(linesOf(101)).toBe(2);
    expect(linesOf(104)).toBe(2);
    // Cada tramo de una calzada del boulevard aporta una sola línea: su vereda exterior.
    // Calle Nueva y Calle Corta Dos la parten, así que son tres tramos en la 108 y dos en
    // la 109 (docs/11 §3.6).
    expect(linesOf(108)).toBe(3);
    expect(linesOf(109)).toBe(2);
    // La peatonal, una sola por tramo: Calle Uno la parte en dos (docs/11 §3.5).
    expect(linesOf(112)).toBe(2);
    // Y el boulevard aporta su mediana: una franja para toda la avenida (docs/11 §3.6).
    expect(lines.filter((line) => line.kind === 'median')).toHaveLength(1);
  });

  it('la mediana no sale de ninguna way y lleva el nombre de la avenida', () => {
    const { lines, tramos, boulevards } = planFixture(extract);

    const median = lines.find((line) => line.kind === 'median');
    expect(median?.osmWayId).toBeNull();
    expect(median?.tramoId).toBeNull();
    expect(median?.side).toBe(0);
    expect(median?.streetName).toBe('Avenida Doble');

    // El plan de la mediana lleva las dos cadenas de las que sale su geometría.
    expect(boulevards).toHaveLength(1);
    expect(boulevards[0]?.sides.map((side) => [...side].sort())).toEqual([[108], [109]]);

    // La vereda exterior de cada calzada es la que mira al otro lado de la avenida: las
    // dos calzadas del fixture están dibujadas en sentidos opuestos, así que la línea
    // exterior de una está a un lado y la de la otra al opuesto. Son cinco tramos porque
    // las dos calles nuevas parten las calzadas en 14-32, 32-28 y 28-15 (oeste) y en
    // 16-29 y 29-17 (este).
    const sides = tramos
      .filter((tramo) => tramo.calzada !== null)
      .map((tramo) => tramo.lines[0]?.side);
    expect(sides.sort()).toEqual([-1, -1, -1, 1, 1]);
  });
});

describe('buildJunctions', () => {
  it('clasifica los cruces y las dos T', () => {
    const { junctions, warnings } = buildJunctions(planFixture(extract).tramos, extract.nodes);

    expect(warnings).toEqual([]);
    // Ocho nodos de la grilla más Calle Nueva, que cruza el boulevard con un nodo en cada
    // calzada (28 y 29). Las dos T son Calle Corta en Calle Uno y Calle Corta Dos contra la
    // calzada oeste (32).
    expect(
      junctions.map((junction) => `${junction.nodeId}:${junction.kind}`).sort(),
    ).toEqual([
      '26:tee',
      '28:cross',
      '29:cross',
      '2:cross',
      '32:tee',
      '33:cross',
      '4:cross',
      '7:cross',
      '8:cross',
    ]);
  });

  it('en la T identifica el brazo que termina', () => {
    const { tramos } = planFixture(extract);
    const { junctions } = buildJunctions(tramos, extract.nodes);

    const tee = junctions.find((junction) => junction.nodeId === 26);
    expect(tee?.arms).toHaveLength(3);

    const stem = tramos[tee?.stemTramoId ?? -1];
    expect(stem?.wayIds).toEqual([114]);
    expect(stem?.streetName).toBe('Calle Corta');
  });

  it('un nodo del borde del extracto no es intersección', () => {
    const { junctions } = buildJunctions(planFixture(extract).tramos, extract.nodes);

    expect(junctions.some((junction) => junction.nodeId === 1)).toBe(false);
  });

  it('una T se reconoce aunque sus rumbos crucen el meridiano', () => {
    // Un brazo que termina tiene que quedar a menos de 120° de los dos de la calle que
    // pasa. Si el ángulo entre rumbos se calcula con un módulo que conserva el signo, el
    // par -103°/168° sale 271° en vez de 89° y la T se pierde (docs/11 §3.2).
    const nodes = new Map([
      [1, { lon: 0, lat: 0 }],
      [2, { lon: -0.978, lat: 0.208 }],
      [3, { lon: 0.978, lat: -0.208 }],
      [4, { lon: -0.225, lat: -0.974 }],
    ]);

    const tramo = (
      tramoId: number,
      nodeIds: number[],
      startCut: PlannedTramo['startCut'],
      endCut: PlannedTramo['endCut'],
    ): PlannedTramo => ({
      streetName: null,
      highwayClass: 'residential',
      nodeIds,
      wayIds: [tramoId],
      startCut,
      endCut,
      offsetM: 6.5,
      lines: [
        { lineId: tramoId * 2, side: 1 },
        { lineId: tramoId * 2 + 1, side: -1 },
      ],
      calzada: null,
    });

    const { junctions, warnings } = buildJunctions(
      [
        tramo(0, [2, 1], 'boundary', 'junction'),
        tramo(1, [1, 3], 'junction', 'boundary'),
        tramo(2, [4, 1], 'boundary', 'junction'),
      ],
      nodes,
    );

    expect(warnings).toEqual([]);
    expect(junctions.map((junction) => `${junction.nodeId}:${junction.kind}`)).toEqual(['1:tee']);
  });
});

describe('planCorners', () => {
  it('da cuatro nodos por intersección de cuatro brazos y un cruce por brazo', () => {
    const junctions = gridJunctions(extract);
    const { nodes, crossings } = planCorners(junctions);

    // Siete cruces de cuatro brazos y dos T: 4 nodos cada una (en la T, dos esquinas y los
    // dos de la boca) y tantos cruces como brazos (docs/11 §3.2 y §3.7). Nueve
    // intersecciones por cuatro nodos son 36, y por tres o cuatro cruces, 34.
    expect(junctions).toHaveLength(9);
    expect(nodes).toHaveLength(36);
    expect(crossings).toHaveLength(7 * 4 + 2 * 3);
    expect(crossings.every((crossing) => crossing.nodeIds[0] !== crossing.nodeIds[1])).toBe(true);
  });

  it('en una T separa las dos esquinas de los dos nodos de la boca', () => {
    const { lines, tramos } = planFixture(extract);
    const junctions = gridJunctions(extract);
    const teeId = junctions.findIndex((junction) => junction.kind === 'tee');
    const tee = junctions[teeId];
    const { nodes } = planCorners(junctions);

    const own = nodes.filter((node) => node.junctionId === teeId);
    expect(own).toHaveLength(4);
    expect(own.filter((node) => node.kind === 'corner')).toHaveLength(2);
    expect(own.filter((node) => node.kind === 'boca')).toHaveLength(2);

    // Los nodos de la boca los pone el brazo que termina, cruzado con una línea de la
    // calle que pasa.
    const stemLines = new Set(
      (tramos[tee?.stemTramoId ?? -1]?.lines ?? []).map((line) => line.lineId),
    );
    for (const boca of own.filter((node) => node.kind === 'boca')) {
      expect(stemLines.has(boca.first) || stemLines.has(boca.second)).toBe(true);
      expect(describeLine(lines, boca.first)).not.toBe('?');
    }
  });

  it('en un cruce cada brazo pone una línea en cada esquina que bordea', () => {
    const junctions = gridJunctions(extract);
    const { nodes } = planCorners(junctions);

    // Es la propiedad que hace que haya una sola esquina por cuadrante: el brazo aporta una
    // línea a la esquina de un lado y la otra a la del otro, y nunca las dos al mismo
    // cuadrante (docs/11 §3.2). Vale para los brazos de dos líneas; la peatonal aporta una
    // sola y por eso su cruce (33) va aparte, más abajo.
    const crosses = junctions
      .map((junction, junctionId) => ({ junction, junctionId }))
      .filter(
        ({ junction }) =>
          junction.kind === 'cross' && junction.arms.every((arm) => arm.lines.length === 2),
      );

    expect(crosses).toHaveLength(6);
    for (const { junction, junctionId } of crosses) {
      const own = nodes.filter((node) => node.junctionId === junctionId);

      // Cuatro esquinas, todas distintas: nunca dos pares de líneas dan el mismo punto.
      expect(own).toHaveLength(4);
      expect(new Set(own.map((node) => [node.first, node.second].sort().join('/'))).size).toBe(4);

      // Cada esquina la bordan dos brazos distintos, y ninguna línea del brazo queda sin
      // esquina: es lo que hace que la esquina sea una y que no sobre ninguna vereda.
      const armsOfLine = (lineId: number): number[] =>
        junction.arms.flatMap((arm, index) => (arm.lines.includes(lineId) ? [index] : []));

      for (const node of own) {
        const first = armsOfLine(node.first);
        const second = armsOfLine(node.second);
        expect(first.length).toBeGreaterThan(0);
        expect(second.length).toBeGreaterThan(0);
        expect(first.some((index) => !second.includes(index))).toBe(true);
      }

      for (const arm of junction.arms) {
        for (const lineId of arm.lines) {
          expect(own.some((node) => node.first === lineId || node.second === lineId)).toBe(true);
        }
      }
    }
  });
});
