/**
 * Unit Tests für US2: Ortschaften auslesen (Issue m324-ap23a-team4/team#3).
 *
 * Getestet wird über echte HTTP-Aufrufe. Statt der Postgres-Datenbank verwenden
 * die Tests {@link FakeLeseRepository} (Daten im Speicher). Die Tests laufen
 * darum isoliert, ohne Datenbank.
 *
 * Ausführen: `npm test`
 */
import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { describe, test } from 'node:test';
import express from 'express';
import { createApp, type Ortschaft } from '../src/app';
import type { OrtschaftenLeseRepository } from '../src/ortschaften/ortschaften-lese-repository';
import { createOrtschaftenRouter } from '../src/ortschaften/ortschaften-router';

const NIEDERHASLI: Ortschaft = {
  id: 'c3f8a4b2-9d1e-4f7a-8b2c-1e4d5a6b7c8d',
  name: 'Niederhasli',
  plz: '8155',
  gruendungsdatum: '1899-05-15',
  einwohner: 5543,
};

const DIELSDORF: Ortschaft = {
  id: '0b6f3a1e-2c4d-4e5f-9a8b-7c6d5e4f3a2b',
  name: 'Dielsdorf',
  plz: '8157',
  gruendungsdatum: '1250-01-01',
  einwohner: 6200,
};

/** Fake-Repository: liest die Ortschaften aus einem Array statt aus Postgres. */
class FakeLeseRepository implements OrtschaftenLeseRepository {
  private readonly ortschaften: Ortschaft[];

  constructor(ortschaften: Ortschaft[]) {
    this.ortschaften = ortschaften;
  }

  async findAll(): Promise<Ortschaft[]> {
    return [...this.ortschaften];
  }

  async findById(id: string): Promise<Ortschaft | null> {
    return this.ortschaften.find((o) => o.id === id) ?? null;
  }
}

/** Fake-Repository, das wie eine nicht erreichbare Datenbank immer einen Fehler wirft. */
class BrokenLeseRepository implements OrtschaftenLeseRepository {
  async findAll(): Promise<Ortschaft[]> {
    throw new Error('Datenbank nicht erreichbar');
  }

  async findById(): Promise<Ortschaft | null> {
    throw new Error('Datenbank nicht erreichbar');
  }
}

/**
 * Startet `app` auf einem freien Port, führt `fn` mit der Basis-URL aus
 * und stoppt den Server danach wieder.
 */
async function withServer(app: express.Express, fn: (baseUrl: string) => Promise<void>): Promise<void> {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as AddressInfo;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

/** Express-App, die nur den US2-Router unter /ortschaften enthält. */
function routerApp(repository: OrtschaftenLeseRepository): express.Express {
  const app = express();
  app.use('/ortschaften', createOrtschaftenRouter(repository));
  return app;
}

describe('US2: GET /ortschaften', () => {
  /**
   * Happy Path: Liste mit Ortschaften.
   *
   * - Ausgangslage: In der Datenbank sind 2 Ortschaften gespeichert.
   * - Aktion: `GET /ortschaften`
   * - Erwartung: Status 200 und ein Array mit genau 2 Objekten, die alle Felder
   *   (id, name, plz, gruendungsdatum, einwohner) vollständig enthalten.
   * - Abnahmekriterien US2: 1 (Liste abrufen) und 2 (alle Felder vollständig).
   */
  test('liefert alle Ortschaften mit allen Feldern (200)', async () => {
    await withServer(routerApp(new FakeLeseRepository([NIEDERHASLI, DIELSDORF])), async (baseUrl) => {
      const response = await fetch(`${baseUrl}/ortschaften`);

      assert.equal(response.status, 200);
      const body = (await response.json()) as Ortschaft[];
      assert.equal(body.length, 2);
      assert.deepEqual(body, [NIEDERHASLI, DIELSDORF]);
    });
  });

  /**
   * Happy Path (leer): keine Ortschaften vorhanden.
   *
   * - Ausgangslage: Die Datenbank enthält keine Ortschaften.
   * - Aktion: `GET /ortschaften`
   * - Erwartung: Status 200 mit einem leeren Array `[]` (kein Fehler).
   * - Abnahmekriterium US2: 5 (keine Ortschaften vorhanden).
   */
  test('liefert ein leeres Array, wenn keine Ortschaften vorhanden sind (200)', async () => {
    await withServer(routerApp(new FakeLeseRepository([])), async (baseUrl) => {
      const response = await fetch(`${baseUrl}/ortschaften`);

      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), []);
    });
  });

  /**
   * Sad Path: Datenbank nicht erreichbar.
   *
   * - Ausgangslage: Das Lesen aus der Datenbank schlägt fehl.
   * - Aktion: `GET /ortschaften`
   * - Erwartung: Status 500 mit einer verständlichen Fehlermeldung im Feld `error`
   *   (keine technischen Details wie die interne Fehlermeldung).
   * - Abnahmekriterium US2: 6 (fehlerhafte Abfragen führen zu klaren Fehlermeldungen).
   */
  test('meldet einen klaren Fehler, wenn die Datenbank nicht lesbar ist (500)', async (t) => {
    t.mock.method(console, 'error', () => {}); // erwartete Fehlerausgabe im Testlog unterdrücken
    await withServer(routerApp(new BrokenLeseRepository()), async (baseUrl) => {
      const response = await fetch(`${baseUrl}/ortschaften`);

      assert.equal(response.status, 500);
      const body = (await response.json()) as { error: string };
      assert.match(body.error, /Ortschaften konnten nicht gelesen werden/);
      assert.doesNotMatch(body.error, /Datenbank nicht erreichbar/);
    });
  });
});

