# Prisma Database Migrations

This project uses Prisma for database schema management and migrations with Supabase (PostgreSQL).

## Setup

1. **Configure Database URL**

   Add your Supabase connection strings to `.env`:
   
   ```env
   # Supabase Database Connection (for Prisma)
   # IMPORTANT: Use DIRECT connection (not pooled) for migrations
   # Format: postgresql://postgres:[PASSWORD]@[HOST]:[PORT]/postgres?sslmode=require
   DATABASE_URL="postgresql://postgres:your_password@db.your-project.supabase.co:5432/postgres?sslmode=require"
   
   # Optional: Shadow database URL (for migration validation)
   # Use the same direct connection URL
   SHADOW_DATABASE_URL="postgresql://postgres:your_password@db.your-project.supabase.co:5432/postgres?sslmode=require"
   ```

   **Important Notes:**
   - In Prisma 7+, the connection URL is configured in `prisma.config.ts` (already set up)
   - **Use DIRECT connection** (port 5432), NOT the pooled connection (port 6543)
   - Connection pooling interferes with Prisma's advisory locks needed for migrations
   - For application queries, you can still use the pooled connection via Supabase client

   To get your connection string:
   - Go to Supabase Dashboard > Settings > Database
   - Under "Connection string", select **"URI"** (not "Session mode" or "Transaction mode")
   - Copy the connection string
   - Replace `[YOUR-PASSWORD]` with your database password

2. **Generate Prisma Client**

   ```bash
   npm run db:generate
   ```

3. **Run Migrations**

   **Option A: Using Migrations (Recommended for production)**
   
   For development (creates migration files):
   ```bash
   npm run db:migrate
   ```

   For production (applies existing migrations):
   ```bash
   npm run db:migrate:deploy
   ```

   **Option B: Using db:push (Quick setup, bypasses migrations)**
   
   If migrations are timing out, you can use `db:push` which doesn't require advisory locks:
   ```bash
   npm run db:setup
   ```
   
   This will:
   - Push the schema directly to the database
   - Generate Prisma Client
   - Skip migration history (faster, but less version control)
   
   ⚠️ **Note:** After using `db:push`, you still need to apply Supabase-specific features (RLS, triggers, seeds) manually.

4. **Apply Supabase-Specific Features**

   After running Prisma migrations, you need to apply Supabase-specific features (RLS policies, triggers, seed data):
   
   - Go to Supabase Dashboard → SQL Editor
   - Run the SQL from `prisma/migrations/20240101000000_init_supabase_rls.sql`
   - This sets up Row Level Security, triggers, and seeds initial categories

## Available Commands

- `npm run db:migrate` - Create and apply a new migration (development)
- `npm run db:migrate:deploy` - Apply migrations without creating new files (production)
- `npm run db:generate` - Generate Prisma Client
- `npm run db:studio` - Open Prisma Studio (database GUI)
- `npm run db:push` - Push schema changes without creating migration (quick dev)
- `npm run db:pull` - Pull schema from database (introspect)

## Migration Workflow

1. **Modify Schema**: Edit `prisma/schema.prisma`
2. **Create Migration**: Run `npm run db:migrate`
3. **Review Migration**: Check the generated SQL in `prisma/migrations/`
4. **Apply Migration**: Migration is automatically applied in development

## Schema Files

- `prisma/schema.prisma` - Prisma schema definition
- `prisma/migrations/` - Migration history (SQL files)

## Notes

- Migrations are version-controlled
- Always review migration SQL before applying to production
- Use `db:push` for quick prototyping (doesn't create migration files)
- Use `db:migrate` for proper version-controlled migrations

