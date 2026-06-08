'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, isMockEnabled, isUserTeacher, getTeacherSettings, saveTeacherSettings, SUBJECT_NAME, TOTAL_WEEKS, TEACHER_ID, DEFAULT_TEACHER_SETTINGS, ALL_GAMES, getGameContent, saveGameContent } from '@/utils/supabase/client';
import type { TeacherSettings, Game } from '@/utils/supabase/client';

interface CheckedInStudent {
  id: string;
  full_name: string;
  avatar_url: string | null;
  points_earned: number;
  game_name: string;
  created_at: string;
  student_input?: string | null;
}

export default function TeacherPage() {
  const router = useRouter();
  const supabase = createClient();

  const [settings, setSettings]       = useState<TeacherSettings>({ ...DEFAULT_TEACHER_SETTINGS, games: ALL_GAMES.map(g => ({ ...g })) });
  const [students, setStudents]       = useState<CheckedInStudent[]>([]);
  const [saving, setSaving]           = useState(false);
  const [savedMsg, setSavedMsg]       = useState(false);
  const [mounted, setMounted]         = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [completedWeeks, setCompletedWeeks] = useState<Set<number>>(new Set());

  const [customSecretQuestion, setCustomSecretQuestion] = useState('');
  const [customQuizQuestions, setCustomQuizQuestions] = useState<any[]>([]);

  // Game 6 (Lucky hand-raiser spinner) states
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [selectedWinner, setSelectedWinner] = useState<any | null>(null);
  const [winnerBonusAwarded, setWinnerBonusAwarded] = useState(false);

  // Load settings
  const loadSettings = useCallback(async () => {
    if (isMockEnabled) {
      setSettings(getTeacherSettings());
    } else {
      try {
        const { data, error } = await supabase
          .from('teacher_settings')
          .select('*')
          .eq('id', 1)
          .single();
        if (error) throw error;
        if (data) {
          setSettings({
            currentWeek: data.current_week,
            sessionOpen: data.session_open,
            games: ALL_GAMES.map(g => ({ ...g })),
          });
        }
      } catch (err) {
        console.error('Failed to load settings from Supabase:', err);
      }
    }
  }, [supabase]);

  // Auth guard + load settings after mount
  useEffect(() => {
    setMounted(true);
    loadSettings();
    supabase.auth.getUser().then(({ data: { user } }: { data: { user: any } }) => {
      if (!user) { router.push('/login'); return; }
      if (!isUserTeacher(user)) { router.push('/home'); }
    });
  }, [loadSettings]);

  useEffect(() => {
    if (mounted) {
      const content2 = getGameContent(2);
      setCustomSecretQuestion(content2.secretQuestion || '');

      const content9 = getGameContent(9);
      setCustomQuizQuestions(content9.quizQuestions || []);
    }
  }, [mounted, settings.currentWeek]);

  // Word Cloud calculation
  const getWordCloudWords = () => {
    const wordCounts: Record<string, number> = {};
    const stopwords = new Set([
      'và', 'là', 'của', 'để', 'trong', 'cho', 'có', 'các', 'nhưng', 'khi', 'này', 'nào', 'với', 'một', 'những', 'được', 'ra', 'về', 'sao', 'điểm', 'trả', 'lời', 'câu', 'hỏi', 'bài', 'học', 'tuần', 'em'
    ]);
    
    students.forEach(s => {
      if (s.student_input && !s.student_input.startsWith('Vòng quay:')) {
        const textWithoutSpin = s.student_input.split(' | Vòng quay:')[0];
        const cleanText = textWithoutSpin.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, ' ');
        const words = cleanText.split(/\s+/);
        words.forEach(w => {
          const trimmed = w.trim();
          if (trimmed.length > 1 && !stopwords.has(trimmed) && isNaN(Number(trimmed))) {
            wordCounts[trimmed] = (wordCounts[trimmed] || 0) + 1;
          }
        });
      }
    });
    
    return Object.entries(wordCounts)
      .map(([text, count]) => ({ text, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  };

  const handleExportCSV = () => {
    if (students.length === 0) {
      alert('Không có dữ liệu sinh viên điểm danh để xuất!');
      return;
    }
    let csvContent = 'data:text/csv;charset=utf-8,\uFEFF';
    csvContent += 'STT,Họ và tên,Tên thử thách,Số điểm,Thời gian điểm danh,Câu trả lời chi tiết\n';
    
    students.forEach((s, idx) => {
      const timeStr = new Date(s.created_at).toLocaleString('vi-VN');
      const cleanInput = s.student_input ? s.student_input.replace(/"/g, '""') : '';
      csvContent += `${idx + 1},"${s.full_name}","${s.game_name}",${s.points_earned},"${timeStr}","${cleanInput}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `DiemDanh_Tuan_${settings.currentWeek}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Load checked-in students for current week
  const loadStudents = useCallback(async () => {
    const weekNum = settings.currentWeek;
    if (isMockEnabled) {
      const checkIns: any[] = JSON.parse(localStorage.getItem('mock_check_ins') || '[]');
      const profiles: any[] = JSON.parse(localStorage.getItem('mock_profiles') || '[]');
      const weekCheckIns = checkIns.filter((c: any) => c.week_number === weekNum);
      const result: CheckedInStudent[] = weekCheckIns.map((c: any) => {
        const profile = profiles.find((p: any) => p.id === c.user_id);
        return {
          id: c.id,
          full_name: profile?.full_name || 'Sinh viên',
          avatar_url: profile?.avatar_url || null,
          points_earned: c.points_earned,
          game_name: c.game_name || 'Điểm danh',
          created_at: c.created_at,
          student_input: c.student_input || null,
        };
      });
      setStudents(result);

      // Extract unique week numbers that have check-ins
      const uniqueWeeks = new Set<number>(checkIns.map((c: any) => c.week_number));
      setCompletedWeeks(uniqueWeeks);
    } else {
      try {
        const { data, error } = await supabase
          .from('check_ins')
          .select(`
            id,
            points_earned,
            game_name,
            created_at,
            student_input,
            profiles (
              id,
              full_name,
              avatar_url
            )
          `)
          .eq('week_number', weekNum);

        if (error) throw error;

        if (data) {
          const result: CheckedInStudent[] = (data as any[]).map((c: any) => {
            const profile = Array.isArray(c.profiles) ? c.profiles[0] : c.profiles;
            return {
              id: c.id,
              full_name: profile?.full_name || 'Sinh viên',
              avatar_url: profile?.avatar_url || null,
              points_earned: c.points_earned,
              game_name: c.game_name || 'Điểm danh',
              created_at: c.created_at,
              student_input: c.student_input || null,
            };
          });
          setStudents(result);
        }

        // Fetch all check-ins to find which weeks have students
        const { data: allCis, error: allErr } = await supabase
          .from('check_ins')
          .select('week_number');
        if (!allErr && allCis) {
          const uniqueWeeks = new Set<number>(allCis.map((c: any) => c.week_number));
          setCompletedWeeks(uniqueWeeks);
        }
      } catch (err) {
        console.error('Failed to load checked in students:', err);
      }
    }
  }, [supabase, settings.currentWeek]);

  useEffect(() => {
    loadStudents();
    const interval = setInterval(loadStudents, 3000);
    return () => clearInterval(interval);
  }, [loadStudents]);

  const getHandRaisers = useCallback(() => {
    return students
      .map(s => {
        const match = s.student_input?.match(/^Giơ tay lúc ([\d.]+)s/);
        const seconds = match ? parseFloat(match[1]) : 5.0;
        return { ...s, seconds };
      })
      .sort((a, b) => {
        if (a.seconds !== b.seconds) {
          return a.seconds - b.seconds;
        }
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      })
      .slice(0, 5);
  }, [students]);

  const buildConicGradient = (raisers: any[]) => {
    if (raisers.length === 0) return 'gray';
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];
    let grad = 'conic-gradient(';
    raisers.forEach((r, idx) => {
      const start = idx * (360 / raisers.length);
      const end = (idx + 1) * (360 / raisers.length);
      const color = colors[idx % colors.length];
      grad += `${color} ${start}deg ${end}deg${idx < raisers.length - 1 ? ', ' : ''}`;
    });
    grad += ')';
    return grad;
  };

  const handleSpinWheel = (raisers: any[]) => {
    if (raisers.length === 0 || wheelSpinning) return;
    
    setWheelSpinning(true);
    setSelectedWinner(null);
    setWinnerBonusAwarded(false);
    
    const winnerIdx = Math.floor(Math.random() * raisers.length);
    const chosenStudent = raisers[winnerIdx];
    
    const segmentAngle = 360 / raisers.length;
    // Rotate 5 full turns + stop at the segment's middle angle relative to 12 o'clock pointer (360 deg)
    const targetAngle = 1800 + (360 - (winnerIdx * segmentAngle + segmentAngle / 2));
    
    setWheelRotation(targetAngle);
    
    setTimeout(() => {
      setWheelSpinning(false);
      setSelectedWinner(chosenStudent);
    }, 4000);
  };

  const handleAwardBonus = async () => {
    if (!selectedWinner || winnerBonusAwarded) return;
    
    setSaving(true);
    if (isMockEnabled) {
      const checkIns = JSON.parse(localStorage.getItem('mock_check_ins') || '[]');
      const updated = checkIns.map((c: any) => {
        if (c.id === selectedWinner.id) {
          return {
            ...c,
            points_earned: c.points_earned + 10,
            student_input: `${c.student_input} | Chọn trả lời (+10đ)`
          };
        }
        return c;
      });
      localStorage.setItem('mock_check_ins', JSON.stringify(updated));
      setWinnerBonusAwarded(true);
      setSaving(false);
      loadStudents();
    } else {
      try {
        const { data: currentCi } = await supabase
          .from('check_ins')
          .select('points_earned, student_input')
          .eq('id', selectedWinner.id)
          .single();
          
        const newPoints = (currentCi?.points_earned || selectedWinner.points_earned) + 10;
        const newInput = `${currentCi?.student_input || selectedWinner.student_input} | Chọn trả lời (+10đ)`;
        
        const { error } = await supabase
          .from('check_ins')
          .update({
            points_earned: newPoints,
            student_input: newInput
          })
          .eq('id', selectedWinner.id);
          
        if (error) throw error;
        setWinnerBonusAwarded(true);
        loadStudents();
      } catch (err) {
        console.error('Failed to award bonus points:', err);
      } finally {
        setSaving(false);
      }
    }
  };

  // Persist and save
  const persist = async (newSettings: TeacherSettings) => {
    setSettings(newSettings);
    setSaving(true);
    if (isMockEnabled) {
      saveTeacherSettings(newSettings);
      setSaving(false);
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 1500);
    } else {
      try {
        const { error } = await supabase
          .from('teacher_settings')
          .update({
            current_week: newSettings.currentWeek,
            session_open: newSettings.sessionOpen,
          })
          .eq('id', 1);
        if (error) throw error;
        setSavedMsg(true);
        setTimeout(() => setSavedMsg(false), 1500);
      } catch (err) {
        console.error('Failed to save settings to Supabase:', err);
      } finally {
        setSaving(false);
      }
    }
  };

  const handleWeekChange = (week: number) => {
    persist({ ...settings, currentWeek: week, sessionOpen: false });
  };

  const toggleSession = () => {
    persist({ ...settings, sessionOpen: !settings.sessionOpen });
  };

  const handleResetAttendance = async () => {
    const confirmed = window.confirm(
      `Cảnh báo: Bạn có chắc chắn muốn xóa toàn bộ điểm danh của Tuần ${settings.currentWeek}? Tất cả sinh viên đã điểm danh tuần này sẽ bị xóa khỏi danh sách và phải điểm danh lại.`
    );
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('check_ins')
        .delete()
        .eq('week_number', settings.currentWeek);

      if (error) throw error;

      await loadStudents();
      alert(`Đã đặt lại thành công điểm danh Tuần ${settings.currentWeek}!`);
    } catch (err) {
      console.error('Failed to reset attendance:', err);
      alert('Không thể đặt lại điểm danh. Vui lòng thử lại.');
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    document.cookie = 'mock_session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    router.push('/login');
  };

  const enabledCount = 1;

  return (
    <div className="flex flex-col min-h-screen bg-background text-on-background pb-16">

      {/* ── Teacher Header ─────────────────────────────────────────────────── */}
      <header className="bg-secondary-container sticky top-0 z-50 shadow-md">
        <div className="flex justify-between items-center px-container-margin py-md w-full max-w-[600px] mx-auto">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-on-secondary-container text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>school</span>
            <div>
              <h1 className="text-base font-extrabold text-on-secondary-container leading-tight">Bảng điều khiển</h1>
              <p className="text-[10px] font-bold text-on-secondary-container/70 uppercase tracking-wider">Giảng viên</p>
            </div>
          </div>
          <button onClick={handleSignOut} className="flex items-center gap-1 text-on-secondary-container/80 text-sm font-bold hover:text-on-secondary-container transition-colors active:scale-95">
            <span className="material-symbols-outlined text-[18px]">logout</span>
            Đăng xuất
          </button>
        </div>
      </header>

      <main className="flex-grow w-full max-w-[600px] mx-auto px-container-margin pt-lg space-y-lg">

        {/* ── Subject + Week hero ──────────────────────────────────────────── */}
        <section className="bg-secondary-container rounded-xxl p-lg relative overflow-hidden animate-fade-in-up shadow-xl">
          <div className="absolute -right-6 -top-6 w-28 h-28 bg-white/10 rounded-full blur-2xl" />
          <div className="relative z-10">
            <p className="text-[10px] font-bold uppercase tracking-widest text-on-secondary-container/70 mb-xs">Môn học</p>
            <h2 className="text-lg font-extrabold text-on-secondary-container font-display-hero leading-tight mb-lg">{SUBJECT_NAME}</h2>

            {/* Week selector */}
            <p className="text-xs font-bold text-on-secondary-container/80 mb-sm">Chọn tuần đang dạy:</p>
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1).map(w => {
                const isCompleted = completedWeeks.has(w);
                const isActive = settings.currentWeek === w;

                return (
                  <button
                    key={w}
                    onClick={() => handleWeekChange(w)}
                    className={`w-9 h-9 rounded-full text-xs font-bold transition-all duration-200 active:scale-90 relative flex items-center justify-center ${
                      isActive
                        ? 'bg-white text-secondary shadow-md scale-110'
                        : 'bg-white/20 text-on-secondary-container hover:bg-white/35'
                    }`}
                  >
                    {w}
                    {isCompleted && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-tertiary text-on-tertiary text-[9px] rounded-full flex items-center justify-center shadow-sm">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Session Toggle ───────────────────────────────────────────────── */}
        {mounted && (
          <section className={`rounded-xxl p-lg flex items-center justify-between gap-md shadow-lg animate-fade-in-up stagger-1 transition-all duration-500 ${
            settings.sessionOpen
              ? 'bg-tertiary-container text-on-tertiary-container'
              : 'bg-surface-container text-on-surface'
          }`}>
            <div className="flex items-center gap-md">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-inner transition-colors duration-500 ${
                settings.sessionOpen ? 'bg-white/20' : 'bg-surface-container-high'
              }`}>
                <span
                  className={`material-symbols-outlined text-[36px] transition-colors duration-300 ${settings.sessionOpen ? 'text-tertiary' : 'text-outline'}`}
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  {settings.sessionOpen ? 'radio_button_checked' : 'radio_button_unchecked'}
                </span>
              </div>
              <div>
                <h3 className="font-extrabold text-base">Buổi học Tuần {settings.currentWeek}</h3>
                <p className="text-sm font-semibold opacity-80">
                  {settings.sessionOpen ? `Đang mở • ${enabledCount} trò chơi kích hoạt` : 'Chưa mở điểm danh'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {settings.sessionOpen && settings.currentWeek === 3 && (
                <button
                  onClick={() => setShowQRModal(true)}
                  className="px-lg py-sm rounded-full font-extrabold text-sm bg-tertiary text-on-tertiary hover:bg-tertiary/90 transition-all active:scale-95 shadow-md flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-[18px]">qr_code</span>
                  Mã QR
                </button>
              )}
              <button
                onClick={toggleSession}
                className={`px-lg py-sm rounded-full font-extrabold text-sm transition-all duration-300 active:scale-95 shadow-md ${
                  settings.sessionOpen
                    ? 'bg-error text-white hover:bg-error/90'
                    : 'bg-primary text-white hover:bg-primary/90 cta-pulse'
                }`}
              >
                {settings.sessionOpen ? 'Đóng buổi' : 'Mở buổi'}
              </button>
            </div>
          </section>
        )}

        {/* Save status */}
        {(saving || savedMsg) && (
          <div className={`flex items-center gap-sm text-sm font-semibold px-md py-sm rounded-full transition-all ${
            savedMsg ? 'bg-tertiary-container text-on-tertiary-container' : 'bg-surface-container text-on-surface-variant'
          }`}>
            <span className="material-symbols-outlined text-[16px]">{savedMsg ? 'check_circle' : 'sync'}</span>
            {savedMsg ? 'Đã lưu cài đặt' : 'Đang lưu...'}
          </div>
        )}

        {/* ── Active Week Game Info ────────────────────────────────────────── */}
        <section className="animate-fade-in-up stagger-2 bg-surface-container-low border border-outline-variant/30 p-md rounded-xxl shadow-sm">
          <div className="flex justify-between items-center mb-sm">
            <h3 className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">Trò chơi Tuần {settings.currentWeek}</h3>
            <span className="bg-primary-container text-on-primary-container text-[11px] font-bold px-2 py-0.5 rounded-full">
              {settings.currentWeek === 2 || settings.currentWeek === 9 ? 'Có thể tùy biến' : 'Cố định'}
            </span>
          </div>

{(() => {
            const currentGame = ALL_GAMES.find(g => g.id === settings.currentWeek);
            if (!currentGame) return <p className="text-xs text-on-surface-variant">Không tìm thấy trò chơi phù hợp cho tuần này.</p>;
            return (
              <div className="flex items-center gap-md bg-white p-md rounded-xl border border-outline-variant/20 shadow-sm">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${currentGame.colorClass}`}>
                  {currentGame.icon}
                </div>
                <div>
                  <div className="flex items-center gap-xs">
                    <h4 className="text-sm font-bold text-on-surface">{currentGame.name}</h4>
                    <span className="text-[10px] font-extrabold bg-surface-container text-on-surface-variant px-1.5 py-0.5 rounded-md">+{currentGame.points} đ</span>
                  </div>
                  <p className="text-xs text-on-surface-variant mt-0.5 leading-tight">{currentGame.description}</p>
                </div>
              </div>
            );
          })()}
        </section>

        {/* Game Customisation Card */}
        {mounted && (settings.currentWeek === 2 || settings.currentWeek === 9 || settings.currentWeek === 6) && (
          <section className="bg-white p-lg rounded-xxl shadow-sm border border-outline-variant/20 animate-fade-in-up mt-sm">
            <h4 className="text-sm font-bold text-on-surface mb-sm flex items-center gap-1">
              <span className="material-symbols-outlined text-[18px] text-primary">
                {settings.currentWeek === 6 ? 'casino' : 'edit_note'}
              </span>
              {settings.currentWeek === 6 ? 'Điều khiển Thử thách: Giơ tay trả lời' : `Tùy biến câu hỏi tuần ${settings.currentWeek}`}
            </h4>
            
            {settings.currentWeek === 2 && (
              <div className="space-y-sm">
                <label className="text-xs font-bold text-on-surface-variant">Nhập câu hỏi bí mật của giảng viên:</label>
                <input
                  type="text"
                  value={customSecretQuestion}
                  onChange={(e) => {
                    setCustomSecretQuestion(e.target.value);
                    saveGameContent(2, { secretQuestion: e.target.value });
                  }}
                  className="w-full px-md py-sm rounded-xl border border-outline-variant/40 text-sm focus:outline-none focus:border-primary bg-surface-container-low"
                  placeholder="Ví dụ: Quy trình thiết kế kỹ thuật gồm mấy bước chính?"
                />
              </div>
            )}

            {settings.currentWeek === 6 && (
              <div className="space-y-md">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-lg items-center">
                  {/* Left side: top list */}
                  <div className="space-y-sm">
                    <h5 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Top 5 sinh viên giơ tay nhanh nhất:</h5>
                    {(() => {
                      const raisers = getHandRaisers();
                      if (raisers.length === 0) {
                        return (
                          <div className="p-md text-center bg-surface-container rounded-xl text-xs text-on-surface-variant font-medium">
                            Chưa có sinh viên nào giơ tay điểm danh!
                          </div>
                        );
                      }
                      return (
                        <div className="space-y-xs">
                          {raisers.map((r, idx) => (
                            <div key={r.id} className="flex items-center justify-between p-sm bg-surface-container-low rounded-xl border border-outline-variant/10">
                              <div className="flex items-center gap-xs">
                                <span className="text-xs font-black text-primary bg-primary/10 w-5 h-5 rounded-full flex items-center justify-center">
                                  {idx + 1}
                                </span>
                                <span className="text-xs font-bold text-on-surface">{r.full_name}</span>
                              </div>
                              <span className="text-[10px] font-black text-green-700 bg-green-500/10 px-2 py-0.5 rounded-full">
                                ⏱️ {r.seconds.toFixed(2)}s
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Right side: Lucky Wheel */}
                  <div className="flex flex-col items-center justify-center py-md space-y-md border-t md:border-t-0 md:border-l border-outline-variant/20">
                    {(() => {
                      const raisers = getHandRaisers();
                      if (raisers.length === 0) return (
                        <p className="text-xs text-on-surface-variant italic text-center">
                          Vòng quay sẽ xuất hiện khi có sinh viên giơ tay.
                        </p>
                      );
                      return (
                        <>
                          <div className="relative">
                            {/* Pointer arrow */}
                            <div className="absolute top-[-12px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[18px] border-t-error z-20 filter drop-shadow-md" />
                            
                            {/* Wheel */}
                            <div
                              className="w-44 h-44 rounded-full border-4 border-on-surface shadow-2xl relative overflow-hidden flex items-center justify-center"
                              style={{
                                transform: `rotate(${wheelRotation}deg)`,
                                backgroundImage: buildConicGradient(raisers),
                                transition: wheelSpinning ? 'transform 4000ms cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none'
                              }}
                            >
                              {/* Text labels */}
                              {raisers.map((r, idx) => {
                                const angle = idx * (360 / raisers.length) + (360 / raisers.length) / 2;
                                return (
                                  <div
                                    key={idx}
                                    className="absolute text-[9px] font-black text-white select-none pointer-events-none text-center truncate max-w-[60px]"
                                    style={{
                                      top: '50%',
                                      left: '50%',
                                      transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-52px)`,
                                      transformOrigin: 'center center',
                                    }}
                                  >
                                    {r.full_name.split(' ').pop()}
                                  </div>
                                );
                              })}
                            </div>

                            {/* Center PIN */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white border-4 border-on-surface flex items-center justify-center shadow-md z-20">
                              <div className="w-2 h-2 rounded-full bg-error animate-pulse" />
                            </div>
                          </div>

                          {/* Action buttons */}
                          <div className="w-full max-w-[200px] text-center">
                            <button
                              disabled={wheelSpinning || raisers.length === 0}
                              onClick={() => handleSpinWheel(raisers)}
                              className="w-full py-sm bg-primary text-on-primary font-black text-xs rounded-xl shadow-md active:scale-95 disabled:opacity-40 transition-all cursor-pointer hover:bg-primary/95 flex items-center justify-center gap-1"
                            >
                              <span className="material-symbols-outlined text-sm">settings_backup_restore</span>
                              {wheelSpinning ? 'Đang quay...' : 'QUAY NGẪU NHIÊN 🎯'}
                            </button>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Winner announcement and award button */}
                {selectedWinner && (
                  <div className="mt-md p-md bg-green-500/10 border border-green-500/30 rounded-2xl text-center space-y-sm animate-pop-in w-full">
                    <p className="text-xs text-green-700 font-bold uppercase tracking-wider">🎉 Chúc mừng người được chọn! 🎉</p>
                    <h4 className="text-md font-black text-on-surface">{selectedWinner.full_name}</h4>
                    <p className="text-[11px] text-on-surface-variant">Giơ tay nhanh thứ: <span className="font-bold text-primary">{getHandRaisers().findIndex(r => r.id === selectedWinner.id) + 1}</span> (⏱️ {getHandRaisers().find(r => r.id === selectedWinner.id)?.seconds.toFixed(2)}s)</p>
                    
                    <button
                      disabled={winnerBonusAwarded || saving}
                      onClick={handleAwardBonus}
                      className={`w-full py-sm font-bold text-xs rounded-xl transition-all shadow-sm ${
                        winnerBonusAwarded
                          ? 'bg-green-600 text-white cursor-default'
                          : 'bg-secondary text-on-secondary hover:bg-secondary/90 active:scale-95 cursor-pointer'
                      }`}
                    >
                      {winnerBonusAwarded ? '✅ Đã Cộng +10 Điểm Thưởng' : '🎁 Cộng +10 Điểm Thưởng Trả Lời'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {settings.currentWeek === 9 && customQuizQuestions.length > 0 && (
              <div className="space-y-md">
                <p className="text-[11px] text-on-surface-variant font-medium">Chỉnh sửa 3 câu hỏi trắc nghiệm của Mini Quiz:</p>
                {customQuizQuestions.map((qItem, qIdx) => (
                  <div key={qIdx} className="p-sm bg-surface-container-low rounded-xl border border-outline-variant/15 space-y-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-primary">Câu hỏi {qIdx + 1}</span>
                    </div>
                    <input
                      type="text"
                      value={qItem.q}
                      onChange={(e) => {
                        const next = [...customQuizQuestions];
                        next[qIdx] = { ...next[qIdx], q: e.target.value };
                        setCustomQuizQuestions(next);
                        saveGameContent(9, { quizQuestions: next });
                      }}
                      className="w-full px-md py-sm rounded-xl border border-outline-variant/40 text-xs focus:outline-none focus:border-primary bg-white"
                      placeholder="Nhập câu hỏi..."
                    />
                    <div className="grid grid-cols-2 gap-sm">
                      {qItem.opts.map((optVal: string, oIdx: number) => (
                        <div key={oIdx} className="space-y-xs">
                          <label className="text-[10px] text-on-surface-variant font-bold">Đáp án {String.fromCharCode(65 + oIdx)}:</label>
                          <input
                            type="text"
                            value={optVal}
                            onChange={(e) => {
                              const next = [...customQuizQuestions];
                              const nextOpts = [...next[qIdx].opts];
                              nextOpts[oIdx] = e.target.value;
                              next[qIdx] = { ...next[qIdx], opts: nextOpts };
                              setCustomQuizQuestions(next);
                              saveGameContent(9, { quizQuestions: next });
                            }}
                            className="w-full px-sm py-xs rounded-lg border border-outline-variant/40 text-[11px] focus:outline-none focus:border-primary bg-white"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-sm pt-xs border-t border-outline-variant/10">
                      <span className="text-[10px] font-bold text-on-surface-variant">Chọn đáp án đúng:</span>
                      <select
                        value={qItem.ans}
                        onChange={(e) => {
                          const next = [...customQuizQuestions];
                          next[qIdx] = { ...next[qIdx], ans: parseInt(e.target.value) };
                          setCustomQuizQuestions(next);
                          saveGameContent(9, { quizQuestions: next });
                        }}
                        className="text-[11px] border border-outline-variant/40 rounded-lg px-xs py-0.5 bg-white"
                      >
                        <option value={0}>Đáp án A</option>
                        <option value={1}>Đáp án B</option>
                        <option value={2}>Đáp án C</option>
                        <option value={3}>Đáp án D</option>
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Word Cloud Section ───────────────────────────────────────────── */}
        {mounted && students.some(s => s.student_input && !s.student_input.startsWith('Vòng quay:')) && (
          <section className="bg-white p-lg rounded-xxl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-outline-variant/15 mt-sm">
            <h3 className="text-sm font-bold text-on-surface mb-sm flex items-center gap-1">
              <span className="material-symbols-outlined text-[18px] text-primary">cloud</span>
              Từ khóa thảo luận nổi bật (Word Cloud)
            </h3>
            <p className="text-xs text-on-surface-variant mb-md">Tổng hợp từ khóa xuất hiện nhiều nhất trong câu trả lời của sinh viên tuần này.</p>
            
            <div className="flex flex-wrap items-center justify-center gap-sm bg-surface-container-low p-lg rounded-xl min-h-[120px]">
              {getWordCloudWords().map((word, wIdx) => {
                const size = word.count > 3 ? 'text-lg font-extrabold' : word.count > 1 ? 'text-sm font-bold' : 'text-xs font-semibold';
                const colors = ['text-primary', 'text-secondary', 'text-tertiary', 'text-error'];
                const colorClass = colors[wIdx % colors.length];
                
                return (
                  <span
                    key={word.text}
                    className={`px-3 py-1 bg-white rounded-full border border-outline-variant/10 shadow-sm transition-all duration-300 hover:scale-110 cursor-pointer ${size} ${colorClass}`}
                    title={`${word.count} lượt nhắc đến`}
                  >
                    {word.text}
                    <span className="text-[9px] opacity-60 ml-0.5">({word.count})</span>
                  </span>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Checked-in Students ──────────────────────────────────────────── */}
        <section className="animate-fade-in-up stagger-3">
          <div className="flex justify-between items-center mb-md">
            <h3 className="text-xl font-extrabold text-on-surface font-display-hero">Sinh viên đã điểm danh</h3>
            <div className="flex items-center gap-sm">
              {students.length > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={handleExportCSV}
                    className="px-sm py-xs rounded-lg font-bold text-xs bg-primary/10 text-primary hover:bg-primary/20 active:scale-95 transition-all border border-primary/20 flex items-center gap-0.5"
                    title="Xuất file báo cáo điểm danh Excel CSV"
                  >
                    <span className="material-symbols-outlined text-[14px]">download</span>
                    Xuất Excel
                  </button>
                  <button
                    onClick={handleResetAttendance}
                    className="px-sm py-xs rounded-lg font-bold text-xs bg-error/10 text-error hover:bg-error/20 active:scale-95 transition-all border border-error/20 flex items-center gap-0.5"
                    title="Đặt lại toàn bộ điểm danh tuần này"
                  >
                    <span className="material-symbols-outlined text-[14px]">restart_alt</span>
                    Đặt lại
                  </button>
                </div>
              )}
              <span className="bg-tertiary-container text-on-tertiary-container text-xs font-bold px-sm py-xs rounded-full">
                {students.length} người
              </span>
            </div>
          </div>

          {students.length === 0 ? (
            <div className="bg-surface-container rounded-2xl p-xl flex flex-col items-center gap-sm text-center">
              <span className="text-4xl">📋</span>
              <p className="text-sm font-semibold text-on-surface-variant">
                {mounted && settings.sessionOpen ? 'Chưa có sinh viên điểm danh tuần này.' : 'Mở buổi học để sinh viên điểm danh.'}
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] divide-y divide-surface-variant/30 border border-outline-variant/10 overflow-hidden">
              {students.map((s, i) => (
                <div key={s.id} className="flex items-center gap-md p-md hover:bg-surface-container-low transition-colors">
                  <span className="w-5 text-center text-xs font-bold text-on-surface-variant">{i + 1}</span>
                  <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-primary-fixed flex-shrink-0">
                    {s.avatar_url
                      ? <img src={s.avatar_url} alt={s.full_name} className="w-full h-full object-cover" />
                      : <div className="w-full h-full bg-primary-container flex items-center justify-center text-on-primary-container font-bold text-sm">{s.full_name[0]}</div>
                    }
                  </div>
                  <div className="flex-grow">
                    <p className="text-sm font-bold text-on-surface">{s.full_name}</p>
                    <p className="text-[11px] text-on-surface-variant">{s.game_name}</p>
                    {s.student_input && (
                      <p className="text-xs text-secondary mt-1 bg-surface-container-low px-2.5 py-1.5 rounded-lg border border-outline-variant/20 italic max-w-[320px] break-words">
                        " {s.student_input} "
                      </p>
                    )}
                  </div>
                  <span className="text-primary font-extrabold text-sm">+{s.points_earned} đ</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="pb-lg" />
      </main>

      {/* QR Code modal popup for Teacher */}
      {showQRModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-xxl w-full max-w-[400px] shadow-2xl border border-outline-variant/20 overflow-hidden animate-pop-in relative p-lg text-center space-y-lg">
            {/* Header */}
            <div className="flex justify-between items-center pb-md border-b border-outline-variant/20">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-2xl">qr_code_2</span>
                <h3 className="font-extrabold text-base text-on-surface">Mã QR Điểm Danh</h3>
              </div>
              <button onClick={() => setShowQRModal(false)} className="text-on-surface-variant hover:text-on-surface active:scale-90 transition-all">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* QR Content */}
            <div className="space-y-md flex flex-col items-center">
              <p className="text-sm font-semibold text-on-surface-variant">
                Sinh viên quét mã này để hoàn tất <span className="text-primary font-bold">Điểm danh cùng GV</span>
              </p>
              
              <div className="bg-white p-md rounded-2xl border border-outline-variant/40 shadow-lg">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=StitchHomeWeeklyAttendance_Teacher_CheckIn_Week_${settings.currentWeek}`}
                  alt="Teacher Attendance QR Code"
                  className="w-56 h-56 select-none"
                />
              </div>

              <div className="bg-primary-container/30 px-md py-sm rounded-xl border border-primary/20">
                <p className="text-xs font-bold text-primary">TUẦN HỌC: {settings.currentWeek}</p>
                <p className="text-[10px] text-on-surface-variant mt-0.5">Môn: {SUBJECT_NAME}</p>
              </div>
            </div>

            {/* Footer */}
            <button
              onClick={() => setShowQRModal(false)}
              className="w-full py-md bg-primary text-on-primary font-bold rounded-xl hover:bg-primary/95 transition-all active:scale-95 shadow-md"
            >
              Đóng cửa sổ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
