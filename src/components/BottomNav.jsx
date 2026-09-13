'use client';
import Link from 'next/link';

export default function BottomNav({ active = 'home' }) {
  return (
    <div className="fixed bottom-4 left-0 right-0 z-30 flex justify-center px-4">
      <nav className="bg-white/95 backdrop-blur border border-slate-200 rounded-full shadow-xl flex items-center justify-around px-4 py-2 w-full max-w-md">
        
        {/* 1. Trang chủ */}
        <Link href="/" className={`flex flex-col items-center flex-1 transition ${active === 'home' ? 'text-orange-500 font-bold' : 'text-slate-700 hover:text-orange-500'}`}>
          <svg className={`w-5 h-5 ${active === 'home' ? 'text-orange-500' : 'text-slate-700'}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span className="text-[10px] mt-1">Trang chủ</span>
        </Link>

        <div className="h-5 w-[1px] bg-slate-200 mx-1"></div>

        {/* 2. Voucher */}
        <a href="https://s.shopee.vn/4AzXOAbszD" target="_blank" rel="noreferrer" className="flex flex-col items-center flex-1 text-slate-700 hover:text-orange-500 transition">
          <svg className="w-5 h-5 text-slate-700" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
          </svg>
          <span className="text-[10px] font-bold mt-1">Voucher</span>
        </a>

        <div className="h-5 w-[1px] bg-slate-200 mx-1"></div>

        {/* 3. Hoàn tiền (Nút tròn nổi ở giữa) */}
        <div className="relative flex-1 flex justify-center">
          <Link href="/" className="flex flex-col items-center group absolute -top-7">
            <div className="w-12 h-12 rounded-2xl bg-white border border-blue-100 shadow-md flex items-center justify-center p-1.5 transition transform group-hover:scale-105">
              <img src="/logo.png" alt="Hoàn tiền" className="w-full h-full object-contain" />
            </div>
            <span className="text-[10px] font-black text-orange-500 mt-1">Hoàn tiền</span>
          </Link>
        </div>

        <div className="h-5 w-[1px] bg-slate-200 mx-1"></div>

        {/* 4. Rút tiền */}
        <Link href="/withdraw" className={`flex flex-col items-center flex-1 transition ${active === 'withdraw' ? 'text-orange-500 font-bold' : 'text-slate-700 hover:text-orange-500'}`}>
          <svg className={`w-5 h-5 ${active === 'withdraw' ? 'text-orange-500' : 'text-slate-700'}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          <span className="text-[10px] mt-1">Rút tiền</span>
        </Link>

        <div className="h-5 w-[1px] bg-slate-200 mx-1"></div>

        {/* 5. Tài khoản */}
        <Link href="/profile" className={`flex flex-col items-center flex-1 transition ${active === 'profile' ? 'text-orange-500 font-bold' : 'text-slate-700 hover:text-orange-500'}`}>
          <svg className={`w-5 h-5 ${active === 'profile' ? 'text-orange-500' : 'text-slate-700'}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <span className="text-[10px] mt-1">Tài khoản</span>
        </Link>

      </nav>
    </div>
  );
}