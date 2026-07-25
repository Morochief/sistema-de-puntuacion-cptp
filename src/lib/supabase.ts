import { createClient } from '@supabase/supabase-js';

// En Astro, las variables públicas del lado del cliente comienzan con PUBLIC_
const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables! Check your .env file.');
  // Fallback para evitar crashear toda la app si falta el env, pero usando dummy values
}

export const supabase = createClient(
  supabaseUrl || 'https://dummy.supabase.co', 
  supabaseAnonKey || 'dummy_key'
);
