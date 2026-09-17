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
  const [users, setUsers] = useState([]); // State lưu danh sách người dùng
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

  // Tải dữ liệu từ Supabase
  const fetchData = async () => {
    setLoading(true);
    
    // 1. Lấy danh sách yêu cầu rút tiền kèm thông tin ngân hàng
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

    // 2. Lấy danh sách đơn hàng
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (orderError) {
      console.error('Lỗi tải danh sách đơn hàng:', orderError.message);
    } else if (orderData) {
      setOrders(orderData);
    }

    // 3. Lấy danh sách và đếm số lượng người dùng từ bảng 'users'
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    if (userError) {
      console.error('Lỗi tải danh sách người dùng:', userError.message);
    } else if (userData) {
      setUsers(userData);
    }
    
    setLoading(false);
  };

  // Cập nhật trạng thái duyệt tiền và tự động trừ số dư ví của khách
  const handleUpdateWithdrawStatus = async (item, newStatus) => {
    const { error: updateError } = await supabase
      .from('withdrawals')
      .update({ status: newStatus })
      .eq('id', item.id);

    if (updateError) {
      alert('Có lỗi xảy ra khi cập nhật: ' + updateError.message);
      return;
    }

    if (newStatus === 'completed') {
      const userId = item.user_id;
      const withdrawAmount = Number(item.amount);

      if (userId) {
        const { data: userData } = await supabase
          .from('users')
          .select('balance')
          .eq('id', userId)
          .single();

        if (userData) {
          const currentBalance = Number(userData.balance || 0);
          const newBalance = Math.max(0, currentBalance - withdrawAmount);

          await supabase
            .from('users')
            .update({ balance: newBalance })
            .eq('id', userId);
        }
      }
    }

    alert(`Đã cập nhật trạng thái thành công: ${newStatus}`);
    fetchData();
  };

  // 1. MÀN HÌNH NHẬP MÃ PIN
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
            <p className="text-xs text-slate-500">Quản lý người dùng, đơn hàng & duyệt lệnh rút tiền</p>
          </div>
          <button 
            onClick={fetchData}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-2 rounded-lg transition"
          >
            🔄 Tải lại dữ liệu
          </button>
        </div>

        {/* Tabs chọn danh mục */}
        <div className="flex flex-wrap gap-2 mb-6 border-b pb-2">
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
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition ${
              activeTab === 'users' ? 'bg-orange-500 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            👥 Người dùng ({users.length})
          </button>
        </div>

        {loading ? (
          <div className="text-center py-10 text-slate-500 text-xs">Đang tải dữ liệu từ Supabase...</div>
        ) : (
          <>
            {/* Tab 1: Yêu cầu rút tiền */}
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

            {/* Tab 2: Danh sách đơn hàng */}
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

            {/* Tab 3: Danh sách Người dùng */}
            {activeTab === 'users' && (
              <div className="overflow-x-auto">
                <div className="mb-4 p-4 bg-orange-50 border border-orange-200 rounded-xl flex justify-between items-center">
                  <span className="text-xs font-bold text-orange-800">Tổng số tài khoản đã đăng ký:</span>
                  <span className="text-lg font-extrabold text-orange-600">{users.length} người dùng</span>
                </div>
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 border-b">
                      <th className="p-3">User ID</th>
                      <th className="p-3">Email / Tên</th>
                      <th className="p-3">Số dư ví</th>
                      <th className="p-3">Ngày tham gia</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-slate-700">
                    {users.length === 0 ? (
                      <tr><td colSpan="4" className="text-center py-6 text-slate-400">Chưa có người dùng nào.</td></tr>
                    ) : (
                      users.map((user) => (
                        <tr key={user.id} className="hover:bg-slate-50">
                          <td className="p-3 font-mono text-slate-500">{user.id}</td>
                          <td className="p-3 font-bold text-slate-800">{user.email || user.username || 'Khách nặc danh'}</td>
                          <td className="p-3 font-bold text-green-600">{Number(user.balance || 0).toLocaleString('vi-VN')} đ</td>
                          <td className="p-3 text-slate-500">{user.created_at ? new Date(user.created_at).toLocaleString('vi-VN') : 'N/A'}</td>
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