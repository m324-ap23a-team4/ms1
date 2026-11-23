import { randomUUID } from 'node:crypto';
import express, { type ErrorRequestHandler } from 'express';
import { isCalendarDate } from './date';

export interface Ortschaft {
  id: string;
  name: string;
  plz: string;
  gruendungsdatum: string;
  einwohner: number;
}

export interface OrtschaftenRepository {
  insert(ortschaft: Ortschaft): Promise<boolean>;
}

export function createApp(repository: OrtschaftenRepository) {
  const app = express();

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'ms1', uptime: process.uptime(), timestamp: new Date().toISOString() });
  });

  app.post('/ortschaften', express.json(), async (req, res) => {
    const { name, plz, gruendungsdatum, einwohner } = req.body ?? {};

    if (typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({ error: 'Validierungsfehler: Name muss mindestens 2 Zeichen enthalten.', field: 'name' });
    }
    if (typeof plz !== 'string' || !/^\d{4}$/.test(plz)) {
      return res.status(400).json({ error: 'Validierungsfehler: PLZ muss aus vier Ziffern bestehen.', field: 'plz' });
    }
    if (!isCalendarDate(gruendungsdatum)) {
      return res.status(400).json({ error: 'Validierungsfehler: Gründungsdatum muss ein gültiges Datum im Format YYYY-MM-DD sein.', field: 'gruendungsdatum' });
    }
    if (!Number.isSafeInteger(einwohner) || einwohner < 0) {
      return res.status(400).json({ error: 'Validierungsfehler: Einwohnerzahl muss positiv sein.', field: 'einwohner' });
    }

    const ortschaft: Ortschaft = { id: randomUUID(), name: name.trim(), plz, gruendungsdatum, einwohner };
    if (!await repository.insert(ortschaft)) {
      return res.status(400).json({ error: 'Validierungsfehler: PLZ ist bereits vorhanden.', field: 'plz' });
    }
    return res.status(201).json(ortschaft);
  });

  const handleError: ErrorRequestHandler = (error, _req, res, next) => {
    if (res.headersSent) return next(error);
    if (error.type === 'entity.parse.failed') {
      return res.status(400).json({ error: 'Validierungsfehler: Ungültiger JSON-Body.', field: 'body' });
    }
    if (error.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request-Body ist zu gross.' });
    }
    console.error(error);
    return res.status(500).json({ error: 'Interner Serverfehler.' });
  };
  app.use(handleError);
  return app;
}
