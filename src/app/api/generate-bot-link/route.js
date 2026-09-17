import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    // 1. Lấy thêm userId từ client/bot gửi lên
    const { originalUrl, affiliateId, userId } = await request.json();

    const targetEndpoint = "https://skycentral.linkhoantien.com/create-link.php";
    const formData = new URLSearchParams();
    formData.append('links', originalUrl);
    formData.append('affiliate_id', affiliateId || '');
    formData.append('domain', 'lzd.mobi');

    // 2. Truyền sub1/sub_id chứa ID người dùng sang hệ thống tạo link
    if (userId) {
      formData.append('sub1', userId);
      formData.append('sub_id', userId);
    }

    const response = await fetch(targetEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString()
    });

    let resultText = await response.text();

    // 3. Đảm bảo link đầu ra luôn có &sub1=userId để không bị mất ID định danh
    if (userId && resultText && resultText.includes('http')) {
      try {
        const generatedUrl = new URL(resultText.trim());
        generatedUrl.searchParams.set('sub1', userId);
        resultText = generatedUrl.toString();
      } catch (e) {
        if (!resultText.includes('sub1=')) {
          const connector = resultText.includes('?') ? '&' : '?';
          resultText = `${resultText.trim()}${connector}sub1=${userId}`;
        }
      }
    }

    return NextResponse.json({ success: true, data: resultText });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}