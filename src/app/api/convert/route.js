// app/api/convert/route.js
import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const originUrl = searchParams.get('url');
  const userId = searchParams.get('userId') || 'guest';
  const affiliateId = "17318640399";

  if (!originUrl) {
    return NextResponse.json({ error: 'Missing URL' }, { status: 400 });
  }

  // Định nghĩa link dự phòng an_redir
  const cleanLanding = originUrl.split('?')[0];
  const encodedLanding = encodeURIComponent(cleanLanding);
  const fallbackUrl = `https://s.shopee.vn/an_redir?origin_link=${encodedLanding}&affiliate_id=${affiliateId}&sub_id=${userId}`;

  try {
    const systemApiUrl = `https://skycentral.linkhoantien.com/api/v1/gen-link?url=${encodeURIComponent(originUrl)}&aff_id=${affiliateId}&sub_id=${userId}`;

    const res = await fetch(systemApiUrl, {
      headers: {
        'Content-Type': 'application/json',
      },
      cache: 'no-store'
    });

    // Kiểm tra nếu API trả về lỗi HTTP (404, 500...)
    if (!res.ok) {
      console.warn(`API bot trả về mã lỗi HTTP: ${res.status}`);
      return NextResponse.json({ short_url: fallbackUrl });
    }

    // Kiểm tra định dạng phản hồi có phải JSON không trước khi parse
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const data = await res.json();
      if (data && data.short_url) {
        return NextResponse.json({ short_url: data.short_url });
      }
    } else {
      console.warn("API bot trả về dữ liệu không phải JSON (có thể là HTML)");
    }
  } catch (err) {
    console.error("Lỗi gọi API rút gọn đối soát:", err.message);
  }

  // Luôn đảm bảo trả về JSON fallback nếu có sự cố
  return NextResponse.json({ short_url: fallbackUrl });
}