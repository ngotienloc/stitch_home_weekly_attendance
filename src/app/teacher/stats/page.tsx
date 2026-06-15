'use client';

import { useEffect, useState, useCallback, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, isMockEnabled, isUserTeacher, SUBJECT_NAME } from '@/utils/supabase/client';

interface CheckedInStudent {
  id: string;
  full_name: string;
  avatar_url: string | null;
  points_earned: number;
  game_name: string;
  created_at: string;
  student_input?: string | null;
}

export default function TeacherStatsPage() {
  const router = useRouter();
  const supabase = createClient();

  const [loading, setLoading] = useState(true);
  const [currentWeek, setCurrentWeek] = useState<number>(1);
  const [teacherTab, setTeacherTab] = useState<'current_week' | 'any_week' | 'overall'>('current_week');
  const [selectedStatsWeek, setSelectedStatsWeek] = useState<number>(1);
  const [isPending, startTransition] = useTransition();
  
  const [students, setStudents] = useState<CheckedInStudent[]>([]);
  const [statsWeeklyStudents, setStatsWeeklyStudents] = useState<CheckedInStudent[]>([]);
  const [allProfiles, setAllProfiles] = useState<any[]>([]);
  const [allCheckIns, setAllCheckIns] = useState<any[]>([]);

  // Memoize check-ins grouped by user_id to avoid O(N * M) lookup on every render
  const checkInsMapByUserId = useMemo(() => {
    const map = new Map<string, Set<number>>();
    allCheckIns.forEach(c => {
      if (!map.has(c.user_id)) {
        map.set(c.user_id, new Set());
      }
      map.get(c.user_id)!.add(c.week_number);
    });
    return map;
  }, [allCheckIns]);

  // Auth guard & load initial active week
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }
      if (!isUserTeacher(user)) {
        router.push('/home');
        return;
      }

      // Get current active week settings
      if (isMockEnabled) {
        const settings = JSON.parse(localStorage.getItem('mock_teacher_settings') || '{}');
        const activeWeek = settings.currentWeek || 1;
        setCurrentWeek(activeWeek);
        setSelectedStatsWeek(activeWeek);
      } else {
        try {
          const { data } = await supabase
            .from('teacher_settings')
            .select('current_week')
            .eq('id', 1)
            .single();
          if (data) {
            setCurrentWeek(data.current_week);
            setSelectedStatsWeek(data.current_week);
          }
        } catch (err) {
          console.error(err);
        }
      }
      setLoading(false);
    }
    init();
  }, [router, supabase]);

  // Load students for current active week
  const loadCurrentWeekStudents = useCallback(async () => {
    if (isMockEnabled) {
      const checkIns: any[] = JSON.parse(localStorage.getItem('mock_check_ins') || '[]');
      const profiles: any[] = JSON.parse(localStorage.getItem('mock_profiles') || '[]');
      const weekCheckIns = checkIns.filter((c: any) => c.week_number === currentWeek);
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
          .eq('week_number', currentWeek);

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
      } catch (err) {
        console.error(err);
      }
    }
  }, [supabase, currentWeek]);

  // Load stats data for overall and other weeks
  const loadStatsData = useCallback(async () => {
    if (isMockEnabled) {
      const checkIns: any[] = JSON.parse(localStorage.getItem('mock_check_ins') || '[]');
      const profiles: any[] = JSON.parse(localStorage.getItem('mock_profiles') || '[]');
      setAllProfiles(profiles);
      setAllCheckIns(checkIns);

      // Load for selectedStatsWeek
      const weekCheckIns = checkIns.filter((c: any) => c.week_number === selectedStatsWeek);
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
      setStatsWeeklyStudents(result);
    } else {
      try {
        const { data: profiles, error: pError } = await supabase
          .from('profiles')
          .select('*')
          .order('full_name', { ascending: true });
        if (pError) throw pError;
        setAllProfiles(profiles || []);

        const { data: checkIns, error: cError } = await supabase
          .from('check_ins')
          .select('*');
        if (cError) throw cError;
        setAllCheckIns(checkIns || []);

        const { data: weekData, error: wError } = await supabase
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
          .eq('week_number', selectedStatsWeek);
        if (wError) throw wError;

        if (weekData) {
          const result: CheckedInStudent[] = (weekData as any[]).map((c: any) => {
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
          setStatsWeeklyStudents(result);
        }
      } catch (err) {
        console.error(err);
      }
    }
  }, [supabase, selectedStatsWeek]);

  // Polling for active week check-ins
  useEffect(() => {
    if (loading) return;
    if (teacherTab === 'current_week') {
      loadCurrentWeekStudents();
      const interval = setInterval(loadCurrentWeekStudents, 3000);
      return () => clearInterval(interval);
    }
  }, [loading, teacherTab, loadCurrentWeekStudents]);

  // Polling for weekly/overall stats
  useEffect(() => {
    if (loading) return;
    if (teacherTab !== 'current_week') {
      loadStatsData();
      const interval = setInterval(loadStatsData, 3000);
      return () => clearInterval(interval);
    }
  }, [loading, teacherTab, loadStatsData]);

  const handleExportCurrentCSV = () => {
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
    link.setAttribute('download', `DiemDanh_Tuan_${currentWeek}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportStatsWeekCSV = () => {
    if (statsWeeklyStudents.length === 0) {
      alert(`Không có dữ liệu sinh viên điểm danh để xuất tuần ${selectedStatsWeek}!`);
      return;
    }
    let csvContent = 'data:text/csv;charset=utf-8,\uFEFF';
    csvContent += 'STT,Họ và tên,Tên thử thách,Số điểm,Thời gian điểm danh,Câu trả lời chi tiết\n';
    
    statsWeeklyStudents.forEach((s, idx) => {
      const timeStr = new Date(s.created_at).toLocaleString('vi-VN');
      const cleanInput = s.student_input ? s.student_input.replace(/"/g, '""') : '';
      csvContent += `${idx + 1},"${s.full_name}","${s.game_name}",${s.points_earned},"${timeStr}","${cleanInput}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `DiemDanh_Tuan_${selectedStatsWeek}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportOverallCSV = () => {
    if (allProfiles.length === 0) {
      alert('Không có dữ liệu sinh viên để xuất!');
      return;
    }
    let csvContent = 'data:text/csv;charset=utf-8,\uFEFF';
    let header = 'STT,Họ và tên,Ngành học,Tổng số buổi,Tỉ lệ chuyên cần';
    for (let w = 1; w <= 16; w++) {
      header += `,Tuần ${w}`;
    }
    csvContent += header + '\n';

    allProfiles.forEach((p, idx) => {
      const studentCis = allCheckIns.filter(c => c.user_id === p.id);
      const attendedCount = studentCis.length;
      const rate = ((attendedCount / 16) * 100).toFixed(1);
      
      let row = `${idx + 1},"${p.full_name}","${p.major || ''}",${attendedCount},${rate}%`;
      for (let w = 1; w <= 16; w++) {
        const hasAttended = studentCis.some(c => c.week_number === w);
        row += hasAttended ? ',"x"' : ',"-"';
      }
      csvContent += row + '\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `BaoCao_DiemDanh_TongHop.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-background text-on-background items-center justify-center">
        <span className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></span>
        <p className="text-sm font-semibold text-on-surface-variant mt-md">Đang tải thống kê...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-on-background pb-16">
      
      {/* ── Header ── */}
      <header className="bg-secondary-container sticky top-0 z-50 shadow-md">
        <div className="flex justify-between items-center px-container-margin py-md w-full max-w-[800px] mx-auto text-on-secondary-container">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-on-secondary-container text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>assessment</span>
            <div>
              <h1 className="text-base font-extrabold leading-tight">Thống kê điểm danh</h1>
              <p className="text-[10px] font-bold opacity-80 uppercase tracking-wider">Giảng viên</p>
            </div>
          </div>
          <button 
            onClick={() => router.push('/teacher')} 
            className="flex items-center gap-1 text-on-secondary-container/90 text-sm font-bold hover:text-on-secondary-container transition-colors active:scale-95 border-0 bg-transparent cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Bảng điều khiển
          </button>
        </div>
      </header>

      <main className="flex-grow w-full max-w-[800px] mx-auto px-container-margin pt-lg space-y-lg">
        
        {/* Course Info Card */}
        <section className="bg-secondary-container text-on-secondary-container rounded-xxl p-lg relative overflow-hidden shadow-md">
          <div className="absolute -right-6 -top-6 w-28 h-28 bg-white/10 rounded-full blur-2xl" />
          <p className="text-[10px] font-bold uppercase tracking-widest opacity-80 mb-xs">Môn học</p>
          <h2 className="text-lg font-extrabold font-display-hero leading-tight">{SUBJECT_NAME}</h2>
        </section>

        {/* ── Tabs Navigation ── */}
        <div className="flex border-b border-outline-variant/30 mb-lg overflow-x-auto no-scrollbar gap-sm">
          <button
            onClick={() => startTransition(() => setTeacherTab('current_week'))}
            className={`pb-sm font-bold text-sm transition-all relative px-sm flex items-center gap-xs cursor-pointer border-0 bg-transparent ${
              teacherTab === 'current_week' ? 'text-primary font-extrabold' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">calendar_today</span>
            Điểm danh tuần này (Tuần {currentWeek})
            {teacherTab === 'current_week' && (
              <span className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full"></span>
            )}
          </button>
          
          <button
            onClick={() => startTransition(() => setTeacherTab('any_week'))}
            className={`pb-sm font-bold text-sm transition-all relative px-sm flex items-center gap-xs cursor-pointer border-0 bg-transparent ${
              teacherTab === 'any_week' ? 'text-primary font-extrabold' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">view_week</span>
            Thống kê theo tuần
            {teacherTab === 'any_week' && (
              <span className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full"></span>
            )}
          </button>

          <button
            onClick={() => startTransition(() => setTeacherTab('overall'))}
            className={`pb-sm font-bold text-sm transition-all relative px-sm flex items-center gap-xs cursor-pointer border-0 bg-transparent ${
              teacherTab === 'overall' ? 'text-primary font-extrabold' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">grid_on</span>
            Bảng thống kê toàn bộ
            {teacherTab === 'overall' && (
              <span className="absolute bottom-0 left-0 right-0 h-1 bg-primary rounded-t-full"></span>
            )}
          </button>
        </div>

        {/* ── Tab Content: Current Week ── */}
        {teacherTab === 'current_week' && (
          <section className="animate-fade-in-up space-y-md">
            <div className="flex justify-between items-center mb-md">
              <h3 className="text-xl font-extrabold text-on-surface font-display-hero">Sinh viên đã điểm danh (Tuần {currentWeek})</h3>
              <div className="flex items-center gap-sm">
                {students.length > 0 && (
                  <button
                    onClick={handleExportCurrentCSV}
                    className="px-sm py-xs rounded-lg font-bold text-xs bg-primary/10 text-primary hover:bg-primary/20 active:scale-95 transition-all border border-primary/20 flex items-center gap-0.5 border-0"
                    title="Xuất file báo cáo điểm danh Excel CSV"
                  >
                    <span className="material-symbols-outlined text-[14px]">download</span>
                    Xuất Excel
                  </button>
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
                  Chưa có sinh viên điểm danh tuần này.
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
        )}

        {/* ── Tab Content: Stats by Week ── */}
        {teacherTab === 'any_week' && (
          <section className="animate-fade-in-up space-y-md">
            <div className="bg-white p-lg rounded-xxl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-outline-variant/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-md">
              <div className="flex items-center gap-md">
                <label className="text-sm font-bold text-on-surface">Chọn tuần học:</label>
                <select
                  value={selectedStatsWeek}
                  onChange={(e) => setSelectedStatsWeek(Number(e.target.value))}
                  className="p-sm bg-surface-container rounded-lg border border-outline-variant/30 text-sm font-bold focus:outline-none focus:border-primary"
                >
                  {Array.from({ length: 16 }).map((_, idx) => (
                    <option key={idx + 1} value={idx + 1}>Tuần {idx + 1}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-sm w-full sm:w-auto justify-between sm:justify-end">
                {statsWeeklyStudents.length > 0 && (
                  <button
                    onClick={handleExportStatsWeekCSV}
                    className="px-sm py-xs rounded-lg font-bold text-xs bg-primary/10 text-primary hover:bg-primary/20 active:scale-95 transition-all border border-primary/20 flex items-center gap-0.5 border-0"
                  >
                    <span className="material-symbols-outlined text-[14px]">download</span>
                    Xuất Excel Tuần {selectedStatsWeek}
                  </button>
                )}
                <span className="bg-tertiary-container text-on-tertiary-container text-xs font-bold px-sm py-xs rounded-full">
                  {statsWeeklyStudents.length} người
                </span>
              </div>
            </div>

            {statsWeeklyStudents.length === 0 ? (
              <div className="bg-surface-container rounded-2xl p-xl flex flex-col items-center gap-sm text-center">
                <span className="text-4xl">📋</span>
                <p className="text-sm font-semibold text-on-surface-variant">
                  Không có dữ liệu điểm danh cho Tuần {selectedStatsWeek}.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl shadow-[0_4px_12px_rgba(0,0,0,0.05)] divide-y divide-surface-variant/30 border border-outline-variant/10 overflow-hidden">
                {statsWeeklyStudents.map((s, i) => (
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
        )}

        {/* ── Tab Content: Overall Statistics Matrix ── */}
        {teacherTab === 'overall' && (
          <section className="animate-fade-in-up space-y-md">
            <div className="bg-white p-lg rounded-xxl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-outline-variant/10 flex justify-between items-center">
              <h3 className="text-lg font-bold text-on-surface flex items-center gap-1">
                <span className="material-symbols-outlined text-[20px] text-primary">assessment</span>
                Bảng điểm danh tổng hợp
              </h3>
              {allProfiles.length > 0 && (
                <button
                  onClick={handleExportOverallCSV}
                  className="px-sm py-xs rounded-lg font-bold text-xs bg-primary/10 text-primary hover:bg-primary/20 active:scale-95 transition-all border border-primary/20 flex items-center gap-0.5 border-0"
                >
                  <span className="material-symbols-outlined text-[14px]">download</span>
                  Xuất Báo Cáo Tổng Hợp
                </button>
              )}
            </div>

            {allProfiles.length === 0 ? (
              <div className="bg-surface-container rounded-2xl p-xl flex flex-col items-center gap-sm text-center">
                <span className="text-4xl">👥</span>
                <p className="text-sm font-semibold text-on-surface-variant">
                  Chưa có dữ liệu sinh viên nào trong hệ thống.
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-xxl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-outline-variant/10 overflow-hidden">
                <div className="overflow-x-auto no-scrollbar">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="bg-surface-container-low text-on-surface border-b border-outline-variant/20">
                        <th className="p-md font-bold text-center w-[50px]">STT</th>
                        <th className="p-md font-bold min-w-[150px]">Họ và tên</th>
                        <th className="p-md font-bold min-w-[120px]">Ngành học</th>
                        <th className="p-md font-bold text-center w-[70px]">Số buổi</th>
                        <th className="p-md font-bold text-center w-[70px]">Tỉ lệ</th>
                        {Array.from({ length: 16 }).map((_, idx) => (
                          <th key={idx + 1} className="p-xs font-bold text-center w-[36px] bg-surface-container/30">T{idx + 1}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-variant/30 text-on-surface">
                      {allProfiles.map((p, idx) => {
                        const attendedWeeks = checkInsMapByUserId.get(p.id) || new Set<number>();
                        const attendedCount = attendedWeeks.size;
                        const rate = ((attendedCount / 16) * 100).toFixed(0);
                        
                        return (
                          <tr key={p.id} className="hover:bg-surface-container-low transition-colors">
                            <td className="p-md text-center font-bold text-on-surface-variant">{idx + 1}</td>
                            <td className="p-md font-bold">
                              <div className="flex items-center gap-sm">
                                <div className="w-6 h-6 rounded-full overflow-hidden border border-outline-variant flex-shrink-0">
                                  {p.avatar_url
                                    ? <img src={p.avatar_url} alt={p.full_name} className="w-full h-full object-cover" />
                                    : <div className="w-full h-full bg-primary-container flex items-center justify-center text-on-primary-container font-bold text-[10px]">{p.full_name[0]}</div>
                                  }
                                </div>
                                <span>{p.full_name}</span>
                              </div>
                            </td>
                            <td className="p-md text-on-surface-variant font-medium">{p.major || '-'}</td>
                            <td className="p-md text-center font-extrabold text-primary">{attendedCount}/16</td>
                            <td className="p-md text-center font-bold text-tertiary">{rate}%</td>
                            {Array.from({ length: 16 }).map((_, wIdx) => {
                              const w = wIdx + 1;
                              const hasAttended = attendedWeeks.has(w);
                              return (
                                <td key={w} className={`p-xs text-center border-l border-outline-variant/10 ${hasAttended ? 'bg-green-50/20' : ''}`}>
                                  {hasAttended ? (
                                    <span className="text-green-600 font-extrabold text-sm" title={`Tuần ${w}: Đã tham gia`}>✓</span>
                                  ) : (
                                    <span className="text-on-surface-variant/20 font-bold" title={`Tuần ${w}: Vắng`}>-</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </section>
        )}
        
      </main>
    </div>
  );
}