describe('US2: GET /ortschaften/:id (für die Prüfung durch MS2)', () => {
  /**
   * Happy Path Einzelabruf: ID existiert.
   *
   * - Ausgangslage: Die Ortschaft Niederhasli ist gespeichert.
   * - Aktion: `GET /ortschaften/{id von Niederhasli}`
   * - Erwartung: Status 200 mit genau diesem Ortschafts-Objekt.
   * - Bedeutung: MS2 erkennt an der 200, dass die Ortschaft existiert (US3).
   */
  test('liefert die Ortschaft zur ID (200)', async () => {
    await withServer(routerApp(new FakeLeseRepository([NIEDERHASLI, DIELSDORF])), async (baseUrl) => {
      const response = await fetch(`${baseUrl}/ortschaften/${NIEDERHASLI.id}`);

      assert.equal(response.status, 200);
      assert.deepEqual(await response.json(), NIEDERHASLI);
    });
  });

  /**
   * Sad Path Einzelabruf: ID existiert nicht.
   *
   * - Ausgangslage: Es gibt keine Ortschaft mit der angefragten ID.
   * - Aktion: `GET /ortschaften/{unbekannte UUID}` und `GET /ortschaften/keine-uuid`
   * - Erwartung: In beiden Fällen Status 404 und eine Fehlermeldung, die die ID nennt.
   * - Bedeutung: MS2 antwortet bei dieser 404 selbst mit 400 «Ortschaft existiert nicht» (US3).
   */
  test('meldet 404, wenn die Ortschaft nicht existiert', async () => {
    await withServer(routerApp(new FakeLeseRepository([NIEDERHASLI])), async (baseUrl) => {
      const unbekannteId = '11111111-2222-4333-8444-555555555555';
      const response = await fetch(`${baseUrl}/ortschaften/${unbekannteId}`);

      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { error: `Ortschaft mit ID ${unbekannteId} nicht gefunden` });

      const ungueltig = await fetch(`${baseUrl}/ortschaften/keine-uuid`);
      assert.equal(ungueltig.status, 404);
      assert.deepEqual(await ungueltig.json(), { error: 'Ortschaft mit ID keine-uuid nicht gefunden' });
    });
  });
});

describe('US2: Einbindung in createApp (zusammen mit US1)', () => {
  /**
   * Integration im Service: POST (US1) und GET (US2) arbeiten zusammen.
   *
   * - Ausgangslage: `createApp` mit einem gemeinsamen Speicher für Schreiben (US1) und Lesen (US2).
   * - Aktion: Ortschaft per `POST /ortschaften` erfassen, dann `GET /ortschaften`
   *   und `GET /ortschaften/{neue id}` aufrufen.
   * - Erwartung: Die neue Ortschaft erscheint in der Liste und ist per ID abrufbar.
   * - Abnahmekriterium US1: 6 (nach Erfassung in der Übersicht sichtbar).
   */
  test('zeigt eine per POST erfasste Ortschaft per GET an', async () => {
    const gespeichert: Ortschaft[] = [];
    const app = createApp(
      {
        async insert(ortschaft) {
          gespeichert.push(ortschaft);
          return true;
        },
      },
      new FakeLeseRepository(gespeichert),
    );

    await withServer(app, async (baseUrl) => {
      const { id: _id, ...felder } = NIEDERHASLI; // ID vergibt der Server selbst
      const created = await fetch(`${baseUrl}/ortschaften`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(felder),
      });
      assert.equal(created.status, 201);
      const neu = (await created.json()) as Ortschaft;

      const liste = await fetch(`${baseUrl}/ortschaften`);
      assert.equal(liste.status, 200);
      assert.deepEqual(await liste.json(), [neu]);

      const einzeln = await fetch(`${baseUrl}/ortschaften/${neu.id}`);
      assert.equal(einzeln.status, 200);
      assert.deepEqual(await einzeln.json(), neu);
    });
  });
});
