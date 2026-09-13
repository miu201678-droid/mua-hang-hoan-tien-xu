'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

// Mã PIN bảo vệ trang Admin
const ADMIN_PIN = "290102"; 

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [activeTab, setActiveTab] = useState('withdrawals');
  const [withdrawals, setWithdrawals] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);

  // Xử lý xác thực mã PIN
  const handleLogin = (e) => {
    e.preventDefault();
    if (pinInput === ADMIN_PIN) {
      setIsAuthenticated(true);
      fetchData();
    } else {
      alert('Mã PIN Admin không đúng!');
    }
  };

  // Tải dữ liệu từ Supabase (Đã tích hợp lấy thông tin ngân hàng qua user_id)
  const fetchData = async () => {
    setLoading(true);
    
    // Lấy danh sách yêu cầu rút tiền kèm thông tin ngân hàng từ bảng user_banks
    const { data: withdrawData, error: withdrawError } = await supabase
      .from('withdrawals')
      .select(`
        *,
        user_banks (
          bank_name,
          bank_account,
          account_name
        )
      `)
      .order('created_at', { ascending: false });

    if (withdrawError) {
      console.error('Lỗi tải yêu cầu rút tiền:', withdrawError.message);
    } else if (withdrawData) {
      setWithdrawals(withdrawData);
    }

    // Lấy danh sách đơn hàng
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (orderError) {
      console.error('Lỗi tải danh sách đơn hàng:', orderError.message);
    } else if (orderData) {
      setOrders(orderData);
    }
    
    setLoading(false);
  };

  // Cập nhật trạng thái duyệt tiền và tự động trừ số dư ví của khách
  const handleUpdateWithdrawStatus = async (item, newStatus) => {
    // 1. Cập nhật trạng thái lệnh rút tiền trước
    const { error: updateError } = await supabase
      .from('withdrawals')
      .update({ status: newStatus })
      .eq('id', item.id);

    if (updateError) {
      alert('Có lỗi xảy ra khi cập nhật: ' + updateError.message);
      return;
    }

    // 2. Nếu Admin bấm "Duyệt" (completed) thì tiến hành trừ số dư trong bảng users
    if (newStatus === 'completed') {
      const userId = item.user_id;
      const withdrawAmount = Number(item.amount);

      if (userId) {
        // Lấy số dư hiện tại của user từ bảng 'users'
        const { data: userData } = await supabase
          .from('users')
          .select('balance')
          .eq('id', userId)
          .single();

        if (userData) {
          const currentBalance = Number(userData.balance || 0);
          const newBalance = Math.max(0, currentBalance - withdrawAmount); // Không để âm số dư

          // Cập nhật lại số dư mới vào cơ sở dữ liệu
          await supabase
            .from('users')
            .update({ balance: newBalance })
            .eq('id', userId);
        }
      }
    }

    alert(`Đã cập nhật trạng thái thành công: ${newStatus}`);
    fetchData(); // Tải lại dữ liệu mới nhất
  };

  // 1. MÀN HÌNH NHẬP MÃ PIN (Nếu chưa đăng nhập)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
        <form onSubmit={handleLogin} className="bg-white p-6 rounded-2xl shadow-md max-w-sm w-full space-y-4">
          <div className="text-center">
            <h2 className="text-lg font-bold text-slate-800">🔐 Đăng nhập Quản trị viên</h2>
            <p className="text-xs text-slate-500 mt-1">Nhập mã PIN Admin để truy cập hệ thống</p>
          </div>
          <input
            type="password"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            placeholder="Nhập mã PIN..."
            className="w-full bg-slate-50 border p-3 rounded-xl text-center text-lg font-bold tracking-widest outline-none focus:border-orange-500"
          />
          <button
            type="submit"
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 rounded-xl text-xs transition"
          >
            Xác nhận
          </button>
        </form>
      </div>
    );
  }

  // 2. MÀN HÌNH GIAO DIỆN QUẢN TRỊ ADMIN
  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto bg-white rounded-2xl shadow border p-6">
        
        {/* Header */}
        <div className="flex justify-between items-center mb-6 pb-4 border-b">
          <div>
            <h1 className="text-xl font-extrabold text-slate-800">👑 Trang Quản Trị Admin</h1>
            <p className="text-xs text-slate-500">Quản lý đơn hàng & Duyệt lệnh rút tiền cho khách</p>
          </div>
          <button 
            onClick={fetchData}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition"
          >
            🔄 Tải lại dữ liệu
          </button>
        </div>

        {/* Tabs chọn danh mục */}
        <div className="flex gap-2 mb-6 border-b pb-2">
          <button
            onClick={() => setActiveTab('withdrawals')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
              activeTab === 'withdrawals' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            💳 Yêu cầu rút tiền ({withdrawals.length})
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
              activeTab === 'orders' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            📦 Danh sách đơn hàng ({orders.length})
          </button>
        </div>

        {loading ? (
          <div className="text-center py-10 text-slate-500 text-xs">Đang tải dữ liệu từ Supabase...</div>
        ) : (
          <>
            {/* Danh sách yêu cầu rút tiền */}
            {activeTab === 'withdrawals' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 border-b">
                      <th className="p-3">Thời gian</th>
                      <th className="p-3">Email khách</th>
                      <th className="p-3">Số tiền</th>
                      <th className="p-3">Thông tin Ngân hàng</th>
                      <th className="p-3">Trạng thái</th>
                      <th className="p-3 text-center">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-slate-700">
                    {withdrawals.length === 0 ? (
                      <tr><td colSpan="6" className="text-center py-6 text-slate-400">Chưa có yêu cầu rút tiền nào.</td></tr>
                    ) : (
                      withdrawals.map((item) => {
                        // Lấy thông tin ngân hàng từ bảng liên kết user_banks (nếu có)
                        const bankInfo = Array.isArray(item.user_banks) 
                          ? item.user_banks[0] 
                          : item.user_banks;

                        return (
                          <tr key={item.id} className="hover:bg-slate-50">
                            <td className="p-3 text-slate-500">{new Date(item.created_at).toLocaleString('vi-VN')}</td>
                            <td className="p-3 font-semibold">{item.user_email || 'Khách hàng'}</td>
                            <td className="p-3 font-bold text-orange-600">{Number(item.amount).toLocaleString('vi-VN')} đ</td>
                            <td className="p-3">
                              {bankInfo ? (
                                <div className="space-y-0.5">
                                  <div className="font-bold text-blue-700">{bankInfo.bank_name}</div>
                                  <div>STK: <span className="font-mono font-bold text-slate-900">{bankInfo.bank_account}</span></div>
                                  <div className="text-slate-500 uppercase">{bankInfo.account_name}</div>
                                </div>
                              ) : (
                                <span className="text-red-500 italic">Chưa cập nhật STK</span>
                              )}
                            </td>
                            <td className="p-3 font-bold">
                              {item.status === 'pending' && <span className="text-yellow-600">⏳ Chờ xử lý</span>}
                              {item.status === 'completed' && <span className="text-green-600">✅ Đã chuyển</span>}
                              {item.status === 'rejected' && <span className="text-red-600">❌ Từ chối</span>}
                            </td>
                            <td className="p-3 text-center">
                              {item.status === 'pending' && (
                                <div className="flex justify-center gap-1">
                                  <button
                                    onClick={() => handleUpdateWithdrawStatus(item, 'completed')}
                                    className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded text-[10px] font-bold"
                                  >
                                    Duyệt
                                  </button>
                                  <button
                                    onClick={() => handleUpdateWithdrawStatus(item, 'rejected')}
                                    className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-[10px] font-bold"
                                  >
                                    Từ chối
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Danh sách đơn hàng */}
            {activeTab === 'orders' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 border-b">
                      <th className="p-3">Mã đơn hàng</th>
                      <th className="p-3">Giá trị đơn</th>
                      <th className="p-3">Hoa hồng nhận</th>
                      <th className="p-3">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-slate-700">
                    {orders.length === 0 ? (
                      <tr><td colSpan="4" className="text-center py-6 text-slate-400">Chưa có đơn hàng nào trong hệ thống.</td></tr>
                    ) : (
                      orders.map((order) => (
                        <tr key={order.id} className="hover:bg-slate-50">
                          <td className="p-3 font-mono font-bold text-slate-800">{order.order_id || order.id}</td>
                          <td className="p-3">{Number(order.amount || 0).toLocaleString('vi-VN')} đ</td>
                          <td className="p-3 font-semibold text-green-600">{Number(order.commission || 0).toLocaleString('vi-VN')} đ</td>
                          <td className="p-3">
                            <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                              {order.status === 1 ? 'Đã duyệt' : 'Chờ duyệt'}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}