import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'
import * as schema from '../../server/db/schema'
import type { Db } from '../../server/db'

export const MIGRATIONS_FOLDER = new URL('../../server/db/migrations', import.meta.url).pathname

export async function createTestDb() {
  const client = new PGlite()
  const db = drizzle({ client, schema }) as unknown as Db
  await migrate(drizzle({ client }), { migrationsFolder: MIGRATIONS_FOLDER })
  return { client, db }
}

export async function rerunMigrations(client: PGlite) {
  await migrate(drizzle({ client }), { migrationsFolder: MIGRATIONS_FOLDER })
}
