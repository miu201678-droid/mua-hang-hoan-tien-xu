import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request) {
  try {
    const { user_id } = await request.json();
    if (!user_id) {
      return NextResponse.json({ success: false, error: 'Thiếu user_id' }, { status: 400 });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // 💡 Tối ưu: Xóa các mã OTP cũ của user này trước khi tạo mã mới
    await supabase.from('otp_codes').delete().eq('user_id', String(user_id));

    // Thêm mã OTP mới
    const { error } = await supabase.from('otp_codes').insert([
      { user_id: String(user_id), code: otpCode, expires_at: expiresAt }
    ]);

    if (error) throw error;

    return NextResponse.json({ success: true, otp: otpCode });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}