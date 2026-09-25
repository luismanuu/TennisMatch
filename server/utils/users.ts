import { eq, inArray, sql } from 'drizzle-orm'
import { useDb } from '../db'
import { user, type UserRole } from '../db/schema'

export type AccountSummary = { id: string; email: string; name: string; role: UserRole; emailVerified: boolean }

const summaryColumns = { id: true, email: true, name: true, role: true, emailVerified: true } as const

export async function getAccountById(id: string): Promise<AccountSummary | undefined> {
  return useDb().query.user.findFirst({ columns: summaryColumns, where: eq(user.id, id) })
}

export async function getAccountsByIds(ids: string[]): Promise<Map<string, AccountSummary>> {
  if (ids.length === 0) {
    return new Map()
  }
  const rows = await useDb().query.user.findMany({ columns: summaryColumns, where: inArray(user.id, ids) })
  return new Map(rows.map((r) => [r.id, r]))
}

export async function findAccountByEmail(email: string): Promise<AccountSummary | undefined> {
  return useDb().query.user.findFirst({
    columns: summaryColumns,
    where: eq(sql`lower(${user.email})`, email.trim().toLowerCase()),
  })
}

export async function setAccountRole(id: string, role: UserRole): Promise<void> {
  await useDb().update(user).set({ role, updatedAt: new Date() }).where(eq(user.id, id))
}

export async function setAccountName(id: string, name: string): Promise<void> {
  await useDb().update(user).set({ name, updatedAt: new Date() }).where(eq(user.id, id))
}
