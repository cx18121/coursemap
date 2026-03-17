import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  await sql`
    CREATE TABLE IF NOT EXISTS synced_events (
      id          SERIAL PRIMARY KEY,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      uid         TEXT NOT NULL,
      summary     TEXT NOT NULL,
      description TEXT,
      start_at    TIMESTAMPTZ NOT NULL,
      end_at      TIMESTAMPTZ NOT NULL,
      gcal_calendar_id TEXT NOT NULL,
      synced_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT synced_events_user_uid_idx UNIQUE (user_id, uid)
    )
  `;
  console.log('Migration complete: synced_events table created');
}

migrate().catch(console.error);
