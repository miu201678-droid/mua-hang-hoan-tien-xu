import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request) {
  try {
    const body = await request.json();
    const { shortLink, originalLink, orderCode, status } = body;

    const { data, error } = await supabaseAdmin
      .from('cashback_links')
      .insert([
        { 
          short_link: shortLink, 
          original_link: originalLink, 
          order_code: orderCode, 
          status: status || 'pending',
          created_at: new Date().toISOString()
        }
      ]);

    if (error) {
      console.error('Lỗi khi lưu Supabase:', error);
      return NextResponse.json({ 
        success: false, 
        error: error.message 
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Đã nhận link và lưu vào Database thành công!',
      data: data || body
    });

  } catch (error) {
    console.error('Lỗi hệ thống API:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}