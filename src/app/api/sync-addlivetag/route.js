import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Danh sách mã Key kết nối Addlivetag (Key chính + Key phụ hoantienxu.io.vn)
const KEYS_TO_TRY = [
  '7a1ad8b3615723c92efb44ba55b4bbc45f7058a7cad0795e', // Key chính mặc định
  'bd01b485efb9b97790d6bb50159c740e5053d360fd6bc73f'  // Key phụ hoantienxu.io.vn
];

const SHARE_URL = 'https://addlivetag.com/tool/conversion/zalo-share.php?t=75f92463dd1564ed8f1375d37c3621d3';

async function handleSync(request) {
  try {
    let rawData = null;

    // 1. Lần lượt thử gọi API bằng Key chính và Key phụ
    for (const key of KEYS_TO_TRY) {
      const apiUrl = `https://addlivetag.com/tool/conversion/zalo.php?export=json&key=${key}`;
      try {
        const res = await fetch(apiUrl, {
          cache: 'no-store',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
          }
        });

        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json) && json.length > 0) {
            rawData = json;
            break;
          }
        }
      } catch (e) {
        console.log(`Thử Key ${key} chưa thành công, đang chuyển sang phương án tiếp theo...`);
      }
    }

    // 2. Phương án dự phòng: Nếu gọi bằng Key chưa ra dữ liệu, thử qua Link chia sẻ công khai
    if (!rawData) {
      try {
        const resShare = await fetch(`${SHARE_URL}&export=json`, { cache: 'no-store' });
        if (resShare.ok) {
          const jsonShare = await resShare.json();
          if (Array.isArray(jsonShare)) rawData = jsonShare;
        }
      } catch (e) {
        console.log('Đang xử lý dữ liệu dự phòng...');
      }
    }

    if (!rawData || !Array.isArray(rawData)) {
      return NextResponse.json({
        success: false,
        error: 'Chưa thể lấy dữ liệu từ Addlivetag. Vui lòng kiểm tra lại thiết lập tài khoản Addlivetag.'
      }, { status: 500 });
    }

    // 3. Chuẩn hóa danh sách đơn hàng
    const ordersToInsert = rawData.map(item => {
      const orderId = String(item.madon || item.order_id || item.orderCode || '').trim();
      const statusText = String(item.trangthai || item.status || '').toLowerCase();
      
      let statusInt = 0; // 0: Chờ xử lý
      if (statusText.includes('duyệt') || statusText.includes('thành công') || statusText === '1') {
        statusInt = 1; // 1: Đã duyệt
      } else if (statusText.includes('hủy') || statusText.includes('huỷ') || statusText.includes('không hợp lệ') || statusText === '2') {
        statusInt = 2; // 2: Đã hủy
      }

      return {
        order_id: orderId,
        user_id: String(item.thanhvien || item.subid || item.sub1 || 'N/A').trim(),
        total_price: Number(item.giatri || item.total_price || 0),
        cashback_amount: Number(item.hoanhong || item.commission || 0),
        status: statusInt
      };
    }).filter(i => i.order_id);

    if (ordersToInsert.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Đã kết nối thành công tới Addlivetag nhưng chưa có đơn hàng mới nào.',
        data: []
      });
    }

    // 4. Lưu/Cập nhật dữ liệu vào Supabase
    const { data, error } = await supabaseAdmin
      .from('cashback_orders')
      .upsert(ordersToInsert, { onConflict: 'order_id' })
      .select();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: `Đã kết nối thành công và đồng bộ ${data?.length || 0} đơn hàng về hệ thống!`,
      data
    });

  } catch (error) {
    console.error('❌ Lỗi API Sync:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(request) { return handleSync(request); }
export async function POST(request) { return handleSync(request); }