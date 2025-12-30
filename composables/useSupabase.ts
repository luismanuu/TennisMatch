import { createClient, SupabaseClient } from '@supabase/supabase-js'

export const useSupabase = (): SupabaseClient => {
  const config = useRuntimeConfig()
  
  return createClient(
    config.public.supabaseUrl,
    config.public.supabaseAnonKey
  )
}

