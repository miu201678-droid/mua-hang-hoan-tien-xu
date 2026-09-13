import { NextResponse } from 'next/server';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json({ error: 'Thiếu tham số URL sản phẩm TikTok' }, { status: 400 });
  }

  try {
    // Gọi chuẩn sang endpoint tạo link affiliate của RioHub
    const apiRes = await fetch('https://riohub.vn/api/v1/partner/tiktok/affiliate/product-links', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Riohub-Api-Key': 'rhk_f0fdfd39222714a91f68f8f647b424b94 d737d6065004f05' // Khóa API chính xác từ ảnh của bạn
      },
      body: JSON.stringify({
        url: url
      })
    });

    const data = await apiRes.json();
    
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: 'Lỗi kết nối tới API RioHub TikTok: ' + error.message }, { status: 500 });
  }
}