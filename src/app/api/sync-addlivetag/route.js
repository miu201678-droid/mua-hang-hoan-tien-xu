import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Tích hợp sẵn tất cả mã Key và Token từ tài khoản Addlivetag của bạn
const API_KEYS = [
  '7a1ad8b3615723c92efb44ba55b4bbc45f7058a7cad0795e', // Key chính
  'bd01b485efb9b97790d6bb50159c740e5053d360fd6bc73f'  // Key phụ (hoantienxu.io.vn)
];

const SHARE_TOKEN = '75f92463dd1564ed8f1375d37c3621d3';

async function handleSync() {
  try {
    let rawData = null;
    let htmlContent = '';

    // 1. Lần lượt thử lấy dữ liệu qua API Key bằng định dạng JSON
    for (const key of API_KEYS) {
      try {
        const res = await fetch(`https://addlivetag.com/tool/conversion/zalo.php?export=json&key=${key}`, {
          cache: 'no-store',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            'Accept': 'application/json, text/plain, */*'
          }
        });

        if (res.ok) {
          const text = await res.text();
          try {
            const json = JSON.parse(text);
            if (Array.isArray(json) && json.length > 0) {
              rawData = json;
              break;
            }
          } catch (e) {
            // Không phải JSON thuần
          }
        }
      } catch (err) {
        console.log(`Key ${key} không phản hồi, thử phương án tiếp...`);
      }
    }

    // 2. Phương án dự phòng: Lấy dữ liệu qua Link Chia Sẻ Công Khai
    if (!rawData) {
      try {
        const shareUrl = `https://addlivetag.com/tool/conversion/zalo-share.php?t=${SHARE_TOKEN}`;
        const resShare = await fetch(shareUrl, {
          cache: 'no-store',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          }
        });

        if (resShare.ok) {
          htmlContent = await resShare.text();
          try {
            const jsonShare = JSON.parse(htmlContent);
            if (Array.isArray(jsonShare)) rawData = jsonShare;
          } catch (e) {
            // Dữ liệu trả về dạng HTML Table
          }
        }
      } catch (e) {
        console.log('Lỗi kết nối link chia sẻ.');
      }
    }

    const ordersToInsert = [];

    // Trường hợp 1: Có dữ liệu JSON từ API -> Chuẩn hóa dữ liệu
    if (rawData && Array.isArray(rawData)) {
      for (const item of rawData) {
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

    // Trường hợp 2: Dữ liệu dạng Bảng HTML -> Bóc tách tự động
    if (ordersToInsert.length === 0 && htmlContent) {
      const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let trMatch;

      while ((trMatch = trRegex.exec(htmlContent)) !== null) {
        const rowContent = trMatch[1];
        const tdMatches = [...rowContent.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)];
        const cells = tdMatches.map(m => m[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim());

        if (cells.length >= 4) {
          let orderId = '';
          for (const cell of cells) {
            const clean = cell.replace(/\s+/g, '');
            if (/^[A-Z0-9]{8,25}$/i.test(clean) && !/^(THỜIGIAN\vert{}SẢNPHẨM\vert{}TRẠNGTHÁI\vert{}MÃĐƠN)$/i.test(clean)) {
              orderId = clean;
              break;
            }
          }

          if (orderId) {
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

            let cashback = 0;
            for (const cell of cells) {
              const numMatch = cell.match(/([\d\.,]+)\s*đ/);
              if (numMatch) {
                cashback = Number(numMatch[1].replace(/[^\d]/g, '')) || 0;
                break;
              }
            }

            const rowTextLower = rowContent.toLowerCase();
            let statusInt = 0;
            if (rowTextLower.includes('đã duyệt') || rowTextLower.includes('thành công')) statusInt = 1;
            else if (rowTextLower.includes('huỷ') || rowTextLower.includes('hủy') || rowTextLower.includes('không hợp lệ')) statusInt = 2;

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
        message: 'Đã kết nối tới Addlivetag thành công nhưng chưa có đơn hàng nào.',
        data: []
      });
    }

    // Lọc trùng đơn hàng
    const uniqueMap = new Map();
    for (const ord of ordersToInsert) {
      if (!uniqueMap.has(ord.order_id)) uniqueMap.set(ord.order_id, ord);
    }
    const finalOrders = Array.from(uniqueMap.values());

    // 3. Cập nhật vào Supabase
    const { data, error } = await supabaseAdmin
      .from('cashback_orders')
      .upsert(finalOrders, { onConflict: 'order_id' })
      .select();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: `Đã kết nối thành công và đồng bộ ${data?.length || 0} đơn hàng về Supabase!`,
      data
    });

  } catch (error) {
    console.error('❌ Lỗi API Sync:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() { return handleSync(); }
export async function POST() { return handleSync(); }