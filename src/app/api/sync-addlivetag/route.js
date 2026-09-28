import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const SHARE_URL = 'https://addlivetag.com/tool/conversion/zalo-share.php?t=75f92463dd1564ed8f1375d37c3621d3';
const API_KEY_URL = 'https://addlivetag.com/tool/conversion/zalo.php?export=json&key=7a1ad8b3615723c92efb44ba55b4bbc45f7058a7cad0795e';

async function handleSync(request) {
  try {
    let responseText = '';
    let fetchSuccess = false;

    // Danh sách đường dẫn dự phòng (tự động thử nếu một link báo 404)
    const urlsToTry = [SHARE_URL, API_KEY_URL];

    for (const url of urlsToTry) {
      try {
        const res = await fetch(url, {
          cache: 'no-store',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'vi,vi-VN;q=0.9,en-US;q=0.8'
          }
        });

        if (res.ok) {
          responseText = await res.text();
          fetchSuccess = true;
          break;
        }
      } catch (e) {
        console.log('Thử đường dẫn thất bại, đang chuyển đường dẫn tiếp theo...', url);
      }
    }

    if (!fetchSuccess || !responseText) {
      return NextResponse.json({
        success: false,
        error: 'Chưa thể kết nối tới Addlivetag. Vui lòng kiểm tra lại trạng thái máy chủ Addlivetag.'
      }, { status: 500 });
    }

    const ordersToInsert = [];

    // 1. Trường hợp Addlivetag trả về dữ liệu JSON
    try {
      const json = JSON.parse(responseText);
      if (Array.isArray(json) && json.length > 0) {
        for (const item of json) {
          const orderId = String(item.madon || item.order_id || item.orderCode || '');
          if (orderId) {
            const statusText = String(item.trangthai || item.status || '').toLowerCase();
            let statusInt = 0;
            if (statusText.includes('duyệt') || statusText.includes('thành công') || statusText === '1') statusInt = 1;
            else if (statusText.includes('huỷ') || statusText.includes('hủy') || statusText.includes('không hợp lệ') || statusText === '2') statusInt = 2;

            ordersToInsert.push({
              order_id: orderId,
              user_id: String(item.thanhvien || item.subid || 'N/A'),
              total_price: Number(item.giatri || 0),
              cashback_amount: Number(item.hoanhong || item.commission || 0),
              status: statusInt
            });
          }
        }
      }
    } catch (jsonErr) {
      // 2. Trường hợp Addlivetag trả về giao diện Bảng HTML -> Bóc tách dữ liệu tự động
      const rowMatches = [...responseText.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)];

      for (const rowMatch of rowMatches) {
        const rowContent = rowMatch[1];
        const cells = [...rowContent.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m => 
          m[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim()
        );

        if (cells.length >= 5) {
          // Tìm ô chứa mã đơn hàng
          const orderId = cells.find(c => /^[A-Z0-9]{8,}$/i.test(c.replace(/\s+/g, ''))) || '';
          
          if (orderId && !orderId.includes('MÃ ĐƠN')) {
            // Lấy tên thành viên (User ID)
            const userLines = (cells[3] || '').split('\n');
            const cleanUserId = userLines[0].trim() || 'N/A';

            // Lấy tiền hoa hồng
            const commCell = cells.find(c => c.includes('đ') || /[\d\.,]+\s*đ/.test(c)) || '0';
            const cashbackAmount = Number(commCell.replace(/[^\d]/g, '')) || 0;

            // Xác định trạng thái đơn
            const rowLower = rowContent.toLowerCase();
            let statusInt = 0;
            if (rowLower.includes('đã duyệt') || rowLower.includes('thành công')) statusInt = 1;
            else if (rowLower.includes('huỷ') || rowLower.includes('hủy') || rowLower.includes('không hợp lệ')) statusInt = 2;

            ordersToInsert.push({
              order_id: orderId,
              user_id: cleanUserId,
              total_price: 0,
              cashback_amount: cashbackAmount,
              status: statusInt
            });
          }
        }
      }
    }

    if (ordersToInsert.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Đã kết nối thành công tới Addlivetag nhưng chưa có đơn hàng mới nào.',
        data: []
      });
    }

    // 3. Cập nhật dữ liệu bóc tách được vào Supabase
    const { data, error } = await supabaseAdmin
      .from('cashback_orders')
      .upsert(ordersToInsert, { onConflict: 'order_id' })
      .select();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: `Đã tự động quét và cập nhật ${data?.length || 0} đơn hàng live từ Addlivetag!`,
      data
    });

  } catch (error) {
    console.error('❌ Lỗi hệ thống API Route:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(request) { return handleSync(request); }
export async function POST(request) { return handleSync(request); }