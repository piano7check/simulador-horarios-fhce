import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? 'https://lafwwaxkexnqeuxhqjuc.supabase.co'
const supabaseKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhZnd3YXhrZXhucWV1eGhxanVjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxNTAyMDYsImV4cCI6MjEwMTcyNjIwNn0.Fm04QPcUBHIiNOolnSZ1elyxbFItM6tevLSGCSyDrYc'

export const supabase = createClient(supabaseUrl, supabaseKey)
