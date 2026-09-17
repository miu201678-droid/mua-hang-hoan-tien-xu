import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request) {
  try {
    const body = await request.json();
    
    // Đọc thông tin gửi từ Addlivetag (sub1 chứa ID người dùng Supabase)
    const { 
      sub1, 
      userId, 
      orderCode, 
      shortLink, 
      originalLink, 
      commission, 
      status 
    } = body;

    const finalUserId = sub1 || userId || null;

    if (!orderCode) {
      return NextResponse.json({ 
        success: false, 
        error: 'Thiếu mã đơn hàng (orderCode)' 
      }, { status: 400 });
    }

    // Cập nhật hoặc thêm mới đơn hàng theo order_code (Upsert)
    const { data, error } = await supabaseAdmin
      .from('cashback_links')
      .upsert(
        [
          {
            user_id: finalUserId,
            order_code: orderCode,
            short_link: shortLink || '',
            original_link: originalLink || '',
            commission: Number(commission || 0),
            status: status || 'pending',
            updated_at: new Date().toISOString()
          }
        ],
        { onConflict: 'order_code' }
      )
      .select();

    if (error) {
      console.error('Lỗi khi lưu Supabase:', error);
      return NextResponse.json({ 
        success: false, 
        error: error.message 
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Đã đồng bộ đơn hàng thành công!',
      data: data?.[0] || null
    });

  } catch (error) {
    console.error('Lỗi hệ thống API:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}