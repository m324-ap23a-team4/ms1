# ms1 – Microservice 1: Ortschaften

Dieser Service ist für die Verwaltung der Ortschaften zuständig (Projekt 5: Immobilienplattform).

- **Verantwortung Phase A:** Teilgruppe A (Dev)
- **Verantwortung Phase B:** Teilgruppe B (Ops)

## Lokal ausführen

Node.js 20 und eine PostgreSQL-Datenbank für MS1 werden benötigt.
Setze `DATABASE_URL` auf die Verbindung zu dieser Datenbank. Der Service legt
seine Tabelle beim Start an, falls sie noch fehlt. `PORT` ist optional
(Standard: `3000`).

```bash
npm ci
npm run dev
npm test
```

Die Tests benötigen keine laufende Datenbank.
