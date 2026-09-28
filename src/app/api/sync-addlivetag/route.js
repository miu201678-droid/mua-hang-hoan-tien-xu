import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Link chia sẻ dữ liệu live từ Addlivetag của bạn
const SHARE_URL = 'https://addlivetag.com/tool/conversion/zalo-share.php?t=75f92463dd1564ed8f1375d37c3621d3';

async function handleSync(request) {
  try {
    // 1. Tự động gửi request kéo HTML trực tiếp từ Addlivetag
    const res = await fetch(SHARE_URL, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!res.ok) {
      throw new Error(`Không thể kết nối Addlivetag (Mã lỗi: ${res.status})`);
    }

    const htmlText = await res.text();

    // 2. Tự động quét và bóc tách bảng dữ liệu HTML thời gian thực (100% Dynamic)
    const ordersToInsert = [];
    const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let trMatch;

    while ((trMatch = trRegex.exec(htmlText)) !== null) {
      const rowHtml = trMatch[1];
      const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
      const cells = [];
      let tdMatch;

      while ((tdMatch = tdRegex.exec(rowHtml)) !== null) {
        const rawCell = tdMatch[1];
        const textContent = rawCell
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .trim();
        
        cells.push(textContent);
      }

      // Bóc tách theo cấu trúc cột thực tế của Addlivetag
      if (cells.length >= 6) {
        const orderIdText = cells[2]?.trim() || ''; // Cột Mã đơn
        const userLines = cells[3]?.split('\n') || [];
        const userId = userLines[0]?.trim() || 'N/A'; // Cột Thành viên (Lấy dòng tên trên cùng)

        const commissionText = cells[5] || ''; // Cột Hoa hồng
        const rawNum = commissionText.replace(/[^\d]/g, '');
        const cashbackAmount = rawNum ? Number(rawNum) : 0;

        // Phân loại trạng thái đơn hàng (0: Chờ xử lý, 1: Đã duyệt, 2: Đã hủy)
        const rowTextLower = rowHtml.toLowerCase();
        let statusInt = 0;
        if (rowTextLower.includes('đã duyệt') || rowTextLower.includes('thành công')) {
          statusInt = 1;
        } else if (rowTextLower.includes('huỷ') || rowTextLower.includes('không hợp lệ')) {
          statusInt = 2;
        } else if (rowTextLower.includes('đang xử lý') || rowTextLower.includes('chờ xử lý')) {
          statusInt = 0;
        }

        // Lọc loại bỏ dòng tiêu đề
        if (orderIdText && orderIdText !== 'MÃ ĐƠN' && orderIdText.length >= 6) {
          ordersToInsert.push({
            order_id: orderIdText,
            user_id: userId,
            total_price: 0,
            cashback_amount: cashbackAmount,
            status: statusInt
          });
        }
      }
    }

    if (ordersToInsert.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Đã quét trang Addlivetag nhưng hiện chưa có đơn hàng nào phát sinh.',
        data: []
      });
    }

    // 3. Lưu toàn bộ dữ liệu quét được vào Supabase
    const { data, error } = await supabaseAdmin
      .from('cashback_orders')
      .upsert(ordersToInsert, { onConflict: 'order_id' })
      .select();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      message: `Tự động quét thành công ${data?.length || 0} đơn hàng live từ Addlivetag!`,
      data
    });

  } catch (error) {
    console.error('❌ Lỗi quét dữ liệu Addlivetag:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(request) {
  return handleSync(request);
}

export async function POST(request) {
  return handleSync(request);
}