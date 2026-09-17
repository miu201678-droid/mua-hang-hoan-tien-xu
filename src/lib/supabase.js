import { createClient } from '@supabase/supabase-js';

// Dùng giá trị dự phòng để tránh crash ứng dụng trong quá trình build trên Render
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || supabaseAnonKey;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // Thêm dòng này để tự động bắt token sau khi đăng nhập Google
  },
});

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);