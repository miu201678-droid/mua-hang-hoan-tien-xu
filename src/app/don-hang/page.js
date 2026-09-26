'use client';

import { useEffect, useState } from 'react';

export default function DonHangPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Giả lập tải đơn hàng hoặc gọi API của bạn ở đây
    setLoading(false);
  }, []);

  return (
    <div style={{ maxWidth: '800px', margin: '40px auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '20px', color: '#1e293b' }}>
        📦 Lịch Sử Hoàn Tiền Đơn Hàng
      </h2>

      {loading ? (
        <p style={{ color: '#64748b' }}>Đang tải danh sách...</p>
      ) : orders.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
          <p style={{ color: '#64748b', fontSize: '16px' }}>Bạn chưa có đơn hàng mua sắm nào được ghi nhận.</p>
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
          <thead>
            <tr style={{ background: '#f1f5f9', textAlign: 'left', color: '#475569', fontSize: '14px' }}>
              <th style={{ padding: '12px' }}>Mã đơn hàng</th>
              <th style={{ padding: '12px' }}>Tiền hoàn</th>
              <th style={{ padding: '12px' }}>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((item, index) => (
              <tr key={index} style={{ borderBottom: '1px solid #f1f5f9' }}>
                <td style={{ padding: '12px' }}>{item.id}</td>
                <td style={{ padding: '12px', color: '#d97706', fontWeight: 'bold' }}>{item.amount} đ</td>
                <td style={{ padding: '12px' }}>Hoàn thành</td>
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