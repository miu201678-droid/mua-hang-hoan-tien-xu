'use client';
import { useState } from 'react';
import Link from 'next/link';
import BottomNav from '@/components/BottomNav';

const MY_AFFILIATE_ID = "17318640399";

// Dữ liệu mẫu các deal 1K (Bạn có thể tự thêm hoặc thay đổi danh sách sản phẩm ở đây)
const SAMPLE_DEALS = [
  {
    id: 1,
    name: 'Đèn LED cắm USB mini siêu sáng bảo vệ mắt',
    price: 1000,
    oldPrice: 15000,
    image: 'https://images.unsplash.com/photo-1540932239986-30128078f3c5?w=300&auto=format&fit=crop&q=60',
    shop: 'Shopee Mall',
    sold: '1.2k',
    link: 'https://shopee.vn'
  },
  {
    id: 2,
    name: 'Miếng dán cường lực điện thoại chống bám vân tay',
    price: 1000,
    oldPrice: 20000,
    image: 'https://images.unsplash.com/photo-1585060544812-6b45742d762f?w=300&auto=format&fit=crop&q=60',
    shop: 'Shop Yêu Thích',
    sold: '3.4k',
    link: 'https://shopee.vn'
  },
  // Bạn có thể dễ dàng thêm nhiều sản phẩm khác vào đây...
];

export default function CustomDeal1kPage() {
  const [filter, setFilter] = useState('ALL');

  // Hàm tạo link affiliate chuẩn tự động gắn ID của bạn
  const getAffiliateUrl = (originLink) => {
    const encoded = encodeURIComponent(originLink || 'https://shopee.vn');
    return `https://s.shopee.vn/an_redir?origin_link=${encoded}&affiliate_id=${MY_AFFILIATE_ID}&sub_id=deal1k_page`;
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white pb-24 font-sans">
      {/* Header riêng của bạn, sạch sẽ, không dính rác */}
      <header className="flex justify-between items-center p-4 bg-slate-800/80 backdrop-blur border-b border-slate-700 sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <span className="text-xl">🔥</span>
          <h1 className="font-extrabold text-sm text-orange-400">SĂN DEAL 1K ĐỒNG GIÁ</h1>
        </div>
        <Link 
          href="/" 
          className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-xl text-xs font-semibold transition"
        >
          Trang chủ
        </Link>
      </header>

      {/* Danh mục lọc nhanh */}
      <div className="px-4 py-3 flex gap-2 overflow-x-auto no-scrollbar bg-slate-800/40 border-b border-slate-800">
        <button 
          onClick={() => setFilter('ALL')}
          className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${filter === 'ALL' ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-300'}`}
        >
          ✨ Tất cả Deal
        </button>
        <button 
          onClick={() => setFilter('1K')}
          className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${filter === '1K' ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-300'}`}
        >
          🔥 Deal 1K
        </button>
        <button 
          onClick={() => setFilter('9K')}
          className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${filter === '9K' ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-300'}`}
        >
          ⚡ Deal 9K
        </button>
      </div>

      {/* Danh sách sản phẩm */}
      <main className="p-4 max-w-md mx-auto">
        <div className="grid grid-cols-2 gap-3">
          {SAMPLE_DEALS.map((item) => (
            <div key={item.id} className="bg-slate-800 rounded-2xl overflow-hidden border border-slate-700/60 flex flex-col justify-between shadow-lg">
              <div>
                <div className="relative aspect-square bg-slate-700">
                  <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  <span className="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-black px-2 py-0.5 rounded-md shadow">
                    -95%
                  </span>
                </div>
                <div className="p-2.5">
                  <h3 className="text-xs font-medium text-slate-200 line-clamp-2 leading-snug">
                    {item.name}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-2">
                    <span className="text-sm font-black text-orange-400">
                      {item.price.toLocaleString('vi-VN')} đ
                    </span>
                    <span className="text-[10px] text-slate-400 line-through">
                      {item.oldPrice.toLocaleString('vi-VN')} đ
                    </span>
                  </div>
                </div>
              </div>

              <div className="p-2.5 pt-0">
                <a 
                  href={getAffiliateUrl(item.link)}
                  target="_blank"
                  rel="noreferrer"
                  className="block w-full text-center bg-orange-500 hover:bg-orange-600 active:scale-95 text-white font-extrabold py-2 rounded-xl text-xs shadow transition uppercase"
                >
                  Mua Ngay
                </a>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Thanh điều hướng dưới */}
      <BottomNav active="deal-1k" />
    </div>
  );
}