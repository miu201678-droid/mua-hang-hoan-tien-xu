'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import BottomNav from '@/components/BottomNav';

const MY_AFFILIATE_ID = "17318640399";

export default function Home() {
  const [user, setUser] = useState(null);
  const [inputUrl, setInputUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [resultData, setResultData] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // State quản lý bước LED chạy tự động (0: Dán link, 1: Mở link, 2: Đặt hàng, 3: Rút tiền)
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const getUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user ?? null);
    };

    getUser();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  // Effect chạy hiệu ứng LED tự động chuyển bước mỗi 1.5 giây
  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 4);
    }, 1500);
    return () => clearInterval(timer);
  }, []);

  const extractProductParam = (urlStr) => {
    if (!urlStr) return null;
    const cleanUrl = urlStr.trim();
    
    if (/^\d+$/.test(cleanUrl)) return { type: 'item_id', value: cleanUrl };

    if (cleanUrl.includes('tiktok.com') || cleanUrl.includes('vt.tiktok.com')) {
      return { type: 'tiktok_url', value: cleanUrl };
    }

    const itemIdMatch = cleanUrl.match(/-i\.\d+\.(\d+)|product\/\d+\/(\d+)/);
    if (itemIdMatch) {
      return { type: 'item_id', value: itemIdMatch[1] || itemIdMatch[2] };
    }

    if (cleanUrl.includes('shopee.vn') || cleanUrl.includes('shp.ee')) {
      return { type: 'shopee_url', value: cleanUrl };
    }

    return null;
  };

  const buildShopeeAffiliateLink = async (originLink) => {
    const userIdSub = user ? user.id : 'guest';

    try {
      const res = await fetch(`/api/convert?url=${encodeURIComponent(originLink)}&userId=${userIdSub}`);
      const data = await res.json();

      if (data && data.short_url) {
        return data.short_url;
      }
    } catch (err) {
      console.warn("Không thể tạo link qua API rút gọn nội bộ, dùng link an_redir dự phòng:", err);
    }

    const cleanLanding = originLink ? originLink.split('?')[0] : 'https://shopee.vn';
    const encodedLanding = encodeURIComponent(cleanLanding);
    return `https://s.shopee.vn/an_redir?origin_link=${encodedLanding}&affiliate_id=${MY_AFFILIATE_ID}&sub_id=${userIdSub}`;
  };

  const handleCheckLink = async () => {
    setErrorMsg('');
    setResultData(null);

    const param = extractProductParam(inputUrl);
    if (!param) {
      setErrorMsg('Vui lòng dán đúng đường dẫn hoặc ID sản phẩm Shopee / TikTok!');
      return;
    }

    setLoading(true);

    try {
      const isTikTok = param.type === 'tiktok_url' || param.value.includes('tiktok.com');
      let data;

      const COMMISSION_SHARE_RATE = 0.55;

      if (isTikTok) {
        const apiUrl = `https://data.addlivetag.com/tiktok/product.php?url=${encodeURIComponent(inputUrl.trim())}`;
        const res = await fetch(apiUrl);
        data = await res.json();

        if (data && data.productInfo && data.productInfo.hasCommission) {
          const info = data.productInfo;
          const totalCommission = info.commission || 0;
          
          const userCashbackMoney = Math.round(totalCommission * COMMISSION_SHARE_RATE); 
          const rawPercent = info.commissionRatePercent || 0;
          const userCashbackPercent = (rawPercent * COMMISSION_SHARE_RATE).toFixed(1);
          
          setResultData({
            name: info.productName,
            image: info.imageUrl || info.image || info.img || '/logo.png',
            price: info.price || 0,
            shopName: info.shopName || info.storeName || 'TikTok Shop',
            sales: info.sales || 0,
            rating: 5,
            cashbackMoney: userCashbackMoney,
            cashbackPercent: userCashbackPercent,
            affiliateUrl: info.productLink || inputUrl,
          });
        } else {
          setErrorMsg('Không tìm thấy thông tin sản phẩm TikTok hoặc sản phẩm không có hoa hồng affiliate.');
        }
      } else {
        const apiUrl = `https://data.addlivetag.com/product-data/product-data.php?url=${encodeURIComponent(inputUrl.trim())}`;
        const res = await fetch(apiUrl);
        data = await res.json();

        if (data.status === 'success' && data.productInfo) {
          const info = data.productInfo;
          const totalCommission = info.commission || 0;
          
          const userCashbackMoney = Math.round(totalCommission * COMMISSION_SHARE_RATE); 
          const rawPercent = info.totalRatePercent ? Math.abs(info.totalRatePercent) : 0;
          const userCashbackPercent = (rawPercent * COMMISSION_SHARE_RATE).toFixed(1);
          
          const affLink = await buildShopeeAffiliateLink(info.productLink || inputUrl);

          setResultData({
            name: info.productName,
            image: info.imageUrl,
            price: info.price,
            shopName: info.shopName,
            sales: info.sales,
            rating: info.rating,
            cashbackMoney: userCashbackMoney,
            cashbackPercent: userCashbackPercent,
            affiliateUrl: affLink,
          });
        } else {
          setErrorMsg('Không tìm thấy thông tin sản phẩm hoặc sản phẩm không hỗ trợ hoàn tiền.');
        }
      }
    } catch (err) {
      console.error(err);
      setErrorMsg('Có lỗi xảy ra khi kết nối máy chủ dữ liệu. Vui lòng thử lại!');
    } finally {
      setLoading(false);
    }
  };

  // Mảng cấu hình 4 bước của Stepper
  const steps = [
    { label: 'Dán link', icon: '📋' },
    { label: 'Mở link', icon: '🛒' },
    { label: 'Đặt hàng', icon: '🧾' },
    { label: 'Rút tiền', icon: '💵' },
  ];

  // Tính tỷ lệ phần trăm độ dài vệt sáng thanh nối LED (0%, 33%, 66%, 100%)
  const progressPercent = (activeStep / 3) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-100 via-blue-50 to-white relative overflow-hidden pb-24 font-sans">
      {/* Dynamic Keyframes cho viền LED */}
      <style jsx global>{`
        @keyframes ledMove {
          0% { background-position: 0% 0%; }
          100% { background-position: 300% 0%; }
        }
        .led-border {
          background: linear-gradient(90deg, #f97316, #fb923c, #0284c7, #f97316);
          background-size: 300% 100%;
          animation: ledMove 6s linear infinite;
        }
        .led-border-scanning {
          background: linear-gradient(90deg, #f97316, #38bdf8, #22c55e, #f97316);
          background-size: 300% 100%;
          animation: ledMove 0.8s linear infinite;
        }
      `}</style>

      <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-5 -z-0">
        <img src="/logo.png" alt="Watermark" className="w-96 h-96 object-contain" />
      </div>

      <header className="flex justify-between items-center p-4 bg-white/80 backdrop-blur border-b border-blue-100 sticky top-0 z-20">
        <button 
          onClick={() => setIsMenuOpen(true)} 
          className="text-2xl text-slate-700 p-1 hover:bg-slate-100 rounded-lg transition"
          aria-label="Open Menu"
        >
          ☰
        </button>
        <img src="/logo.png" alt="Speedo Cashback" className="h-9 object-contain" />
        
        {user ? (
          <Link href="/profile" className="flex items-center gap-2 bg-slate-100 p-1 pr-3 rounded-full border">
            <img src={user.user_metadata?.avatar_url || '/logo.png'} className="w-6 h-6 rounded-full" alt="Avatar" />
            <span className="text-xs font-bold text-slate-700 truncate max-w-[80px]">
              {user.user_metadata?.full_name || 'Tài khoản'}
            </span>
          </Link>
        ) : (
          <Link 
            href="/profile" 
            className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-4 py-1.5 rounded-full text-sm shadow transition"
          >
            Đăng nhập
          </Link>
        )}
      </header>

      {isMenuOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
            onClick={() => setIsMenuOpen(false)}
          ></div>

          <div className="relative w-64 bg-white h-full p-5 flex flex-col justify-between shadow-2xl z-10">
            <div>
              <div className="flex justify-between items-center pb-4 border-b">
                <div className="flex items-center gap-2">
                  <img src="/logo.png" alt="Logo" className="h-7 object-contain" />
                  <span className="font-bold text-slate-800 text-sm">Danh Mục</span>
                </div>
                <button 
                  onClick={() => setIsMenuOpen(false)}
                  className="text-slate-400 hover:text-slate-700 font-bold text-lg p-1"
                >
                  ✕
                </button>
              </div>

              <nav className="flex flex-col space-y-2 mt-4 text-xs font-semibold text-slate-700">
                <Link href="/" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 p-3 hover:bg-slate-100 rounded-xl transition">
                  <span>🏠</span> Trang chủ
                </Link>
                
                <Link href="/deal-1k" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 p-3 hover:bg-orange-50 hover:text-orange-600 rounded-xl transition font-bold text-orange-600">
                  <span>🔥</span> Săn Deal 1K
                </Link>

                <Link href="/vong-quay" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 p-3 hover:bg-amber-50 hover:text-amber-600 rounded-xl transition font-bold text-amber-600">
                  <span>🎁</span> Vòng Quay May Mắn
                </Link>

                <Link href="/withdraw" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 p-3 hover:bg-slate-100 rounded-xl transition">
                  <span>💳</span> Rút tiền
                </Link>

                <Link href="/profile" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 p-3 hover:bg-slate-100 rounded-xl transition">
                  <span>👤</span> Tài khoản
                </Link>

                <hr className="my-2 border-slate-100" />
                
                <Link href="/admin" onClick={() => setIsMenuOpen(false)} className="flex items-center gap-3 p-3 text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition font-bold">
                  <span>⚙️</span> Trang Quản Trị (Admin)
                </Link>
              </nav>
            </div>

            <div className="text-[10px] text-slate-400 text-center border-t pt-3">
              © Cashback System
            </div>
          </div>
        </div>
      )}

      <main className="px-4 pt-6 max-w-md mx-auto relative z-10 text-center space-y-6">
        <section>
          <h1 className="text-2xl font-extrabold text-slate-800 leading-snug">
            Mua Sắm Thông Minh<br />
            <span className="text-orange-500">Hoàn Tiền Hoa Hồng</span>
          </h1>
          <p className="text-xs text-slate-600 mt-2">
            Tiết kiệm tối đa cho mọi đơn hàng Shopee & TikTok. Nhận tiền mặt trực tiếp về tài khoản ngân hàng.
          </p>

          {/* CARD NHẬP LINK BỌC VIỀN LED */}
          <div className={`mt-6 p-[2px] rounded-2xl transition-all duration-300 ${
            loading 
              ? 'led-border-scanning shadow-[0_0_20px_rgba(249,115,22,0.4)]' 
              : 'led-border shadow-sm'
          }`}>
            <div className="bg-white p-4 rounded-[14px] text-left">
              <h2 className="font-bold text-slate-800 text-sm text-center">Dán Link kiểm tra hoàn tiền</h2>
              <p className="text-[11px] text-slate-500 mb-3 text-center">Hỗ trợ link sản phẩm Shopee & TikTok</p>
              
              <input 
                type="text" 
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="Dán link sản phẩm Shopee hoặc TikTok..." 
                className="w-full bg-slate-100 px-3 py-2.5 rounded-xl text-xs outline-none border focus:border-blue-400 mb-3"
              />

              <button 
                onClick={handleCheckLink}
                disabled={loading}
                className="w-full bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-bold py-2.5 rounded-xl text-sm shadow flex items-center justify-center gap-1 transition disabled:opacity-50"
              >
                {loading ? (
                  <span className="animate-pulse">⚡ ĐANG QUÉT LINK HOÀN TIỀN...</span>
                ) : (
                  '⚡ KIỂM TRA & NHẬN LINK'
                )}
              </button>

              {errorMsg && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-center space-y-2">
                  <p className="text-red-500 text-[11px] font-medium">{errorMsg}</p>
                </div>
              )}

              {resultData && (
                <div className="mt-4 p-3 bg-blue-50/70 rounded-xl border border-blue-200 text-left space-y-3">
                  <div className="flex gap-3 items-center">
                    <img 
                      src={resultData.image} 
                      alt={resultData.name} 
                      className="w-16 h-16 object-cover rounded-lg border bg-white flex-shrink-0" 
                    />
                    <div className="overflow-hidden">
                      <h3 className="font-bold text-xs text-slate-800 line-clamp-2 leading-tight">
                        {resultData.name}
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-1">
                        Shop: <span className="font-semibold text-slate-700">{resultData.shopName}</span>
                      </p>
                      <p className="text-xs font-extrabold text-orange-600 mt-0.5">
                        {resultData.price ? resultData.price.toLocaleString('vi-VN') + ' đ' : 'Đang cập nhật'}
                      </p>
                    </div>
                  </div>

                  <div className="bg-orange-100 border border-orange-200 p-2.5 rounded-xl flex justify-between items-center">
                    <div>
                      <div className="text-[10px] text-orange-800 font-medium">Tiền hoàn của bạn:</div>
                      <div className="text-base font-black text-orange-600">
                        +{resultData.cashbackMoney.toLocaleString('vi-VN')} đ
                      </div>
                    </div>
                    <span className="bg-orange-500 text-white font-bold text-xs px-2.5 py-1 rounded-lg">
                      ~{resultData.cashbackPercent}%
                    </span>
                  </div>

                  {user ? (
                    <a 
                      href={resultData.affiliateUrl} 
                      target="_blank" 
                      rel="noreferrer"
                      className="block w-full text-center bg-green-600 hover:bg-green-700 text-white font-extrabold py-2.5 rounded-xl text-xs shadow transition uppercase"
                    >
                      🛒 MUA NGAY ĐỂ NHẬN HOÀN TIỀN
                    </a>
                  ) : (
                    <Link 
                      href="/profile" 
                      className="block w-full text-center bg-orange-500 hover:bg-orange-600 text-white font-extrabold py-2.5 rounded-xl text-xs shadow transition uppercase"
                    >
                      👉 ĐĂNG NHẬP ĐỂ MUA HÀNG & NHẬN HOÀN TIỀN
                    </Link>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mt-6">
            <div className="bg-white p-3 rounded-xl shadow-sm border text-center border-orange-200">
              <div className="font-bold text-orange-500 text-sm mb-1">Shopee</div>
              <span className="bg-orange-500 text-white text-[10px] px-2 py-0.5 rounded-full">Đang chạy</span>
            </div>
            <div className="bg-white p-3 rounded-xl shadow-sm border text-center opacity-60">
              <div className="font-bold text-blue-600 text-sm mb-1">Lazada</div>
              <span className="bg-slate-200 text-slate-600 text-[10px] px-2 py-0.5 rounded-full">Sắp có</span>
            </div>
            <div className="bg-white p-3 rounded-xl shadow-sm border text-center border-slate-300">
              <div className="font-bold text-slate-800 text-sm mb-1">TikTok</div>
              <span className="bg-green-600 text-white text-[10px] px-2 py-0.5 rounded-full">Đang chạy</span>
            </div>
          </div>
        </section>

        {/* Hướng dẫn dạng Stepper LED Tự Động Chạy */}
        <section className="bg-white/90 backdrop-blur p-5 rounded-3xl shadow-sm border border-emerald-100 text-center">
          <span className="inline-block bg-emerald-50 text-emerald-600 text-[11px] font-semibold px-3 py-1 rounded-full mb-2">
            ❓ Hướng dẫn nhanh
          </span>
          <h2 className="text-lg font-bold text-slate-800">Cách Nhận Hoàn Tiền</h2>
          <p className="text-[11px] text-slate-500 mt-1 mb-8">
            Chỉ mất chưa đầy 1 phút để hoàn tất quy trình
          </p>

          <div className="relative flex items-center justify-between max-w-sm mx-auto px-2">
            {/* Thanh nền xám đệm dưới */}
            <div className="absolute top-5 left-6 right-6 h-1 bg-slate-100 -z-0 rounded-full" />

            {/* Thanh LED màu xanh phát sáng chạy theo tỉ lệ % */}
            <div 
              className="absolute top-5 left-6 h-1 bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-500 -z-0 shadow-[0_0_8px_rgba(16,185,129,0.8)]" 
              style={{ width: `calc(${progressPercent}% * 0.82)` }}
            />

            {/* Vòng lặp hiển thị 4 nút bước */}
            {steps.map((step, idx) => {
              const isPassed = idx <= activeStep;
              const isCurrent = idx === activeStep;

              return (
                <div key={idx} className="flex flex-col items-center relative z-10 transition-all duration-300">
                  <div 
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm border-2 transition-all duration-500 ${
                      isPassed
                        ? 'bg-emerald-500 text-white border-white shadow-[0_0_10px_rgba(16,185,129,0.6)]'
                        : 'bg-white text-slate-400 border-slate-200'
                    } ${isCurrent ? 'scale-110 animate-pulse border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.9)]' : ''}`}
                  >
                    {step.icon}
                  </div>
                  <span className={`text-[11px] mt-2 transition-colors duration-300 ${
                    isCurrent ? 'font-bold text-emerald-600 scale-105' : isPassed ? 'font-semibold text-slate-800' : 'font-medium text-slate-400'
                  }`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* SECTION: HƯỚNG DẪN MUA SẮM SHOPEE (UI MOCKUP KHÔNG DÙNG FILE ẢNH) */}
        <section className="bg-white/90 backdrop-blur p-5 rounded-3xl shadow-sm border border-orange-100 text-left space-y-4 font-sans">
          <div className="text-center">
            <span className="inline-block bg-orange-50 text-orange-600 text-[11px] font-semibold px-3 py-1 rounded-full mb-1">
              📖 Chi tiết từng bước
            </span>
            <h2 className="text-lg font-bold text-slate-800">Hướng dẫn mua sắm Shopee</h2>
          </div>

          {/* BƯỚC 1 */}
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-3">
            <p className="text-xs leading-relaxed text-slate-700">
              <strong className="text-orange-500">Bước 1:</strong> Tìm sản phẩm bạn muốn mua trên Shopee. Nhấn vào biểu tượng &quot;Chia sẻ&quot; góc phải màn hình &amp; sao chép đường dẫn.
            </p>
            <div className="bg-amber-50 rounded-xl p-2.5 border border-amber-100 flex items-start gap-2 text-[11px] text-amber-800">
              <span className="text-amber-500 font-bold">⚠️</span>
              <span>Xóa sản phẩm khỏi giỏ hàng nếu đã thêm trước đó</span>
            </div>
            
            <div className="rounded-xl p-3 bg-gradient-to-b from-orange-500 to-orange-600 text-white space-y-2 shadow-inner">
              <div className="flex justify-between items-center text-[10px] opacity-90 border-b border-orange-400 pb-1.5">
                <span>🛒 Shopee App</span>
                <span className="bg-white/20 px-2 py-0.5 rounded-full">Chi tiết sản phẩm</span>
              </div>
              <div className="flex items-center justify-between bg-white text-slate-800 p-2.5 rounded-lg shadow">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🛍️</span>
                  <div>
                    <div className="font-semibold text-xs truncate max-w-[130px]">Sản phẩm Shopee...</div>
                    <div className="text-orange-600 font-bold text-xs">150.000đ</div>
                  </div>
                </div>
                <div className="bg-orange-100 text-orange-600 px-2 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 animate-pulse">
                  <span>↗️</span> Chia sẻ
                </div>
              </div>
            </div>
          </div>

          {/* BƯỚC 2 */}
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-3">
            <p className="text-xs leading-relaxed text-slate-700">
              <strong className="text-orange-500">Bước 2:</strong> Vào Hoàn Tiền Online, dán đường dẫn tại &quot;Dán link xem tiền hoàn&quot;.
            </p>
            <div className="bg-blue-50 rounded-xl p-2.5 border border-blue-100 flex items-start gap-2 text-[11px] text-blue-800">
              <span className="text-blue-500 font-bold">💡</span>
              <span>Hệ thống tự động tạo liên kết hoàn tiền cho bạn</span>
            </div>

            <div className="rounded-xl p-3 bg-slate-50 border border-slate-200 space-y-2">
              <div className="text-[10px] font-semibold text-slate-500 text-center">Ô Nhập Link Hoàn Tiền</div>
              <div className="bg-white border-2 border-orange-400 p-2 rounded-lg flex items-center justify-between shadow-sm">
                <span className="text-[11px] text-slate-400 truncate max-w-[170px]">https://shopee.vn/product/...</span>
                <span className="bg-orange-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-md">Kiểm tra</span>
              </div>
            </div>
          </div>

          {/* BƯỚC 3 */}
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-3">
            <p className="text-xs leading-relaxed text-slate-700">
              <strong className="text-orange-500">Bước 3:</strong> Sau khi chuyển sang Shopee, thêm hàng vào giỏ &amp; hoàn tất thanh toán.
            </p>
            <div className="bg-amber-50 rounded-xl p-2.5 border border-amber-100 flex items-start gap-2 text-[11px] text-amber-800">
              <span className="text-amber-500 font-bold">⚠️</span>
              <span>Không nhấn vào video, livestream để tránh mất đơn hoàn tiền</span>
            </div>

            <div className="rounded-xl p-3 bg-orange-50 border border-orange-200 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-700">Tổng thanh toán:</span>
                <span className="text-orange-600 font-bold text-sm">150.000đ</span>
              </div>
              <div className="w-full bg-orange-500 text-white font-bold text-center py-2 rounded-lg shadow-md text-xs">
                ĐẶT HÀNG NGAY
              </div>
            </div>
          </div>

          {/* BƯỚC 4 */}
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm space-y-3">
            <p className="text-xs leading-relaxed text-slate-700">
              <strong className="text-orange-500">Bước 4:</strong> Sau khi thanh toán thành công, chờ 1-5 ngày đơn hoàn tiền được ghi nhận. Theo dõi trạng thái tại Lịch sử.
            </p>
            <div className="bg-blue-50 rounded-xl p-2.5 border border-blue-100 flex items-start gap-2 text-[11px] text-blue-800">
              <span className="text-blue-500 font-bold">💡</span>
              <span>Tiền được cộng tự động vào tài khoản</span>
            </div>

            <div className="rounded-xl p-3 bg-green-50 border border-green-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="bg-green-500 text-white p-1.5 rounded-full text-[10px]">✓</div>
                <div>
                  <div className="text-xs font-bold text-slate-800">Đơn hàng Shopee</div>
                  <div className="text-[10px] text-slate-500">Trạng thái: Chờ ghi nhận</div>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-green-600">+12.500đ</span>
                <div className="text-[10px] text-slate-400">Hoàn tiền</div>
              </div>
            </div>
          </div>
        </section>

        {/* Lộ trình hoàn tiền */}
        <section className="bg-white/90 backdrop-blur p-5 rounded-3xl shadow-sm border border-blue-100 text-center">
          <span className="inline-block bg-blue-100 text-blue-600 text-[11px] font-semibold px-3 py-1 rounded-full mb-2">
            📈 Lộ trình hoàn tiền
          </span>
          <h2 className="text-lg font-bold text-slate-800">Quy Trình Nhận Hoàn Tiền Siêu Tốc</h2>
          <p className="text-[11px] text-slate-500 mt-1 mb-6">
            Hiểu rõ quy trình ghi nhận đơn hàng và thời gian tiền hoàn về tài khoản.
          </p>

          <div className="space-y-4">
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
              <div className="w-10 h-10 bg-orange-500 text-white rounded-xl flex items-center justify-center mx-auto text-lg mb-2 shadow-sm">🛍️</div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">BƯỚC 1: MUA HÀNG</span>
              <h3 className="font-extrabold text-slate-800 text-sm mt-0.5">Ngày mua</h3>
              <span className="inline-block bg-orange-100 text-orange-600 text-[10px] font-bold px-2 py-0.5 rounded-full my-1.5">Hôm nay</span>
              <p className="text-[11px] text-slate-500">Bạn copy link dán vào hệ thống, nhận link hoàn tiền và tiến hành đặt mua hàng.</p>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
              <div className="w-10 h-10 bg-white border text-slate-600 rounded-xl flex items-center justify-center mx-auto text-lg mb-2 shadow-sm">☑️</div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">BƯỚC 2: ĐỐI SOÁT</span>
              <h3 className="font-extrabold text-slate-800 text-sm mt-0.5">Ghi nhận</h3>
              <span className="inline-block bg-slate-200 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full my-1.5">Ngày mai</span>
              <p className="text-[11px] text-slate-500">Sàn ghi nhận đơn hàng tạm tính và tự động đồng bộ hiển thị trong lịch sử ví.</p>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-center">
              <div className="w-10 h-10 bg-white border text-slate-600 rounded-xl flex items-center justify-center mx-auto text-lg mb-2 shadow-sm">🛡️</div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">BƯỚC 3: THỰC NHẬN</span>
              <h3 className="font-extrabold text-slate-800 text-sm mt-0.5">Có thể rút</h3>
              <span className="inline-block bg-slate-200 text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded-full my-1.5">7 ngày</span>
              <p className="text-[11px] text-slate-500">Sau khi đơn hoàn thành, tiền khả dụng sẽ được cộng vào ví và có thể rút ngay.</p>
            </div>
          </div>
        </section>

        {/* Trợ giúp & Cộng đồng */}
        <section className="bg-white/90 backdrop-blur p-5 rounded-3xl shadow-sm border border-blue-100 text-center space-y-4">
          <span className="inline-block bg-blue-100 text-blue-600 text-[11px] font-semibold px-3 py-1 rounded-full">
            💬 Trợ giúp & Cộng đồng
          </span>
          <h2 className="text-lg font-bold text-slate-800">Cập Nhật Thông Tin & Hỗ Trợ</h2>
          <p className="text-[11px] text-slate-500">
            Tham gia các kênh cộng đồng để nhận tín hiệu săn mã giảm giá và hỗ trợ trực tiếp.
          </p>

          <div className="space-y-3 pt-1">
            <a href="https://www.facebook.com/share/g/1SWxrzShJi/" target="_blank" rel="noreferrer" className="flex items-center justify-between p-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl shadow transition">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center text-lg">👥</div>
                <div className="text-left">
                  <div className="font-bold text-xs">Cộng Đồng Facebook</div>
                  <div className="text-[10px] text-blue-100">Cập nhật tin tức & deals hot</div>
                </div>
              </div>
              <span className="text-xs font-bold bg-white/20 px-2.5 py-1 rounded-lg">Tham gia</span>
            </a>

            <a href="https://t.me/sansalemuarebanlai" target="_blank" rel="noreferrer" className="flex items-center justify-between p-3.5 bg-sky-500 hover:bg-sky-600 text-white rounded-2xl shadow transition">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center text-lg">🤖</div>
                <div className="text-left">
                  <div className="font-bold text-xs">Telegram Báo Mã Nhanh</div>
                  <div className="text-[10px] text-sky-100">Có Bot tự động báo tín hiệu mã hot</div>
                </div>
              </div>
              <span className="text-xs font-bold bg-white/20 px-2.5 py-1 rounded-lg">Vào ngay</span>
            </a>

            <a href="https://zalo.me/g/ltnns6sbwe1qucoc2x4d" target="_blank" rel="noreferrer" className="flex items-center justify-between p-3.5 bg-blue-500 hover:bg-blue-600 text-white rounded-2xl shadow transition">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center text-lg">💬</div>
                <div className="text-left">
                  <div className="font-bold text-xs">Nhóm Zalo Trao Đổi</div>
                  <div className="text-[10px] text-blue-100">Trò chuyện & hỗ trợ khách hàng</div>
                </div>
              </div>
              <span className="text-xs font-bold bg-white/20 px-2.5 py-1 rounded-lg">Tham gia</span>
            </a>
          </div>
        </section>
      </main>

      <BottomNav active="home" />
    </div>
  );
}