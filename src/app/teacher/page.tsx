'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, isMockEnabled, getTeacherSettings, saveTeacherSettings, SUBJECT_NAME, TOTAL_WEEKS, TEACHER_ID, DEFAULT_TEACHER_SETTINGS, ALL_GAMES } from '@/utils/supabase/client';
import type { TeacherSettings, Game } from '@/utils/supabase/client';

interface CheckedInStudent {
  id: string;
  full_name: string;
  avatar_url: string | null;
  points_earned: number;
  game_name: string;
  created_at: string;
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

  // Auth guard + load real settings after mount
  useEffect(() => {
    setMounted(true);
    setSettings(getTeacherSettings());
    supabase.auth.getUser().then(({ data: { user } }: { data: { user: any } }) => {
      if (!user) { router.push('/login'); return; }
      if (user.id !== TEACHER_ID) { router.push('/home'); }
    });
  }, []);

  // Load checked-in students for current week
  const loadStudents = useCallback(async () => {
    const s = getTeacherSettings();
    if (isMockEnabled) {
      const checkIns: any[] = JSON.parse(localStorage.getItem('mock_check_ins') || '[]');
      const profiles: any[] = JSON.parse(localStorage.getItem('mock_profiles') || '[]');
      const weekCheckIns = checkIns.filter((c: any) => c.week_number === s.currentWeek);
      const result: CheckedInStudent[] = weekCheckIns.map((c: any) => {
        const profile = profiles.find((p: any) => p.id === c.user_id);
        return {
          id: c.id,
          full_name: profile?.full_name || 'Sinh viên',
          avatar_url: profile?.avatar_url || null,
          points_earned: c.points_earned,
          game_name: c.game_name || 'Điểm danh',
          created_at: c.created_at,
        };
      });
      setStudents(result);
    } else {
      try {
        const { data, error } = await supabase
          .from('check_ins')
          .select(`
            id,
            points_earned,
            game_name,
            created_at,
            profiles (
              id,
              full_name,
              avatar_url
            )
          `)
          .eq('week_number', s.currentWeek);

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
            };
          });
          setStudents(result);
        }
      } catch (err) {
        console.error('Failed to load checked in students:', err);
      }
    }
  }, [supabase]);

  useEffect(() => {
    loadStudents();
    const interval = setInterval(loadStudents, 3000);
    return () => clearInterval(interval);
  }, [loadStudents]);

  // Persist and save
  const persist = (newSettings: TeacherSettings) => {
    setSettings(newSettings);
    saveTeacherSettings(newSettings);
    setSaving(true);
    setTimeout(() => { setSaving(false); setSavedMsg(true); setTimeout(() => setSavedMsg(false), 1500); }, 300);
  };

  const handleWeekChange = (week: number) => {
    persist({ ...settings, currentWeek: week, sessionOpen: false });
  };

  const toggleSession = () => {
    persist({ ...settings, sessionOpen: !settings.sessionOpen });
  };

  const toggleGame = (gameId: number) => {
    const games = settings.games.map(g => g.id === gameId ? { ...g, enabled: !g.enabled } : g);
    persist({ ...settings, games });
  };

  const moveGame = (gameId: number, direction: 'up' | 'down') => {
    const sorted = [...settings.games].sort((a, b) => a.order - b.order);
    const idx    = sorted.findIndex(g => g.id === gameId);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const newGames = sorted.map((g, i) => {
      if (i === idx)     return { ...g, order: sorted[swapIdx].order };
      if (i === swapIdx) return { ...g, order: sorted[idx].order };
      return g;
    });
    persist({ ...settings, games: newGames });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    document.cookie = 'mock_session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
    router.push('/login');
  };

  const sortedGames = [...settings.games].sort((a, b) => a.order - b.order);
  const enabledCount = settings.games.filter(g => g.enabled).length;

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
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1).map(w => (
                <button
                  key={w}
                  onClick={() => handleWeekChange(w)}
                  className={`w-9 h-9 rounded-full text-sm font-bold transition-all duration-200 active:scale-90 ${
                    settings.currentWeek === w
                      ? 'bg-white text-secondary shadow-md scale-110'
                      : 'bg-white/20 text-on-secondary-container hover:bg-white/35'
                  }`}
                >
                  {w}
                </button>
              ))}
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
              {settings.sessionOpen && (
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

        {/* ── Games Management ─────────────────────────────────────────────── */}
        <section className="animate-fade-in-up stagger-2">
          <div className="flex justify-between items-end mb-md">
            <div>
              <h3 className="text-xl font-extrabold text-on-surface font-display-hero">Trò chơi buổi học</h3>
              <p className="text-xs text-on-surface-variant font-medium mt-xs">Bật/tắt và sắp xếp thứ tự hiển thị cho sinh viên</p>
            </div>
            <span className="bg-primary-container text-on-primary-container text-xs font-bold px-sm py-xs rounded-full">
              {enabledCount}/{TOTAL_WEEKS} bật
            </span>
          </div>

          <div className="space-y-sm">
            {sortedGames.map((game, idx) => (
              <div
                key={game.id}
                className={`bg-white rounded-2xl border flex items-center gap-sm p-sm transition-all duration-300 ${
                  game.enabled
                    ? 'border-primary/10 shadow-[0_4px_12px_rgba(0,0,0,0.05)]'
                    : 'border-outline-variant/20 opacity-55'
                }`}
              >
                {/* Reorder arrows */}
                <div className="flex flex-col gap-0.5">
                  <button
                    onClick={() => moveGame(game.id, 'up')}
                    disabled={idx === 0}
                    className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-surface-container disabled:opacity-20 transition-colors active:scale-90"
                  >
                    <span className="material-symbols-outlined text-[16px] text-on-surface-variant">arrow_drop_up</span>
                  </button>
                  <button
                    onClick={() => moveGame(game.id, 'down')}
                    disabled={idx === sortedGames.length - 1}
                    className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-surface-container disabled:opacity-20 transition-colors active:scale-90"
                  >
                    <span className="material-symbols-outlined text-[16px] text-on-surface-variant">arrow_drop_down</span>
                  </button>
                </div>

                {/* Icon */}
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${game.colorClass}`}>
                  {game.icon}
                </div>

                {/* Info */}
                <div className="flex-grow min-w-0">
                  <div className="flex items-center gap-xs">
                    <p className="text-sm font-bold text-on-surface truncate">{game.name}</p>
                    <span className="flex-shrink-0 text-[10px] font-extrabold bg-surface-container text-on-surface-variant px-1.5 py-0.5 rounded-md">+{game.points}</span>
                  </div>
                  <p className="text-[11px] text-on-surface-variant truncate">{game.description}</p>
                </div>

                {/* Toggle switch */}
                <button
                  onClick={() => toggleGame(game.id)}
                  className={`flex-shrink-0 w-12 h-6 rounded-full relative transition-colors duration-300 ${game.enabled ? 'bg-primary' : 'bg-outline-variant/40'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all duration-300 ${game.enabled ? 'left-[26px]' : 'left-0.5'}`} />
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* ── Checked-in Students ──────────────────────────────────────────── */}
        <section className="animate-fade-in-up stagger-3">
          <div className="flex justify-between items-center mb-md">
            <h3 className="text-xl font-extrabold text-on-surface font-display-hero">Sinh viên đã điểm danh</h3>
            <span className="bg-tertiary-container text-on-tertiary-container text-xs font-bold px-sm py-xs rounded-full">
              {students.length} người
            </span>
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
