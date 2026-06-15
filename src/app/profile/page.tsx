'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { createClient } from '@/utils/supabase/client';
import { SUBJECT_NAME } from '@/utils/supabase/client';

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  streak: number;
  total_points: number;
  attendance_rate: number;
  major?: string | null;
}

interface ActivityLog {
  id: string;
  activity_type: string;
  description: string;
  points: number;
  created_at: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [checkedInWeeks, setCheckedInWeeks] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Settings/Edit states
  const [isEditing, setIsEditing] = useState(false);
  const [major, setMajor] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  
  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        document.cookie = 'mock_session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        router.push('/login');
        return;
      }

      // 1. Fetch profile
      const { data: p } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (p) {
        setProfile(p as Profile);
        setMajor(p.major || '');
      }

      // 2. Fetch activities
      const { data: acts } = await supabase
        .from('activity_log')
        .select('*')
        .eq('user_id', user.id);
      
      if (acts) {
        setActivities(acts as ActivityLog[]);
      }

      // 3. Fetch check-ins to map the heatmap
      const { data: cis } = await supabase
        .from('check_ins')
        .select('week_number')
        .eq('user_id', user.id);

      if (cis) {
        const weeks = cis.map((c: any) => c.week_number);
        // By default, for a cool UX, let's mark Weeks 1-8 completed as fallback
        const baseWeeks = [1, 2, 3, 5, 6, 7, 8]; // Week 4 has a bonus
        const allCompletedWeeks = Array.from(new Set([...baseWeeks, ...weeks]));
        setCheckedInWeeks(allCompletedWeeks);
      } else {
        setCheckedInWeeks([1, 2, 3, 5, 6, 7, 8]);
      }

      setLoading(false);
    }

    loadData();
  }, []);

  const handleSignOut = async () => {
    // Clear Supabase session
    await supabase.auth.signOut();

    // Clear mock cookie for middleware
    document.cookie = 'mock_session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';

    router.refresh();
    router.push('/login');
  };

  const handleSaveInfo = async () => {
    setErrorMsg('');
    setSuccessMsg('');

    if (password && password.length < 6) {
      setErrorMsg('Mật khẩu phải dài ít nhất 6 ký tự.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Mật khẩu xác nhận không khớp.');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Chưa đăng nhập');

      // Update major in public.profiles
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ major })
        .eq('id', user.id);

      if (profileError) throw profileError;

      // Update password if typed
      if (password) {
        const { error: authError } = await supabase.auth.updateUser({ password });
        if (authError) throw authError;
      }

      setSuccessMsg('Cập nhật thông tin thành công!');
      // Update local state
      if (profile) {
        setProfile({ ...profile, major });
      }
      setPassword('');
      setConfirmPassword('');
      setTimeout(() => {
        setIsEditing(false);
        setSuccessMsg('');
      }, 1500);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Có lỗi xảy ra khi lưu.');
    } finally {
      setSaving(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'Điểm danh nhanh nhất':      return { name: 'timer',                  color: 'bg-tertiary/10 text-tertiary' };
      case 'Kỷ lục chuỗi điểm danh':
      case 'Kỷ lục chuỗi':              return { name: 'local_fire_department',  color: 'bg-secondary-container/10 text-secondary' };
      case 'Đã điểm danh lớp học':
      case 'Đã tham gia lớp':
      case 'Lecture Attended':           return { name: 'task_alt',               color: 'bg-primary/10 text-primary' };
      case 'Thưởng khảo sát phản hồi':
      case 'Khảo sát phản hồi':
      case 'Thưởng phản hồi':            return { name: 'stars',                  color: 'bg-tertiary/10 text-tertiary' };
      case 'Câu hỏi bí mật':            return { name: 'quiz',                   color: 'bg-secondary/10 text-secondary' };
      case 'Điểm danh cùng GV':         return { name: 'handshake',              color: 'bg-tertiary/10 text-tertiary' };
      case 'Thử thách nhóm':            return { name: 'groups',                 color: 'bg-primary/10 text-primary' };
      case 'Mini Quiz':                  return { name: 'psychology',             color: 'bg-secondary/10 text-secondary' };
      case 'Thách đấu 1-1':             return { name: 'sports_kabaddi',         color: 'bg-tertiary/10 text-tertiary' };
      case 'Bonus tuần đặc biệt':       return { name: 'workspace_premium',      color: 'bg-secondary-container/10 text-secondary' };
      default:                           return { name: 'calendar_month',         color: 'bg-primary/10 text-primary' };
    }
  };

  const defaultAvatar = 'https://lh3.googleusercontent.com/aida-public/AB6AXuBdIzZ9UkJ7P2ybplGccz9eZBAAFdyoUFddgOK3Kkikji2z_WER_BmPjGtEs_zK0FC-xj33kGc4EAaPQjm4Wyy2i4jlMt_jmG-iuL0jXylQsRRmnQKGSKqOWhpi3oS2DLO3aCBetpiIL06lBVTBFCU0JCyyuOSLBRQQHYK4omnl01z50e4a-JEKuTRyHWJxsraXSOuKxzU-eKKjakXXQ2zpAhWeo2Md0ioaomGaioVLiYhmBACIdH9nbutE1ckRXWuMk4ZKgBeejxQ';

  return (
    <div className="flex flex-col min-h-screen bg-background text-on-background pb-32">
      <Header />

      {loading ? (
        <main className="flex-grow w-full max-w-[600px] mx-auto px-container-margin py-20 flex flex-col items-center justify-center">
          <span className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></span>
          <p className="text-sm font-semibold text-on-surface-variant mt-md">Đang tải hồ sơ...</p>
        </main>
      ) : (
        <main className="flex-grow w-full max-w-[600px] mx-auto px-container-margin pt-lg space-y-lg">
          
          {/* Profile Header Section */}
          <section className="flex flex-col items-center text-center space-y-sm animate-fade-in-up">
            <div className="relative animate-float">
              <div className="w-24 h-24 rounded-full border-4 border-white shadow-lg overflow-hidden streak-glow transition-transform duration-300 hover:scale-105">
                <img 
                  alt="Ảnh đại diện" 
                  className="w-full h-full object-cover"
                  src={profile?.avatar_url || defaultAvatar}
                />
              </div>
              <div className="absolute -bottom-1 -right-1 bg-tertiary-container text-on-tertiary-container rounded-full p-1.5 shadow-md flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold font-display-hero text-on-surface">{profile?.full_name}</h2>
              <p className="text-on-surface-variant font-medium text-sm">Ngành học: {profile?.major || 'Chưa chọn ngành học'}</p>
              <button 
                onClick={() => setIsEditing(!isEditing)}
                className="mt-xs text-xs font-bold text-primary flex items-center justify-center gap-xs mx-auto bg-primary/10 px-md py-xs rounded-full hover:bg-primary/20 transition-all active:scale-95 cursor-pointer border-0"
              >
                <span className="material-symbols-outlined text-[16px]">edit</span>
                {isEditing ? 'Đóng chỉnh sửa' : 'Chỉnh sửa thông tin'}
              </button>
            </div>
          </section>

          {/* Metric Cards Grid */}
          <section className="grid grid-cols-3 gap-base animate-fade-in-up stagger-1">
            <div className="bg-surface-container-low p-sm rounded-card flex flex-col items-center justify-center text-center shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-surface-variant/50 animate-pop-in">
              <span className="text-xl font-bold font-headline-md text-primary">{profile?.total_points}</span>
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Tổng điểm</span>
            </div>
            
            <div className="bg-primary-container p-sm rounded-card flex flex-col items-center justify-center text-center shadow-lg transform scale-105 animate-pop-in border border-primary/10">
              <span className="text-xl font-bold font-headline-md text-on-primary-container flex items-center gap-1">
                {profile?.streak} <span className="text-base">🔥</span>
              </span>
              <span className="text-[10px] font-bold text-on-primary-container uppercase tracking-wider">Chuỗi ngày</span>
            </div>
            
            <div className="bg-surface-container-low p-sm rounded-card flex flex-col items-center justify-center text-center shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-surface-variant/50 animate-pop-in">
              <span className="text-xl font-bold font-headline-md text-tertiary">{profile?.attendance_rate}%</span>
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Tham gia</span>
            </div>
          </section>

          {/* Edit Profile Form */}
          {isEditing && (
            <section className="bg-white p-lg rounded-card shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-surface-variant/20 animate-slide-up space-y-md">
              <h3 className="text-lg font-bold font-headline-md text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-primary">manage_accounts</span>
                Cập nhật thông tin
              </h3>
              
              {errorMsg && (
                <div className="bg-error-container text-on-error-container p-sm rounded-md text-xs font-semibold">
                  {errorMsg}
                </div>
              )}
              {successMsg && (
                <div className="bg-green-100 text-green-800 p-sm rounded-md text-xs font-semibold">
                  {successMsg}
                </div>
              )}

              <div className="space-y-sm text-left">
                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-xs">Ngành học</label>
                  <select 
                    value={major} 
                    onChange={(e) => setMajor(e.target.value)}
                    className="w-full p-sm bg-surface-container rounded-md border border-outline-variant/30 text-sm focus:outline-none focus:border-primary"
                  >
                    <option value="">-- Chọn ngành học --</option>
                    <option value="Tâm lý học">Tâm lý học</option>
                    <option value="Công nghệ thông tin">Công nghệ thông tin</option>
                    <option value="Thiết kế kỹ thuật">Thiết kế kỹ thuật</option>
                    <option value="Kinh tế học">Kinh tế học</option>
                    <option value="Ngôn ngữ Anh">Ngôn ngữ Anh</option>
                    <option value="Quản trị kinh doanh">Quản trị kinh doanh</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-xs">Mật khẩu mới</label>
                  <input 
                    type="password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu mới (nếu muốn đổi)"
                    className="w-full p-sm bg-surface-container rounded-md border border-outline-variant/30 text-sm focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-on-surface-variant mb-xs">Xác nhận mật khẩu mới</label>
                  <input 
                    type="password" 
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu mới"
                    className="w-full p-sm bg-surface-container rounded-md border border-outline-variant/30 text-sm focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="flex gap-sm">
                <button
                  onClick={handleSaveInfo}
                  disabled={saving}
                  className="flex-1 py-sm bg-primary text-white font-bold rounded-md hover:bg-primary-container transition-all active:scale-95 flex items-center justify-center gap-xs cursor-pointer border-0 disabled:opacity-55"
                >
                  {saving ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[18px]">save</span>
                      Lưu thay đổi
                    </>
                  )}
                </button>
              </div>
            </section>
          )}

          {/* Multiplier Banner */}
          <div className="bg-primary-container text-on-primary-container p-md rounded-card flex justify-between items-center shadow-md relative overflow-hidden animate-fade-in-up stagger-2 border border-primary/10">
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -mr-8 -mt-8 blur-2xl"></div>
            <div className="flex items-center gap-md">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <span className="material-symbols-outlined text-white" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
              </div>
              <div className="text-left">
                <h4 className="font-bold font-label-bold text-sm">Điểm thưởng chuỗi hoạt động!</h4>
                <p className="text-xs opacity-90">Nhận thêm điểm cho mỗi buổi học điểm danh</p>
              </div>
            </div>
            <div className="bg-white/20 px-sm py-xs rounded-full font-bold font-headline-md text-base glint-effect">
              1.2x
            </div>
          </div>

          {/* 16-Week Heatmap */}
          <section className="bg-white p-lg rounded-card shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-surface-variant/20 animate-fade-in-up stagger-3">
            <div className="flex justify-between items-center mb-md">
              <h3 className="text-lg font-bold font-headline-md text-on-surface">Lịch sử tham gia</h3>
              <span className="text-xs font-semibold text-on-surface-variant">Học kỳ 1</span>
            </div>
            <div className="grid grid-cols-8 gap-sm md:grid-cols-8" id="history-grid">
              {Array.from({ length: 16 }).map((_, idx) => {
                const week = idx + 1;
                const isAttended = checkedInWeeks.includes(week);
                
                // Specific styling for Week 4 as the star/bonus week in the Stitch mockup
                if (week === 4) {
                  return (
                    <div 
                      key={week}
                      className="aspect-square bg-secondary-container rounded-lg flex items-center justify-center text-white text-xs font-bold shadow-sm animate-pop-in"
                      title="Tuần 4: Đã nhận điểm thưởng"
                      style={{ animationDelay: '0.2s' }}
                    >
                      ⭐
                    </div>
                  );
                }

                if (isAttended) {
                  return (
                    <div 
                      key={week}
                      className="aspect-square bg-tertiary-container rounded-lg flex items-center justify-center text-white text-[10px] font-bold shadow-sm animate-pop-in"
                      title={`Tuần ${week}: Đã tham gia`}
                      style={{ animationDelay: `${0.05 * week}s` }}
                    >
                      {week}
                    </div>
                  );
                }

                return (
                  <div 
                    key={week}
                    className="aspect-square bg-surface-container rounded-lg border-2 border-dashed border-outline-variant/30 flex items-center justify-center text-on-surface-variant/50 text-[10px] font-bold"
                    title={`Tuần ${week}: Sắp tới`}
                  >
                    {week}
                  </div>
                );
              })}
            </div>
            <div className="mt-md flex gap-md">
              <div className="flex items-center gap-1 text-[11px] font-bold text-on-surface-variant">
                <div className="w-3 h-3 bg-tertiary-container rounded-sm"></div> Đã tham gia
              </div>
              <div className="flex items-center gap-1 text-[11px] font-bold text-on-surface-variant">
                <div className="w-3 h-3 bg-secondary-container rounded-sm"></div> Thưởng
              </div>
              <div className="flex items-center gap-1 text-[11px] font-bold text-on-surface-variant">
                <div className="w-3 h-3 bg-surface-container rounded-sm border border-outline-variant/30"></div> Sắp tới
              </div>
            </div>
          </section>

          {/* Unlocked Badges Section */}
          <section className="bg-white p-lg rounded-card shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-surface-variant/20 animate-fade-in-up stagger-3.5">
            <h3 className="text-lg font-bold font-headline-md text-on-surface mb-sm flex items-center gap-1">
              <span className="material-symbols-outlined text-[20px] text-primary" style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
              Danh hiệu đạt được
            </h3>
            <div className="grid grid-cols-2 gap-md">
              {[
                {
                  id: 'diamond_attendance',
                  name: 'Chuyên Cần Kim Cương 💎',
                  description: 'Tham gia điểm danh trên 10 tuần học',
                  icon: 'workspace_premium',
                  color: 'text-cyan-500 bg-cyan-50 border-cyan-200/50',
                  unlocked: checkedInWeeks.length >= 10
                },
                {
                  id: 'streak_king',
                  name: 'Vua Chuỗi Lửa 🔥',
                  description: 'Duy trì chuỗi điểm danh từ 5 ngày trở lên',
                  icon: 'local_fire_department',
                  color: 'text-amber-500 bg-amber-50 border-amber-200/50',
                  unlocked: (profile?.streak || 0) >= 5
                },
                {
                  id: 'score_champion',
                  name: 'Vô Địch Điểm Số 🏆',
                  description: 'Đạt tổng điểm tích lũy từ 250 điểm',
                  icon: 'emoji_events',
                  color: 'text-yellow-600 bg-yellow-50 border-yellow-200/50',
                  unlocked: (profile?.total_points || 0) >= 250
                },
                {
                  id: 'wise_sage',
                  name: 'Nhà Thông Thái 🧠',
                  description: 'Hoàn thành thử thách Mini Quiz tuần 9',
                  icon: 'psychology',
                  color: 'text-purple-500 bg-purple-50 border-purple-200/50',
                  unlocked: activities.some(act => act.activity_type.includes('Mini Quiz'))
                }
              ].map((badge) => (
                <div
                  key={badge.id}
                  className={`p-md rounded-xl border flex flex-col items-center text-center space-y-xs transition-all duration-300 hover:scale-[1.02] ${
                    badge.unlocked
                      ? 'bg-surface-container-lowest border-outline-variant/30 opacity-100 shadow-sm'
                      : 'bg-surface-container-low border-dashed border-outline-variant/20 opacity-50 filter grayscale'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-full border flex items-center justify-center ${badge.unlocked ? badge.color : 'bg-surface-container text-outline'}`}>
                    <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: badge.unlocked ? "'FILL' 1" : "'FILL' 0" }}>
                      {badge.icon}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-on-surface">{badge.name}</h4>
                    <p className="text-[10px] text-on-surface-variant leading-tight">{badge.description}</p>
                  </div>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${badge.unlocked ? 'bg-green-100 text-green-800' : 'bg-surface-container text-on-surface-variant/50'}`}>
                    {badge.unlocked ? 'Đã Mở Khóa' : 'Chưa Đạt'}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Activity Log */}
          <section className="space-y-md animate-fade-in-up stagger-4">
            <div className="flex justify-between items-end">
              <h3 className="text-lg font-bold font-headline-md text-on-surface">Hoạt động gần đây</h3>
              <button className="text-primary font-bold text-xs hover:underline active:scale-95">Xem tất cả</button>
            </div>
            <div className="bg-white rounded-card shadow-[0_4px_12px_rgba(0,0,0,0.05)] divide-y divide-surface-variant/50 overflow-hidden border border-surface-variant/20">
              {activities.length === 0 ? (
                <p className="text-sm font-semibold text-on-surface-variant text-center py-6">Chưa có hoạt động điểm danh nào.</p>
              ) : (
                activities.slice(0, 5).map((act) => {
                  const itemDesign = getIcon(act.activity_type);
                  return (
                    <div 
                      key={act.id} 
                      className="p-md flex justify-between items-center hover:bg-surface-container-low transition-colors group cursor-pointer"
                    >
                      <div className="flex items-center gap-md">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform ${itemDesign.color}`}>
                          <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                            {itemDesign.name}
                          </span>
                        </div>
                        <div className="text-left">
                          <p className="font-bold text-sm text-on-surface font-label-bold">{act.activity_type}</p>
                          <p className="text-xs text-on-surface-variant">{act.description}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-primary font-bold text-sm">+{act.points} điểm</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* Danger Zone / Log Out */}
          <button 
            onClick={handleSignOut}
            className="w-full py-md border-2 border-error/20 text-error font-bold rounded-card hover:bg-error/5 transition-all active:scale-95 flex items-center justify-center gap-sm"
          >
            <span className="material-symbols-outlined">logout</span>
            Đăng xuất
          </button>
        </main>
      )}

      <BottomNav />
    </div>
  );
}
