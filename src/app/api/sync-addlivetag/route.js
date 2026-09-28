import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// API Key chính thức khởi tạo cho hoantienxu.io.vn
const ADDLIVETAG_KEY = 'bd01b485efb9b97790d6bb50159c740e5053d360fd6bc73f';

// Các đường dẫn API chuẩn từ Addlivetag
const API_URLS = [
  `https://addlivetag.com/tool/conversion/zalo.php?export=json&key=${ADDLIVETAG_KEY}`,
  `https://addlivetag.com/tool/conversion/zalo-share.php?key=${ADDLIVETAG_KEY}&export=json`
];

async function handleSync(request) {
  try {
    let rawData = null;

    // 1. Kết nối gọi API chính thức bằng Key của Website
    for (const url of API_URLS) {
      try {
        const res = await fetch(url, {
          cache: 'no-store',
          headers: {
            'User-Agent': 'HoanTienXu/1.0 (https://hoantienxu.io.vn)'
          }
        });

        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json) || (json && typeof json === 'object')) {
            rawData = json;
            break;
          }
        }
      } catch (err) {
        console.log('Thử kết nối API Addlivetag...', url);
      }
    }

    if (!rawData) {
      return NextResponse.json({
        success: false,
        error: 'Chưa thể lấy dữ liệu từ API Addlivetag. Vui lòng kiểm tra lại Key trên hệ thống.'
      }, { status: 500 });
    }

    // 2. Chuyển đổi dữ liệu chuẩn hóa
    const list = Array.isArray(rawData) ? rawData : (rawData.data || rawData.orders || []);
    const ordersToInsert = [];

    for (const item of list) {
      const orderId = String(item.madon || item.order_id || item.orderCode || item.code || '').trim();
      if (orderId) {
        const statusText = String(item.trangthai || item.status || '').toLowerCase();
        let statusInt = 0;
        if (statusText.includes('duyệt') || statusText.includes('thành công') || statusText === '1') {
          statusInt = 1;
        } else if (statusText.includes('hủy') || statusText.includes('huỷ') || statusText.includes('không hợp lệ') || statusText === '2') {
          statusInt = 2;
        }

        ordersToInsert.push({
          order_id: orderId,
          user_id: String(item.thanhvien || item.subid || item.sub1 || 'N/A').trim(),
          total_price: Number(item.giatri || item.total_price || 0),
          cashback_amount: Number(item.hoanhong || item.commission || 0),
          status: statusInt
        });
      }
    }

    if (ordersToInsert.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Kết nối thành công tới Addlivetag API! Hiện chưa có đơn hàng phát sinh.',
        data: []
      });
    }

    // 3. Cập nhật trực tiếp vào Supabase Database
    const { data, error } = await supabaseAdmin
      .from('cashback_orders')
      .upsert(ordersToInsert, { onConflict: 'order_id' })
      .select();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: `Đã kết nối API thành công và đồng bộ ${data?.length || 0} đơn hàng về hệ thống!`,
      data
    });

  } catch (error) {
    console.error('❌ Lỗi API Sync:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(request) { return handleSync(request); }
export async function POST(request) { return handleSync(request); }