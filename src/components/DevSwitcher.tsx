'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, isMockEnabled, TEACHER_EMAIL } from '@/utils/supabase/client';

export default function DevSwitcher() {
  const router = useRouter();
  const supabase = createClient();

  const [isOpen, setIsOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isDev, setIsDev] = useState(false);

  // Credentials inputs
  const [teacherEmail, setTeacherEmail] = useState('');
  const [teacherPassword, setTeacherPassword] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [studentPassword, setStudentPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    // Only active in development or when mock mode is enabled
    const isDevMode = process.env.NODE_ENV === 'development' || isMockEnabled;
    setIsDev(isDevMode);

    if (isDevMode) {
      // Retrieve stored test accounts
      setTeacherEmail(localStorage.getItem('dev_teacher_email') || TEACHER_EMAIL);
      setTeacherPassword(localStorage.getItem('dev_teacher_password') || '');
      setStudentEmail(localStorage.getItem('dev_student_email') || 'student@edu.vn');
      setStudentPassword(localStorage.getItem('dev_student_password') || '');

      // Check current auth user
      supabase.auth.getUser().then((res: any) => {
        setCurrentUser(res?.data?.user || null);
      });
    }
  }, []);

  // Sync user state on open/changes
  const handleOpenToggle = async () => {
    if (!isOpen) {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    }
    setIsOpen(!isOpen);
    setError(null);
    setSuccess(null);
  };

  const handleSave = () => {
    localStorage.setItem('dev_teacher_email', teacherEmail.trim());
    localStorage.setItem('dev_teacher_password', teacherPassword);
    localStorage.setItem('dev_student_email', studentEmail.trim());
    localStorage.setItem('dev_student_password', studentPassword);
    
    setSuccess('Đã lưu thông tin chuyển nhanh!');
    setTimeout(() => setSuccess(null), 1500);
  };

  const handleSwitch = async (role: 'teacher' | 'student') => {
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const email = role === 'teacher' ? teacherEmail.trim() : studentEmail.trim();
      const password = role === 'teacher' ? teacherPassword : studentPassword;

      if (!email) {
        throw new Error(`Vui lòng cấu hình Email cho ${role === 'teacher' ? 'Giảng viên' : 'Sinh viên'}`);
      }
      if (!isMockEnabled && !password) {
        throw new Error(`Chế độ Supabase thật yêu cầu cấu hình Mật khẩu bên dưới (hoặc đăng nhập tài khoản thủ công một lần tại trang Đăng nhập để hệ thống tự ghi nhớ mật khẩu).`);
      }

      // 1. Sign out current session
      await supabase.auth.signOut();
      document.cookie = 'mock_session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';

      // 2. Sign in with target credentials
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: password || 'nopassword', // mock client handles any password
      });

      if (signInError) throw signInError;

      // 3. For mock mode client, sync mock session cookie
      if (isMockEnabled && data?.session) {
        document.cookie = `mock_session=${encodeURIComponent(JSON.stringify(data.session))}; path=/; max-age=86400;`;
      }

      setSuccess(`Đã chuyển vai trò sang ${role === 'teacher' ? 'Giảng viên' : 'Sinh viên'}!`);
      
      // Delay slightly to ensure browser writes session cookies
      await new Promise((resolve) => setTimeout(resolve, 800));
      
      setIsOpen(false);

      // 4. Force hard reload to update server context and cookies
      if (role === 'teacher') {
        window.location.href = '/teacher';
      } else {
        window.location.href = '/home';
      }
    } catch (err: any) {
      setError(err.message || 'Chuyển đổi vai trò thất bại.');
    } finally {
      setLoading(false);
    }
  };

  if (!isDev) return null;

  const isCurrentlyTeacher = currentUser?.email === teacherEmail || currentUser?.email?.endsWith('@teacher.edu.vn') || currentUser?.id === 'teacher-uuid';
  const isCurrentlyStudent = currentUser && !isCurrentlyTeacher;

  return (
    <>
      {/* Floating Trigger Button */}
      <button
        onClick={handleOpenToggle}
        className="fixed bottom-[100px] left-4 md:left-[calc(50%-280px)] z-50 w-11 h-11 bg-primary text-white rounded-full flex items-center justify-center shadow-lg border border-primary/20 hover:bg-primary-container hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer"
        title="Bảng chuyển vai trò nhanh (Dev Tool)"
      >
        <span className="material-symbols-outlined text-[22px] animate-pulse">swap_horiz</span>
      </button>

      {/* Switcher Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-xxl w-full max-w-[420px] shadow-2xl border border-outline-variant/30 overflow-hidden animate-pop-in relative p-lg text-center space-y-md">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center pb-sm border-b border-outline-variant/20">
              <div className="flex items-center gap-2 text-primary font-bold">
                <span className="material-symbols-outlined">shield_person</span>
                <span className="text-sm font-extrabold uppercase tracking-wide">Chuyển Vai Trò (Dev Tool)</span>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low rounded-full w-8 h-8 flex items-center justify-center transition-colors active:scale-90"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Quick Feedback Notifications */}
            {error && (
              <div className="bg-error-container/20 border border-error/20 text-error p-sm rounded-xl text-xs font-semibold text-left">
                ⚠️ {error}
              </div>
            )}
            {success && (
              <div className="bg-tertiary-container/20 border border-tertiary/20 text-tertiary p-sm rounded-xl text-xs font-semibold text-left">
                ✨ {success}
              </div>
            )}

            {/* Current Account Information */}
            <div className="bg-surface-container-low p-sm rounded-xl border border-outline-variant/20 text-left">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Tài khoản hiện tại:</span>
              {currentUser ? (
                <div className="flex items-center gap-sm mt-xs">
                  <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-extrabold text-xs">
                    {currentUser.email?.[0].toUpperCase() || 'U'}
                  </div>
                  <div className="truncate">
                    <p className="text-xs font-bold text-on-surface truncate">{currentUser.email}</p>
                    <p className="text-[10px] text-primary font-semibold">
                      Vai trò: {isCurrentlyTeacher ? '👨‍🏫 GIẢNG VIÊN' : '🎓 SINH VIÊN'}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs font-medium text-on-surface-variant/70 italic mt-xs">Chưa đăng nhập</p>
              )}
            </div>

            {/* Quick Switch Buttons */}
            <div className="grid grid-cols-2 gap-sm">
              <button
                disabled={loading || isCurrentlyTeacher}
                onClick={() => handleSwitch('teacher')}
                className={`py-md px-sm rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-xs shadow-sm border transition-all active:scale-95 cursor-pointer ${
                  isCurrentlyTeacher
                    ? 'bg-surface-container text-on-surface-variant/40 border-outline-variant/10 cursor-default shadow-none'
                    : 'bg-secondary-container text-on-secondary-container hover:bg-secondary-container/90 border-secondary-container/20'
                }`}
              >
                <span className="material-symbols-outlined text-[24px]">school</span>
                <span>Sang Giảng Viên</span>
              </button>

              <button
                disabled={loading || isCurrentlyStudent}
                onClick={() => handleSwitch('student')}
                className={`py-md px-sm rounded-xl font-bold text-xs flex flex-col items-center justify-center gap-xs shadow-sm border transition-all active:scale-95 cursor-pointer ${
                  isCurrentlyStudent
                    ? 'bg-surface-container text-on-surface-variant/40 border-outline-variant/10 cursor-default shadow-none'
                    : 'bg-primary-container text-on-primary-container hover:bg-primary-container/90 border-primary-container/20'
                }`}
              >
                <span className="material-symbols-outlined text-[24px]">face</span>
                <span>Sang Sinh Viên</span>
              </button>
            </div>

            {/* Developer Credentials Configuration Form */}
            <div className="text-left border-t border-outline-variant/20 pt-sm">
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block mb-sm">
                ⚙️ Cấu hình tài khoản test:
              </span>
              
              <div className="space-y-sm">
                {/* Teacher Account Config */}
                <div className="bg-surface-container-low p-sm rounded-xl border border-outline-variant/10 space-y-xs">
                  <span className="text-[10px] font-bold text-secondary flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">school</span> Tài khoản Giảng viên
                  </span>
                  <input
                    type="email"
                    value={teacherEmail}
                    onChange={(e) => setTeacherEmail(e.target.value)}
                    placeholder="teacher@edu.vn"
                    className="w-full text-xs px-sm py-xs bg-white border border-outline-variant/50 focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-lg outline-none"
                  />
                  {!isMockEnabled && (
                    <input
                      type="password"
                      value={teacherPassword}
                      onChange={(e) => setTeacherPassword(e.target.value)}
                      placeholder="Mật khẩu giáo viên..."
                      className="w-full text-xs px-sm py-xs bg-white border border-outline-variant/50 focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-lg outline-none"
                    />
                  )}
                </div>

                {/* Student Account Config */}
                <div className="bg-surface-container-low p-sm rounded-xl border border-outline-variant/10 space-y-xs">
                  <span className="text-[10px] font-bold text-primary flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">face</span> Tài khoản Sinh viên
                  </span>
                  <input
                    type="email"
                    value={studentEmail}
                    onChange={(e) => setStudentEmail(e.target.value)}
                    placeholder="student@edu.vn"
                    className="w-full text-xs px-sm py-xs bg-white border border-outline-variant/50 focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-lg outline-none"
                  />
                  {!isMockEnabled && (
                    <input
                      type="password"
                      value={studentPassword}
                      onChange={(e) => setStudentPassword(e.target.value)}
                      placeholder="Mật khẩu sinh viên..."
                      className="w-full text-xs px-sm py-xs bg-white border border-outline-variant/50 focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-lg outline-none"
                    />
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    className="flex-grow py-sm bg-surface-container-high text-on-surface font-bold text-xs rounded-xl hover:bg-surface-container-highest transition-all active:scale-95 shadow-sm border border-outline-variant/20 cursor-pointer"
                  >
                    Lưu Tài Khoản Test
                  </button>
                </div>
              </div>
            </div>
            
          </div>
        </div>
      )}
    </>
  );
}
