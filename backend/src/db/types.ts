/**
 * Tipos de la base de datos para Kysely.
 *
 * Se regeneran desde la base real con `kysely-codegen`, de modo que las columnas
 * `geometry` de PostGIS queden tipadas y nunca como `any`. Mientras no haya tablas
 * creadas por las migraciones, queda vacío a propósito.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- se completa con kysely-codegen
export interface DB {}
