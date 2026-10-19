import { createClient } from '@supabase/supabase-js';

// The publishable key is designed to be public: the database's row-level security rules protect the data.
const url = import.meta.env.VITE_SUPABASE_URL || 'https://uirbllexpcftcslwizft.supabase.co';
const key = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_8Rmd4Q4L3GSohGHzzJH0UA_7-OJA4d9';

export const supabase = createClient(url, key, {
  auth: {
    // PKCE puts the sign-in code in ?code=…, which works alongside the app's #/ page addresses.
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
