import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

async function handleSync(request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // 1. Tự động đọc dữ liệu từ GET Query Params hoặc POST Body (JSON / Form-Data)
    let body = {};
    if (request.method === 'POST') {
      const contentType = request.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        body = await request.json().catch(() => ({}));
      } else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
        const formData = await request.formData().catch(() => new Map());
        body = Object.fromEntries(formData.entries());
      }
    }

    // 2. Bóc tách linh hoạt các biến
    const finalUserId = 
      searchParams.get('sub1') || searchParams.get('sub_id') || searchParams.get('uid') ||
      body.sub1 || body.sub_id || body.userId || body.uid || null;

    const orderId = 
      searchParams.get('orderCode') || searchParams.get('order_code') || searchParams.get('order_id') ||
      body.orderCode || body.order_code || body.order_id || null;

    const rawCommission = 
      searchParams.get('commission') || body.commission || 0;

    const rawStatus = 
      searchParams.get('status') || body.status || '0';

    // Chuyển status về dạng số int4 cho Supabase (0: Chờ xử lý, 1: Thành công, 2: Đã hủy)
    let statusInt = 0;
    if (rawStatus === 'completed' || rawStatus === '1' || rawStatus === 1) {
      statusInt = 1;
    } else if (rawStatus === 'canceled' || rawStatus === '2' || rawStatus === 2) {
      statusInt = 2;
    } else {
      statusInt = Number(rawStatus) || 0;
    }

    console.log('==> [AddLiveTag Sync Received]:', {
      finalUserId,
      orderId,
      commission: rawCommission,
      status: statusInt
    });

    if (!orderId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Thiếu mã đơn hàng (order_id)' 
      }, { status: 400 });
    }

    // 3. Upsert vào Supabase khớp chính xác tên cột: order_id, user_id, total_price, cashback_amount, status
    const { data, error } = await supabaseAdmin
      .from('cashback_orders')
      .upsert(
        [
          {
            order_id: orderId,
            user_id: finalUserId,
            total_price: 0,
            cashback_amount: Number(rawCommission || 0),
            status: statusInt
          }
        ],
        { onConflict: 'order_id' }
      )
      .select();

    if (error) {
      console.error('❌ Lỗi lưu Supabase:', error);
      return NextResponse.json({ 
        success: false, 
        error: `Supabase Error: ${error.message}` 
      }, { status: 400 });
    }

    console.log('✅ Đồng bộ đơn hàng Supabase thành công:', data?.[0]);

    return NextResponse.json({
      success: true,
      message: 'Đã đồng bộ đơn hàng thành công!',
      data: data?.[0] || null
    });

  } catch (error) {
    console.error('❌ Lỗi hệ thống API Route:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

export async function GET(request) {
  return handleSync(request);
}

export async function POST(request) {
  return handleSync(request);
}