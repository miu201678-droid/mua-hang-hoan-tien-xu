import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { originalUrl, affiliateId } = await request.json();

    const targetEndpoint = "https://skycentral.linkhoantien.com/create-link.php";
    const formData = new URLSearchParams();
    formData.append('links', originalUrl);
    formData.append('affiliate_id', affiliateId || '');
    formData.append('domain', 'lzd.mobi');

    const response = await fetch(targetEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString()
    });

    const resultText = await response.text();
    return NextResponse.json({ success: true, data: resultText });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}