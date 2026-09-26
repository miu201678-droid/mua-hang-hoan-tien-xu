import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request) {
  try {
    const body = await request.json();
    
    // --- THÊM DÒNG NÀY ĐỂ DEBUG ---
    console.log("ZALO WEBHOOK PAYLOAD:", JSON.stringify(body, null, 2));

    // Mở rộng thêm các trường bắt ID và nội dung tin nhắn để phòng hờ AddLiveTag đổi tên trường
    const zaloUserId = body.sender?.id || body.from_id || body.user_id || body.sender_id;
    const messageText = (body.message?.text || body.content || body.text || body.msg || '').trim();

    if (messageText.toLowerCase().startsWith('/dongbo')) {
      // Tách chuỗi theo khoảng trắng an toàn
      const parts = messageText.split(/\s+/);
      const inputOtp = parts[1];

      if (!inputOtp) {
        return NextResponse.json({
          success: true,
          message: 'Vui lòng nhập cú pháp: /dongbo [mã 6 số]',
        });
      }

      // Kiểm tra OTP trong bảng otp_codes
      const { data: otpData, error: otpError } = await supabase
        .from('otp_codes')
        .select('*')
        .eq('code', inputOtp)
        .gte('expires_at', new Date().toISOString())
        .maybeSingle();

      if (otpError || !otpData) {
        return NextResponse.json({
          success: true,
          message: 'Mã OTP không hợp lệ hoặc đã hết hạn!',
        });
      }

      // Cập nhật zalo_user_id vào bảng profiles
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ zalo_user_id: zaloUserId })
        .eq('id', otpData.user_id);

      if (updateError) throw updateError;

      // Xóa OTP sau khi đồng bộ thành công
      await supabase.from('otp_codes').delete().eq('id', otpData.id);

      return NextResponse.json({
        success: true,
        message: '🎉 Đồng bộ tài khoản Zalo thành công!',
      });
    }

    return NextResponse.json({ success: true, message: 'Đã nhận sự kiện' });
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}