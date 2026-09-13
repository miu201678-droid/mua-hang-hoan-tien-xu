'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State quản lý thông tin ngân hàng & rút tiền
  const [bankInfo, setBankInfo] = useState({ bankName: '', accountNumber: '', accountName: '' });
  const [balance, setBalance] = useState({ available: 0, pending: 0 });
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [history, setHistory] = useState([]);

  // Hàm format tiền tệ hiển thị có chữ đ nhỏ bên trên
  const formatMoney = (amount) => {
    return (
      <span>
        {Number(amount || 0).toLocaleString('vi-VN')}
        <sup className="text-[10px] ml-0.5">đ</sup>
      </span>
    );
  };

  // Hàm tự động thêm dấu chấm khi gõ số tiền rút (VD: 5.000.000)
  const handleAmountChange = (e) => {
    const rawValue = e.target.value.replace(/\D/g, '');
    if (!rawValue) {
      setWithdrawAmount('');
      return;
    }
    const formatted = Number(rawValue).toLocaleString('vi-VN');
    setWithdrawAmount(formatted);
  };

  // Lấy thông tin user & dữ liệu từ Supabase khi load trang
  useEffect(() => {
    const fetchUserData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user ?? null;
      setUser(currentUser);

      if (currentUser) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('bank_name, account_number, account_name, balance_available, balance_pending')
          .eq('id', currentUser.id)
          .single();

        if (profile) {
          setBankInfo({
            bankName: profile.bank_name || '',
            accountNumber: profile.account_number || '',
            accountName: profile.account_name || '',
          });
          setBalance({
            available: profile.balance_available || 0,
            pending: profile.balance_pending || 0,
          });
        }

        const { data: txHistory } = await supabase
          .from('withdrawals')
          .select('*')
          .eq('user_id', currentUser.id)
          .order('created_at', { ascending: false });

        if (txHistory) {
          setHistory(txHistory);
        }
      }
      setLoading(false);
    };

    fetchUserData();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/profile`,
      },
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const handleSaveBank = async (e) => {
    e.preventDefault();
    if (!user) return alert('Vui lòng đăng nhập trước!');

    const { error } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        bank_name: bankInfo.bankName,
        account_number: bankInfo.accountNumber,
        account_name: bankInfo.accountName,
        updated_at: new Date(),
      });

    if (error) {
      alert('Lỗi lưu thông tin ngân hàng: ' + error.message);
    } else {
      alert('Đã lưu thông tin ngân hàng thành công!');
    }
  };

  // Xử lý rút tiền
  const handleWithdraw = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Lọc bỏ dấu chấm và chữ đ để lấy số thực (VD: "5.000.000đ" -> 5000000)
    const cleanAmount = withdrawAmount.replace(/\D/g, '');
    const amount = Number(cleanAmount);

    if (!amount || amount <= 0) return alert('Vui lòng nhập số tiền hợp lệ');
    if (amount > balance.available) return alert('Số dư khả dụng không đủ');
    if (!bankInfo.accountNumber || !bankInfo.bankName) {
      return alert('Vui lòng cập nhật thông tin ngân hàng trước khi rút tiền');
    }

    setIsSubmitting(true);

    try {
      const { data: newTx, error: txError } = await supabase
        .from('withdrawals')
        .insert([
          {
            user_id: user.id,
            amount: amount,
            bank_name: bankInfo.bankName,
            account_number: bankInfo.accountNumber,
            account_name: bankInfo.accountName,
            status: 'Đang xử lý',
          },
        ])
        .select()
        .single();

      if (txError) throw txError;

      const newAvailableBalance = balance.available - amount;
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ balance_available: newAvailableBalance })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setBalance((prev) => ({ ...prev, available: newAvailableBalance }));
      setHistory([newTx, ...history]);
      setShowWithdrawModal(false);
      setWithdrawAmount('');
      alert('Gửi yêu cầu rút tiền thành công!');
    } catch (error) {
      alert('Lỗi xử lý giao dịch: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-xs text-slate-500">
        ⏳ Đang tải thông tin tài khoản...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-28 font-sans text-left">
      <header className="p-4 bg-white border-b sticky top-0 z-10 flex items-center justify-between">
        <Link href="/" className="text-slate-600 text-sm font-bold">
          ← Trang chủ
        </Link>
        <h1 className="font-bold text-slate-800 text-sm">Tài Khoản</h1>
        <div className="w-12"></div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-4">
        {/* Profile */}
        <div className="bg-white p-5 rounded-3xl border shadow-sm text-center space-y-3">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto text-2xl overflow-hidden border">
            {user?.user_metadata?.avatar_url ? (
              <img src={user.user_metadata.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
            ) : (
              '👤'
            )}
          </div>

          <div>
            <h2 className="font-bold text-slate-800 text-base">
              {user ? (user.user_metadata?.full_name || 'Người dùng') : 'Chưa đăng nhập'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {user ? user.email : 'Đăng nhập để tự động tích điểm hoàn tiền vào ví'}
            </p>
          </div>

          {user ? (
            <div className="pt-2 border-t space-y-2">
              <div className="bg-slate-50 p-2.5 rounded-xl text-xs space-y-1 border">
                <p><span className="text-slate-400">Mã ID Ví:</span> <code className="bg-slate-200 px-1 py-0.5 rounded text-[10px] text-slate-700">{user.id}</code></p>
                <p><span className="text-slate-400">Trạng thái:</span> <span className="text-green-600 font-bold">Đã xác thực</span></p>
              </div>

              <button
                onClick={handleLogout}
                className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2 rounded-xl text-xs transition"
              >
                Đăng xuất
              </button>
            </div>
          ) : (
            <div className="pt-2 border-t">
              <button
                onClick={handleGoogleLogin}
                className="w-full bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-bold py-2.5 rounded-2xl text-xs shadow-sm flex items-center justify-center gap-2 transition active:scale-95"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                Đăng nhập bằng Google
              </button>
            </div>
          )}
        </div>

        {/* Ví & Rút tiền */}
        <div className="bg-gradient-to-br from-rose-500 to-pink-600 rounded-3xl p-5 text-white shadow-md space-y-4">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-xs text-rose-100 font-medium">Số dư có thể rút</span>
              <div className="text-2xl font-extrabold mt-1">
                {formatMoney(balance.available)}
              </div>
            </div>
            <span className="bg-white/25 backdrop-blur text-[10px] text-white px-2.5 py-1 rounded-full font-semibold">
              Chờ duyệt: {formatMoney(balance.pending)}
            </span>
          </div>

          <button
            onClick={() => setShowWithdrawModal(true)}
            disabled={!user}
            className="w-full bg-white text-rose-600 hover:bg-rose-50 font-bold py-2.5 rounded-2xl text-xs shadow-sm transition active:scale-95 disabled:opacity-60"
          >
            💳 Tạo Lệnh Rút Tiền
          </button>
        </div>

        {/* Thông tin Ngân hàng */}
        <div className="bg-white p-5 rounded-3xl border shadow-sm space-y-3">
          <h3 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
            🏦 Tài Khoản Ngân Hàng Nhận Tiền
          </h3>
          <form onSubmit={handleSaveBank} className="space-y-2.5">
            <div>
              <label className="text-[11px] text-slate-500 block mb-1">Ngân hàng</label>
              <input
                type="text"
                placeholder="VD: MBBank, Vietcombank..."
                value={bankInfo.bankName}
                onChange={(e) => setBankInfo({ ...bankInfo, bankName: e.target.value })}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-rose-400"
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
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-rose-400"
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
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-rose-400 font-semibold"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2 rounded-xl text-xs transition"
            >
              Lưu Thông Tin
            </button>
          </form>
        </div>

        {/* Lịch sử rút tiền */}
        <div className="bg-white p-5 rounded-3xl border shadow-sm space-y-3">
          <h3 className="font-bold text-slate-800 text-xs">📋 Lịch Sử Rút Tiền</h3>
          {history.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-4">Chưa có giao dịch rút tiền nào</p>
          ) : (
            <div className="space-y-2">
              {history.map((tx) => (
                <div key={tx.id} className="flex justify-between items-center p-2.5 bg-slate-50 rounded-xl border text-xs">
                  <div>
                    <div className="font-bold text-slate-800">-{formatMoney(tx.amount)}</div>
                    <div className="text-[10px] text-slate-400">
                      {new Date(tx.created_at || Date.now()).toLocaleDateString('vi-VN')}
                    </div>
                  </div>
                  <span className="bg-amber-100 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {tx.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modal Rút tiền */}
      {showWithdrawModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 space-y-4 shadow-xl">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-slate-800 text-sm">Rút Tiền Về Ngân Hàng</h3>
              <button onClick={() => setShowWithdrawModal(false)} className="text-slate-400 text-base">✕</button>
            </div>

            <form onSubmit={handleWithdraw} className="space-y-3">
              <div>
                <label className="text-[11px] text-slate-500 block mb-1">Số tiền muốn rút (VNĐ)</label>
                <input
                  type="text"
                  placeholder="Nhập số tiền (VD: 500.000)"
                  value={withdrawAmount ? `${withdrawAmount}đ` : ''}
                  onChange={handleAmountChange}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-sm font-bold focus:outline-none focus:border-rose-400"
                  required
                />
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border text-[11px] text-slate-600 space-y-1">
                <p><strong>Ngân hàng nhận:</strong> {bankInfo.bankName || 'Chưa cập nhật'}</p>
                <p><strong>Số tài khoản:</strong> {bankInfo.accountNumber || 'Chưa cập nhật'}</p>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowWithdrawModal(false)}
                  disabled={isSubmitting}
                  className="flex-1 bg-slate-100 text-slate-600 font-bold py-2.5 rounded-xl text-xs"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-rose-500 hover:bg-rose-600 text-white font-bold py-2.5 rounded-xl text-xs transition disabled:opacity-50"
                >
                  {isSubmitting ? 'Đang xử lý...' : 'Xác Nhận Rút'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Navigation Bottom */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t flex justify-around py-2 z-30">
        <Link href="/" className="flex flex-col items-center text-slate-400 hover:text-orange-500 text-[10px]">
          <span className="text-base">🏠</span>
          Trang chủ
        </Link>
        <Link href="/profile" className="flex flex-col items-center text-orange-500 font-bold text-[10px]">
          <span className="text-base">👤</span>
          Tài khoản
        </Link>
      </nav>
    </div>
  );
}