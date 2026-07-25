import { createClient } from '@supabase/supabase-js';

// En Astro, las variables públicas del lado del cliente comienzan con PUBLIC_
const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL || 'https://lfhxwamctujvgszmdjap.supabase.co';
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_FoUBe2a_2bsqfH_Smw0Waw_sopBzlNK';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
