import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// API Key chính từ Addlivetag
const ADDLIVETAG_API_KEY = '7a1ad8b3615723c92efb44ba55b4bbc45f7058a7cad0795e';

async function handleSync(request) {
  try {
    const { searchParams } = new URL(request.url);

    // 1. Đọc dữ liệu nếu có request POST/GET gửi tới dạng Webhook
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

    const singleOrderId = 
      searchParams.get('orderCode') || searchParams.get('order_code') || searchParams.get('order_id') ||
      body.orderCode || body.order_code || body.order_id || null;

    // TH 1: Bắn đơn lẻ từ Webhook (Nếu Addlivetag gọi tới)
    if (singleOrderId) {
      const finalUserId = 
        searchParams.get('sub1') || searchParams.get('sub_id') || searchParams.get('uid') ||
        body.sub1 || body.sub_id || body.userId || body.uid || 'N/A';

      const rawCommission = searchParams.get('commission') || body.commission || 0;
      const rawStatus = searchParams.get('status') || body.status || '0';

      let statusInt = 0;
      if (rawStatus === 'completed' || rawStatus === '1' || rawStatus === 1) statusInt = 1;
      else if (rawStatus === 'canceled' || rawStatus === '2' || rawStatus === 2) statusInt = 2;
      else statusInt = Number(rawStatus) || 0;

      const { data, error } = await supabaseAdmin
        .from('cashback_orders')
        .upsert(
          [{ order_id: singleOrderId, user_id: finalUserId, total_price: 0, cashback_amount: Number(rawCommission || 0), status: statusInt }],
          { onConflict: 'order_id' }
        )
        .select();

      if (error) throw error;
      return NextResponse.json({ success: true, message: 'Đã lưu đơn hàng từ Webhook', data: data?.[0] });
    }

    // TH 2: Tự động chủ động gọi sang Addlivetag lấy toàn bộ danh sách đơn hàng về
    const apiUrl = `https://addlivetag.com/tool/conversion/zalo.php?export=json&key=${ADDLIVETAG_API_KEY}`;
    const res = await fetch(apiUrl, { cache: 'no-store' });
    const listData = await res.json().catch(() => []);

    if (Array.isArray(listData) && listData.length > 0) {
      const formattedOrders = listData
        .map(item => ({
          order_id: item.madon || item.order_id || item.orderCode,
          user_id: item.thanhvien || item.subid || item.sub1 || 'N/A',
          total_price: Number(item.giatri || 0),
          cashback_amount: Number(item.hoanhong || item.commission || 0),
          status: item.trangthai === 'Đang xử lý' ? 0 : item.trangthai === 'Đã duyệt' ? 1 : 0
        }))
        .filter(item => item.order_id);

      if (formattedOrders.length > 0) {
        const { data, error } = await supabaseAdmin
          .from('cashback_orders')
          .upsert(formattedOrders, { onConflict: 'order_id' })
          .select();

        if (error) throw error;
        return NextResponse.json({
          success: true,
          message: `Đã đồng bộ thành công ${data?.length || 0} đơn hàng từ Addlivetag về Supabase!`,
          data
        });
      }
    }

    return NextResponse.json({ success: true, message: 'Không tìm thấy đơn hàng mới nào trên Addlivetag' });

  } catch (error) {
    console.error('❌ Lỗi hệ thống API Route:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(request) {
  return handleSync(request);
}

export async function POST(request) {
  return handleSync(request);
}