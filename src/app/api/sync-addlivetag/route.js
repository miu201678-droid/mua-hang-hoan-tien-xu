import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase'; // Đường dẫn tới file supabase client của bạn

export async function POST(request) {
  try {
    const body = await request.json();
    
    // Kiểm tra dữ liệu ZaloBot gửi lên (tùy thuộc vào cấu trúc payload thực tế của ZaloBot)
    // Ví dụ: shortLink, originalLink, user_id, ...
    const { shortLink, originalLink, orderCode, status } = body;

    // Thực hiện lưu hoặc cập nhật vào database Supabase của bạn
    // const { data, error } = await supabaseAdmin.from('your_table').insert([...]);

    return NextResponse.json({
      success: true,
      message: 'Đã nhận link từ ZaloBot thành công!',
      data: body
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 400 });
  }
}