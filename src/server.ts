import 'dotenv/config';
import { Pool } from 'pg';
import { createApp } from './app';
import { PostgresOrtschaftenLeseRepository } from './ortschaften/ortschaften-lese-repository';

const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000 });

async function start() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ortschaften (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      plz TEXT NOT NULL UNIQUE,
      gruendungsdatum DATE NOT NULL,
      einwohner BIGINT NOT NULL CHECK (einwohner >= 0)
    )
  `);

  const app = createApp({
    async insert({ id, name, plz, gruendungsdatum, einwohner }) {
      const result = await pool.query(
        `INSERT INTO ortschaften (id, name, plz, gruendungsdatum, einwohner)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (plz) DO NOTHING`,
        [id, name, plz, gruendungsdatum, einwohner],
      );
      return result.rowCount === 1;
    },
  }, new PostgresOrtschaftenLeseRepository(pool));

  const port = Number(process.env.PORT || 3000);
  app.listen(port, () => console.log(`MS1 hört auf Port ${port}`));
}

pool.on('error', (error) => console.error('MS1-Datenbankverbindung unterbrochen', error));
start().catch(async (error) => {
  console.error('MS1 konnte nicht gestartet werden', error);
  await pool.end();
  process.exitCode = 1;
});
