# Supabase Database Setup

This directory contains the database schema for the Tennis Match Platform.

## Setup Options

### Option 1: Using Prisma (Recommended)

This project uses **Prisma** for database migrations. See `prisma/README.md` for detailed instructions.

**Quick Start:**
1. Add `DATABASE_URL` to your `.env` file (Supabase connection string)
2. Run migrations: `npm run db:migrate`
3. Generate Prisma Client: `npm run db:generate`

### Option 2: Manual SQL Setup

If you prefer to run SQL manually:

1. **Open Supabase Dashboard**
   - Go to your Supabase project dashboard
   - Navigate to SQL Editor

2. **Run the Schema**
   - Copy the contents of `schema.sql`
   - Paste into the SQL Editor
   - Click "Run" to execute

3. **Verify Tables**
   - Check that `categories` and `players` tables are created
   - Verify that initial categories are seeded:
     - Principiante
     - Intermedio
     - Avanzado
     - Profesional

4. **Verify RLS Policies**
   - Go to Authentication > Policies
   - Ensure RLS is enabled for both tables
   - Verify policies are created correctly

## Tables

### `categories`
Stores dynamic player categories that can be managed through the admin interface.

### `players`
Stores player profiles linked to Clerk user IDs.

## Row Level Security (RLS)

- **Players**: Users can only read/update their own profile
- **Categories**: Publicly readable by all authenticated users

## Notes

- The schema includes automatic `updated_at` timestamp triggers
- Initial categories are seeded automatically
- Foreign key constraints ensure data integrity

