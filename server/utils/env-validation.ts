import { z } from 'zod'

/**
 * Environment variable validation schema
 * Validates all required environment variables at startup
 */
const envSchema = z.object({
  // Public environment variables
  SUPABASE_URL: z.string().url('Supabase URL must be a valid URL'),
  SUPABASE_ANON_KEY: z.string().min(1, 'Supabase anon key is required'),
  
  // Server-only environment variables
  // Clerk secret key can be in either format
  clerkSecretKey: z.string().startsWith('sk_', 'Clerk secret key must start with sk_'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'Supabase service role key is required'),
  OPENROUTER_API_KEY: z.string().min(1, 'OpenRouter API key is required').optional(),
  
  // Database (for Prisma)
  DATABASE_URL: z.string().url('Database URL must be a valid URL').optional(),
  
  // Clerk publishable key is optional - @clerk/nuxt handles it automatically
  // No validation needed as it's not required for server-side operations
})

type Env = z.infer<typeof envSchema>

/**
 * Validates environment variables and returns typed config
 * Throws error if required variables are missing or invalid
 */
export function validateEnv(): Env {
  // Check for Clerk secret key in either format
  const clerkSecretKey = process.env.NUXT_CLERK_SECRET_KEY || process.env.CLERK_SECRET_KEY
  
  if (!clerkSecretKey) {
    throw new Error('CLERK_SECRET_KEY is required. Please set NUXT_CLERK_SECRET_KEY or CLERK_SECRET_KEY in your environment variables.')
  }
  
  const env = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    clerkSecretKey: clerkSecretKey,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
  }
  
  try {
    return envSchema.parse(env)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('\n')
      throw new Error(`Environment validation failed:\n${missingVars}`)
    }
    throw error
  }
}

/**
 * Get validated environment variables
 * Call this at application startup
 */
export function getValidatedEnv(): Env {
  return validateEnv()
}
