import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const API_KEYS = [
  '7a1ad8b3615723c92efb44ba55b4bbc45f7058a7cad0795e',
  'bd01b485efb9b97790d6bb50159c740e5053d360fd6bc73f'
];

const SHARE_TOKEN = '75f92463dd1564ed8f1375d37c3621d3';

async function handleSync() {
  try {
    let rawData = null;
    let htmlContent = '';
    let debugInfo = [];

    // 1. Thử kéo qua JSON từ API Keys
    for (const key of API_KEYS) {
      const testUrls = [
        `https://addlivetag.com/tool/conversion/index.php?export=json&key=${key}`,
        `https://addlivetag.com/tool/conversion/zalo.php?export=json&key=${key}`,
        `https://addlivetag.com/tool/conversion/api.php?key=${key}`
      ];

      for (const url of testUrls) {
        try {
          const res = await fetch(url, {
            cache: 'no-store',
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
          });
          if (res.ok) {
            const text = await res.text();
            if (text.startsWith('[') || text.startsWith('{')) {
              const json = JSON.parse(text);
              if (Array.isArray(json) && json.length > 0) {
                rawData = json;
                debugInfo.push(`Lấy thành công JSON từ URL: ${url}`);
                break;
              }
            }
          }
        } catch (e) {}
      }
      if (rawData) break;
    }

    // 2. Nếu JSON rỗng, kéo từ Link Chia Sẻ Public
    if (!rawData) {
      const shareUrls = [
        `https://addlivetag.com/tool/conversion/zalo-share.php?t=${SHARE_TOKEN}`,
        `https://addlivetag.com/tool/conversion/index.php?share=${SHARE_TOKEN}`
      ];

      for (const sUrl of shareUrls) {
        try {
          const resShare = await fetch(sUrl, {
            cache: 'no-store',
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
            }
          });

          if (resShare.ok) {
            const text = await resShare.text();
            if (text.length > 200) {
              htmlContent = text;
              debugInfo.push(`Tải thành công HTML từ: ${sUrl} (Độ dài: ${text.length} ký tự)`);
              break;
            }
          }
        } catch (e) {}
      }
    }

    const ordersToInsert = [];

    // Xử lý dữ liệu JSON nếu có
    if (rawData && Array.isArray(rawData)) {
      for (const item of rawData) {
        const orderId = String(item.madon || item.order_id || item.orderCode || item.id || '').trim();
        if (orderId) {
          const statusText = String(item.trangthai || item.status || '').toLowerCase();
          let statusInt = 0;
          if (statusText.includes('duyệt') || statusText.includes('thành công') || statusText === '1') statusInt = 1;
          else if (statusText.includes('hủy') || statusText.includes('huỷ') || statusText.includes('không hợp lệ') || statusText === '2') statusInt = 2;

          ordersToInsert.push({
            order_id: orderId,
            user_id: String(item.thanhvien || item.subid || item.sub_id || 'N/A').trim(),
            amount: Number(item.giatri || item.amount || 0),
            commission: Number(item.hoanhong || item.commission || 0),
            status: statusInt
          });
        }
      }
    }

    // Xử lý dữ liệu Bảng HTML nếu kéo từ link public
    if (ordersToInsert.length === 0 && htmlContent) {
      // Tìm tất cả thẻ tr
      const trMatches = htmlContent.match(/<tr[^>]*>([\s\S]*?)<\/tr>/gi) || [];
      debugInfo.push(`Tìm thấy ${trMatches.length} dòng <tr> trong HTML`);

      for (const trHtml of trMatches) {
        const tdMatches = [...trHtml.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(m => 
          m[1].replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').trim()
        );

        if (tdMatches.length >= 3) {
          // Tìm Mã Đơn
          let orderId = '';
          for (const cell of tdMatches) {
            const match = cell.match(/([A-Z0-9]{9,25})/i);
            if (match && !/^(THỜIGIAN|SẢNPHẨM|TRẠNGTHÁI|MÃĐƠN|SHOPEE|TIKTOK)$/i.test(match[1])) {
              orderId = match[1];
              break;
            }
          }

          if (orderId) {
            // Tìm Hoa Hồng
            let commission = 0;
            for (const cell of tdMatches) {
              const moneyMatch = cell.match(/([\d\.,]+)\s*đ/);
              if (moneyMatch) {
                commission = Number(moneyMatch[1].replace(/[^\d]/g, '')) || 0;
                break;
              }
            }

            // Trạng thái
            const rowText = trHtml.toLowerCase();
            let statusInt = 0;
            if (rowText.includes('hoàn thành') || rowText.includes('thành công') || rowText.includes('đã duyệt')) statusInt = 1;
            else if (rowText.includes('hủy') || rowText.includes('huỷ') || rowText.includes('không hợp lệ')) statusInt = 2;

            ordersToInsert.push({
              order_id: orderId,
              user_id: 'N/A',
              amount: 0,
              commission: commission,
              status: statusInt
            });
          }
        }
      }
    }

    if (ordersToInsert.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'Chưa bóc tách được đơn hàng nào.',
        debugInfo,
        data: []
      });
    }

    // Lọc trùng theo order_id
    const uniqueMap = new Map();
    for (const ord of ordersToInsert) {
      if (!uniqueMap.has(ord.order_id)) uniqueMap.set(ord.order_id, ord);
    }
    const finalOrders = Array.from(uniqueMap.values());

    // Cập nhật vào Supabase
    const { data, error } = await supabaseAdmin
      .from('orders')
      .upsert(finalOrders, { onConflict: 'order_id' })
      .select();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: `Đã đồng bộ thành công ${data?.length || 0} đơn hàng vào Supabase!`,
      debugInfo,
      data
    });

  } catch (error) {
    console.error('❌ Lỗi API Sync:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET() { return handleSync(); }
export async function POST() { return handleSync(); }