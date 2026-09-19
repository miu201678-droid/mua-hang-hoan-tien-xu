import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

// 1. Client cho Client-side (Trình duyệt & Đăng nhập Google)
if (!globalThis.supabaseClientInstance) {
  globalThis.supabaseClientInstance = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

// 2. Client Admin (Tắt persistSession để KHÔNG trùng storage key với client thường)
if (!globalThis.supabaseAdminInstance) {
  globalThis.supabaseAdminInstance = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export const supabase = globalThis.supabaseClientInstance;
export const supabaseAdmin = globalThis.supabaseAdminInstance;