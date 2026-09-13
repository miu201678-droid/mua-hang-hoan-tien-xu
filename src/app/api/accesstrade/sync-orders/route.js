import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Ép API này chạy ở chế độ động, tránh bị lỗi build tĩnh trên Render
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const apiKey = process.env.ACCESSTRADE_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Thiếu ACCESSTRADE_API_KEY trong file .env.local' },
        { status: 500 }
      );
    }

    // Tính ngày cách đây 30 ngày theo định dạng YYYY-MM-DD chuẩn của Accesstrade
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sinceDate = thirtyDaysAgo.toISOString().split('T')[0];

    const apiUrl = `https://api.accesstrade.vn/v1/order-list?since=${sinceDate}&status=1`;

    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      cache: 'no-store'
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        { success: false, error: `Accesstrade API Lỗi (${response.status}): ${errorText}` },
        { status: response.status }
      );
    }

    const result = await response.json();
    const orders = result.data || [];

    const processedOrders = orders.map(order => {
      const pubCommission = order.pub_commission || 0;
      return {
        order_id: order.order_id,
        user_id: order.utm_content || order.sub1 || "khach_chua_dang_nhap",
        total_price: order.transaction_value,
        cashback_amount: pubCommission * 0.5,
        status: 1, // Trạng thái đơn hàng
        created_at: order.created_at || new Date().toISOString()
      };
    });

    // Tự động lưu hoặc cập nhật danh sách đơn hàng vào Supabase
    if (processedOrders.length > 0) {
      const { error: dbError } = await supabase
        .from('cashback_orders')
        .upsert(processedOrders, { onConflict: 'order_id' });

      if (dbError) {
        console.error('Lỗi khi lưu vào Supabase:', dbError);
        return NextResponse.json(
          { success: false, error: `Lỗi Supabase: ${dbError.message}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      total_orders: processedOrders.length,
      data: processedOrders
    });

  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}