'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import BottomNav from '@/components/BottomNav'; // điều chỉnh đường dẫn tới file BottomNav của bạn

export default function DonHangPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClientComponentClient();

  useEffect(() => {
    async function loadOrders() {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('cashback_orders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setOrders(data);
      }
      setLoading(false);
    }

    loadOrders();
  }, []);

  const renderStatus = (status) => {
    const s = Number(status);
    if (s === 1) return <span className="px-2.5 py-1 text-xs font-bold text-green-700 bg-green-100 rounded-full">Đã duyệt</span>;
    if (s === 2) return <span className="px-2.5 py-1 text-xs font-bold text-red-700 bg-red-100 rounded-full">Đã hủy</span>;
    return <span className="px-2.5 py-1 text-xs font-bold text-amber-700 bg-amber-100 rounded-full">Đang xử lý</span>;
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 pb-24">
      <h1 className="text-xl font-bold mb-4 text-slate-800">📦 Lịch Sử Hoàn Tiền Đơn Hàng</h1>

      {loading ? (
        <div className="text-center py-8 text-slate-500">Đang tải danh sách đơn hàng...</div>
      ) : orders.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-200">
          <p className="text-slate-500">Bạn chưa có đơn hàng mua sắm nào được ghi nhận.</p>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-xl shadow border border-slate-200">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
              <tr>
                <th className="p-3.5">Mã đơn hàng</th>
                <th className="p-3.5">Tiền hoàn</th>
                <th className="p-3.5">Trạng thái</th>
                <th className="p-3.5">Ngày ghi nhận</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.map((item) => (
                <tr key={item.order_id} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-3.5 font-mono font-medium text-slate-900">{item.order_id}</td>
                  <td className="p-3.5 font-bold text-amber-600">
                    +{Number(item.cashback_amount || 0).toLocaleString('vi-VN')} đ
                  </td>
                  <td className="p-3.5">{renderStatus(item.status)}</td>
                  <td className="p-3.5 text-slate-500 text-xs">
                    {new Date(item.created_at || Date.now()).toLocaleDateString('vi-VN')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Gọi thanh BottomNav với tab active là orders */}
      <BottomNav active="orders" />
    </div>
  );
}