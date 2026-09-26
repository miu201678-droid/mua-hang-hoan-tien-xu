import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request) {
  try {
    const { userId, zaloUserId } = await request.json();

    if (!userId || !zaloUserId) {
      return NextResponse.json({ success: false, message: 'Thiếu thông tin người dùng hoặc Zalo ID.' }, { status: 400 });
    }

    // Cập nhật trực tiếp zalo_user_id vào bảng profiles
    const { error } = await supabase
      .from('profiles')
      .update({ zalo_user_id: zaloUserId.trim() })
      .eq('id', userId);

    if (error) throw error;

    return NextResponse.json({ success: true, message: 'Liên kết Zalo thành công!' });
  } catch (error) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}