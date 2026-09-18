import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Danh sách phần thưởng và tỷ lệ cài đặt chính xác
const REWARDS = [
  { amount: 5000, label: '5.000đ', weight: 43 },         // 43% trúng 5K
  { amount: 10000, label: '10.000đ', weight: 0.9 },      // 0.9% trúng 10K
  { amount: 15000, label: '15.000đ', weight: 0.1 },      // 0.1% trúng 15K
  { amount: 0, label: '0đ (Chúc may mắn)', weight: 55 }, // 55% trúng 0đ
  { amount: 20000, label: '20.000đ', weight: 0 },        // KHÓA (0%)
  { amount: 100000, label: '100.000đ', weight: 0 },      // KHÓA (0%)
  { amount: 200000, label: '200.000đ', weight: 0 },      // KHÓA (0%)
];

// 1. API GET: Lấy số lượt quay và số đơn hàng hiện tại của người dùng để hiển thị lên UI
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Thiếu thông tin userId' }, { status: 400 });
    }

    // Đếm tổng số đơn thành công
    const { count: totalOrders, error: orderErr } = await supabaseAdmin
      .from('cashback_links')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('status', ['success', 'completed']);

    if (orderErr) throw orderErr;

    // Đếm số lượt đã quay
    const { count: totalSpinsUsed, error: spinErr } = await supabaseAdmin
      .from('spin_history')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (spinErr) throw spinErr;

    // Tính lượt quay khả dụng (5 đơn = 1 lượt)
    const totalEarnedSpins = Math.floor((totalOrders || 0) / 5);
    const remainingSpins = Math.max(0, totalEarnedSpins - (totalSpinsUsed || 0));

    return NextResponse.json({
      success: true,
      remainingSpins,
      totalOrders: totalOrders || 0
    });

  } catch (error) {
    console.error('Lỗi lấy số lượt quay:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// 2. API POST: Thực hiện quay thưởng
export async function POST(request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Thiếu thông tin người dùng' }, { status: 400 });
    }

    // Đếm tổng số đơn hàng thành công
    const { count: totalOrders, error: orderErr } = await supabaseAdmin
      .from('cashback_links')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('status', ['success', 'completed']);

    if (orderErr) throw orderErr;

    // Đếm số lượt người dùng đã quay
    const { count: totalSpinsUsed, error: spinErr } = await supabaseAdmin
      .from('spin_history')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (spinErr) throw spinErr;

    // Tính lượt quay khả dụng
    const totalEarnedSpins = Math.floor((totalOrders || 0) / 5);
    const remainingSpins = totalEarnedSpins - (totalSpinsUsed || 0);

    if (remainingSpins <= 0) {
      return NextResponse.json({
        success: false,
        error: `Chưa đủ lượt quay! Tích lũy thêm đơn hàng (Hiện có ${totalOrders || 0} đơn thành công).`
      }, { status: 400 });
    }

    // Quay thưởng ngẫu nhiên theo trọng số
    const reward = getRandomReward();

    // Ghi lịch sử quay
    const { error: insertErr } = await supabaseAdmin
      .from('spin_history')
      .insert([{ user_id: userId, reward_amount: reward.amount }]);

    if (insertErr) throw insertErr;

    // Nếu trúng tiền (> 0đ) thì thực thi cộng vào ví qua RPC
    if (reward.amount > 0) {
      const { error: rpcErr } = await supabaseAdmin.rpc('add_reward_balance', {
        user_id_input: userId,
        reward_amount: reward.amount
      });

      if (rpcErr) throw rpcErr;
    }

    // Trả phản hồi kết quả về cho Frontend
    const isWin = reward.amount > 0;
    return NextResponse.json({
      success: true,
      amount: reward.amount,
      wonAmount: reward.amount,
      reward: reward,
      remainingSpins: remainingSpins - 1,
      message: isWin 
        ? `🎉 Chúc mừng! Bạn đã nhận ${reward.label} vào ví.` 
        : `😅 Chúc bạn may mắn lần sau! Rất tiếc bạn đã quay vào ô 0đ.`
    });

  } catch (error) {
    console.error('Lỗi quay thưởng:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

function getRandomReward() {
  const totalWeight = REWARDS.reduce((sum, r) => sum + r.weight, 0);
  let random = Math.random() * totalWeight;

  for (const reward of REWARDS) {
    if (random < reward.weight) {
      return reward;
    }
    random -= reward.weight;
  }
  return REWARDS[3]; // Mặc định trả về 0đ nếu có sự cố
}