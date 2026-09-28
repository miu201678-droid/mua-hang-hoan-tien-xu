import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Link chia sẻ dữ liệu công khai từ Addlivetag (xuất ra dạng JSON)
const ADDLIVETAG_SHARE_URL = 'https://addlivetag.com/tool/conversion/zalo-share.php?t=75f92463dd1564ed8f1375d37c3621d3&export=json';

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
          [{ 
            order_id: singleOrderId, 
            user_id: finalUserId, 
            total_price: 0, 
            cashback_amount: Number(rawCommission || 0), 
            status: statusInt 
          }],
          { onConflict: 'order_id' }
        )
        .select();

      if (error) throw error;
      return NextResponse.json({ success: true, message: 'Đã lưu đơn hàng từ Webhook', data: data?.[0] });
    }

    // TH 2: Tự động chủ động kéo toàn bộ danh sách đơn hàng từ Link chia sẻ của Addlivetag
    const res = await fetch(ADDLIVETAG_SHARE_URL, { cache: 'no-store' });
    const listData = await res.json().catch(() => []);

    if (Array.isArray(listData) && listData.length > 0) {
      const formattedOrders = listData
        .map(item => {
          // Xử lý trạng thái: 0 = Đang xử lý, 1 = Đã duyệt, 2 = Đã hủy / Không hợp lệ
          let statusInt = 0;
          const statusText = String(item.trangthai || item.status || '').toLowerCase();
          if (statusText.includes('duyệt') || statusText.includes('thành công') || statusText === '1') {
            statusInt = 1;
          } else if (statusText.includes('huỷ') || statusText.includes('không hợp lệ') || statusText === '2') {
            statusInt = 2;
          }

          return {
            order_id: item.madon || item.order_id || item.orderCode,
            user_id: item.thanhvien || item.subid || item.sub1 || 'N/A',
            total_price: Number(item.giatri || item.total_price || 0),
            cashback_amount: Number(item.hoanhong || item.commission || 0),
            status: statusInt
          };
        })
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