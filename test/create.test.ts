import assert from 'node:assert/strict';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { test, type TestContext } from 'node:test';
import { createApp, type Ortschaft } from '../src/app';

const valid = { name: 'Niederhasli', plz: '8155', gruendungsdatum: '1899-05-15', einwohner: 5543 };

async function setup(t: TestContext) {
  const stored: Ortschaft[] = [];
  const server = createApp({
    async insert(ortschaft) {
      if (stored.some((entry) => entry.plz === ortschaft.plz)) return false;
      stored.push(ortschaft);
      return true;
    },
  }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  const { port } = server.address() as AddressInfo;

  return {
    stored,
    post: (body: object) => fetch(`http://127.0.0.1:${port}/ortschaften`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  };
}

/** Prüft Status 201, generierte UUID und die an das Repository übergebenen Werte. */
test('speichert eine gültige Ortschaft', async (t) => {
  const { stored, post } = await setup(t);
  const response = await post(valid);
  assert.equal(response.status, 201);
  const { id, ...fields } = await response.json();
  assert.match(id, /^[0-9a-f-]{36}$/);
  assert.deepEqual(fields, valid);
  assert.deepEqual(stored, [{ id, ...valid }]);
});

/** Prüft, dass negative Einwohnerzahlen einen Feldfehler ergeben. */
test('lehnt negative Einwohnerzahlen ab', async (t) => {
  const { stored, post } = await setup(t);
  const response = await post({ ...valid, einwohner: -10 });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: 'Validierungsfehler: Einwohnerzahl muss positiv sein.',
    field: 'einwohner',
  });
  assert.equal(stored.length, 0);
});

/** Prüft, dass zwei Ortschaften dieselbe PLZ nicht verwenden können. */
test('lehnt eine doppelte PLZ ab', async (t) => {
  const { stored, post } = await setup(t);
  const first = await post(valid);
  assert.equal(first.status, 201);
  await first.json();
  const repeat = await post({ ...valid, name: 'Testort' });
  assert.equal(repeat.status, 400);
  assert.equal((await repeat.json()).field, 'plz');
  assert.equal(stored.length, 1);
});

/** Prüft, dass ein fehlender Name vor dem Speichern abgewiesen wird. */
test('verlangt einen Namen', async (t) => {
  const { stored, post } = await setup(t);
  const response = await post({ ...valid, name: undefined });
  assert.equal(response.status, 400);
  assert.equal((await response.json()).field, 'name');
  assert.equal(stored.length, 0);
});

/** Prüft Kalenderdaten sowie den erlaubten Grenzwert von null Einwohnern. */
test('validiert Kalendertage und erlaubt null Einwohner', async (t) => {
  const { stored, post } = await setup(t);
  const invalid = await post({ ...valid, gruendungsdatum: '2025-02-29' });
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).field, 'gruendungsdatum');
  const validResponse = await post({ ...valid, gruendungsdatum: '2024-02-29', einwohner: 0 });
  assert.equal(validResponse.status, 201);
  assert.equal((await validResponse.json()).einwohner, 0);
  assert.equal(stored.length, 1);
});
