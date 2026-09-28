'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function DonHangPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchOrders() {
      try {
        // Lấy danh sách đơn hàng từ bảng cashback_orders (hoặc tên bảng hoàn tiền của bạn)
        const { data, error } = await supabase
          .from('cashback_orders')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('Lỗi lấy đơn hàng:', error);
        } else if (data) {
          setOrders(data);
        }
      } catch (err) {
        console.error('Exception:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchOrders();
  }, []);

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px', color: '#1e293b' }}>
        📦 Lịch Sử Hoàn Tiền Đơn Hàng
      </h2>

      {loading ? (
        <p style={{ color: '#64748b' }}>Đang tải danh sách đơn hàng...</p>
      ) : orders.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <p style={{ color: '#64748b', fontSize: '16px' }}>Bạn chưa có đơn hàng mua sắm nào được ghi nhận trong cơ sở dữ liệu.</p>
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <thead>
            <tr style={{ background: '#f1f5f9', textAlign: 'left', color: '#475569', fontSize: '14px' }}>
              <th style={{ padding: '12px' }}>Mã đơn hàng</th>
              <th style={{ padding: '12px' }}>Tiền hoàn</th>
              <th style={{ padding: '12px' }}>Trạng thái</th>
              <th style={{ padding: '12px' }}>Thời gian</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((item, index) => (
              <tr key={item.id || index} style={{ borderBottom: '1px solid #f1f5f9', fontSize: '14px' }}>
                <td style={{ padding: '12px', fontFamily: 'monospace', fontWeight: '500' }}>{item.order_id || item.id}</td>
                <td style={{ padding: '12px', color: '#d97706', fontWeight: 'bold' }}>
                  {Number(item.cashback_amount || item.amount || 0).toLocaleString('vi-VN')} đ
                </td>
                <td style={{ padding: '12px' }}>
                  <span style={{ 
                    padding: '4px 8px', 
                    borderRadius: '4px', 
                    fontSize: '12px',
                    background: item.status === 1 ? '#dcfce7' : '#fef3c7',
                    color: item.status === 1 ? '#166534' : '#92400e'
                  }}>
                    {item.status === 1 ? 'Đã duyệt' : 'Đang xử lý'}
                  </span>
                </td>
                <td style={{ padding: '12px', color: '#64748b', fontSize: '12px' }}>
                  {item.created_at ? new Date(item.created_at).toLocaleDateString('vi-VN') : 'N/A'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      
      <div style={{ marginTop: '30px' }}>
        <a href="/" style={{ color: '#2563eb', textDecoration: 'none', fontWeight: '500' }}>← Quay lại trang chủ</a>
      </div>
    </div>
  );
}