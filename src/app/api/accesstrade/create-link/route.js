import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { shopeeUrl } = await request.json();
    const apiKey = process.env.ACCESSTRADE_API_KEY;

    if (!shopeeUrl) {
      return NextResponse.json({ success: false, error: 'Thiếu đường link Shopee' }, { status: 400 });
    }

    // Affiliate ID định danh của bạn
    const affiliateId = "17318640399";

    // Gọi API Deeplink Accesstrade
    const response = await fetch('https://api.accesstrade.vn/v1/deeplinks', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: shopeeUrl,
        utm_source: 'cashback_web',
        utm_content: affiliateId, // Gắn ID 17318640399
        sub1: affiliateId
      })
    });

    const result = await response.json();

    if (result.short_link || result.data?.short_link) {
      return NextResponse.json({
        success: true,
        affiliate_link: result.short_link || result.data?.short_link,
        affiliate_id: affiliateId
      });
    }

    return NextResponse.json({ 
      success: false, 
      error: 'Không tạo được link affiliate từ Accesstrade' 
    }, { status: 500 });

  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}