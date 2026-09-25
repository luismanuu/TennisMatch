import { Pool, neonConfig } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import * as schema from './schema'

export { schema }

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
export type DbOrTx = Db | Tx

let instance: Db | undefined

function connect(): Db {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL is not configured')
  }
  if (typeof WebSocket !== 'undefined') {
    neonConfig.webSocketConstructor = WebSocket
  }
  return drizzle({ client: new Pool({ connectionString: url }), schema }) as unknown as Db
}

export function useDb(): Db {
  instance ??= connect()
  return instance
}

// Tests run the real queries against an in-process Postgres (PGlite) and install it here.
export function setDbForTests(db: Db | undefined): void {
  instance = db
}
