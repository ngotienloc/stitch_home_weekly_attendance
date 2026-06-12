'use client';

import { useState, useEffect } from 'react';

interface Props {
  onClose: () => void;
}

export default function OnboardingTour({ onClose }: Props) {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    {
      title: 'Chào mừng bạn đến với AttendanceHero! 🎓',
      icon: 'school',
      color: 'bg-primary/10 text-primary border-primary/20',
      content: (
        <div className="space-y-sm text-center">
          <p className="text-sm font-medium text-on-surface leading-relaxed">
            <b>AttendanceHero</b> biến việc điểm danh giảng đường nhàm chán thành những cuộc phiêu lưu học tập kỳ thú cho học phần <b>Tư duy công nghệ và Thiết kế kỹ thuật</b>!
          </p>
          <div className="bg-surface-container-low p-md rounded-xl border border-outline-variant/20 flex items-center justify-around text-center my-md">
            <div>
              <span className="text-2xl">⚡</span>
              <p className="text-[10px] font-bold text-on-surface-variant mt-1">Điểm danh nhanh</p>
            </div>
            <div className="h-8 w-[1px] bg-outline-variant/30" />
            <div>
              <span className="text-2xl">🎮</span>
              <p className="text-[10px] font-bold text-on-surface-variant mt-1">Chơi game vui</p>
            </div>
            <div className="h-8 w-[1px] bg-outline-variant/30" />
            <div>
              <span className="text-2xl">🏆</span>
              <p className="text-[10px] font-bold text-on-surface-variant mt-1">Leo bảng xếp hạng</p>
            </div>
          </div>
          <p className="text-xs text-on-surface-variant font-semibold">
            Hãy dành 1 phút để khám phá cách tích lũy tối đa điểm thưởng chuyên cần nhé! 🚀
          </p>
        </div>
      )
    },
    {
      title: 'Xác minh Vị trí GPS 📍',
      icon: 'my_location',
      color: 'bg-secondary-container/10 text-secondary border-secondary-container/20',
      content: (
        <div className="space-y-sm text-center">
          <p className="text-sm font-medium text-on-surface leading-relaxed">
            Để đảm bảo bạn đang ngồi học tại giảng đường, hệ thống yêu cầu bạn bật <b>GPS</b> định vị của thiết bị.
          </p>
          
          <div className="bg-surface-container-low p-md rounded-xl border border-outline-variant/20 space-y-sm text-left my-sm">
            <div className="flex items-center gap-xs">
              <span className="material-symbols-outlined text-success text-[18px]">task_alt</span>
              <span className="text-xs font-bold text-on-surface">Vị trí hợp lệ:</span>
              <span className="text-xs font-mono bg-white px-2 py-0.5 rounded border border-outline-variant/20 font-bold ml-auto text-primary">ĐH Bách Khoa HN</span>
            </div>
            <div className="flex items-center gap-xs">
              <span className="material-symbols-outlined text-success text-[18px]">task_alt</span>
              <span className="text-xs font-bold text-on-surface">Bán kính quét:</span>
              <span className="text-xs font-bold ml-auto text-primary">Trong vòng 500m</span>
            </div>
          </div>

          <p className="text-xs text-on-surface-variant leading-relaxed font-semibold">
            💡 Bạn có thể dùng tính năng <b>Giả lập vị trí (Demo)</b> để thử nghiệm nhanh nếu đang không ở trường!
          </p>
        </div>
      )
    },
    {
      title: 'Thử thách Tuần học độc đáo 🎮',
      icon: 'sports_esports',
      color: 'bg-tertiary-container/10 text-tertiary border-tertiary-container/20',
      content: (
        <div className="space-y-sm text-center">
          <p className="text-sm font-medium text-on-surface leading-relaxed">
            Mỗi tuần học (Từ Tuần 1 đến Tuần 16) sẽ đi kèm <b>một game điểm danh duy nhất</b> tương ứng với nội dung học.
          </p>
          
          <div className="bg-surface-container-low p-sm rounded-xl border border-outline-variant/20 text-left space-y-xs max-h-36 overflow-y-auto no-scrollbar my-sm">
            <div className="flex items-center gap-sm p-xs bg-white rounded border border-outline-variant/10">
              <span className="text-lg">💣</span>
              <div>
                <p className="text-xs font-bold text-on-surface">Tuần 1: Đại chiến bom hẹn giờ</p>
                <p className="text-[10px] text-on-surface-variant">Trả lời nhanh để chuyền bom đi</p>
              </div>
            </div>
            <div className="flex items-center gap-sm p-xs bg-white rounded border border-outline-variant/10">
              <span className="text-lg">⚔️</span>
              <div>
                <p className="text-xs font-bold text-on-surface">Tuần 10: Thách đấu 1-1</p>
                <p className="text-[10px] text-on-surface-variant">Thi đấu kiến thức với bạn bên cạnh</p>
              </div>
            </div>
            <div className="flex items-center gap-sm p-xs bg-white rounded border border-outline-variant/10">
              <span className="text-lg">⚡</span>
              <div>
                <p className="text-xs font-bold text-on-surface">Tuần 15: Đại chiến phản xạ</p>
                <p className="text-[10px] text-on-surface-variant">Bấm màn hình nhanh nhất cả lớp</p>
              </div>
            </div>
          </div>

          <p className="text-xs text-on-surface-variant font-semibold">
            Hoàn thành game sẽ lập tức ghi nhận điểm danh và cộng điểm chuyên cần!
          </p>
        </div>
      )
    },
    {
      title: 'Tích lũy Chuỗi & Leo Bảng xếp hạng 🔥',
      icon: 'leaderboard',
      color: 'bg-primary/10 text-primary border-primary/20',
      content: (
        <div className="space-y-sm text-center">
          <p className="text-sm font-medium text-on-surface leading-relaxed">
            Duy trì chuỗi đi học liên tục (<b>Streak 🔥</b>) để nhận thêm điểm thưởng và tranh thứ hạng cao với bạn học.
          </p>

          <div className="bg-gradient-to-r from-primary/5 to-secondary/5 p-md rounded-xl border border-outline-variant/20 space-y-xs my-sm">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="flex items-center gap-1">🥇 Hạng 1: Nguyễn Văn A</span>
              <span className="text-primary font-black">450đ (🔥 12)</span>
            </div>
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="flex items-center gap-1">🥈 Hạng 2: Lê Hải Yến</span>
              <span className="text-primary font-black">420đ (🔥 10)</span>
            </div>
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="flex items-center gap-1">🥉 Hạng 3: Trần Thị Lan</span>
              <span className="text-primary font-black">415đ (🔥 8)</span>
            </div>
          </div>

          <p className="text-xs text-on-surface-variant font-semibold">
            Chuỗi điểm danh liên tục càng cao, điểm cộng tích lũy cuối kỳ càng nhiều!
          </p>
        </div>
      )
    },
    {
      title: 'Vòng Quay May Mắn sau điểm danh 🎡',
      icon: 'star',
      color: 'bg-tertiary-container/10 text-tertiary border-tertiary-container/20',
      content: (
        <div className="space-y-sm text-center">
          <p className="text-sm font-medium text-on-surface leading-relaxed">
            Mỗi lần hoàn thành thử thách điểm danh, bạn sẽ được thưởng một lượt quay <b>Vòng Quay May Mắn</b>.
          </p>

          <div className="flex flex-col items-center justify-center my-md">
            <div className="w-20 h-20 rounded-full border-2 border-dashed border-primary flex items-center justify-center bg-primary/5 animate-spin" style={{ animationDuration: '8s' }}>
              <span className="text-3xl animate-pulse">🎡</span>
            </div>
            <span className="text-xs font-bold text-primary mt-2">Cơ hội nhận từ +5đ đến +100đ thưởng!</span>
          </div>

          <p className="text-xs text-on-surface-variant font-semibold">
            Đừng bỏ lỡ lượt quay may mắn để bứt phá điểm số trên Bảng Xếp Hạng nhé!
          </p>
        </div>
      )
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem('attendance_hero_onboarding_completed', 'true');
    onClose();
  };

  const step = steps[currentStep];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-container-margin">
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xxl p-lg w-full max-w-[440px] shadow-2xl flex flex-col justify-between overflow-hidden animate-pop-in relative min-h-[460px]">
        
        {/* Skip button top right */}
        <button
          onClick={handleComplete}
          className="absolute top-4 right-4 text-xs font-extrabold text-on-surface-variant/70 hover:text-on-surface bg-surface-container-low px-2.5 py-1.5 rounded-full border border-outline-variant/10 active:scale-95 transition-all"
        >
          Bỏ qua
        </button>

        {/* Modal Content */}
        <div className="flex-grow flex flex-col justify-center py-md">
          {/* Step Icon */}
          <div className={`w-16 h-16 rounded-full ${step.color} border mx-auto flex items-center justify-center mb-md animate-float shadow-inner`}>
            <span className="material-symbols-outlined text-[36px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              {step.icon}
            </span>
          </div>

          {/* Step Title */}
          <h3 className="text-base font-extrabold text-on-surface text-center mb-sm font-headline-md tracking-tight">
            {step.title}
          </h3>

          {/* Custom Step Content */}
          <div className="px-xs">{step.content}</div>
        </div>

        {/* Bottom Actions */}
        <div className="border-t border-outline-variant/20 pt-md mt-md flex flex-col gap-sm">
          {/* Dots Indicator */}
          <div className="flex justify-center gap-1.5">
            {steps.map((_, idx) => (
              <div
                key={idx}
                className={`h-2 rounded-full transition-all duration-300 ${
                  idx === currentStep ? 'w-6 bg-primary' : 'w-2 bg-outline-variant/40'
                }`}
              />
            ))}
          </div>

          {/* Navigation Buttons */}
          <div className="flex justify-between items-center gap-sm">
            <button
              onClick={handlePrev}
              disabled={currentStep === 0}
              className={`flex-1 py-sm font-bold text-xs rounded-xl border transition-all active:scale-95 flex items-center justify-center gap-1 ${
                currentStep === 0
                  ? 'bg-transparent text-on-surface-variant/20 border-outline-variant/10 cursor-not-allowed'
                  : 'bg-white text-on-surface border-outline-variant/30 hover:bg-surface-container-low'
              }`}
            >
              <span className="material-symbols-outlined text-sm">chevron_left</span>
              Quay lại
            </button>

            <button
              onClick={handleNext}
              className="flex-1 py-sm bg-primary text-on-primary font-bold text-xs rounded-xl hover:bg-primary/95 transition-all active:scale-95 shadow-md flex items-center justify-center gap-1"
            >
              <span>{currentStep === steps.length - 1 ? 'Bắt đầu! 🚀' : 'Tiếp theo'}</span>
              {currentStep < steps.length - 1 && (
                <span className="material-symbols-outlined text-sm">chevron_right</span>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
