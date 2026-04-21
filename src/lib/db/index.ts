import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'
import * as relations from './relations'

const client = postgres(process.env.DATABASE_URL!, {
  max: 3,
  ssl: process.env.NODE_ENV === 'production' ? 'require' : false,
})

export const db = drizzle(client, { schema: { ...schema, ...relations } })
