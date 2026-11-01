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

    // 101 a 109 más la 114: las cuatro de Calle A, Ancha, Uno, Corta, la sin nombre, las
    // dos del boulevard y la peatonal, que entra con una sola línea sobre su eje.
    expect(selection.ways.map((way) => way.id)).toEqual([
      101, 102, 103, 104, 105, 106, 114, 107, 108, 109, 112,
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
        '106 10-26 boundary|junction',
        '106 26-2 junction|junction',
        '106 2-7 junction|junction',
        '106 7-11 junction|boundary',
        '107 12-4 boundary|junction',
        '107 4-8 junction|junction',
        '107 8-13 junction|boundary',
        '108 14-15 boundary|boundary',
        '109 16-17 boundary|boundary',
        '112 22-23 boundary|boundary',
        '114 27-26 boundary|junction',
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
    // Las dos calzadas del boulevard aportan una línea cada una.
    expect(linesOf(108)).toBe(1);
    expect(linesOf(109)).toBe(1);
    // La peatonal, una sola.
    expect(linesOf(112)).toBe(1);
    // Y cada boulevard aporta su mediana: una franja para toda la avenida (docs/11 §3.6).
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
    // exterior de una está a un lado y la de la otra al opuesto.
    const sides = tramos
      .filter((tramo) => tramo.calzada !== null)
      .map((tramo) => tramo.lines[0]?.side);
    expect(sides.sort()).toEqual([-1, 1]);
  });
});

describe('buildJunctions', () => {
  it('clasifica cuatro cruces y una T', () => {
    const { junctions, warnings } = buildJunctions(planFixture(extract).tramos, extract.nodes);

    expect(warnings).toEqual([]);
    expect(
      junctions.map((junction) => `${junction.nodeId}:${junction.kind}`).sort(),
    ).toEqual(['26:tee', '2:cross', '4:cross', '7:cross', '8:cross']);
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

    // Cuatro cruces de cuatro brazos y una T, todas con dos líneas por brazo: 4 nodos cada
    // cruce y 4 nodos la T (dos esquinas y los dos de la boca), y tantos cruces como brazos
    // (docs/11 §3.2 y §3.7).
    expect(junctions).toHaveLength(5);
    expect(nodes).toHaveLength(20);
    expect(crossings).toHaveLength(4 * 4 + 3);
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
    const { lines } = planFixture(extract);
    const junctions = gridJunctions(extract);
    const { nodes } = planCorners(junctions);

    // Es la propiedad que hace que haya una sola esquina por cuadrante: el brazo aporta una
    // línea a la esquina de un lado y la otra a la del otro, y nunca las dos al mismo
    // cuadrante (docs/11 §3.2).
    const crosses = junctions
      .map((junction, junctionId) => ({ junction, junctionId }))
      .filter(({ junction }) => junction.kind === 'cross');

    expect(crosses).toHaveLength(4);
    for (const { junction, junctionId } of crosses) {
      const used = nodes
        .filter((node) => node.junctionId === junctionId)
        .flatMap((node) => [node.first, node.second]);

      expect(used).toHaveLength(8);
      expect(new Set(used).size).toBe(8);
      for (const arm of junction.arms) {
        const own = used.filter((lineId) => {
          const line = lines.find((candidate) => candidate.lineId === lineId);
          return line?.tramoId === arm.tramoId;
        });
        expect(own).toHaveLength(2);
      }
    }
  });
});
