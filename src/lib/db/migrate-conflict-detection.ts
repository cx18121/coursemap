import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function migrate() {
  await sql`
    ALTER TABLE synced_events
    ADD COLUMN IF NOT EXISTS gcal_event_id TEXT
  `;
  console.log('Migration complete: gcal_event_id column added to synced_events');
}

migrate().catch(console.error);
