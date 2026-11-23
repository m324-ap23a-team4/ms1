import type { Pool } from 'pg';
import type { Ortschaft } from '../app';

/**
 * Lesezugriff auf die gespeicherten Ortschaften (US2).
 *
 * Der Router kennt nur dieses Interface. Darum können die Unit Tests eine
 * Fake-Implementierung ohne Datenbank verwenden.
 */
export interface OrtschaftenLeseRepository {
  /** Liefert alle Ortschaften, sortiert nach Name. Leere Liste, wenn keine vorhanden sind. */
  findAll(): Promise<Ortschaft[]>;
  /** Liefert die Ortschaft mit dieser ID oder `null`, wenn es sie nicht gibt. */
  findById(id: string): Promise<Ortschaft | null>;
}

/**
 * Spalten der Tabelle `ortschaften` (angelegt in `server.ts`).
 * - Das Datum wird als YYYY-MM-DD formatiert, damit die API kein
 *   JavaScript-Date mit Zeitzone zurückgibt.
 * - `einwohner` ist eine BIGINT-Spalte. Die Bibliothek `pg` liefert BIGINT
 *   als Text ("5543"), darum wird der Wert als integer gelesen.
 */
const SELECT_ORTSCHAFT = `
  SELECT id,
         name,
         plz,
         to_char(gruendungsdatum, 'YYYY-MM-DD') AS gruendungsdatum,
         CAST(einwohner AS integer) AS einwohner
    FROM ortschaften`;

/** Postgres-Implementierung von {@link OrtschaftenLeseRepository}. */
export class PostgresOrtschaftenLeseRepository implements OrtschaftenLeseRepository {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async findAll(): Promise<Ortschaft[]> {
    const result = await this.pool.query<Ortschaft>(`${SELECT_ORTSCHAFT} ORDER BY name`);
    return result.rows;
  }

  async findById(id: string): Promise<Ortschaft | null> {
    const result = await this.pool.query<Ortschaft>(`${SELECT_ORTSCHAFT} WHERE id = $1`, [id]);
    return result.rows[0] ?? null;
  }
}
