'use client';
import { useState, useEffect } from 'react';
import { supabase, supabaseAdmin } from '@/lib/supabase';

const ADMIN_PIN = "290102"; // Mã PIN Admin của bạn

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [activeTab, setActiveTab] = useState('withdrawals');
  
  // States chứa dữ liệu từ Supabase
  const [withdrawals, setWithdrawals] = useState([]);
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [wheelSpins, setWheelSpins] = useState([]);
  const [loading, setLoading] = useState(false);

  // User modal detail state
  const [selectedUser, setSelectedUser] = useState(null);

  // Tải dữ liệu từ Supabase bằng supabaseAdmin (bỏ qua chặn RLS)
  const fetchData = async () => {
    setLoading(true);
    // Sử dụng client Admin nếu có, không thì dùng client thường
    const db = supabaseAdmin || supabase;
    try {
      // 1. Tải Rút tiền
      const { data: withdrawData, error: wErr } = await db
        .from('withdrawals')
        .select('*')
        .order('created_at', { ascending: false });

      if (wErr) console.error("Lỗi rút tiền:", wErr);

      // 2. Tải STK Ngân hàng
      const { data: bankData } = await db
        .from('user_banks')
        .select('*');

      if (withdrawData) {
        const merged = withdrawData.map((w) => ({
          ...w,
          bank_info: bankData?.find((b) => b.user_id === w.user_id) || null
        }));
        setWithdrawals(merged);
      }

      // 3. Tải Đơn hàng
      const { data: orderData, error: oErr } = await db
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
      if (oErr) console.error("Lỗi đơn hàng:", oErr);
      if (orderData) setOrders(orderData);

      // 4. Tải Người dùng
      const { data: userData, error: uErr } = await db
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });
      if (uErr) console.error("Lỗi users:", uErr);
      if (userData) setUsers(userData);

      // 5. Tải Vòng quay
      const { data: spinData } = await db
        .from('wheel_spins')
        .select('*')
        .order('created_at', { ascending: false });
      if (spinData) setWheelSpins(spinData);

    } catch (error) {
      console.error("Lỗi khi tải dữ liệu Admin:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (pinInput === ADMIN_PIN) {
      setIsAuthenticated(true);
    } else {
      alert('Mã PIN Admin không đúng!');
    }
  };

  const handleUpdateWithdrawStatus = async (item, newStatus) => {
    const db = supabaseAdmin || supabase;
    const { error } = await db
      .from('withdrawals')
      .update({ status: newStatus })
      .eq('id', item.id);

    if (error) {
      alert('Có lỗi xảy ra: ' + error.message);
      return;
    }

    if (newStatus === 'completed' && item.user_id) {
      const { data: uData } = await db
        .from('users')
        .select('balance')
        .eq('id', item.user_id)
        .single();

      if (uData) {
        const currentBal = Number(uData.balance || 0);
        const newBal = Math.max(0, currentBal - Number(item.amount));
        await db
          .from('users')
          .update({ balance: newBal })
          .eq('id', item.user_id);
      }
    }

    alert(`Đã cập nhật trạng thái thành: ${newStatus === 'completed' ? 'Thành công' : 'Từ chối'}`);
    fetchData();
  };

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    const db = supabaseAdmin || supabase;
    const { error } = await db
      .from('orders')
      .update({ status: newStatus })
      .eq('id', orderId);

    if (error) {
      alert('Không thể cập nhật đơn hàng: ' + error.message);
    } else {
      alert('Cập nhật đơn hàng thành công!');
      fetchData();
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 font-sans">
        <form onSubmit={handleLogin} className="bg-white p-6 rounded-2xl shadow-lg max-w-sm w-full space-y-4">
          <div className="text-center">
            <h2 className="text-lg font-black text-slate-800">👑 Đăng nhập Admin</h2>
            <p className="text-xs text-slate-500 mt-1">Hoàn Tiền Xu - Nguyễn Trí Trung</p>
          </div>
          <input
            type="password"
            value={pinInput}
            onChange={(e) => setPinInput(e.target.value)}
            placeholder="Nhập mã PIN Admin..."
            className="w-full bg-slate-50 border border-slate-300 p-3 rounded-xl text-center text-lg font-bold outline-none focus:border-orange-500"
          />
          <button
            type="submit"
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 rounded-xl text-xs transition"
          >
            Vào hệ thống
          </button>
        </form>
      </div>
    );
  }

  const completedOrders = orders.filter(o => o.status === 1 || o.status === 'completed');
  const canceledOrders = orders.filter(o => o.status === 2 || o.status === 'canceled' || o.status === 'cancelled');
  const totalSpinPrize = wheelSpins.reduce((sum, s) => sum + (Number(s.prize_amount) || 0), 0);

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow-sm border p-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-4 border-b">
          <div>
            <h1 className="text-xl font-black text-slate-800 flex items-center gap-2">
              👑 Admin Hoàn Tiền Xu
            </h1>
            <p className="text-xs text-slate-500">Quản trị viên: <span className="font-bold text-slate-700">Nguyễn Trí Trung</span></p>
          </div>
          <button 
            onClick={fetchData}
            disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition shadow"
          >
            🔄 {loading ? 'Đang cập nhật...' : 'Tải lại dữ liệu'}
          </button>
        </div>

        {/* Thống kê nhanh */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <div className="bg-orange-50 border border-orange-200 p-3 rounded-xl">
            <div className="text-[10px] text-orange-600 font-bold uppercase">Chờ duyệt rút</div>
            <div className="text-lg font-black text-orange-700">
              {withdrawals.filter(w => w.status === 'pending').length} lệnh
            </div>
          </div>
          <div className="bg-green-50 border border-green-200 p-3 rounded-xl">
            <div className="text-[10px] text-green-600 font-bold uppercase">Đơn mua thành công</div>
            <div className="text-lg font-black text-green-700">{completedOrders.length} đơn</div>
          </div>
          <div className="bg-red-50 border border-red-200 p-3 rounded-xl">
            <div className="text-[10px] text-red-600 font-bold uppercase">Đơn bị hủy</div>
            <div className="text-lg font-black text-red-700">{canceledOrders.length} đơn</div>
          </div>
          <div className="bg-purple-50 border border-purple-200 p-3 rounded-xl">
            <div className="text-[10px] text-purple-600 font-bold uppercase">Tiền trúng vòng quay</div>
            <div className="text-lg font-black text-purple-700">{totalSpinPrize.toLocaleString('vi-VN')} đ</div>
          </div>
        </div>

        {/* Thanh chọn Tab */}
        <div className="flex flex-wrap gap-2 mb-6 border-b pb-2">
          <button
            onClick={() => setActiveTab('withdrawals')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'withdrawals' ? 'bg-orange-500 text-white shadow' : 'bg-slate-100 text-slate-600'
            }`}
          >
            💳 Duyệt Rút Tiền ({withdrawals.length})
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'orders' ? 'bg-orange-500 text-white shadow' : 'bg-slate-100 text-slate-600'
            }`}
          >
            📦 Đơn Hàng Mua & Hủy ({orders.length})
          </button>
          <button
            onClick={() => setActiveTab('wheel')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'wheel' ? 'bg-orange-500 text-white shadow' : 'bg-slate-100 text-slate-600'
            }`}
          >
            🎡 Vòng Quay Trúng Thưởng ({wheelSpins.length})
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition ${
              activeTab === 'users' ? 'bg-orange-500 text-white shadow' : 'bg-slate-100 text-slate-600'
            }`}
          >
            👥 Người Dùng ({users.length})
          </button>
        </div>

        {/* TAB 1: YÊU CẦU RÚT TIỀN */}
        {activeTab === 'withdrawals' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b">
                  <th className="p-3">Thời gian</th>
                  <th className="p-3">User ID / Email</th>
                  <th className="p-3">Số tiền</th>
                  <th className="p-3">Ngân hàng & STK nhận</th>
                  <th className="p-3">Trạng thái</th>
                  <th className="p-3 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y text-slate-700">
                {withdrawals.length === 0 ? (
                  <tr><td colSpan="6" className="text-center py-6 text-slate-400">Chưa có yêu cầu rút tiền nào.</td></tr>
                ) : (
                  withdrawals.map((item) => {
                    const bank = item.bank_info;
                    return (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="p-3 text-slate-500">{new Date(item.created_at).toLocaleString('vi-VN')}</td>
                        <td className="p-3 font-semibold">{item.user_email || item.user_id}</td>
                        <td className="p-3 font-black text-orange-600">{Number(item.amount).toLocaleString('vi-VN')} đ</td>
                        <td className="p-3">
                          {bank ? (
                            <div className="space-y-0.5">
                              <span className="font-bold text-blue-700">{bank.bank_name}</span> - <span className="font-mono font-bold text-slate-900">{bank.bank_account}</span>
                              <div className="text-[11px] text-slate-500 uppercase">{bank.account_name}</div>
                            </div>
                          ) : (
                            <span className="text-red-500 italic">Chưa liên kết NH</span>
                          )}
                        </td>
                        <td className="p-3 font-bold">
                          {item.status === 'pending' && <span className="text-yellow-600">⏳ Chờ duyệt</span>}
                          {item.status === 'completed' && <span className="text-green-600">✅ Đã chuyển</span>}
                          {item.status === 'rejected' && <span className="text-red-600">❌ Từ chối</span>}
                        </td>
                        <td className="p-3 text-center">
                          {item.status === 'pending' && (
                            <div className="flex justify-center gap-1">
                              <button
                                onClick={() => handleUpdateWithdrawStatus(item, 'completed')}
                                className="bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded-lg text-[10px] font-bold"
                              >
                                Duyệt
                              </button>
                              <button
                                onClick={() => handleUpdateWithdrawStatus(item, 'rejected')}
                                className="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded-lg text-[10px] font-bold"
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

        {/* TAB 2: ĐƠN HÀNG MUA & HỦY */}
        {activeTab === 'orders' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b">
                  <th className="p-3">Mã đơn hàng</th>
                  <th className="p-3">User ID</th>
                  <th className="p-3">Giá trị đơn</th>
                  <th className="p-3">Hoa hồng</th>
                  <th className="p-3">Trạng thái mua hàng</th>
                  <th className="p-3 text-center">Cập nhật</th>
                </tr>
              </thead>
              <tbody className="divide-y text-slate-700">
                {orders.length === 0 ? (
                  <tr><td colSpan="6" className="text-center py-6 text-slate-400">Chưa có đơn hàng nào.</td></tr>
                ) : (
                  orders.map((o) => {
                    const isCompleted = o.status === 1 || o.status === 'completed';
                    const isCanceled = o.status === 2 || o.status === 'canceled' || o.status === 'cancelled';
                    return (
                      <tr key={o.id} className="hover:bg-slate-50">
                        <td className="p-3 font-mono font-bold text-slate-800">{o.order_id || o.id}</td>
                        <td className="p-3 text-slate-500">{o.user_id}</td>
                        <td className="p-3">{Number(o.amount || 0).toLocaleString('vi-VN')} đ</td>
                        <td className="p-3 font-bold text-green-600">{Number(o.commission || 0).toLocaleString('vi-VN')} đ</td>
                        <td className="p-3 font-bold">
                          {isCompleted && <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full">✅ Mua thành công</span>}
                          {isCanceled && <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full">❌ Đơn đã hủy</span>}
                          {!isCompleted && !isCanceled && <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">⏳ Chờ đối soát</span>}
                        </td>
                        <td className="p-3 text-center space-x-1">
                          <button
                            onClick={() => handleUpdateOrderStatus(o.id, 1)}
                            className="bg-green-600 text-white text-[10px] px-2 py-1 rounded"
                          >
                            Set Mua thành công
                          </button>
                          <button
                            onClick={() => handleUpdateOrderStatus(o.id, 2)}
                            className="bg-red-500 text-white text-[10px] px-2 py-1 rounded"
                          >
                            Set Đơn Hủy
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 3: VÒNG QUAY TRÚNG THƯỞNG */}
        {activeTab === 'wheel' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b">
                  <th className="p-3">Thời gian</th>
                  <th className="p-3">User ID</th>
                  <th className="p-3">Phần thưởng</th>
                  <th className="p-3">Số tiền nhận</th>
                </tr>
              </thead>
              <tbody className="divide-y text-slate-700">
                {wheelSpins.length === 0 ? (
                  <tr><td colSpan="4" className="text-center py-6 text-slate-400">Chưa có lượt quay thưởng nào.</td></tr>
                ) : (
                  wheelSpins.map((s) => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="p-3 text-slate-500">{new Date(s.created_at).toLocaleString('vi-VN')}</td>
                      <td className="p-3 font-semibold">{s.user_id}</td>
                      <td className="p-3 font-bold text-slate-800">{s.prize_label || 'Tiền thưởng'}</td>
                      <td className="p-3 font-black text-purple-600">+{Number(s.prize_amount || 0).toLocaleString('vi-VN')} đ</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 4: DANH SÁCH NGƯỜI DÙNG */}
        {activeTab === 'users' && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 border-b">
                  <th className="p-3">User ID</th>
                  <th className="p-3">Email / Tên</th>
                  <th className="p-3">Số dư ví</th>
                  <th className="p-3">Số đơn đã mua</th>
                  <th className="p-3">Số đơn đã hủy</th>
                  <th className="p-3 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y text-slate-700">
                {users.length === 0 ? (
                  <tr><td colSpan="6" className="text-center py-6 text-slate-400">Không tìm thấy dữ liệu người dùng nào trong CSDL.</td></tr>
                ) : (
                  users.map((u) => {
                    const userOrders = orders.filter(o => o.user_id === u.id);
                    const userDone = userOrders.filter(o => o.status === 1 || o.status === 'completed').length;
                    const userCancel = userOrders.filter(o => o.status === 2 || o.status === 'canceled' || o.status === 'cancelled').length;

                    return (
                      <tr key={u.id} className="hover:bg-slate-50">
                        <td className="p-3 font-mono text-slate-500">{u.id}</td>
                        <td className="p-3 font-bold text-slate-800">{u.email || u.username || 'Khách'}</td>
                        <td className="p-3 font-black text-green-600">{Number(u.balance || 0).toLocaleString('vi-VN')} đ</td>
                        <td className="p-3 font-bold text-green-700">{userDone} đơn</td>
                        <td className="p-3 font-bold text-red-600">{userCancel} đơn</td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => setSelectedUser({ ...u, userDone, userCancel, userOrders })}
                            className="bg-orange-500 hover:bg-orange-600 text-white text-[10px] font-bold px-2 py-1 rounded-lg"
                          >
                            Chi tiết TK
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* POPUP XEM CHI TIẾT NGƯỜI DÙNG */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b pb-3">
              <h3 className="font-black text-slate-800 text-base">Thông tin Tài khoản</h3>
              <button onClick={() => setSelectedUser(null)} className="text-slate-400 font-bold hover:text-slate-600">✕</button>
            </div>
            
            <div className="space-y-2 text-xs">
              <div><span className="text-slate-500">Email/Tên:</span> <strong className="text-slate-800">{selectedUser.email || selectedUser.username}</strong></div>
              <div><span className="text-slate-500">User ID:</span> <code className="bg-slate-100 p-1 rounded">{selectedUser.id}</code></div>
              <div><span className="text-slate-500">Số dư hiện tại:</span> <strong className="text-green-600">{Number(selectedUser.balance || 0).toLocaleString('vi-VN')} đ</strong></div>
              <div className="flex gap-4 pt-2">
                <div className="bg-green-50 text-green-700 p-2 rounded-xl border border-green-200 flex-1 text-center font-bold">
                  Đã mua thành công: {selectedUser.userDone} đơn
                </div>
                <div className="bg-red-50 text-red-700 p-2 rounded-xl border border-red-200 flex-1 text-center font-bold">
                  Đã bị hủy: {selectedUser.userCancel} đơn
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedUser(null)}
              className="w-full bg-slate-200 hover:bg-slate-300 font-bold py-2 rounded-xl text-xs text-slate-700"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}