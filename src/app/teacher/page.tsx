'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, isMockEnabled, isUserTeacher, getTeacherSettings, saveTeacherSettings, SUBJECT_NAME, TOTAL_WEEKS, TEACHER_ID, DEFAULT_TEACHER_SETTINGS, ALL_GAMES } from '@/utils/supabase/client';
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
            };
          });
          setStudents(result);
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

        {/* ── Active Week Game Info ────────────────────────────────────────── */}
        <section className="animate-fade-in-up stagger-2 bg-surface-container-low border border-outline-variant/30 p-md rounded-xxl shadow-sm">
          <div className="flex justify-between items-center mb-sm">
            <h3 className="text-sm font-bold text-on-surface-variant uppercase tracking-wider">Trò chơi Tuần {settings.currentWeek}</h3>
            <span className="bg-primary-container text-on-primary-container text-[11px] font-bold px-2 py-0.5 rounded-full">
              Cố định
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
