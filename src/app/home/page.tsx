'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import GameModal from '@/components/games/GameModal';
import { createClient, isMockEnabled, getTeacherSettings, SUBJECT_NAME, TOTAL_WEEKS, DEFAULT_TEACHER_SETTINGS, ALL_GAMES } from '@/utils/supabase/client';
import type { TeacherSettings, Game } from '@/utils/supabase/client';

export default function HomePage() {
  const router   = useRouter();
  const supabase = createClient();

  const [userId,         setUserId]         = useState<string | null>(null);
  const [selectedWeek,   setSelectedWeek]   = useState<number | null>(null);
  const [checkedIn,      setCheckedIn]      = useState(false);
  const [streak,         setStreak]         = useState(0);
  const [loading,        setLoading]        = useState(false);
  const [showModal,      setShowModal]      = useState(false);
  const [lastPoints,     setLastPoints]     = useState(10);
  const [lastGame,       setLastGame]       = useState('Điểm danh');
  const [activeGame,     setActiveGame]     = useState<any>(null);
  // Safe default — localStorage only loaded after mount to avoid SSR mismatch
  const [teacherSettings, setTeacherSettings] = useState<TeacherSettings>({ ...DEFAULT_TEACHER_SETTINGS, games: ALL_GAMES.map(g => ({ ...g })) });

  const activeWeek = selectedWeek ?? teacherSettings.currentWeek;

  // ── Sync teacher settings ─────────────────────────────────────────
  const refreshSettings = useCallback(async () => {
    if (isMockEnabled) {
      setTeacherSettings(getTeacherSettings());
    } else {
      try {
        const { data, error } = await supabase
          .from('teacher_settings')
          .select('*')
          .eq('id', 1)
          .single();
        if (error) throw error;
        if (data) {
          setTeacherSettings({
            currentWeek: data.current_week,
            sessionOpen: data.session_open,
            games: ALL_GAMES.map(g => ({ ...g })),
          });
        }
      } catch (err) {
        console.error('Failed to sync settings from Supabase:', err);
      }
    }
  }, [supabase]);

  useEffect(() => {
    refreshSettings();
    const interval = setInterval(refreshSettings, 3000);
    window.addEventListener('teacher-settings-changed', refreshSettings);

    // Setup Supabase Realtime Subscription if not in mock mode
    let channel: any = null;
    if (!isMockEnabled) {
      channel = supabase
        .channel('teacher-settings-changes')
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'teacher_settings', filter: 'id=eq.1' },
          (payload: any) => {
            const data = payload.new;
            setTeacherSettings({
              currentWeek: data.current_week,
              sessionOpen: data.session_open,
              games: ALL_GAMES.map(g => ({ ...g })),
            });
          }
        )
        .subscribe();
    }

    return () => {
      clearInterval(interval);
      window.removeEventListener('teacher-settings-changed', refreshSettings);
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [refreshSettings, supabase]);

  // ── Auth + initial state + check-in update on activeWeek change ────────────────
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        document.cookie = 'mock_session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        router.push('/login');
        return;
      }
      setUserId(user.id);

      const { data: profile } = await supabase.from('profiles').select('streak').eq('id', user.id).single();
      if (profile) setStreak(profile.streak);

      const { data: cis } = await supabase.from('check_ins').select('*').eq('user_id', user.id).eq('week_number', activeWeek);
      setCheckedIn(!!(cis && cis.length > 0));
    }
    init();
  }, [activeWeek, userId]);

  // ── Check-in handler ───────────────────────────────────────────────────────
  const handleCheckIn = async (game?: Game, earnedPts?: number) => {
    if (loading || !teacherSettings.sessionOpen) return;
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const pts      = earnedPts ?? game?.points ?? 10;
      const gameName = game?.name  ?? 'Đã điểm danh lớp học';
      const record   = {
        user_id: user.id,
        subject: SUBJECT_NAME,
        game_name: gameName,
        points_earned: pts,
        week_number: activeWeek,
        is_bonus: (pts >= 50),
      };

      const { error } = await supabase.from('check_ins').insert(record);
      if (error) throw error;

      setCheckedIn(true);
      setStreak(prev => prev + 1);
      setLastPoints(pts);
      setLastGame(gameName);
      setShowModal(true);
    } catch (err) {
      console.error('Check-in failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const activeGameForWeek = ALL_GAMES.find(g => g.id === activeWeek);
  const enabledGames     = activeGameForWeek ? [activeGameForWeek] : [];
  const { sessionOpen }  = teacherSettings;

  // ── Colour helpers ──────────────────────────────────────────────────────────
  const pointsBadgeColor = (pts: number) => {
    if (pts >= 50) return 'bg-secondary-container text-on-secondary-container';
    if (pts >= 15) return 'bg-primary-container text-on-primary-container';
    return 'bg-tertiary-container text-on-tertiary-container';
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-on-background pb-32">
      <Header />

      <main className="flex-grow w-full max-w-[600px] mx-auto px-container-margin py-lg">

        {/* ── Hero Section ──────────────────────────────────────────────────── */}
        <section className="animate-fade-in-up bg-primary p-lg rounded-xxl text-on-primary mb-xl relative overflow-hidden shadow-xl">
          <div className="absolute -right-8 -top-8 w-32 h-32 bg-primary-container opacity-20 rounded-full blur-2xl" />
          <div className="relative z-10">
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-xs">Đang học</p>
            <h2 className="text-xl font-extrabold font-display-hero mb-md leading-snug">{SUBJECT_NAME}</h2>

            <div className="flex justify-between items-end mb-sm">
              <span className="text-sm font-bold">Tuần {activeWeek} / {TOTAL_WEEKS}</span>
              <span className="float-badge text-xs font-semibold bg-white/20 px-sm py-xs rounded-full flex items-center gap-1">
                <span className="inline-block animate-bounce">🔥</span> Chuỗi {streak} ngày
              </span>
            </div>

            {/* 16-week progress pills */}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-2">
              {Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1).map(w => {
                let cls = 'bg-white/20';
                if (w < activeWeek || (w === activeWeek && checkedIn)) cls = 'bg-tertiary-fixed shadow-sm';
                else if (w === activeWeek && !checkedIn) cls = 'shimmer-pill ring-4 ring-white/30';
                const isSelected = w === activeWeek;
                return (
                  <button
                    key={w}
                    onClick={() => setSelectedWeek(w)}
                    className={`flex-shrink-0 h-3.5 rounded-full transition-all duration-300 cursor-pointer ${
                      isSelected ? 'w-12 ring-2 ring-white' : 'w-8'
                    } ${cls}`}
                    title={`Tuần ${w}`}
                  />
                );
              })}
            </div>
            <p className="text-[10px] opacity-75 mt-xs text-center font-medium italic">💡 Nhấp vào các thanh kén ở trên để chuyển đổi nhanh giữa 16 tuần</p>
          </div>
        </section>

        {/* ── Games Section ─────────────────────────────────────────────────── */}
        <section className="mb-lg">
          <div className="flex justify-between items-center mb-md">
            <h3 className="text-xl font-extrabold text-on-surface font-display-hero tracking-tight">
              Thử thách tuần {activeWeek}
            </h3>
            <div
              onClick={() => router.push('/leaderboard')}
              className="text-primary text-sm font-bold flex items-center interactive-scale cursor-pointer hover:underline"
            >
              Bảng xếp hạng
              <span className="material-symbols-outlined text-[18px] ml-xs">chevron_right</span>
            </div>
          </div>

          {/* Session closed state */}
          {!sessionOpen ? (
            <div className="flex flex-col items-center justify-center py-10 bg-surface-container rounded-2xl border-2 border-dashed border-outline-variant/30 text-center animate-fade-in-up">
              <span className="text-5xl mb-md">🔒</span>
              <h4 className="font-extrabold text-on-surface text-base mb-xs">Buổi học chưa mở</h4>
              <p className="text-sm text-on-surface-variant font-medium">Giảng viên chưa mở buổi điểm danh tuần {activeWeek}.<br />Vui lòng chờ giảng viên bắt đầu.</p>
            </div>
          ) : enabledGames.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 bg-surface-container rounded-2xl border border-outline-variant/20 text-center">
              <span className="text-4xl mb-md">📋</span>
              <p className="text-sm text-on-surface-variant font-medium">Giảng viên chưa thêm trò chơi cho buổi này.</p>
            </div>
          ) : (
              <div className="space-y-gutter">
              {enabledGames.map((game, idx) => (
                <div
                  key={game.id}
                  onClick={() => setActiveGame(game)}
                  className="animate-fade-in-up bg-white p-md rounded-xxl flex items-center gap-md border border-outline-variant/20 shadow-[0_4px_16px_rgba(0,0,0,0.03)] transition-all duration-200 active:scale-95 hover:shadow-md cursor-pointer"
                  style={{ animationDelay: `${0.05 * idx}s` }}
                >
                  <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-[28px] select-none ${game.colorClass}`}>
                    {game.icon}
                  </div>
                  <div className="flex-grow">
                    <div className="flex justify-between items-start">
                      <h4 className="text-[14px] font-bold text-on-surface font-label-bold">{game.name}</h4>
                      <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-lg ${pointsBadgeColor(game.points)}`}>
                        +{game.points} điểm
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant mt-xs leading-tight font-medium">{game.description}</p>
                  </div>
                  <span className="material-symbols-outlined text-primary text-[20px] opacity-60">play_circle</span>
                </div>
              ))}
              </div>
          )}
        </section>

        {/* ── CTA Button ───────────────────────────────────────────────────── */}
        <div className="animate-fade-in-up stagger-4 mt-xl flex flex-col items-center">
          <button
            onClick={() => handleCheckIn(enabledGames[0])}
            disabled={checkedIn || loading || !sessionOpen}
            className={`w-full py-lg font-bold font-headline-md text-lg rounded-xxl transition-all duration-300 active:scale-95 flex items-center justify-center gap-sm group relative overflow-hidden shadow-lg border ${
              checkedIn
                ? 'bg-surface-container-high text-on-surface-variant/50 cursor-default shadow-none border-outline-variant/20'
                : !sessionOpen
                ? 'bg-surface-container text-on-surface-variant/40 cursor-not-allowed border-outline-variant/20'
                : 'bg-primary text-on-primary hover:bg-primary/95 cta-pulse border-primary/10'
            }`}
          >
            {loading ? (
              <span className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : checkedIn ? (
              <>
                <span className="material-symbols-outlined text-tertiary" style={{ fontVariationSettings: "'FILL' 1" }}>task_alt</span>
                Đã Điểm Danh Thành Công
              </>
            ) : !sessionOpen ? (
              <>
                <span className="material-symbols-outlined">lock</span>
                Chờ Giảng Viên Mở Buổi
              </>
            ) : (
              <>
                <span className="material-symbols-outlined group-active:rotate-45 transition-transform">location_on</span>
                Điểm Danh Ngay
              </>
            )}
          </button>
          {!checkedIn && sessionOpen && (
            <p className="text-xs text-on-surface-variant mt-md font-semibold">Yêu cầu bật kết nối Bluetooth &amp; Vị trí</p>
          )}
        </div>
      </main>

      {/* ── Success Modal ─────────────────────────────────────────────────── */}
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur-sm p-container-margin">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xxl p-lg w-full max-w-[450px] shadow-2xl text-center overflow-hidden animate-pop-in relative">
            <div className="absolute top-4 left-4 text-2xl animate-bounce" style={{ animationDelay: '0.1s' }}>🎉</div>
            <div className="absolute top-8 right-8 text-2xl animate-bounce" style={{ animationDelay: '0.4s' }}>✨</div>
            <div className="absolute bottom-12 left-10 text-2xl animate-bounce" style={{ animationDelay: '0.2s' }}>⭐</div>
            <div className="absolute bottom-8 right-6 text-2xl animate-bounce" style={{ animationDelay: '0.5s' }}>🔥</div>

            <div className="w-20 h-20 bg-tertiary-container/25 text-tertiary rounded-full mx-auto flex items-center justify-center mb-md mt-sm shadow-md animate-float">
              <span className="material-symbols-outlined text-[48px]" style={{ fontVariationSettings: "'FILL' 1" }}>stars</span>
            </div>

            <h3 className="text-2xl font-bold font-display-hero text-primary tracking-tight">Đã Hoàn Thành!</h3>
            <p className="text-on-surface font-semibold mt-xs text-sm">{lastGame}</p>
            <p className="text-on-surface-variant text-xs">{SUBJECT_NAME} • Tuần {activeWeek}</p>

            <div className="my-lg space-y-md bg-surface-container-low p-md rounded-xl border border-outline-variant/20">
              <div className="flex justify-between items-center px-sm">
                <span className="text-sm font-bold text-on-surface-variant">Điểm Nhận Được</span>
                <span className="bg-primary-container text-on-primary-container font-extrabold px-3 py-1 rounded-full text-sm">+{lastPoints} ĐIỂM ⭐</span>
              </div>
              <hr className="border-outline-variant/30" />
              <div className="flex justify-between items-center px-sm">
                <span className="text-sm font-bold text-on-surface-variant">Chuỗi Liên Tục</span>
                <span className="bg-secondary-container text-on-secondary-container font-extrabold px-3 py-1 rounded-full text-sm">🔥 {streak} Ngày</span>
              </div>
            </div>

            <button
              onClick={() => { setShowModal(false); router.refresh(); }}
              className="w-full py-sm bg-primary text-on-primary font-bold rounded-xl hover:bg-primary/90 transition-all active:scale-95 shadow-md"
            >
              Tuyệt vời! Tiếp tục nào 🚀
            </button>
          </div>
        </div>
      )}

      {activeGame && (
        <GameModal
          game={activeGame}
          weekNumber={activeWeek}
          streak={streak}
          onComplete={(earnedPts) => {
            setActiveGame(null);
            handleCheckIn(activeGame, earnedPts);
          }}
          onClose={() => setActiveGame(null)}
        />
      )}

      <BottomNav />
    </div>
  );
}
