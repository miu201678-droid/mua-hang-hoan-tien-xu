import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const REWARDS = [
  { amount: 5000, label: '5.000đ', weight: 60 },    // Tỷ lệ trúng 60%
  { amount: 10000, label: '10.000đ', weight: 30 },  // Tỷ lệ trúng 30%
  { amount: 15000, label: '15.000đ', weight: 10 },  // Tỷ lệ trúng 10%
  { amount: 50000, label: '50.000đ', weight: 0 },   // Tỷ lệ trúng 0% (không bao giờ ra)
  { amount: 100000, label: '100.000đ', weight: 0 }, // Tỷ lệ trúng 0% (không bao giờ ra)
];

export async function POST(request) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ success: false, error: 'Thiếu thông tin người dùng' }, { status: 400 });
    }

    const { count: totalOrders, error: orderErr } = await supabaseAdmin
      .from('cashback_links')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .in('status', ['success', 'completed']); 

    if (orderErr) throw orderErr;

    const { count: totalSpinsUsed, error: spinErr } = await supabaseAdmin
      .from('spin_history')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (spinErr) throw spinErr;

    const totalEarnedSpins = Math.floor((totalOrders || 0) / 5);
    const remainingSpins = totalEarnedSpins - (totalSpinsUsed || 0);

    if (remainingSpins <= 0) {
      return NextResponse.json({
        success: false,
        error: `Chưa đủ lượt quay! Tích lũy thêm đơn hàng (Hiện có ${totalOrders || 0} đơn thành công).`
      }, { status: 400 });
    }

    const reward = getRandomReward();

    const { error: insertErr } = await supabaseAdmin
      .from('spin_history')
      .insert([{ user_id: userId, reward_amount: reward.amount }]);

    if (insertErr) throw insertErr;

    const { error: rpcErr } = await supabaseAdmin.rpc('add_reward_balance', {
      user_id_input: userId,
      reward_amount: reward.amount
    });

    if (rpcErr) throw rpcErr;

    return NextResponse.json({
      success: true,
      amount: reward.amount, // Bổ sung để Frontend tự động cộng tiền ngay
      reward: reward,
      remainingSpins: remainingSpins - 1,
      message: `Chúc mừng! Bạn đã nhận ${reward.label} vào ví.`
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
  return REWARDS[0];
}