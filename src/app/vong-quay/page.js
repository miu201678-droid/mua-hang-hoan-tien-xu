'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export default function VongQuayPage() {
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState(null);

  // Lấy số dư ví hiện tại của tài khoản từ Supabase
  const fetchBalance = useCallback(async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('balance_available')
        .eq('id', userId)
        .single();

      if (data && !error) {
        setBalance(data.balance_available || 0);
      }
    } catch (err) {
      console.error('Lỗi lấy số dư:', err);
    }
  }, []);

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        fetchBalance(user.id);
      }
    }
    getUser();
  }, [fetchBalance]);

  const handleSpin = async () => {
    if (!user) {
      alert('Vui lòng đăng nhập để quay thưởng!');
      return;
    }

    setSpinning(true);
    setResult(null);

    const newRotation = rotation + 1440 + Math.floor(Math.random() * 360);
    setRotation(newRotation);

    try {
      const res = await fetch('/api/spin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });

      const data = await res.json();

      if (!data.success) {
        alert(data.error || 'Có lỗi xảy ra!');
        setSpinning(false);
        return;
      }

      setTimeout(() => {
        const wonAmount = data.amount || data.wonAmount || 0;
        const isWin = wonAmount > 0;

        setResult({
          message: data.message,
          isWin: Boolean(isWin)
        });

        // Nếu trúng thưởng: Tự động cộng số dư trên UI & đồng bộ lại từ Supabase
        if (isWin) {
          setBalance((prev) => prev + wonAmount);
          fetchBalance(user.id);
        }

        setSpinning(false);
      }, 3000);

    } catch (err) {
      alert('Có lỗi kết nối, vui lòng thử lại sau!');
      setSpinning(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 font-sans">
      <div className="bg-slate-900 border border-slate-800 p-6 md:p-8 rounded-2xl max-w-md w-full text-center shadow-2xl relative overflow-hidden">
        
        {/* Header & Thẻ hiển thị số dư ví */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-amber-400 mb-4">🎁 VÒNG QUAY MAY MẮN</h1>
          
          <div className="bg-slate-800/90 border border-slate-700/80 rounded-xl p-3.5 flex items-center justify-between shadow-inner">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-lg">
                👛
              </div>
              <div className="text-left">
                <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Số dư khả dụng</p>
                <p className="text-xs font-semibold text-slate-300 truncate max-w-[120px]">
                  {user ? (user.email?.split('@')[0] || 'Thành viên') : 'Chưa đăng nhập'}
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-xl font-extrabold text-emerald-400 tracking-tight">
                {Number(balance).toLocaleString('vi-VN')}
              </span>
              <span className="text-xs font-bold text-emerald-500 ml-1">đ</span>
            </div>
          </div>
        </div>

        <p className="text-gray-400 text-xs mb-6">Mỗi 5 đơn hàng thành công = 1 lượt quay (Cơ hội nhận 5k, 10k, 15k cộng thẳng vào ví)</p>

        {/* Khung Vòng Quay */}
        <div className="flex justify-center my-6 overflow-hidden py-2">
          <div
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: spinning ? 'transform 3s cubic-bezier(0.15, 0.9, 0.25, 1)' : 'none',
            }}
            className="w-44 h-44 rounded-full border-4 border-amber-400 flex items-center justify-center text-lg font-bold bg-gradient-to-tr from-amber-500 to-red-500 shadow-lg shadow-amber-500/20 select-none"
          >
            {spinning ? '🌀 Đang quay...' : '🎰 VÒNG QUAY'}
          </div>
        </div>

        {/* Nút quay */}
        <button
          onClick={handleSpin}
          disabled={spinning}
          className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 disabled:opacity-50 text-black font-extrabold rounded-xl transition-all shadow-lg shadow-amber-500/20 active:scale-95 text-sm uppercase tracking-wider"
        >
          {spinning ? 'ĐANG QUAY...' : 'QUAY NGAY'}
        </button>

        {/* Thông báo kết quả */}
        {result && (
          <div
            className={`mt-4 p-3.5 border rounded-xl text-sm font-semibold transition-all duration-300 ${
              result.isWin
                ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-400 shadow-lg shadow-emerald-500/10'
                : 'bg-slate-800/80 border-slate-700 text-slate-300'
            }`}
          >
            {result.message}
          </div>
        )}
      </div>
    </div>
  );
}