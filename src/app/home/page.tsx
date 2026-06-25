'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import GameModal from '@/components/games/GameModal';
import OnboardingTour from '@/components/OnboardingTour';
import { createClient, isMockEnabled, getTeacherSettings, SUBJECT_NAME, TOTAL_WEEKS, DEFAULT_TEACHER_SETTINGS, ALL_GAMES, isUserTeacher } from '@/utils/supabase/client';
import type { TeacherSettings, Game } from '@/utils/supabase/client';

export default function HomePage() {
  const router   = useRouter();
  const supabase = createClient();

  const [userId,         setUserId]         = useState<string | null>(null);
  const [selectedWeek,   setSelectedWeek]   = useState<number | null>(null);
  const [checkedIn,      setCheckedIn]      = useState(false);
  const [checkedInWeeks, setCheckedInWeeks] = useState<Set<number>>(new Set());
  const [streak,         setStreak]         = useState(0);
  const [loading,        setLoading]        = useState(false);
  const [showModal,      setShowModal]      = useState(false);
  const [lastPoints,     setLastPoints]     = useState(10);
  const [lastGame,       setLastGame]       = useState('Điểm danh');
  const [activeGame,     setActiveGame]     = useState<any>(null);
  // Safe default — localStorage only loaded after mount to avoid SSR mismatch
  const [teacherSettings, setTeacherSettings] = useState<TeacherSettings>({ ...DEFAULT_TEACHER_SETTINGS, games: ALL_GAMES.map(g => ({ ...g })) });
  const [showTour, setShowTour] = useState(false);

  // GPS verification states
  const [gpsVerified, setGpsVerified] = useState(false);
  const [checkingGps, setCheckingGps] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [showGpsModal, setShowGpsModal] = useState(false);
  const [pendingAction, setPendingAction] = useState<{ type: 'game' | 'direct', game?: Game } | null>(null);

  // Lucky Spin states
  const [showSpinModal, setShowSpinModal] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [spinResult, setSpinResult] = useState<number | null>(null);
  const [rotation, setRotation] = useState(0);
  const [pendingCheckInData, setPendingCheckInData] = useState<{ game?: Game, earnedPts?: number, studentInput?: string } | null>(null);

  const SPIN_OPTIONS = [5, 10, 15, 20, 50, 100];

  const handleStartSpin = () => {
    if (spinning) return;
    setSpinning(true);

    // Choose a random option index based on attendance and streak
    // Higher attendance (checkedInWeeks.size) or higher streak increases the chance of higher points
    const S = checkedInWeeks.size + streak;
    const baseWeights = [40, 30, 15, 10, 4, 1]; // Weights for segment indexes: 0 (+5đ), 1 (+10đ), 2 (+15đ), 3 (+20đ), 4 (+50đ), 5 (+100đ)
    const weights = baseWeights.map((w, idx) => w + S * idx * 1.5);
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    
    let randomNum = Math.random() * totalWeight;
    let randomIndex = 0;
    for (let i = 0; i < weights.length; i++) {
      if (randomNum < weights[i]) {
        randomIndex = i;
        break;
      }
      randomNum -= weights[i];
    }
    
    const chosenValue = SPIN_OPTIONS[randomIndex];
    
    // Calculate rotation: 5 full spins (1800 deg) + offset for the index
    // Each segment is 60 deg, centered at (index * 60 + 30) deg.
    // To make it land at the top pointer (0 deg), the rotation should be:
    const targetAngle = 1800 + (360 - (randomIndex * 60 + 30));
    
    setRotation(targetAngle);
    
    setTimeout(() => {
      setSpinning(false);
      setSpinResult(chosenValue);
      
      // Proceed with check-in after a short delay
      setTimeout(() => {
        setShowSpinModal(false);
        if (pendingCheckInData) {
          const finalPts = (pendingCheckInData.earnedPts || pendingCheckInData.game?.points || 10) + chosenValue;
          const finalInput = pendingCheckInData.studentInput 
            ? `${pendingCheckInData.studentInput} | Vòng quay: +${chosenValue}đ`
            : `Vòng quay: +${chosenValue}đ`;
          
          executeCheckIn(pendingCheckInData.game, finalPts, finalInput);
          setPendingCheckInData(null);
        }
      }, 1500);
    }, 3000);
  };

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

      const { data: allCis } = await supabase.from('check_ins').select('week_number').eq('user_id', user.id);
      if (allCis) {
        setCheckedInWeeks(new Set(allCis.map((c: any) => c.week_number)));
        setCheckedIn(allCis.some((c: any) => c.week_number === activeWeek));
      } else {
        setCheckedIn(false);
      }

      // Check onboarding tour
      const isTeacher = isUserTeacher(user);
      if (!isTeacher) {
        const onboardingCompleted = localStorage.getItem('attendance_hero_onboarding_completed');
        if (onboardingCompleted !== 'true') {
          setShowTour(true);
        }
      }
    }
    init();
  }, [activeWeek, userId]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.location.search.includes('startTour=true')) {
        setShowTour(true);
        const newUrl = window.location.pathname;
        window.history.replaceState({ path: newUrl }, '', newUrl);
      }

      const handleStartTourEvent = () => setShowTour(true);
      window.addEventListener('start-onboarding-tour', handleStartTourEvent);
      return () => window.removeEventListener('start-onboarding-tour', handleStartTourEvent);
    }
  }, []);

  // ── GPS Geolocation helpers ────────────────────────────────────────────────
  const HUST_COORDS = { lat: 21.0064, lng: 105.8431 };
  const MAX_DISTANCE_METERS = 500; // 500m radius

  const getDistanceInMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // metres
    const phi1 = lat1 * Math.PI/180;
    const phi2 = lat2 * Math.PI/180;
    const deltaPhi = (lat2-lat1) * Math.PI/180;
    const deltaLambda = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(deltaPhi/2) * Math.sin(deltaPhi/2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda/2) * Math.sin(deltaLambda/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // in metres
  };

  const handleGpsSuccess = (lat: number, lng: number) => {
    const dist = getDistanceInMeters(lat, lng, HUST_COORDS.lat, HUST_COORDS.lng);
    if (dist <= MAX_DISTANCE_METERS) {
      setGpsVerified(true);
      setGpsError(null);
      
      // Auto close and trigger pending action after 1s
      setTimeout(() => {
        setShowGpsModal(false);
        if (pendingAction) {
          if (pendingAction.type === 'game' && pendingAction.game) {
            setActiveGame(pendingAction.game);
          } else if (pendingAction.type === 'direct') {
            handleCheckIn();
          }
          setPendingAction(null);
        }
      }, 1000);
    } else {
      setGpsError(`Cách ĐH Bách Khoa ${(dist / 1000).toFixed(2)} km. Vui lòng di chuyển vào khuôn viên trường (bán kính 500m) để điểm danh.`);
    }
  };

  const handleRealGpsVerification = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setGpsError('Trình duyệt của bạn không hỗ trợ định vị GPS.');
      return;
    }

    setCheckingGps(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCheckingGps(false);
        const { latitude, longitude } = position.coords;
        handleGpsSuccess(latitude, longitude);
      },
      (error) => {
        setCheckingGps(false);
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setGpsError('Quyền truy cập vị trí bị từ chối. Vui lòng bật GPS trên thiết bị.');
            break;
          case error.POSITION_UNAVAILABLE:
            setGpsError('Không thể xác định vị trí. Vui lòng thử lại.');
            break;
          case error.TIMEOUT:
            setGpsError('Hết thời gian yêu cầu vị trí. Vui lòng thử lại.');
            break;
          default:
            setGpsError('Đã xảy ra lỗi khi lấy vị trí.');
        }
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleMockGpsVerification = () => {
    setCheckingGps(true);
    setGpsError(null);

    setTimeout(() => {
      setCheckingGps(false);
      handleGpsSuccess(HUST_COORDS.lat, HUST_COORDS.lng);
    }, 800);
  };

  // ── Check-in handler ───────────────────────────────────────────────────────
  const isCurrentWeek = activeWeek === teacherSettings.currentWeek;
  const isSessionOpenForSelectedWeek = isCurrentWeek && teacherSettings.sessionOpen;

  const handleCheckIn = async (game?: Game, earnedPts?: number, studentInput?: string) => {
    if (loading || !isSessionOpenForSelectedWeek) return;
    setPendingCheckInData({ game, earnedPts, studentInput });
    setSpinResult(null);
    setRotation(0);
    setShowSpinModal(true);
  };

  const executeCheckIn = async (game?: Game, earnedPts?: number, studentInput?: string) => {
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
        student_input: studentInput || null,
      };

      const { error } = await supabase.from('check_ins').insert(record);
      if (error) throw error;

      setCheckedIn(true);
      setCheckedInWeeks(prev => {
        const next = new Set(prev);
        next.add(activeWeek);
        return next;
      });
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

            {/* GPS verification card */}
            {isSessionOpenForSelectedWeek && !checkedIn && (
              <div className="mt-md flex items-center justify-between bg-white/10 rounded-xl px-md py-sm border border-white/5 backdrop-blur-sm">
                <div className="flex items-center gap-xs">
                  <span className="material-symbols-outlined text-[18px]">
                    {gpsVerified ? 'location_on' : 'location_off'}
                  </span>
                  <span className="text-[11px] font-semibold">
                    {gpsVerified ? 'Đã xác minh vị trí tại ĐH Bách Khoa HN' : 'Chưa xác minh vị trí lớp học'}
                  </span>
                </div>
                {!gpsVerified && (
                  <button
                    onClick={() => {
                      setPendingAction(null);
                      setShowGpsModal(true);
                    }}
                    className="bg-white text-primary text-[10px] font-bold px-3 py-1.5 rounded-lg shadow hover:bg-white/95 active:scale-95 transition-all flex items-center gap-0.5"
                  >
                    <span className="material-symbols-outlined text-[12px]">my_location</span>
                    Xác minh
                  </button>
                )}
              </div>
            )}

            {/* 16-week progress circles */}
            <div className="flex gap-2.5 overflow-x-auto no-scrollbar py-3 items-center">
              {Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1).map(w => {
                const isChecked = checkedInWeeks.has(w);
                const isSelected = w === activeWeek;
                const isCurrent = w === teacherSettings.currentWeek;

                let cls = '';
                if (isChecked) {
                  cls = 'bg-tertiary-fixed text-on-tertiary-fixed shadow-sm';
                } else if (isCurrent) {
                  cls = 'shimmer-pill ring-4 ring-white/30 text-white';
                } else {
                  cls = 'bg-white/10 text-white/50 border border-white/5';
                }

                return (
                  <button
                    key={w}
                    onClick={() => setSelectedWeek(w)}
                    className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 cursor-pointer ${
                      isSelected ? 'ring-2 ring-white scale-110 shadow-md' : 'opacity-80 hover:opacity-100'
                    } ${cls}`}
                    title={`Tuần ${w}`}
                  >
                    {isChecked ? '✓' : w}
                  </button>
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
          {!isSessionOpenForSelectedWeek ? (
            <div className="flex flex-col items-center justify-center py-10 bg-surface-container rounded-2xl border-2 border-dashed border-outline-variant/30 text-center animate-fade-in-up">
              <span className="text-5xl mb-md">{activeWeek < teacherSettings.currentWeek ? '⏰' : '🔒'}</span>
              <h4 className="font-extrabold text-on-surface text-base mb-xs">
                {activeWeek < teacherSettings.currentWeek ? 'Buổi học đã kết thúc' : 'Buổi học chưa mở'}
              </h4>
              <p className="text-sm text-on-surface-variant font-medium">
                {activeWeek < teacherSettings.currentWeek
                  ? `Thời gian điểm danh cho tuần ${activeWeek} đã hết hạn.`
                  : `Giảng viên chưa mở buổi điểm danh tuần ${activeWeek}. Vui lòng chờ giảng viên bắt đầu.`}
              </p>
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
                  onClick={() => {
                    if (checkedIn) return;
                    if (!gpsVerified) {
                      setPendingAction({ type: 'game', game });
                      setShowGpsModal(true);
                    } else {
                      setActiveGame(game);
                    }
                  }}
                  className={`animate-fade-in-up bg-white p-md rounded-xxl flex items-center gap-md border border-outline-variant/20 shadow-[0_4px_16px_rgba(0,0,0,0.03)] transition-all duration-200 ${
                    checkedIn
                      ? 'opacity-60 cursor-default'
                      : 'active:scale-95 hover:shadow-md cursor-pointer'
                  }`}
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
                  {checkedIn ? (
                    <span className="material-symbols-outlined text-success text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>task_alt</span>
                  ) : (
                    <span className="material-symbols-outlined text-primary text-[20px] opacity-60">play_circle</span>
                  )}
                </div>
              ))}
              </div>
          )}
        </section>

        {/* ── CTA Button ───────────────────────────────────────────────────── */}
        <div className="animate-fade-in-up stagger-4 mt-xl flex flex-col items-center">
          <button
            onClick={() => {
              if (!gpsVerified) {
                setPendingAction({ type: enabledGames.length > 0 ? 'game' : 'direct', game: enabledGames[0] });
                setShowGpsModal(true);
              } else {
                if (enabledGames.length > 0) {
                  setActiveGame(enabledGames[0]);
                } else {
                  handleCheckIn();
                }
              }
            }}
            disabled={checkedIn || loading || !isSessionOpenForSelectedWeek}
            className={`w-full py-lg font-bold font-headline-md text-lg rounded-xxl transition-all duration-300 active:scale-95 flex items-center justify-center gap-sm group relative overflow-hidden shadow-lg border ${
              checkedIn
                ? 'bg-surface-container-high text-on-surface-variant/50 cursor-default shadow-none border-outline-variant/20'
                : !isSessionOpenForSelectedWeek
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
            ) : !isSessionOpenForSelectedWeek ? (
              <>
                <span className="material-symbols-outlined">{activeWeek < teacherSettings.currentWeek ? 'timer_off' : 'lock'}</span>
                {activeWeek < teacherSettings.currentWeek ? 'Đã Hết Hạn Điểm Danh' : 'Chờ Giảng Viên Mở Buổi'}
              </>
            ) : (
              <>
                <span className="material-symbols-outlined group-active:rotate-45 transition-transform">location_on</span>
                Điểm Danh Ngay
              </>
            )}
          </button>
          {!checkedIn && isSessionOpenForSelectedWeek && (
            <p className="text-xs text-on-surface-variant mt-md font-semibold flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">info</span>
              Yêu cầu bật GPS &amp; xác minh vị trí tại Bách Khoa
            </p>
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
          onComplete={(earnedPts, studentInput) => {
            setActiveGame(null);
            handleCheckIn(activeGame, earnedPts, studentInput);
          }}
          onClose={() => setActiveGame(null)}
        />
      )}

      {/* ── GPS Verification Modal ────────────────────────────────────────── */}
      {showGpsModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/60 backdrop-blur-sm p-container-margin">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xxl p-lg w-full max-w-[420px] shadow-2xl text-center overflow-hidden animate-pop-in relative">
            
            {/* Pulsing map pin icon */}
            <div className="w-16 h-16 bg-primary/10 text-primary rounded-full mx-auto flex items-center justify-center mb-md mt-sm shadow-inner cta-pulse">
              <span className="material-symbols-outlined text-[36px]" style={{ fontVariationSettings: "'FILL' 1" }}>location_on</span>
            </div>

            <h3 className="text-xl font-extrabold text-on-surface font-display-hero tracking-tight">Xác Minh Vị Trí Lớp Học</h3>
            <p className="text-xs text-on-surface-variant font-medium mt-xs leading-relaxed">
              Hệ thống yêu cầu bạn bật GPS và xác định đúng vị trí tại <span className="font-bold text-primary">Đại học Bách Khoa Hà Nội</span> (1 Đại Cồ Việt) để tham gia thử thách điểm danh.
            </p>

            {/* GPS coordinates & errors log */}
            <div className="my-md p-md rounded-xl bg-surface-container-low border border-outline-variant/20 text-left space-y-sm">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-on-surface-variant">Tọa độ yêu cầu:</span>
                <span className="font-mono text-on-surface font-semibold">21.0064, 105.8431</span>
              </div>
              
              {checkingGps && (
                <div className="flex items-center gap-xs text-xs text-primary font-bold animate-pulse">
                  <span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  Đang lấy tọa độ thực tế từ trình duyệt...
                </div>
              )}

              {gpsError && (
                <div className="text-xs text-error font-semibold leading-tight bg-error-container/10 p-sm rounded border border-error/20">
                  ⚠️ {gpsError}
                </div>
              )}
              
              {gpsVerified && (
                <div className="text-xs text-success font-bold leading-tight bg-tertiary-container/10 p-sm rounded border border-tertiary/20 flex items-center gap-xs">
                  <span className="material-symbols-outlined text-[16px]">task_alt</span>
                  Xác minh thành công! Vị trí của bạn hợp lệ.
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="space-y-sm">
              <button
                onClick={handleRealGpsVerification}
                disabled={checkingGps || gpsVerified}
                className="w-full py-md bg-primary text-on-primary font-bold rounded-xl hover:bg-primary/95 transition-all active:scale-95 shadow-md flex items-center justify-center gap-xs disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">my_location</span>
                Xác minh GPS thực tế
              </button>
              
              <button
                onClick={handleMockGpsVerification}
                disabled={checkingGps || gpsVerified}
                className="w-full py-md bg-secondary-container text-on-secondary-container font-bold rounded-xl hover:bg-secondary-container/90 transition-all active:scale-95 border border-outline-variant/10 flex items-center justify-center gap-xs disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">cell_tower</span>
                Giả lập vị trí tại Bách Khoa (Demo)
              </button>

              <button
                onClick={() => { setShowGpsModal(false); setGpsError(null); }}
                disabled={checkingGps}
                className="w-full py-sm text-on-surface-variant hover:text-on-surface font-bold rounded-xl text-sm transition-all active:scale-95"
              >
                Hủy bỏ
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── Lucky Spin Wheel Modal ────────────────────────────────────────── */}
      {showSpinModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-black/75 backdrop-blur-sm p-container-margin">
          <div className="bg-surface-container-lowest border border-outline-variant/30 rounded-xxl p-lg w-full max-w-[420px] shadow-2xl text-center overflow-hidden animate-pop-in relative">
            
            <h3 className="text-xl font-extrabold text-primary font-display-hero tracking-tight">Vòng Quay May Mắn! 🎡</h3>
            <p className="text-xs text-on-surface-variant font-medium mt-xs">
              Điểm danh thành công! Hãy quay vòng quay để nhận thêm điểm thưởng ngẫu nhiên.
            </p>

            {/* The Wheel */}
            <div className="relative my-lg flex justify-center items-center">
              {/* Selector arrow */}
              <div className="absolute -top-4 z-10 w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-t-[25px] border-t-error filter drop-shadow"></div>
              
              <div
                className="w-56 h-56 rounded-full border-4 border-primary relative overflow-hidden shadow-xl transition-transform ease-out duration-[3000ms]"
                style={{
                  transform: `rotate(${rotation}deg)`,
                  background: 'conic-gradient(#ff8a80 0deg 60deg, #ff80ab 60deg 120deg, #ea80fc 120deg 180deg, #b388ff 180deg 240deg, #8c9eff 240deg 300deg, #ffd180 300deg 360deg)'
                }}
              >
                {SPIN_OPTIONS.map((val, idx) => {
                  const angle = 60;
                  const rotateDeg = idx * angle + 30; // center of segment
                  return (
                    <div
                      key={idx}
                      className="absolute text-sm font-extrabold text-white"
                      style={{
                        top: '50%',
                        left: '50%',
                        transform: `translate(-50%, -50%) rotate(${rotateDeg}deg) translate(0, -70px)`,
                        transformOrigin: 'center center',
                      }}
                    >
                      +{val}đ
                    </div>
                  );
                })}
              </div>
              
              {/* Center peg */}
              <div className="absolute inset-0 m-auto w-10 h-10 bg-white rounded-full border-2 border-primary shadow flex items-center justify-center font-bold text-xs select-none">
                ⭐
              </div>
            </div>

            {/* Status & Spin Button */}
            <div className="space-y-sm">
              {spinResult !== null ? (
                <div className="text-sm font-extrabold text-tertiary animate-bounce">
                  🎉 Chúc mừng! Bạn nhận được +{spinResult} điểm!
                </div>
              ) : (
                <button
                  onClick={handleStartSpin}
                  disabled={spinning}
                  className="w-full py-md bg-primary text-on-primary font-bold rounded-xl hover:bg-primary/95 transition-all active:scale-95 shadow-md flex items-center justify-center gap-xs disabled:opacity-50"
                >
                  <span className="material-symbols-outlined animate-spin-slow">autorenew</span>
                  {spinning ? 'Đang quay...' : 'QUAY NGAY!'}
                </button>
              )}
            </div>

          </div>
        </div>
      )}

      {showTour && (
        <OnboardingTour onClose={() => setShowTour(false)} />
      )}

      <BottomNav />
    </div>
  );
}
