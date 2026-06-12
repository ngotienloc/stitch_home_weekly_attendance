'use client';

import { useState } from 'react';
import { ALL_GAMES } from '@/utils/supabase/client';

interface Props {
  onClose: () => void;
  onStartTour: () => void;
}

export default function HandbookModal({ onClose, onStartTour }: Props) {
  const [activeTab, setActiveTab] = useState<'overview' | 'games' | 'rewards'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGameId, setExpandedGameId] = useState<number | null>(null);

  // 16 Games detailed instructions
  const gameInstructions: Record<number, { steps: string[]; tip: string; demoType: string }> = {
    1: {
      steps: [
        'Quả bom sẽ ngẫu nhiên xuất hiện trên màn hình của một bạn.',
        'Người giữ bom phải trả lời đúng câu hỏi trắc nghiệm hiển thị.',
        'Chọn đúng để chuyền bom đi, chọn sai bị khóa nút 1.5 giây.',
        'Bom nổ sau 15 giây. Bị nổ bom nhận +5đ, người sống sót nhận +15đ.'
      ],
      tip: 'Hãy bình tĩnh đọc câu hỏi và suy nghĩ kỹ trước khi chọn để tránh bị phạt khóa nút!',
      demoType: 'bomb'
    },
    2: {
      steps: [
        'Mỗi sinh viên bắt đầu với 3 Tim (mạng sống).',
        'Các câu hỏi trắc nghiệm trực tuyến xuất hiện trên màn hình điện thoại.',
        'Chọn sai đáp án hoặc hết giờ trả lời sẽ bị trừ 1 Tim.',
        'Sống sót đến câu hỏi cuối cùng nhận tối đa +15đ, bị loại nhận +5đ.'
      ],
      tip: 'Chất lượng quan trọng hơn tốc độ trong game sinh tồn, hãy chọn đáp án an toàn!',
      demoType: 'battle'
    },
    3: {
      steps: [
        'Giảng viên trình chiếu mã QR động lên máy chiếu lớp học.',
        'Mở tính năng quét QR và hướng camera về phía máy chiếu.',
        'Căn chỉnh mã QR nằm gọn trong khung ngắm.',
        'Hệ thống ghi nhận điểm danh và cộng trực tiếp +10đ.'
      ],
      tip: 'Nếu quét lỗi, hãy di chuyển lại gần máy chiếu hoặc nhờ giảng viên phóng to mã QR.',
      demoType: 'qr'
    },
    4: {
      steps: [
        'Chọn đúng số Nhóm của bạn ở đầu trang.',
        'Đóng góp ý tưởng lên bảng Note chung và thảo luận qua Chat nhóm.',
        'Chỉ cần một thành viên trong nhóm nộp giải pháp, cả nhóm hoàn thành.',
        'Nhận ngay +20đ cho tất cả thành viên trong nhóm đã đăng ký.'
      ],
      tip: 'Phân chia công việc rõ ràng, một người tổng hợp ý kiến để gửi bài sớm nhất!',
      demoType: 'group'
    },
    5: {
      steps: [
        'Nhận từ khóa bí mật. Kẻ giả mạo nhận từ khác, Mr. White nhận dấu hỏi.',
        'Mỗi thành viên mô tả từ khóa của mình bằng 1-2 từ gợi ý.',
        'Thảo luận nhóm để phân tích các mô tả đáng nghi.',
        'Tiến hành bỏ phiếu bầu ra Kẻ giả mạo để nhận trọn vẹn +15đ.'
      ],
      tip: 'Dân thường nên mô tả khái quát để giả mạo khó phát hiện ra từ khóa thực sự!',
      demoType: 'undercover'
    },
    6: {
      steps: [
        'Khi giảng viên đưa ra câu hỏi thảo luận bất ngờ trên lớp.',
        'Biểu tượng Bàn Tay khổng lồ sẽ xuất hiện trên màn hình.',
        'Hãy nhanh tay bấm nút "Giơ Tay ✋" ngay lập tức.',
        'Thời gian phản xạ ngắn nhất sẽ nhận tối đa +10đ.'
      ],
      tip: 'Đặt ngón tay sẵn sàng trên màn hình khi giảng viên bắt đầu chuẩn bị đặt câu hỏi.',
      demoType: 'hand'
    },
    7: {
      steps: [
        'Đọc các câu hỏi phản hồi nhanh cuối buổi học.',
        'Chọn số Sao (1-5) để đánh giá mức độ hài lòng về bài học.',
        'Nhập nhận xét chi tiết hoặc đề xuất cải tiến cho giảng viên.',
        'Gửi khảo sát để hoàn thành điểm danh và nhận +5đ.'
      ],
      tip: 'Đóng góp ý kiến chân thực sẽ giúp giảng viên điều chỉnh bài giảng tuần sau tốt hơn!',
      demoType: 'feedback'
    },
    8: {
      steps: [
        'Đi học đầy đủ và điểm danh đúng giờ liên tục qua các tuần.',
        'Tích lũy chuỗi điểm danh không gián đoạn (Streak 🔥).',
        'Mỗi tuần trong chuỗi sẽ nhân thêm điểm chuyên cần.',
        'Nhận tối đa +10đ thưởng thêm cho chuỗi streak dài.'
      ],
      tip: 'Đừng nghỉ học không lý do để tránh làm đứt chuỗi và phải tích lũy lại từ đầu!',
      demoType: 'streak'
    },
    9: {
      steps: [
        'Trò chơi nối từ trực tuyến cùng cả lớp.',
        'Hệ thống hiển thị một từ khóa kỹ thuật ban đầu.',
        'Chọn từ tiếp theo có chữ bắt đầu trùng với chữ cuối của từ trước.',
        'Sinh viên chọn đúng và nhanh nhất sẽ ghi điểm cho mình (+15đ).'
      ],
      tip: 'Nhớ nhanh các thuật ngữ kỹ thuật phổ biến như: Thiết kế, Kế hoạch, Hoạch định, Định hình...',
      demoType: 'chain'
    },
    10: {
      steps: [
        'Hệ thống tự động ghép cặp 1v1 ngẫu nhiên với bạn học cùng lớp.',
        'Nếu sau 6 giây chưa tìm thấy đối thủ, bạn sẽ thi đấu với AI Bot.',
        'Cùng trả lời bộ 3 câu hỏi trắc nghiệm nhanh (10 giây/câu).',
        'Người trả lời đúng nhiều hơn và nhanh hơn sẽ giành chiến thắng (+25đ).'
      ],
      tip: 'Trả lời đúng là điều kiện tiên quyết, sau đó mới đến tốc độ phản hồi!',
      demoType: 'duel'
    },
    11: {
      steps: [
        'Giảng viên mở cổng bình chọn cho các ý tưởng dự án xuất sắc.',
        'Đọc kỹ các phương án thiết kế của từng nhóm học sinh.',
        'Xếp hạng top 3 ý tưởng bạn thấy sáng tạo nhất (Hạng 1, 2, 3).',
        'Nhấp gửi bình chọn để giúp bạn học và nhận ngay +10đ.'
      ],
      tip: 'Hãy đánh giá công tâm dựa trên tính khả thi và tính sáng tạo của ý tưởng!',
      demoType: 'vote'
    },
    12: {
      steps: [
        'Hoàn thành bài tập nhóm hoặc bài viết thảo luận trong lớp.',
        'Sao chép liên kết nộp bài (Google Drive, Dropbox, Figma...).',
        'Dán liên kết vào ô nhập bài tập trên ứng dụng.',
        'Bấm nộp bài sớm trước giờ học kết thúc để nhận +10đ.'
      ],
      tip: 'Đảm bảo mở quyền truy cập liên kết ở chế độ công khai để giảng viên có thể xem bài!',
      demoType: 'submit'
    },
    13: {
      steps: [
        'Hệ thống tìm kiếm một đối thủ ngẫu nhiên cùng lớp để ghép cặp 1v1.',
        'Đấu trắc nghiệm tư duy công nghệ & thiết kế kỹ thuật gồm 5 câu hỏi.',
        'Mỗi đáp án đúng lắp ráp thành công 1 bộ phận của Tuabin gió.',
        'Người hoàn thành Tuabin trước hoặc lắp ráp được nhiều phần hơn sẽ thắng (+15đ).'
      ],
      tip: 'Kiến thức cốt lõi về cấu trúc hệ thống công nghệ (Đầu vào - Xử lý - Đầu ra) sẽ giúp bạn lắp ráp tuabin nhanh nhất!',
      demoType: 'turbine'
    },
    14: {
      steps: [
        'Chỉ mở vào tuần học đặc biệt (Tuần giữa kỳ hoặc Báo cáo đồ án).',
        'Giao diện hộp quà vàng siêu cấp xuất hiện trên trang chủ.',
        'Nhấp trực tiếp vào hộp quà để mở điểm thưởng.',
        'Cộng trực tiếp +50đ thưởng chuyên cần siêu cấp.'
      ],
      tip: 'Tuần học đặc biệt là cơ hội bứt phá điểm số cao nhất học kỳ, hãy đi học đầy đủ!',
      demoType: 'gift'
    },
    15: {
      steps: [
        'Hệ thống hiển thị trạng thái đếm ngược "Chuẩn bị...".',
        'Quan sát màn hình và tập trung cao độ.',
        'Ngay khi màn hình đổi sang Màu Xanh và hiện "BẤM NGAY", chạm thật nhanh.',
        'Nhận tối đa +15đ dựa trên tốc độ phản xạ của bạn (tính bằng mili-giây).'
      ],
      tip: 'Tránh chạm màn hình quá sớm trước khi đổi màu, bạn sẽ bị phạt cộng thêm thời gian!',
      demoType: 'reflex'
    },
    16: {
      steps: [
        'Viết chia sẻ tối thiểu 20 ký tự về trải nghiệm học tập môn học.',
        'Chia sẻ của bạn sẽ xuất hiện công khai trên bảng tin chung.',
        'Đọc và thả tim cho chia sẻ của các bạn học sinh khác.',
        'Gửi chia sẻ để nhận ngay +5đ tích lũy.'
      ],
      tip: 'Viết ngắn gọn nhưng súc tích về bài học kỹ thuật tâm đắc nhất của bạn.',
      demoType: 'reflection'
    }
  };

  const getMiniMockup = (type: string) => {
    switch (type) {
      case 'bomb':
        return (
          <div className="flex flex-col items-center p-sm bg-primary/5 rounded-xl border border-primary/10">
            <span className="text-3xl animate-bounce">💣</span>
            <div className="w-full bg-outline-variant/30 h-1.5 rounded-full overflow-hidden mt-xs">
              <div className="bg-error h-full" style={{ width: '60%' }} />
            </div>
            <span className="text-[10px] text-error font-bold mt-1">⏱️ 09 giây còn lại</span>
          </div>
        );
      case 'battle':
        return (
          <div className="flex flex-col items-center p-sm bg-secondary-container/5 rounded-xl border border-secondary-container/10">
            <div className="flex gap-xs text-xl">❤️ ❤️ ❤️</div>
            <span className="text-[10px] text-on-surface-variant font-bold mt-1">Sống sót: 15 / 40 học viên</span>
          </div>
        );
      case 'qr':
        return (
          <div className="relative w-24 h-24 border border-dashed border-primary/40 rounded-xl flex items-center justify-center bg-primary/5">
            <div className="absolute top-1 left-1 w-3 h-3 border-t-2 border-l-2 border-primary" />
            <div className="absolute top-1 right-1 w-3 h-3 border-t-2 border-r-2 border-primary" />
            <div className="absolute bottom-1 left-1 w-3 h-3 border-b-2 border-l-2 border-primary" />
            <div className="absolute bottom-1 right-1 w-3 h-3 border-b-2 border-r-2 border-primary" />
            <span className="material-symbols-outlined text-3xl text-primary animate-pulse">qr_code_2</span>
          </div>
        );
      case 'group':
        return (
          <div className="space-y-xs w-full text-left bg-surface-container p-xs rounded-xl border border-outline-variant/10">
            <div className="bg-amber-100 p-1.5 rounded text-[10px] text-amber-900 border border-amber-200">
              📌 <b>Nhóm 1:</b> Chế tạo robot lau nhà bằng năng lượng mặt trời.
            </div>
            <div className="bg-white p-1 rounded text-[9px] text-on-surface-variant italic truncate">
              💬 Minh Anh: Tôi đang phác thảo 3D nhé...
            </div>
          </div>
        );
      case 'undercover':
        return (
          <div className="flex flex-col items-center p-sm bg-surface-container-low rounded-xl border border-outline-variant/20">
            <div className="bg-primary/10 text-primary border border-primary/20 text-[10px] font-black px-2 py-0.5 rounded-full mb-1">
              DÂN THƯỜNG
            </div>
            <span className="text-xs font-bold text-on-surface">Từ bí mật: <b>Mẫu thử (Prototype)</b></span>
          </div>
        );
      case 'hand':
        return (
          <div className="flex flex-col items-center">
            <button className="w-12 h-12 bg-primary text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white animate-pulse">
              <span className="material-symbols-outlined text-xl">pan_tool</span>
            </button>
            <span className="text-[9px] text-primary font-bold mt-1">NHẤN ĐỂ PHÁT BIỂU</span>
          </div>
        );
      case 'feedback':
        return (
          <div className="text-center space-y-1">
            <div className="flex justify-center gap-xs text-sm text-yellow-500">
              ★ ★ ★ ★ ☆
            </div>
            <span className="text-[9px] text-on-surface-variant block">Đánh giá bài học: 4/5 sao</span>
          </div>
        );
      case 'streak':
        return (
          <div className="flex items-center gap-xs bg-orange-50 border border-orange-200 px-3 py-1 rounded-full text-orange-700">
            <span className="animate-bounce">🔥</span>
            <span className="text-xs font-black">Chuỗi 12 ngày</span>
          </div>
        );
      case 'chain':
        return (
          <div className="flex items-center gap-1 text-[9px] font-bold">
            <span className="bg-surface-container px-1 py-0.5 rounded border">Thiết kế</span>
            ➔
            <span className="bg-primary-container text-white px-1 py-0.5 rounded border border-primary">Kỹ thuật</span>
          </div>
        );
      case 'duel':
        return (
          <div className="flex justify-around items-center w-full p-1 bg-surface-container rounded-lg text-[10px] font-bold">
            <span className="text-primary">Bạn (10đ)</span>
            <span className="text-xs">⚔️</span>
            <span className="text-secondary">Nam (5đ)</span>
          </div>
        );
      case 'vote':
        return (
          <div className="space-y-1 text-left w-full text-[9px]">
            <div>🥇 Hạng 1: <span className="font-bold">Ý tưởng Nhóm 3</span></div>
            <div>🥈 Hạng 2: <span className="font-bold">Ý tưởng Nhóm 7</span></div>
          </div>
        );
      case 'submit':
        return (
          <div className="bg-white border border-outline-variant/30 rounded p-sm flex items-center gap-xs text-[9px]">
            <span className="material-symbols-outlined text-sm text-primary">link</span>
            <span className="text-on-surface font-semibold truncate max-w-[100px]">drive.google.com/file...</span>
            <span className="text-success font-black ml-auto">✓ ĐÃ NỘP</span>
          </div>
        );
      case 'turbine':
        return (
          <div className="flex flex-col items-center gap-xs">
            <div className="relative w-12 h-12 flex flex-col justify-end items-center mx-auto border border-primary/20 rounded bg-primary/5">
              <span className="text-xl animate-spin-blades">🌪️</span>
            </div>
            <span className="text-[8px] text-primary font-black uppercase">Tuabin Gió</span>
          </div>
        );
      case 'gift':
        return (
          <div className="flex flex-col items-center text-center">
            <span className="text-3xl animate-bounce">🎁</span>
            <span className="text-[8px] font-bold text-amber-600 block mt-1">MỞ HỘP QUÀ +50đ</span>
          </div>
        );
      case 'reflex':
        return (
          <div className="w-24 py-2 bg-success text-white text-center rounded-lg font-black text-xs border border-success-container shadow-sm animate-pulse">
            ⚡ BẤM NGAY
          </div>
        );
      case 'reflection':
        return (
          <div className="bg-white p-xs rounded border border-outline-variant/30 text-left">
            <p className="text-[9px] leading-snug font-medium text-on-surface">"Hôm nay tôi hiểu rõ về 5 bước Design Thinking."</p>
            <span className="text-[8px] text-primary font-bold mt-1 block">❤️ 5 Thả tim</span>
          </div>
        );
      default:
        return null;
    }
  };

  // Filter games based on search query
  const filteredGames = ALL_GAMES.filter(
    g =>
      g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      g.id.toString() === searchQuery.trim() ||
      g.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-container-margin">
      <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xxl w-full max-w-[480px] max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-pop-in relative">
        
        {/* Modal Header */}
        <div className="bg-primary p-md flex items-center justify-between shrink-0">
          <div className="flex items-center gap-sm">
            <span className="material-symbols-outlined text-2xl text-on-primary" style={{ fontVariationSettings: "'FILL' 1" }}>menu_book</span>
            <div>
              <h2 className="text-base font-extrabold text-on-primary">Cẩm Nang AttendanceHero</h2>
              <p className="text-[10px] text-on-primary/70">Tra cứu nhanh hướng dẫn và luật chơi môn học</p>
            </div>
          </div>
          <button onClick={onClose} className="text-on-primary/70 hover:text-on-primary active:scale-90 transition-all cursor-pointer">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-outline-variant/20 bg-surface-container-low px-sm shrink-0">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex-1 py-sm text-center text-xs font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === 'overview' ? 'border-primary text-primary font-black' : 'border-transparent text-on-surface-variant'
            }`}
          >
            Hướng dẫn chung
          </button>
          <button
            onClick={() => setActiveTab('games')}
            className={`flex-1 py-sm text-center text-xs font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === 'games' ? 'border-primary text-primary font-black' : 'border-transparent text-on-surface-variant'
            }`}
          >
            16 Trò chơi
          </button>
          <button
            onClick={() => setActiveTab('rewards')}
            className={`flex-1 py-sm text-center text-xs font-bold transition-all border-b-2 cursor-pointer ${
              activeTab === 'rewards' ? 'border-primary text-primary font-black' : 'border-transparent text-on-surface-variant'
            }`}
          >
            Vòng quay &amp; Điểm
          </button>
        </div>

        {/* Tab Contents */}
        <div className="p-md overflow-y-auto flex-grow space-y-md">
          
          {/* ── TAB 1: OVERVIEW ────────────────────────────────────────────────── */}
          {activeTab === 'overview' && (
            <div className="space-y-md animate-fade-in text-left">
              <div className="bg-primary/5 p-md rounded-xl border border-primary/10 space-y-xs">
                <h4 className="text-xs font-extrabold text-primary flex items-center gap-xs uppercase">
                  <span className="material-symbols-outlined text-[16px]">info</span>
                  AttendanceHero là gì?
                </h4>
                <p className="text-xs font-medium text-on-surface-variant leading-relaxed">
                  Là ứng dụng game hóa điểm danh cho môn học <b>Tư duy công nghệ và Thiết kế kỹ thuật</b>. Bạn đi học, xác minh vị trí lớp học, chơi trò chơi để điểm danh và nhận điểm tích lũy xếp hạng.
                </p>
              </div>

              <div className="space-y-sm">
                <h4 className="text-xs font-extrabold text-on-surface uppercase tracking-wider">Quy trình điểm danh gồm 3 bước:</h4>
                
                <div className="space-y-xs">
                  <div className="flex gap-sm p-sm bg-surface-container-low rounded-xl border border-outline-variant/15">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-black shrink-0">1</span>
                    <div>
                      <p className="text-xs font-bold text-on-surface">Xác minh GPS tại Bách Khoa</p>
                      <p className="text-[10px] text-on-surface-variant leading-relaxed mt-0.5">
                        Bật vị trí trên điện thoại và xác định bạn đang ở trong bán kính <b>500m</b> tính từ tâm <b>Đại học Bách Khoa Hà Nội</b>.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-sm p-sm bg-surface-container-low rounded-xl border border-outline-variant/15">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-black shrink-0">2</span>
                    <div>
                      <p className="text-xs font-bold text-on-surface">Chơi trò chơi thử thách</p>
                      <p className="text-[10px] text-on-surface-variant leading-relaxed mt-0.5">
                        Mỗi tuần học giảng viên sẽ mở 1 game điểm danh đặc trưng. Hoàn thành game để hệ thống ghi nhận điểm danh.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-sm p-sm bg-surface-container-low rounded-xl border border-outline-variant/15">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-black shrink-0">3</span>
                    <div>
                      <p className="text-xs font-bold text-on-surface">Quay vòng quay may mắn</p>
                      <p className="text-[10px] text-on-surface-variant leading-relaxed mt-0.5">
                        Nhận thêm điểm thưởng ngẫu nhiên từ vòng quay may mắn sau khi điểm danh thành công!
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-sm border-t border-outline-variant/20 flex justify-center">
                <button
                  onClick={() => { onClose(); onStartTour(); }}
                  className="py-2.5 px-md bg-secondary-container text-on-secondary-container font-black text-xs rounded-xl shadow hover:bg-secondary-container/90 active:scale-95 transition-all flex items-center gap-xs cursor-pointer border border-outline-variant/10"
                >
                  <span className="material-symbols-outlined text-sm">flight_takeoff</span>
                  Xem lại Hướng dẫn nhanh (Tour)
                </button>
              </div>
            </div>
          )}

          {/* ── TAB 2: GAMES LIST & DETAILS ───────────────────────────────────── */}
          {activeTab === 'games' && (
            <div className="space-y-md animate-fade-in text-left">
              {/* Search input */}
              <div className="relative shrink-0">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-[18px] text-on-surface-variant/60">search</span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Tìm kiếm trò chơi hoặc số tuần..."
                  className="w-full pl-9 pr-md py-2 text-xs bg-surface-container-low border border-outline-variant/40 focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-xl outline-none"
                />
              </div>

              {/* Games Accordion List */}
              <div className="space-y-sm max-h-[45vh] overflow-y-auto pr-xs">
                {filteredGames.length === 0 ? (
                  <p className="text-xs font-bold text-on-surface-variant/60 text-center py-xl">
                    Không tìm thấy trò chơi nào phù hợp.
                  </p>
                ) : (
                  filteredGames.map(game => {
                    const isExpanded = expandedGameId === game.id;
                    const inst = gameInstructions[game.id] || { steps: ['Đang cập nhật hướng dẫn...'], tip: '', demoType: '' };

                    return (
                      <div
                        key={game.id}
                        className="bg-white border border-outline-variant/20 rounded-xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.02)] transition-all"
                      >
                        {/* Title Accordion Header */}
                        <div
                          onClick={() => setExpandedGameId(isExpanded ? null : game.id)}
                          className="p-md flex items-center justify-between cursor-pointer hover:bg-surface-container-low transition-colors"
                        >
                          <div className="flex items-center gap-sm">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl select-none shrink-0 ${game.colorClass}`}>
                              {game.icon}
                            </div>
                            <div>
                              <h5 className="text-xs font-black text-on-surface flex items-center gap-1.5">
                                {game.name}
                                <span className="text-[9px] bg-primary-container text-white px-1.5 py-0.5 rounded-full font-bold shrink-0">
                                  +{game.points}đ
                                </span>
                              </h5>
                              <p className="text-[10px] text-on-surface-variant font-medium mt-0.5">
                                Tuần {game.id} • {game.description.slice(0, 36)}...
                              </p>
                            </div>
                          </div>
                          <span className="material-symbols-outlined text-on-surface-variant/70 text-[18px]">
                            {isExpanded ? 'expand_less' : 'expand_more'}
                          </span>
                        </div>

                        {/* Accordion Content Details */}
                        {isExpanded && (
                          <div className="px-md pb-md pt-xs border-t border-outline-variant/10 bg-surface-container-lowest space-y-sm animate-slide-up">
                            <div>
                              <h6 className="text-[10px] font-black text-on-surface-variant uppercase tracking-wider mb-xs">
                                📋 Mô tả chi tiết thử thách:
                              </h6>
                              <p className="text-xs font-semibold text-on-surface leading-relaxed">
                                {game.description}
                              </p>
                            </div>

                            {/* Grid showing steps + mockup side-by-side */}
                            <div className="grid grid-cols-5 gap-sm items-start">
                              <div className="col-span-3 space-y-sm">
                                <h6 className="text-[10px] font-black text-on-surface-variant uppercase tracking-wider">
                                  🎮 Các bước chơi:
                                </h6>
                                <div className="space-y-xs">
                                  {inst.steps.map((s, idx) => (
                                    <div key={idx} className="flex gap-1.5 items-start">
                                      <span className="w-4 h-4 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-black shrink-0 mt-0.5">
                                        {idx + 1}
                                      </span>
                                      <p className="text-[10px] font-bold text-on-surface leading-normal">{s}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="col-span-2 space-y-sm text-center flex flex-col items-center justify-center">
                                <h6 className="text-[10px] font-black text-on-surface-variant uppercase tracking-wider block">
                                  📱 Minh họa:
                                </h6>
                                {getMiniMockup(inst.demoType)}
                              </div>
                            </div>

                            {/* Tip section */}
                            {inst.tip && (
                              <div className="bg-tertiary-container/10 p-sm rounded-lg border border-tertiary/20 text-[10px] text-tertiary font-bold flex gap-1 items-start">
                                <span className="material-symbols-outlined text-sm shrink-0">tips_and_updates</span>
                                <span>💡 <b>Mẹo nhỏ:</b> {inst.tip}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ── TAB 3: REWARDS & POINTS ───────────────────────────────────────── */}
          {activeTab === 'rewards' && (
            <div className="space-y-md animate-fade-in text-left">
              <div className="bg-gradient-to-br from-tertiary-container/15 to-tertiary-container/5 p-md rounded-xl border border-tertiary/20 space-y-sm text-center">
                <span className="text-4xl animate-bounce block">🎡</span>
                <div>
                  <h4 className="text-sm font-black text-on-surface">Vòng Quay May Mắn sau điểm danh</h4>
                  <p className="text-[10px] text-on-surface-variant leading-relaxed mt-0.5">
                    Ngay sau khi vượt qua thử thách game tuần, bạn sẽ mở khóa vòng quay này để nhận thêm điểm ngẫu nhiên.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-xs pt-xs">
                  <div className="bg-white p-xs rounded border border-outline-variant/10">
                    <span className="text-xs font-black text-primary">+5đ</span>
                    <span className="text-[8px] text-on-surface-variant block">Rất dễ</span>
                  </div>
                  <div className="bg-white p-xs rounded border border-outline-variant/10">
                    <span className="text-xs font-black text-primary">+20đ</span>
                    <span className="text-[8px] text-on-surface-variant block">Trung bình</span>
                  </div>
                  <div className="bg-white p-xs rounded border border-outline-variant/10">
                    <span className="text-xs font-black text-primary">+100đ</span>
                    <span className="text-[8px] text-amber-600 font-extrabold block">Siêu may mắn</span>
                  </div>
                </div>
              </div>

              <div className="space-y-sm">
                <h4 className="text-xs font-extrabold text-on-surface uppercase tracking-wider">Cơ chế tính điểm &amp; Lợi ích:</h4>
                <div className="space-y-sm bg-surface-container-low p-md rounded-xl border border-outline-variant/15 text-xs font-semibold text-on-surface-variant space-y-2">
                  <div className="flex gap-2">
                    <span className="text-primary font-bold">●</span>
                    <p><b>Điểm chuyên cần:</b> Tích lũy trực tiếp qua các tuần để cộng vào điểm quá trình môn học.</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-primary font-bold">●</span>
                    <p><b>Xếp hạng học tập:</b> Đua top 10 lớp học để giành lấy danh hiệu "Kỹ sư Ưu tú" kèm quà tặng từ giảng viên.</p>
                  </div>
                  <div className="flex gap-2">
                    <span className="text-primary font-bold">●</span>
                    <p><b>Cộng điểm đồ án:</b> Đạt Streak 🔥 lớn hơn 10 tuần sẽ được cộng trực tiếp +1.0 điểm vào đồ án thiết kế môn học.</p>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
