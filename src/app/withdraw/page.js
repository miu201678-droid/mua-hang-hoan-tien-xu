'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function WithdrawPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  const [bankInfo, setBankInfo] = useState({ bankName: '', accountNumber: '', accountName: '' });
  const [balance, setBalance] = useState({ available: 0, pending: 0 });
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [history, setHistory] = useState([]);
  const [ordersList, setOrdersList] = useState([]);
  const [timeRange, setTimeRange] = useState('7');

  // State quản lý Modal thông báo đẹp mắt
  const [modal, setModal] = useState({ show: false, title: '', message: '', type: 'info' });

  const showAlert = (title, message, type = 'error') => {
    setModal({ show: true, title, message, type });
  };

  const closeModal = () => {
    setModal((prev) => ({ ...prev, show: false }));
  };

  const [stats, setStats] = useState({
    totalSavings: 0,
    paidOut: 0,
    savingsPercent: 0,
    pending: 0,
  });

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        const currentUser = session.user;
        setUser(currentUser);

        const { data: bankData } = await supabase
          .from('user_banks')
          .select('*')
          .eq('user_id', currentUser.id)
          .single();

        if (bankData) {
          setBankInfo({
            bankName: bankData.bank_name || '',
            accountNumber: bankData.account_number || '',
            accountName: bankData.account_name || '',
          });
        }

        const { data: withdrawData } = await supabase
          .from('withdrawals')
          .select('*')
          .eq('user_id', currentUser.id)
          .order('created_at', { ascending: false });

        if (withdrawData) {
          setHistory(withdrawData);

          const paid = withdrawData
            .filter((item) => item.status === 'Đã duyệt' || item.status === 'Thành công')
            .reduce((sum, item) => sum + Number(item.amount), 0);

          const pendingAmount = withdrawData
            .filter((item) => item.status === 'Đang xử lý')
            .reduce((sum, item) => sum + Number(item.amount), 0);

          const { data: ordersData } = await supabase
            .from('orders')
            .select('*')
            .eq('user_id', currentUser.id)
            .order('created_at', { ascending: false });

          let totalCommission = 0;
          let totalOrderValue = 0;

          if (ordersData) {
            setOrdersList(ordersData);
            ordersData.forEach((ord) => {
              if (ord.status === 'Thành công') {
                totalCommission += Number(ord.commission || 0);
              }
              totalOrderValue += Number(ord.order_amount || 0);
            });
          }

          const availableBalance = Math.max(0, totalCommission - paid - pendingAmount);
          const percent = totalOrderValue > 0 ? ((totalCommission / totalOrderValue) * 100).toFixed(1) : 0;

          setBalance({ available: availableBalance, pending: pendingAmount });
          setStats({
            totalSavings: totalCommission,
            paidOut: paid,
            savingsPercent: percent,
            pending: pendingAmount,
          });
        }
      }
      setLoading(false);
    };

    fetchData();
  }, []);

  const handleSaveBank = async (e) => {
    e.preventDefault();
    if (!user) return showAlert('Chưa đăng nhập', 'Vui lòng đăng nhập để thực hiện!', 'warning');

    const { error } = await supabase.from('user_banks').upsert({
      user_id: user.id,
      bank_name: bankInfo.bankName,
      account_number: bankInfo.accountNumber,
      account_name: bankInfo.accountName.toUpperCase(),
      updated_at: new Date(),
    });

    if (error) {
      showAlert('Lỗi Lưu Ngân Hàng', error.message, 'error');
    } else {
      showAlert('Thành Công', 'Lưu thông tin ngân hàng thành công!', 'success');
    }
  };

  const handleWithdraw = async (e) => {
    e.preventDefault();
    if (!user) return showAlert('Chưa đăng nhập', 'Vui lòng đăng nhập để thực hiện!', 'warning');

    const amount = Number(withdrawAmount);
    if (!amount || amount < 40000) {
      return showAlert('Hạn Mức Rút Tiền', 'Số tiền rút tối thiểu là 40.000đ', 'warning');
    }
    if (amount > balance.available) {
      return showAlert('Rút Tiền Thất Bại', 'Số dư khả dụng của bạn không đủ để thực hiện giao dịch này.', 'error');
    }
    if (!bankInfo.accountNumber || !bankInfo.bankName) {
      return showAlert('Thiếu Thông Tin', 'Vui lòng lưu thông tin ngân hàng nhận tiền ở bên dưới trước!', 'warning');
    }

    setSubmitting(true);

    const { data, error } = await supabase
      .from('withdrawals')
      .insert([
        {
          user_id: user.id,
          amount: amount,
          status: 'Đang xử lý',
        },
      ])
      .select();

    setSubmitting(false);

    if (error) {
      showAlert('Gửi Yêu Cầu Thất Bại', error.message, 'error');
    } else if (data) {
      setHistory([data[0], ...history]);
      setBalance((prev) => ({
        available: prev.available - amount,
        pending: prev.pending + amount,
      }));
      setWithdrawAmount('');
      showAlert('Gửi Yêu Cầu Thành Công', 'Đã gửi yêu cầu rút tiền thành công! Admin sẽ đối soát và chuyển khoản cho bạn trong 24h-48h.', 'success');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs text-slate-500 font-bold">
        ⏳ Đang tải dữ liệu thực tế...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-28 font-sans text-left relative">
      {/* MODAL THÔNG BÁO XỊN XÒ */}
      {modal.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white w-full max-w-xs rounded-3xl p-6 text-center shadow-2xl border border-slate-100 transform transition-all scale-100">
            <div className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center text-2xl mb-3 shadow-inner">
              {modal.type === 'error' && <span className="bg-rose-100 text-rose-500 w-full h-full rounded-2xl flex items-center justify-center">⚠️</span>}
              {modal.type === 'success' && <span className="bg-emerald-100 text-emerald-500 w-full h-full rounded-2xl flex items-center justify-center">🎉</span>}
              {modal.type === 'warning' && <span className="bg-amber-100 text-amber-500 w-full h-full rounded-2xl flex items-center justify-center">🔔</span>}
            </div>

            <h3 className="text-base font-bold text-slate-800 mb-1">{modal.title}</h3>
            <p className="text-xs text-slate-500 leading-relaxed mb-5">{modal.message}</p>

            <button
              onClick={closeModal}
              className={`w-full py-2.5 rounded-xl font-bold text-xs text-white shadow-md active:scale-95 transition ${
                modal.type === 'error'
                  ? 'bg-rose-500 hover:bg-rose-600'
                  : modal.type === 'success'
                  ? 'bg-emerald-500 hover:bg-emerald-600'
                  : 'bg-orange-500 hover:bg-orange-600'
              }`}
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}

      <header className="p-4 bg-white border-b sticky top-0 z-10 flex items-center justify-between">
        <Link href="/" className="text-slate-600 text-sm font-bold">
          ← Trang chủ
        </Link>
        <h1 className="font-bold text-slate-800 text-sm">💳 Rút Tiền</h1>
        <div className="w-12"></div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-4">
        <div className="bg-gradient-to-br from-orange-500 to-amber-500 rounded-3xl p-5 text-white shadow-md space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs text-orange-100 font-medium">Số dư có thể rút</span>
              <div className="text-3xl font-extrabold mt-1">
                {balance.available.toLocaleString('vi-VN')} <span className="text-sm underline">đ</span>
              </div>
            </div>
            <span className="bg-white/20 backdrop-blur text-[10px] text-white px-2.5 py-1 rounded-full font-semibold">
              Chờ duyệt: {balance.pending.toLocaleString('vi-VN')}đ
            </span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="text-left">
            <h3 className="font-bold text-slate-800 text-sm">⚡ Quy Trình Nhận Hoàn Tiền Siêu Tốc</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Hiểu rõ quy trình ghi nhận đơn hàng và thời gian tiền hoàn về tài khoản.</p>
          </div>

          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-base shrink-0">
                🛍️
              </div>
              <div className="text-left flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-xs">BƯỚC 1: MUA HÀNG</span>
                  <span className="text-[10px] bg-orange-100 text-orange-600 font-semibold px-2 py-0.5 rounded-full">Hôm nay</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Bạn copy link dán vào hệ thống, nhận link hoàn tiền và tiến hành đặt mua hàng.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-base shrink-0">
                ☑️
              </div>
              <div className="text-left flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-xs">BƯỚC 2: ĐỐI SOÁT</span>
                  <span className="text-[10px] bg-blue-100 text-blue-600 font-semibold px-2 py-0.5 rounded-full">Ngày mai</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Sàn ghi nhận đơn hàng tạm tính và tự động đồng bộ hiển thị trong lịch sử ví.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold text-base shrink-0">
                🛡️
              </div>
              <div className="text-left flex-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 text-xs">BƯỚC 3: THỰC NHẬN</span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-600 font-semibold px-2 py-0.5 rounded-full">7 ngày</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Sau khi đơn hoàn thành, tiền khả dụng sẽ được cộng vào ví và có thể rút ngay.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-800 text-xs">Theo dõi số tiền tiết kiệm</h3>
            <div className="flex items-center bg-slate-100 p-0.5 rounded-full text-[10px] font-bold">
              {['7', '30', '90'].map((range) => (
                <button
                  key={range}
                  type="button"
                  onClick={() => setTimeRange(range)}
                  className={`px-2 py-0.5 rounded-full transition ${
                    timeRange === range ? 'bg-orange-500 text-white' : 'text-slate-500'
                  }`}
                >
                  {range} ngày
                </button>
              ))}
            </div>
          </div>

          <div className="h-28 w-full flex flex-col justify-between pt-4 relative">
            <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-slate-400 z-10 pointer-events-none">
              {stats.totalSavings > 0 ? 'Dữ liệu đang được ghi nhận' : 'Chưa ghi nhận dữ liệu.'}
            </div>
            <svg className="w-full h-20 overflow-visible" viewBox="0 0 300 100">
              <line x1="0" y1="20" x2="300" y2="20" stroke="#f1f5f9" strokeDasharray="3 3" />
              <line x1="0" y1="60" x2="300" y2="60" stroke="#f1f5f9" strokeDasharray="3 3" />
              <line x1="0" y1="95" x2="300" y2="95" stroke="#e2e8f0" />
              <path d="M 0 95 L 300 95" stroke="#f97316" strokeWidth="2" fill="none" />
            </svg>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-orange-50/60 border border-orange-100 p-3 rounded-2xl">
            <span className="text-[11px] font-bold text-slate-700">Tổng tiền tiết kiệm</span>
            <div className="text-base font-extrabold text-orange-600 my-0.5">
              {stats.totalSavings.toLocaleString('vi-VN')}đ
            </div>
            <span className="text-[9px] text-slate-400">Hoa hồng ghi nhận</span>
          </div>

          <div className="bg-emerald-50/60 border border-emerald-100 p-3 rounded-2xl">
            <span className="text-[11px] font-bold text-slate-700">Đã nhận</span>
            <div className="text-base font-extrabold text-emerald-600 my-0.5">
              {stats.paidOut.toLocaleString('vi-VN')}đ
            </div>
            <span className="text-[9px] text-slate-400">Đã thanh toán</span>
          </div>

          <div className="bg-blue-50/60 border border-blue-100 p-3 rounded-2xl">
            <span className="text-[11px] font-bold text-slate-700">% Tiết kiệm</span>
            <div className="text-base font-extrabold text-blue-600 my-0.5">
              {stats.savingsPercent}%
            </div>
            <span className="text-[9px] text-slate-400">Ước tính / giá trị đơn</span>
          </div>

          <div className="bg-amber-50/60 border border-amber-100 p-3 rounded-2xl">
            <span className="text-[11px] font-bold text-slate-700">Chờ quyết toán</span>
            <div className="text-base font-extrabold text-amber-500 my-0.5">
              {stats.pending.toLocaleString('vi-VN')}đ
            </div>
            <span className="text-[9px] text-slate-400">Đang đối soát</span>
          </div>
        </div>

        {/* LỊCH SỬ ĐƠN HÀNG HOÀN TIỀN */}
        <div className="bg-white p-5 rounded-3xl border shadow-sm space-y-3">
          <h3 className="font-bold text-slate-800 text-xs">🛍️ Lịch Sử Đơn Hàng Hoàn Tiền</h3>
          {ordersList.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-3">Bạn chưa có đơn hàng hoàn tiền nào</p>
          ) : (
            <div className="space-y-2">
              {ordersList.map((ord) => (
                <div key={ord.id} className="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl border text-xs">
                  <div className="space-y-0.5">
                    <div className="font-bold text-slate-800">Đơn hàng: {ord.id}</div>
                    <div className="text-[10px] text-slate-500">
                      Giá trị: <span className="font-semibold">{Number(ord.order_amount || 0).toLocaleString('vi-VN')}đ</span> | 
                      Hoa hồng: <span className="text-orange-600 font-bold">+{Number(ord.commission || 0).toLocaleString('vi-VN')}đ</span>
                    </div>
                    <div className="text-[9px] text-slate-400">
                      {ord.created_at ? new Date(ord.created_at).toLocaleDateString('vi-VN') : ''}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      ord.status === 'Thành công'
                        ? 'bg-emerald-100 text-emerald-700'
                        : ord.status === 'Đã hủy'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {ord.status || 'Đang xử lý'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white p-5 rounded-3xl border shadow-sm space-y-3">
          <h3 className="font-bold text-slate-800 text-xs">💸 Yêu Cầu Rút Tiền</h3>
          <form onSubmit={handleWithdraw} className="space-y-3">
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">Số tiền muốn rút (VNĐ)</label>
              <input
                type="number"
                placeholder="Nhập tối thiểu 40.000đ..."
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-2.5 text-sm font-bold focus:outline-none focus:border-orange-400"
                required
              />
            </div>
            <button
              type="submit"
              disabled={!user || submitting}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 rounded-xl text-xs transition active:scale-95 disabled:opacity-50"
            >
              {submitting ? 'Đang gửi...' : user ? 'Xác Nhận Rút Tiền' : 'Vui Lòng Đăng Nhập'}
            </button>
          </form>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm space-y-3">
          <h3 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
            <span>📖</span> Hướng Dẫn Rút Tiền
          </h3>
          <ul className="text-[11px] text-slate-600 space-y-2 list-disc pl-4 text-left">
            <li>
              <strong>Hạn mức rút:</strong> Tối thiểu <span className="text-orange-600 font-bold">40.000đ</span> / lần rút.
            </li>
            <li>
              <strong>Thông tin ngân hàng:</strong> Cần lưu chính xác tên ngân hàng, số tài khoản và tên chủ tài khoản (viết hoa không dấu).
            </li>
            <li>
              <strong>Thời gian xử lý:</strong> Sau khi gửi yêu cầu, Admin sẽ kiểm tra đối soát và chuyển khoản trong vòng <span className="font-semibold text-slate-800">24h - 48h</span> làm việc.
            </li>
            <li>
              <strong>Trạng thái giao dịch:</strong> Bạn có thể theo dõi tiến độ xử lý ở mục <em>Lịch Sử Rút Tiền</em> bên dưới.
            </li>
          </ul>
        </div>

        <div className="bg-white p-5 rounded-3xl border shadow-sm space-y-3">
          <h3 className="font-bold text-slate-800 text-xs">🏦 Tài Khoản Ngân Hàng Nhận Tiền</h3>
          <form onSubmit={handleSaveBank} className="space-y-2.5">
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">Ngân hàng</label>
              <input
                type="text"
                placeholder="VD: MBBank, Vietcombank..."
                value={bankInfo.bankName}
                onChange={(e) => setBankInfo({ ...bankInfo, bankName: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-orange-400"
                required
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">Số tài khoản</label>
              <input
                type="text"
                placeholder="Nhập số tài khoản"
                value={bankInfo.accountNumber}
                onChange={(e) => setBankInfo({ ...bankInfo, accountNumber: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-orange-400"
                required
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">Tên chủ tài khoản</label>
              <input
                type="text"
                placeholder="NGUYEN VAN A"
                value={bankInfo.accountName}
                onChange={(e) => setBankInfo({ ...bankInfo, accountName: e.target.value.toUpperCase() })}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-orange-400 font-semibold"
                required
              />
            </div>
            <button
              type="submit"
              disabled={!user}
              className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 rounded-xl text-xs transition disabled:opacity-50"
            >
              Lưu Thông Tin Ngân Hàng
            </button>
          </form>
        </div>

        <div className="bg-white p-5 rounded-3xl border shadow-sm space-y-3">
          <h3 className="font-bold text-slate-800 text-xs">📋 Lịch Sử Rút Tiền</h3>
          {history.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-3">Chưa có lịch sử giao dịch</p>
          ) : (
            <div className="space-y-2">
              {history.map((tx) => (
                <div key={tx.id} className="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl border text-xs">
                  <div>
                    <div className="font-bold text-slate-800">-{Number(tx.amount).toLocaleString('vi-VN')}đ</div>
                    <div className="text-[10px] text-slate-400">
                      {new Date(tx.created_at).toLocaleDateString('vi-VN')}
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      tx.status === 'Thành công' || tx.status === 'Đã duyệt'
                        ? 'bg-emerald-100 text-emerald-700'
                        : tx.status === 'Từ chối'
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {tx.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <div className="fixed bottom-3 left-3 right-3 z-30 max-w-md mx-auto">
        <nav className="bg-white/95 backdrop-blur border border-slate-200 rounded-full shadow-lg flex items-center justify-between px-2 py-2.5">
          <Link href="/" className="flex flex-col items-center flex-1 text-slate-700 hover:text-orange-500 transition">
            <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            <span className="text-[10px] font-bold mt-1">Trang chủ</span>
          </Link>

          <div className="h-5 w-[1px] bg-slate-200"></div>

          <a href="https://s.shopee.vn/4AzXOAbszD" target="_blank" rel="noreferrer" className="flex flex-col items-center flex-1 text-slate-700 hover:text-orange-500 transition">
            <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
            </svg>
            <span className="text-[10px] font-bold mt-1">Voucher</span>
          </a>

          <div className="h-5 w-[1px] bg-slate-200"></div>

          <div className="relative flex-1 flex justify-center -mt-7">
            <Link href="/" className="flex flex-col items-center group">
              <div className="w-12 h-12 rounded-2xl bg-white border border-blue-100 shadow-md flex items-center justify-center p-1.5 transition transform group-hover:scale-105">
                <img src="/logo.png" alt="Hoàn tiền" className="w-full h-full object-contain" />
              </div>
              <span className="text-[10px] font-black text-orange-500 mt-1">Hoàn tiền</span>
            </Link>
          </div>

          <div className="h-5 w-[1px] bg-slate-200"></div>

          <Link href="/withdraw" className="flex flex-col items-center flex-1 text-orange-500 font-bold transition">
            <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="text-[10px] font-bold mt-1 text-orange-500">Rút tiền</span>
          </Link>

          <div className="h-5 w-[1px] bg-slate-200"></div>

          <Link href="/profile" className="flex flex-col items-center flex-1 text-slate-700 hover:text-orange-500 transition">
            <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span className="text-[10px] font-bold mt-1">Tài khoản</span>
          </Link>
        </nav>
      </div>
    </div>
  );
}