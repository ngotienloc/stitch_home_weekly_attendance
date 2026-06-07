'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, isMockEnabled, TEACHER_EMAIL, TEACHER_ID } from '@/utils/supabase/client';

export default function LoginPage() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const supabase = createClient();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!email || !password || (isSignUp && !fullName)) {
      setError('Vui lòng điền đầy đủ các thông tin bắt buộc.');
      setLoading(false);
      return;
    }

    try {
      if (isMockEnabled) {
        // --- Mock Login/Signup flow ---
        const isTeacher = email === TEACHER_EMAIL || email.endsWith('@teacher.edu.vn');
        const userId    = isTeacher ? TEACHER_ID : 'me-uuid';
        const role      = isTeacher ? 'teacher' : 'student';
        const user = {
          id: userId, email, role,
          user_metadata: {
            full_name: isTeacher ? 'Giảng viên' : (isSignUp ? fullName : 'Nguyễn Văn A'),
            avatar_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAmGPFVAAaMkg5aUJhLN2BvApjkuO_Wpd0TV85ayhw0D1Chk4B0xjktsKqvWI4Xz49ZaFzD8xNev_EManm18MZUWoqzzPPZZ7tvFDc5S14ChgzBgZehfiAmsmwMxQrn7pWYjbn6IryJBnnXu0N5SYppwDPbOukSsSBL7XJ_lZKw-x7BVdOWKaQM13bHJXvc7WCjj7FvzZ_0fmJpiqWQIfbVviaclfTbJsYPI7rSzS-hpRMNrnp2CYB_3GIL0Ky0ZGWwtYp6ik_ovNo',
          },
        };
        const session = { user, access_token: 'mock-token' };
        localStorage.setItem('mock_session', JSON.stringify(session));

        if (!isTeacher) {
          const profiles = JSON.parse(localStorage.getItem('mock_profiles') || '[]');
          const existingIdx = profiles.findIndex((p: any) => p.id === userId);
          const newProfile = {
            id: userId,
            full_name: isSignUp ? fullName : 'Nguyễn Văn A',
            avatar_url: user.user_metadata.avatar_url,
            streak: isSignUp ? 0 : 12,
            total_points: isSignUp ? 0 : 210,
            attendance_rate: isSignUp ? 100.0 : 95.0,
            email, role: 'student',
          };
          if (existingIdx >= 0) { if (isSignUp) profiles[existingIdx] = newProfile; }
          else profiles.push(newProfile);
          localStorage.setItem('mock_profiles', JSON.stringify(profiles));
        }

        document.cookie = `mock_session=${encodeURIComponent(JSON.stringify(session))}; path=/; max-age=86400;`;
        router.refresh();
        router.push(isTeacher ? '/teacher' : '/home');
      } else {
        // --- Real Supabase Login/Signup flow ---
        if (isSignUp) {
          const { error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                full_name: fullName,
                avatar_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAmGPFVAAaMkg5aUJhLN2BvApjkuO_Wpd0TV85ayhw0D1Chk4B0xjktsKqvWI4Xz49ZaFzD8xNev_EManm18MZUWoqzzPPZZ7tvFDc5S14ChgzBgZehfiAmsmwMxQrn7pWYjbn6IryJBnnXu0N5SYppwDPbOukSsSBL7XJ_lZKw-x7BVdOWKaQM13bHJXvc7WCjj7FvzZ_0fmJpiqWQIfbVviaclfTbJsYPI7rSzS-hpRMNrnp2CYB_3GIL0Ky0ZGWwtYp6ik_ovNo',
              }
            }
          });
          if (signUpError) throw signUpError;
          setError('Email xác thực đã được gửi! Vui lòng kiểm tra hộp thư của bạn hoặc tiến hành đăng nhập.');
        } else {
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (signInError) throw signInError;

          // Cache credentials in local storage for the Dev Quick Switcher
          if (process.env.NODE_ENV === 'development') {
            const isUserTeacherRole = email === TEACHER_EMAIL || email.endsWith('@teacher.edu.vn');
            if (isUserTeacherRole) {
              localStorage.setItem('dev_teacher_email', email);
              localStorage.setItem('dev_teacher_password', password);
            } else {
              localStorage.setItem('dev_student_email', email);
              localStorage.setItem('dev_student_password', password);
            }
          }

          const isUserTeacherRole = email === TEACHER_EMAIL || email.endsWith('@teacher.edu.vn');
          router.refresh();
          router.push(isUserTeacherRole ? '/teacher' : '/home');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Đăng nhập thất bại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-grow w-full max-w-[600px] mx-auto px-container-margin py-xl flex flex-col justify-center min-h-[100dvh] pb-12 animate-fade-in-up">
      {/* Brand Header */}
      <div className="text-center mb-lg">
        <div className="w-16 h-16 bg-primary-fixed-dim rounded-2xl mx-auto flex items-center justify-center mb-md text-primary animate-float shadow-md">
          <span className="material-symbols-outlined text-[40px]" style={{ fontVariationSettings: "'FILL' 1" }}>school</span>
        </div>
        <h1 className="text-3xl font-extrabold text-primary font-display-hero tracking-tight">AttendanceHero</h1>
        <p className="text-on-surface-variant font-medium mt-1">Game hóa điểm danh & thực hiện thử thách</p>
        {isMockEnabled && (
          <div className="mt-3 space-y-1">
            <span className="inline-block bg-secondary-container/20 text-secondary text-xs font-bold px-3 py-1 rounded-full">
              ✨ Chế độ Demo Đang Hoạt Động
            </span>
            <div className="text-[11px] text-on-surface-variant font-medium space-y-0.5">
              <p>🎓 Sinh viên: <span className="font-bold text-primary">student@edu.vn</span></p>
              <p>👨‍🏫 Giảng viên: <span className="font-bold text-secondary">teacher@edu.vn</span></p>
              <p className="opacity-60">(mật khẩu bất kỳ)</p>
            </div>
          </div>
        )}
      </div>

      {/* Auth Card */}
      <div className="bg-surface-container-lowest p-lg rounded-xxl shadow-xl border border-outline-variant/30 relative overflow-hidden">
        <div className="absolute -right-8 -top-8 w-24 h-24 bg-primary-container opacity-10 rounded-full blur-2xl"></div>
        
        <h2 className="text-xl font-bold font-headline-md text-on-surface mb-lg">
          {isSignUp ? 'Tạo tài khoản anh hùng của bạn' : 'Chào mừng trở lại, Sinh viên!'}
        </h2>

        {error && (
          <div className={`p-md rounded-xl text-sm font-semibold mb-md border ${
            error.includes('gửi') 
              ? 'bg-tertiary-container/10 border-tertiary/20 text-tertiary' 
              : 'bg-error-container/20 border-error/20 text-error'
          }`}>
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-md">
          {isSignUp && (
            <div>
              <label className="block text-sm font-bold text-on-surface-variant mb-xs ml-1" htmlFor="fullName">Họ và Tên</label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nguyễn Văn A"
                className="w-full px-md py-sm bg-surface-container-low border border-outline-variant/50 focus:border-primary focus:ring-4 focus:ring-primary/20 rounded-xl font-body-md text-on-surface outline-none transition-all"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-bold text-on-surface-variant mb-xs ml-1" htmlFor="email">Email Trường học</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ten@student.edu.vn"
              className="w-full px-md py-sm bg-surface-container-low border border-outline-variant/50 focus:border-primary focus:ring-4 focus:ring-primary/20 rounded-xl font-body-md text-on-surface outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-on-surface-variant mb-xs ml-1" htmlFor="password">Mật khẩu</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-md py-sm bg-surface-container-low border border-outline-variant/50 focus:border-primary focus:ring-4 focus:ring-primary/20 rounded-xl font-body-md text-on-surface outline-none transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-md mt-lg bg-gradient-to-r from-primary to-primary-container text-on-primary font-headline-md text-base font-bold rounded-xl cta-pulse transition-all active:scale-95 flex items-center justify-center gap-sm disabled:opacity-50"
          >
            {loading ? (
              <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <>
                <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>
                  {isSignUp ? 'person_add' : 'login'}
                </span>
                {isSignUp ? 'Bắt đầu Hành trình' : 'Đăng nhập Bảng điều khiển'}
              </>
            )}
          </button>
        </form>

        <div className="mt-xl text-center">
          <p className="text-sm text-on-surface-variant">
            {isSignUp ? 'Bạn đã có tài khoản?' : 'Bạn chưa có tài khoản?'}
          </p>
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
            }}
            className="mt-xs text-primary font-bold hover:underline transition-all active:scale-95"
          >
            {isSignUp ? 'Đăng nhập ngay' : 'Tạo tài khoản mới'}
          </button>
        </div>
      </div>
    </div>
  );
}
