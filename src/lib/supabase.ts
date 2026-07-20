import { createClient } from '@supabase/supabase-js';

// En Astro, las variables públicas del lado del cliente comienzan con PUBLIC_
const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || 'https://lfhxwamctujvgszmdjap.supabase.co';
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxmaHh3YW1jdHVqdmdzem1kamFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1ODIzMzEsImV4cCI6MjEwMDE1ODMzMX0.UShXQhDKW4RQwN2bZ_RDbn59hkDY0YWR6BDcNLZm3SQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
