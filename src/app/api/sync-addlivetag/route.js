import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const SHARE_URL = 'https://addlivetag.com/tool/conversion/zalo-share.php?t=75f92463dd1564ed8f1375d37c3621d3';

async function handleSync(request) {
  try {
    const res = await fetch(SHARE_URL, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': 'https://addlivetag.com/'
      }
    });

    if (!res.ok) {
      throw new Error(`Mã lỗi HTTP: ${res.status}`);
    }

    const htmlText = await res.text();
    const ordersToInsert = [];

    // 1. Giải mã JSON nếu Addlivetag trả về mảng dữ liệu JSON
    try {
      const json = JSON.parse(htmlText);
      const list = Array.isArray(json) ? json : (json.data || json.orders || []);
      if (Array.isArray(list) && list.length > 0) {
        for (const item of list) {
          const orderId = String(item.madon || item.order_id || item.orderCode || item.code || '').trim();
          if (orderId) {
            const statusText = String(item.trangthai || item.status || '').toLowerCase();
            let statusInt = 0;
            if (statusText.includes('duyệt') || statusText.includes('thành công') || statusText === '1') statusInt = 1;
            else if (statusText.includes('hủy') || statusText.includes('huỷ') || statusText.includes('không hợp lệ') || statusText === '2') statusInt = 2;

            ordersToInsert.push({
              order_id: orderId,
              user_id: String(item.thanhvien || item.subid || item.sub1 || 'N/A').trim(),
              total_price: Number(item.giatri || 0),
              cashback_amount: Number(item.hoanhong || item.commission || 0),
              status: statusInt
            });
          }
        }
      }
    } catch (e) {
      // Không phải JSON -> Chuyển sang quét HTML
    }

    // 2. Bóc tách HTML siêu linh hoạt theo dòng / ô
    if (ordersToInsert.length === 0) {
      const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let rowMatch;

      while ((rowMatch = rowRegex.exec(htmlText)) !== null) {
        const rowHtml = rowMatch[1];
        const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
        const cells = [];
        let cellMatch;

        while ((cellMatch = cellRegex.exec(rowHtml)) !== null) {
          const cleanCell = cellMatch[1]
            .replace(/&nbsp;/g, ' ')
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]+>/g, '')
            .trim();
          cells.push(cleanCell);
        }

        if (cells.length >= 2) {
          let orderId = '';
          let userId = 'N/A';
          let cashbackAmount = 0;

          // Lùng tìm mã đơn (Chuỗi hoa/số từ 8 - 25 ký tự)
          for (const cell of cells) {
            const potentialCodes = cell.match(/[A-Z0-9]{8,25}/gi);
            if (potentialCodes) {
              for (const code of potentialCodes) {
                if (code.length >= 8 && !/^(STT|MADON|TRANGTHAI|HOANHONG|DANHSACH)$/i.test(code)) {
                  orderId = code;
                  break;
                }
              }
            }
          }

          if (orderId) {
            const rowLower = rowHtml.toLowerCase();
            let statusInt = 0;
            if (rowLower.includes('đã duyệt') || rowLower.includes('thành công') || rowLower.includes('duyệt')) {
              statusInt = 1;
            } else if (rowLower.includes('huỷ') || rowLower.includes('hủy') || rowLower.includes('không hợp lệ')) {
              statusInt = 2;
            }

            // Tìm tên thành viên / SubID
            for (const c of cells) {
              if (c && !c.includes(orderId) && !/^\d+$/.test(c) && !c.includes('đ') && c.length > 1) {
                const firstLine = c.split('\n')[0].trim();
                if (firstLine && !/^(stt|mã|đơn|hoàn|trạng|ngày|tùy|hành|chức|năng)$/i.test(firstLine)) {
                  userId = firstLine;
                  break;
                }
              }
            }

            // Tìm số tiền hoa hồng
            for (const c of cells) {
              const numMatch = c.match(/([\d\.,]+)\s*đ?/);
              if (numMatch && (c.includes('đ') || c.includes('VNĐ') || c.includes('.'))) {
                const parsedNum = Number(numMatch[1].replace(/[^\d]/g, ''));
                if (parsedNum > 0) {
                  cashbackAmount = parsedNum;
                  break;
                }
              }
            }

            ordersToInsert.push({
              order_id: orderId,
              user_id: userId,
              total_price: 0,
              cashback_amount: cashbackAmount,
              status: statusInt
            });
          }
        }
      }
    }

    // 3. Scanner Quét mã toàn trang (Nếu bảng dùng cấu trúc div/flexbox)
    if (ordersToInsert.length === 0) {
      const allOrderCodes = htmlText.match(/268[A-Z0-9]{8,17}/gi) || htmlText.match(/[A-Z0-9]{12,18}/gi) || [];
      const uniqueCodes = [...new Set(allOrderCodes)].filter(code => !/^(THONGKE|DANGXULY|DANHSACH)$/i.test(code));

      for (const code of uniqueCodes) {
        ordersToInsert.push({
          order_id: code,
          user_id: 'Khách hàng',
          total_price: 0,
          cashback_amount: 0,
          status: 0
        });
      }
    }

    if (ordersToInsert.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Đã kết nối tới Addlivetag nhưng không quét thấy dữ liệu đơn hàng.',
        data: []
      });
    }

    // Lọc bỏ đơn hàng trùng mã
    const uniqueOrdersMap = new Map();
    for (const ord of ordersToInsert) {
      if (!uniqueOrdersMap.has(ord.order_id)) {
        uniqueOrdersMap.set(ord.order_id, ord);
      }
    }
    const finalOrders = Array.from(uniqueOrdersMap.values());

    // 4. Cập nhật dữ liệu vào Supabase
    const { data, error } = await supabaseAdmin
      .from('cashback_orders')
      .upsert(finalOrders, { onConflict: 'order_id' })
      .select();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: `Đã tự động quét và cập nhật thành công ${data?.length || 0} đơn hàng live từ Addlivetag!`,
      data
    });

  } catch (error) {
    console.error('❌ Lỗi sync Addlivetag:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(request) { return handleSync(request); }
export async function POST(request) { return handleSync(request); }