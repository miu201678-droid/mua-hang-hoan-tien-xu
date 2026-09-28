import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Link chia sẻ công khai chứa danh sách 5 đơn hàng thực tế của bạn
const SHARE_URL = 'https://addlivetag.com/tool/conversion/zalo-share.php?t=75f92463dd1564ed8f1375d37c3621d3';

async function handleSync() {
  try {
    // 1. Tải giao diện HTML từ link chia sẻ Addlivetag
    const res = await fetch(SHARE_URL, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    if (!res.ok) {
      return NextResponse.json({
        success: false,
        error: `Không thể kết nối máy chủ Addlivetag (Mã lỗi: ${res.status})`
      }, { status: 500 });
    }

    const htmlText = await res.text();
    const ordersToInsert = [];

    // 2. Thử giải mã nếu trả về dạng JSON
    try {
      const json = JSON.parse(htmlText);
      const list = Array.isArray(json) ? json : (json.data || []);
      if (Array.isArray(list) && list.length > 0) {
        for (const item of list) {
          const orderId = String(item.madon || item.order_id || item.orderCode || '').trim();
          if (orderId) {
            const statusText = String(item.trangthai || item.status || '').toLowerCase();
            let statusInt = 0;
            if (statusText.includes('duyệt') || statusText.includes('thành công') || statusText === '1') statusInt = 1;
            else if (statusText.includes('hủy') || statusText.includes('huỷ') || statusText.includes('không hợp lệ') || statusText === '2') statusInt = 2;

            ordersToInsert.push({
              order_id: orderId,
              user_id: String(item.thanhvien || item.subid || 'N/A').trim(),
              total_price: Number(item.giatri || 0),
              cashback_amount: Number(item.hoanhong || 0),
              status: statusInt
            });
          }
        }
      }
    } catch (e) {
      // Nếu là HTML -> Chuyển sang quét thẻ Bảng <tr> <td>
    }

    // 3. Tiến hành bóc tách dữ liệu từ Bảng HTML
    if (ordersToInsert.length === 0) {
      const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let trMatch;

      while ((trMatch = trRegex.exec(htmlText)) !== null) {
        const rowContent = trMatch[1];
        const tdMatches = [...rowContent.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
        
        const cells = tdMatches.map(m => 
          m[1]
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/&nbsp;/g, ' ')
            .trim()
        );

        if (cells.length >= 4) {
          // Lùng tìm ô chứa Mã đơn hàng (chuỗi số/chữ từ 8-25 ký tự)
          let orderId = '';
          for (const cell of cells) {
            const clean = cell.replace(/\s+/g, '');
            if (/^[A-Z0-9]{8,25}$/i.test(clean) && !/^(THỜIGIAN\vert{}SẢNPHẨM\vert{}TRẠNGTHÁI\vert{}MÃĐƠN)$/i.test(clean)) {
              orderId = clean;
              break;
            }
          }

          if (orderId) {
            // Trích xuất Tên thành viên (User ID)
            let userId = 'N/A';
            for (const cell of cells) {
              if (cell && !cell.includes(orderId) && !cell.includes('đ') && !/^\d{2}\/\d{2}/.test(cell)) {
                const firstLine = cell.split('\n')[0].trim();
                if (firstLine && firstLine.length > 1 && !/^(Shopee|TikTok|Lazada)$/i.test(firstLine)) {
                  userId = firstLine;
                  break;
                }
              }
            }

            // Trích xuất Hoa hồng
            let cashback = 0;
            for (const cell of cells) {
              const numMatch = cell.match(/([\d\.,]+)\s*đ/);
              if (numMatch) {
                cashback = Number(numMatch[1].replace(/[^\d]/g, '')) || 0;
                break;
              }
            }

            // Trích xuất Trạng thái (0: Đang xử lý, 1: Đã duyệt, 2: Hủy/Không hợp lệ)
            const rowTextLower = rowContent.toLowerCase();
            let statusInt = 0;
            if (rowTextLower.includes('đã duyệt') || rowTextLower.includes('thành công')) {
              statusInt = 1;
            } else if (rowTextLower.includes('huỷ') || rowTextLower.includes('hủy') || rowTextLower.includes('không hợp lệ')) {
              statusInt = 2;
            }

            ordersToInsert.push({
              order_id: orderId,
              user_id: userId,
              total_price: 0,
              cashback_amount: cashback,
              status: statusInt
            });
          }
        }
      }
    }

    if (ordersToInsert.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Kết nối thành công tới Addlivetag nhưng chưa tìm thấy đơn hàng.',
        data: []
      });
    }

    // Lọc bỏ đơn hàng trùng lặp mã
    const uniqueMap = new Map();
    for (const ord of ordersToInsert) {
      if (!uniqueMap.has(ord.order_id)) {
        uniqueMap.set(ord.order_id, ord);
      }
    }
    const finalOrders = Array.from(uniqueMap.values());

    // 4. Lưu / Cập nhật trực tiếp vào Supabase
    const { data, error } = await supabaseAdmin
      .from('cashback_orders')
      .upsert(finalOrders, { onConflict: 'order_id' })
      .select();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: `Tự động quét và đồng bộ thành công ${data?.length || 0} đơn hàng từ Addlivetag về Supabase!`,
      data
    });

  } catch (error) {
    console.error('❌ Lỗi API Sync:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() { return handleSync(); }
export async function POST() { return handleSync(); }