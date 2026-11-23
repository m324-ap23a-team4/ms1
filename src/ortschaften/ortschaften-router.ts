import { Router, type Request, type Response } from 'express';
import type { OrtschaftenLeseRepository } from './ortschaften-lese-repository';

/** Prüft, ob ein Text eine gültige UUID ist (Format der Ortschafts-IDs). */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * US2: Ortschaften auslesen (Issue m324-ap23a-team4/team#3).
 *
 * - `GET /ortschaften`     → 200 mit allen Ortschaften, `[]` wenn keine vorhanden sind
 * - `GET /ortschaften/:id` → 200 mit der Ortschaft, 404 wenn es sie nicht gibt.
 *   MS2 verwendet diesen Endpunkt, um eine Ortschaft zu prüfen (US3).
 *
 * Wird in `createApp` unter `/ortschaften` eingebunden.
 */
export function createOrtschaftenRouter(repository: OrtschaftenLeseRepository): Router {
  const router = Router();

  router.get('/', async (_req: Request, res: Response) => {
    try {
      res.status(200).json(await repository.findAll());
    } catch (error) {
      sendReadError(res, error);
    }
  });

  router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
    const { id } = req.params;
    try {
      // Eine ID, die keine UUID ist, kann es nicht geben: direkt 404, ohne Datenbankabfrage.
      const ortschaft = UUID_PATTERN.test(id) ? await repository.findById(id) : null;
      if (!ortschaft) {
        res.status(404).json({ error: `Ortschaft mit ID ${id} nicht gefunden` });
        return;
      }
      res.status(200).json(ortschaft);
    } catch (error) {
      sendReadError(res, error);
    }
  });

  return router;
}

/** Antwortet mit einer klaren Fehlermeldung, wenn die Datenbank nicht gelesen werden kann. */
function sendReadError(res: Response, error: unknown): void {
  console.error('Fehler beim Lesen der Ortschaften:', error);
  res.status(500).json({ error: 'Ortschaften konnten nicht gelesen werden. Bitte später erneut versuchen.' });
}
