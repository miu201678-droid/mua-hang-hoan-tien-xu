'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';

// Mảng 7 phần thưởng đồng bộ 100% với Backend
const PRIZES = [
  { label: '5K', value: 5000, color: '#FFB800' },
  { label: '10K', value: 10000, color: '#00A3FF' },
  { label: '15K', value: 15000, color: '#A000FF' },
  { label: '0đ', value: 0, color: '#64748B' },
  { label: '20K', value: 20000, color: '#E6007A' },
  { label: '100K', value: 100000, color: '#00D68F' },
  { label: '200K', value: 200000, color: '#FF3B30' },
];

export default function VongQuayPage() {
  const [user, setUser] = useState(null);
  const [balance, setBalance] = useState(0);
  const [spins, setSpins] = useState(0); // Quản lý số lượt quay khả dụng
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState(null);

  // State quản lý Modal popup thông báo
  const [modalInfo, setModalInfo] = useState({ show: false, message: '' });

  const canvasRef = useRef(null);
  const rotationRef = useRef(0);
  const ledFrameRef = useRef(0);

  // Lấy số lượt quay khả dụng từ Backend (API GET)
  const fetchSpins = useCallback(async (userId) => {
    try {
      const res = await fetch(`/api/spin?userId=${userId}`);
      const data = await res.json();
      if (data.success) {
        setSpins(data.remainingSpins);
      }
    } catch (err) {
      console.error('Lỗi lấy số lượt quay:', err);
    }
  }, []);

  // Lấy số dư ví từ Supabase
  const fetchBalance = useCallback(async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('balance_available')
        .eq('id', userId)
        .single();

      if (data && !error) {
        setBalance(data.balance_available || 0);
      }
    } catch (err) {
      console.error('Lỗi lấy số dư:', err);
    }
  }, []);

  // Hàm vẽ đĩa quay + Đèn LED Canvas
  const drawWheel = useCallback((currentAngle, ledTick = 0) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;

    const wheelRadius = width / 2 - 25;
    const ledRadius = wheelRadius + 12;

    const numSegments = PRIZES.length;
    const arc = (2 * Math.PI) / numSegments;

    ctx.clearRect(0, 0, width, height);

    // 1. Viền ngoài chứa LED
    ctx.beginPath();
    ctx.arc(centerX, centerY, wheelRadius + 20, 0, 2 * Math.PI);
    ctx.fillStyle = '#0b1638';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#1a3b8b';
    ctx.stroke();

    // 2. 12 bóng LED nhấp nháy
    const numLeds = 12;
    for (let i = 0; i < numLeds; i++) {
      const angle = (i * 2 * Math.PI) / numLeds;
      const x = centerX + ledRadius * Math.cos(angle);
      const y = centerY + ledRadius * Math.sin(angle);

      const isLit = (i + ledTick) % 2 === 0;

      ctx.beginPath();
      ctx.arc(x, y, 6, 0, 2 * Math.PI);

      if (isLit) {
        ctx.fillStyle = '#FFEE55';
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 12;
      } else {
        ctx.fillStyle = '#443300';
        ctx.shadowBlur = 0;
      }
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#FFFFFF';
      ctx.stroke();
    }

    ctx.shadowBlur = 0;

    // 3. Các ô phần thưởng
    for (let i = 0; i < numSegments; i++) {
      const angle = currentAngle + i * arc;
      ctx.beginPath();
      ctx.fillStyle = PRIZES[i].color;
      ctx.moveTo(centerX, centerY);
      ctx.arc(centerX, centerY, wheelRadius, angle, angle + arc);
      ctx.lineTo(centerX, centerY);
      ctx.fill();

      ctx.strokeStyle = '#071233';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(angle + arc / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 18px sans-serif';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 4;
      ctx.fillText(PRIZES[i].label, wheelRadius - 25, 6);
      ctx.restore();
    }

    // Viền kim loại mạ vàng
    ctx.beginPath();
    ctx.arc(centerX, centerY, wheelRadius, 0, 2 * Math.PI);
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#FFB800';
    ctx.stroke();

    // 4. Nút tâm tròn
    ctx.beginPath();
    ctx.arc(centerX, centerY, 30, 0, 2 * Math.PI);
    ctx.fillStyle = '#00A3FF';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#FFFFFF';
    ctx.stroke();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚡', centerX, centerY);
  }, []);

  // Chạy LED liên tục khi không quay
  useEffect(() => {
    let intervalId;
    if (!spinning) {
      intervalId = setInterval(() => {
        ledFrameRef.current = (ledFrameRef.current + 1) % 2;
        drawWheel(rotationRef.current, ledFrameRef.current);
      }, 500);
    }
    return () => clearInterval(intervalId);
  }, [spinning, drawWheel]);

  useEffect(() => {
    async function getUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        fetchBalance(user.id);
        fetchSpins(user.id); // Tải số lượt quay khả dụng
      }
    }
    getUser();
  }, [fetchBalance, fetchSpins]);

  const handleSpin = async () => {
    if (!user) {
      setModalInfo({
        show: true,
        message: 'Vui lòng đăng nhập để tham gia quay thưởng!',
      });
      return;
    }

    if (spins <= 0) {
      setModalInfo({
        show: true,
        message: 'Bạn đã hết lượt quay! Hãy tích lũy thêm 5 đơn hàng thành công để nhận 1 lượt quay mới.',
      });
      return;
    }

    if (spinning) return;

    setSpinning(true);
    setResult(null);

    try {
      const res = await fetch('/api/spin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      });

      const data = await res.json();

      if (!data.success) {
        setModalInfo({
          show: true,
          message: data.error || 'Chưa đủ lượt quay! Tích lũy thêm đơn hàng thành công.',
        });
        setSpinning(false);
        return;
      }

      const wonAmount = data.amount || data.wonAmount || 0;
      let prizeIndex = PRIZES.findIndex((p) => p.value === wonAmount);
      if (prizeIndex === -1) prizeIndex = 3; // Mặc định dừng ở ô 0đ nếu có lỗi

      const numSegments = PRIZES.length;
      const arc = (2 * Math.PI) / numSegments;

      const targetSegmentAngle = -Math.PI / 2 - (prizeIndex * arc + arc / 2);
      const extraRounds = 6 * 2 * Math.PI;
      const finalAngle =
        rotationRef.current +
        extraRounds +
        (targetSegmentAngle - (rotationRef.current % (2 * Math.PI)));

      const startAngle = rotationRef.current;
      const startTime = performance.now();
      const duration = 4000;

      let ledCounter = 0;

      const animate = (currentTime) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        const easeOut = 1 - Math.pow(1 - progress, 3);
        const current = startAngle + (finalAngle - startAngle) * easeOut;

        rotationRef.current = current;

        ledCounter++;
        const fastLedTick = Math.floor(ledCounter / 5) % 2;

        drawWheel(current, fastLedTick);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          const isWin = wonAmount > 0;
          setResult({
            message: data.message,
            isWin: Boolean(isWin),
          });

          // Cập nhật lượt quay còn lại trả về từ API
          if (data.remainingSpins !== undefined) {
            setSpins(data.remainingSpins);
          } else {
            setSpins((prev) => Math.max(0, prev - 1));
          }

          if (isWin) {
            setBalance((prev) => prev + wonAmount);
            fetchBalance(user.id);
          }
          setSpinning(false);
        }
      };

      requestAnimationFrame(animate);
    } catch (err) {
      setModalInfo({
        show: true,
        message: 'Có lỗi kết nối, vui lòng thử lại sau!',
      });
      setSpinning(false);
    }
  };

  const getLedClass = () => {
    if (spinning) return 'led-border spinning';
    if (result && result.isWin) return 'led-border win-green';
    return 'led-border';
  };

  return (
    <div
      style={{
        backgroundColor: '#03091e',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        color: '#fff',
        fontFamily: 'sans-serif',
      }}
    >
      <style jsx global>{`
        @keyframes redLedGlow {
          0% {
            border-color: #ff0000;
            box-shadow: 0 0 8px #ff0000, inset 0 0 6px #ff0000;
            opacity: 1;
          }
          50% {
            border-color: #ff6666;
            box-shadow: 0 0 25px #ff0000, inset 0 0 15px #ff0000;
            opacity: 0.5;
          }
          100% {
            border-color: #ff0000;
            box-shadow: 0 0 8px #ff0000, inset 0 0 6px #ff0000;
            opacity: 1;
          }
        }

        @keyframes greenLedGlow {
          0% {
            border-color: #00d68f;
            box-shadow: 0 0 10px #00d68f, inset 0 0 8px #00d68f;
            opacity: 1;
          }
          50% {
            border-color: #70ffd4;
            box-shadow: 0 0 30px #00d68f, inset 0 0 18px #00d68f;
            opacity: 0.4;
          }
          100% {
            border-color: #00d68f;
            box-shadow: 0 0 10px #00d68f, inset 0 0 8px #00d68f;
            opacity: 1;
          }
        }

        .led-border {
          animation: redLedGlow 1.2s infinite ease-in-out;
        }

        .led-border.spinning {
          animation: redLedGlow 0.25s infinite linear !important;
        }

        .led-border.win-green {
          animation: greenLedGlow 0.4s infinite ease-in-out !important;
        }
      `}</style>

      <div
        style={{
          backgroundColor: '#071233',
          border: '2px solid #1a3b8b',
          borderRadius: '24px',
          padding: '24px',
          maxWidth: '450px',
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 0 50px rgba(0, 102, 255, 0.3)',
        }}
      >
        <h1
          style={{
            fontSize: '26px',
            fontWeight: '900',
            color: '#FFB800',
            marginBottom: '16px',
            textTransform: 'uppercase',
            letterSpacing: '1px',
          }}
        >
          ⚡ VÒNG QUAY MAY MẮN 🎁
        </h1>

        {/* Khung hiển thị SỐ LƯỢT QUAY KHẢ DỤNG */}
        <div
          style={{
            backgroundColor: 'rgba(255, 184, 0, 0.15)',
            border: '1px solid #FFB800',
            borderRadius: '12px',
            padding: '8px 12px',
            marginBottom: '16px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#FFB800',
          }}
        >
          <span>🎯 Số lượt quay hiện có:</span>
          <span
            style={{
              backgroundColor: '#FFB800',
              color: '#071233',
              borderRadius: '20px',
              padding: '2px 10px',
              fontSize: '16px',
              fontWeight: '900',
            }}
          >
            {spins}
          </span>
        </div>

        {/* Khung số dư */}
        <div
          className={getLedClass()}
          style={{
            backgroundColor: '#0b1b4f',
            border: '2px solid #ff0000',
            borderRadius: '16px',
            padding: '12px 16px',
            marginBottom: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: '10px', color: '#8a99ad', fontWeight: 'bold' }}>
              SỐ DƯ KHẢ DỤNG
            </div>
            <div style={{ fontSize: '13px', color: '#e2e8f0', fontWeight: '600' }}>
              {user ? user.email?.split('@')[0] || 'Thành viên' : 'Chưa đăng nhập'}
            </div>
          </div>
          <div style={{ fontSize: '20px', fontWeight: '800', color: '#00D68F' }}>
            {Number(balance).toLocaleString('vi-VN')}{' '}
            <span style={{ fontSize: '12px' }}>đ</span>
          </div>
        </div>

        <p style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '20px', lineHeight: '1.4' }}>
          Mỗi 5 đơn hàng thành công = 1 lượt quay (Cơ hội nhận 5k, 10k, 15k, 20k, 100k, 200k)
        </p>

        {/* Khung chứa Vòng quay Canvas */}
        <div style={{ position: 'relative', display: 'inline-block', margin: '5px 0' }}>
          <div
            style={{
              position: 'absolute',
              top: '-8px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '0',
              height: '0',
              borderLeft: '14px solid transparent',
              borderRight: '14px solid transparent',
              borderTop: '24px solid #FF3B30',
              zIndex: 10,
              filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.9))',
            }}
          />

          <canvas
            ref={canvasRef}
            width={340}
            height={340}
            style={{ maxWidth: '100%', height: 'auto', display: 'block', margin: '0 auto' }}
          />
        </div>

        {/* Nút bấm quay */}
        <button
          onClick={handleSpin}
          disabled={spinning}
          style={{
            width: '100%',
            marginTop: '16px',
            padding: '16px',
            borderRadius: '16px',
            backgroundColor: spinning ? '#64748b' : '#FFB800',
            color: '#071233',
            fontSize: '18px',
            fontWeight: '900',
            border: 'none',
            cursor: spinning ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 15px rgba(255, 184, 0, 0.4)',
            textTransform: 'uppercase',
          }}
        >
          {spinning ? 'ĐANG QUAY...' : 'QUAY NGAY >'}
        </button>

        {/* Thông báo kết quả trúng thưởng */}
        {result && (
          <div
            style={{
              marginTop: '16px',
              padding: '12px',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: 'bold',
              backgroundColor: result.isWin
                ? 'rgba(0, 214, 143, 0.2)'
                : 'rgba(255, 255, 255, 0.1)',
              border: `1px solid ${result.isWin ? '#00D68F' : '#334155'}`,
              color: result.isWin ? '#00D68F' : '#e2e8f0',
            }}
          >
            {result.message}
          </div>
        )}
      </div>

      {/* POPUP THÔNG BÁO TÙY CHỈNH NEON */}
      {modalInfo.show && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(3, 9, 30, 0.8)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#071233',
              border: '2px solid #FFB800',
              borderRadius: '20px',
              padding: '24px',
              maxWidth: '360px',
              width: '100%',
              textAlign: 'center',
              boxShadow: '0 0 30px rgba(255, 184, 0, 0.4)',
            }}
          >
            <div style={{ fontSize: '40px', marginBottom: '8px' }}>🎁</div>
            <h3
              style={{
                fontSize: '18px',
                fontWeight: '900',
                color: '#FFB800',
                marginBottom: '10px',
                textTransform: 'uppercase',
              }}
            >
              Thông Báo
            </h3>
            <p style={{ fontSize: '14px', color: '#CBD5E1', marginBottom: '20px', lineHeight: '1.5' }}>
              {modalInfo.message}
            </p>
            <button
              onClick={() => setModalInfo({ show: false, message: '' })}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '12px',
                backgroundColor: '#FFB800',
                color: '#071233',
                fontWeight: 'bold',
                fontSize: '15px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(255, 184, 0, 0.3)',
              }}
            >
              ĐÃ HIỂU
            </button>
          </div>
        </div>
      )}
    </div>
  );
}