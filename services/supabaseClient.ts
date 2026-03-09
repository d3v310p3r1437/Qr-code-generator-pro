
import { createClient } from '@supabase/supabase-js';

const getSupabaseClient = () => {
  const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
  const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // We throw a descriptive error that will be caught when the app tries to use Supabase
    throw new Error('Supabase URL and Anon Key are required. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Settings.');
  }

  return createClient(supabaseUrl, supabaseAnonKey);
};

let instance: any = null;

// Use a Proxy to lazily initialize the Supabase client only when it's first accessed.
// This prevents the app from crashing on boot if the environment variables are missing.
export const supabase = new Proxy({} as any, {
  get(target, prop) {
    if (!instance) {
      instance = getSupabaseClient();
    }
    const value = instance[prop];
    return typeof value === 'function' ? value.bind(instance) : value;
  }
});
