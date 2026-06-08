import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isMockEnabled = !supabaseUrl || !supabaseAnonKey;

// ─── Constants ────────────────────────────────────────────────────────────────
export const SUBJECT_NAME = 'Tư duy công nghệ và Thiết kế kỹ thuật';
export const TOTAL_WEEKS = 16;
export const TEACHER_EMAIL = 'teacher@edu.vn';
export const TEACHER_ID = 'teacher-uuid';

export function isUserTeacher(user: any): boolean {
  if (!user) return false;
  return user.id === TEACHER_ID || user.email === TEACHER_EMAIL || user.email?.endsWith('@teacher.edu.vn');
}

// ─── Game Definitions ─────────────────────────────────────────────────────────
export interface Game {
  id: number;
  name: string;
  icon: string;
  description: string;
  points: number;
  colorClass: string;
  enabled: boolean;
  order: number;
}

export const ALL_GAMES: Game[] = [
  { id: 1,  name: 'Đại chiến bom hẹn giờ',   icon: '💣', description: 'Trả lời nhanh câu hỏi trắc nghiệm để chuyền bom đi!', points: 15, colorClass: 'bg-primary-fixed-dim',  enabled: true,  order: 1  },
  { id: 2,  name: 'Đấu trường sinh tử',      icon: '🦖', description: 'Sinh tồn Kahoot-style qua các câu hỏi trắc nghiệm!',points: 15, colorClass: 'bg-secondary-fixed',     enabled: true,  order: 2  },
  { id: 3,  name: 'Điểm danh cùng GV',       icon: '🤝', description: 'Quét mã QR trực tiếp với giảng viên.',             points: 10, colorClass: 'bg-tertiary-fixed',      enabled: true,  order: 3  },
  { id: 4,  name: 'Thử thách nhóm',          icon: '👥', description: 'Hoàn thành nhiệm vụ cùng nhóm trong lớp.',         points: 20, colorClass: 'bg-primary-fixed-dim',  enabled: true,  order: 4  },
  { id: 5,  name: 'Kẻ giả mạo lớp học',      icon: '🕵️', description: 'Bình chọn tìm kẻ giả mạo trong nhóm thời gian thực.',points: 15, colorClass: 'bg-secondary-fixed',     enabled: true,  order: 5  },
  { id: 6,  name: 'Giơ tay trả lời',         icon: '✋', description: 'Trả lời câu hỏi bất ngờ trong buổi học.',          points: 10, colorClass: 'bg-tertiary-fixed',      enabled: true,  order: 6  },
  { id: 7,  name: 'Khảo sát phản hồi',       icon: '📊', description: 'Điền khảo sát nhanh cuối buổi học.',               points: 5,  colorClass: 'bg-primary-fixed-dim',  enabled: true,  order: 7  },
  { id: 8,  name: 'Chuỗi điểm danh 🔥',     icon: '🔥', description: 'Duy trì chuỗi điểm danh liên tục không gián đoạn.',points: 10, colorClass: 'bg-secondary-fixed',     enabled: true,  order: 8  },
  { id: 9,  name: 'Cuộc đua nối từ',         icon: '🔗', description: 'Chọn phương án nối từ đúng nhanh nhất lớp.',        points: 15, colorClass: 'bg-tertiary-fixed',      enabled: true,  order: 9  },
  { id: 10, name: 'Thách đấu 1-1',           icon: '⚔️', description: 'Thi đấu trực tiếp với bạn ngồi cạnh.',             points: 25, colorClass: 'bg-primary-fixed-dim',  enabled: true,  order: 10 },
  { id: 11, name: 'Bình chọn ý tưởng',       icon: '💡', description: 'Bình chọn ý tưởng hay nhất từ các nhóm.',          points: 10, colorClass: 'bg-secondary-fixed',     enabled: true,  order: 11 },
  { id: 12, name: 'Nộp bài nhanh',           icon: '📝', description: 'Nộp bài tập trước giờ học kết thúc.',              points: 10, colorClass: 'bg-tertiary-fixed',      enabled: true,  order: 12 },
  { id: 13, name: 'Kể chuyện 30 giây',       icon: '🎤', description: 'Thuyết trình ngắn về điều học được hôm nay.',       points: 15, colorClass: 'bg-primary-fixed-dim',  enabled: true,  order: 13 },
  { id: 14, name: 'Bonus tuần đặc biệt',     icon: '⭐', description: 'Điểm thưởng đặc biệt, chỉ mở vào tuần quan trọng!',points: 50, colorClass: 'bg-secondary-fixed',     enabled: true,  order: 14 },
  { id: 15, name: 'Đại chiến phản xạ',       icon: '⚡', description: 'Chờ màn hình chuyển màu xanh và nhấn nút phản xạ nhanh nhất lớp!', points: 15, colorClass: 'bg-tertiary-fixed',      enabled: true,  order: 15 },
  { id: 16, name: 'Chia sẻ học được gì',     icon: '💬', description: 'Chia sẻ điều mới học được với cả lớp hôm nay.',    points: 5,  colorClass: 'bg-primary-fixed-dim',  enabled: true,  order: 16 },
];

// ─── Teacher Settings ─────────────────────────────────────────────────────────
export interface TeacherSettings {
  currentWeek: number;
  sessionOpen: boolean;
  games: Game[];
}

export const DEFAULT_TEACHER_SETTINGS: TeacherSettings = {
  currentWeek: 1,
  sessionOpen: true,
  games: ALL_GAMES.map(g => ({ ...g })),
};

export function getTeacherSettings(): TeacherSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_TEACHER_SETTINGS, games: ALL_GAMES.map(g => ({ ...g })) };
  const str = localStorage.getItem('mock_teacher_settings');
  if (!str) {
    const s = { ...DEFAULT_TEACHER_SETTINGS, sessionOpen: true, games: ALL_GAMES.map(g => ({ ...g })) };
    localStorage.setItem('mock_teacher_settings', JSON.stringify(s));
    return s;
  }
  try {
    const parsed = JSON.parse(str);
    parsed.sessionOpen = true; // Force open
    if (parsed.games) {
      parsed.games = parsed.games.map((g: any) => ({ ...g, enabled: true }));
    } else {
      parsed.games = ALL_GAMES.map(g => ({ ...g }));
    }
    return parsed;
  } catch {
    return { ...DEFAULT_TEACHER_SETTINGS, sessionOpen: true, games: ALL_GAMES.map(g => ({ ...g })) };
  }
}

export function saveTeacherSettings(settings: TeacherSettings): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('mock_teacher_settings', JSON.stringify(settings));
  // Notify same-tab listeners (student page polling will pick this up)
  window.dispatchEvent(new Event('teacher-settings-changed'));
}

// ─── Game Content (Teacher-configured per week) ───────────────────────────────
export interface QuizQuestion { q: string; opts: [string,string,string,string]; ans: number; }
export interface GameContent {
  secretQuestion?:  string;
  entryCode?:       string;
  teamChallenge?:   string;
  keyword?:         string;
  keywordHint?:     string;
  quizQuestions?:   QuizQuestion[];
  duelQuestion?:    string;
  reviewQuestions?: string[];
}
export const DEFAULT_GAME_CONTENT: GameContent = {
  secretQuestion:  'Quy trình thiết kế kỹ thuật gồm mấy bước chính?',
  entryCode:       '2025',
  teamChallenge:   'Thảo luận nhóm: Thiết kế giải pháp giải quyết vấn đề giao thông đô thị trong 10 phút.',
  keyword:         'prototype',
  keywordHint:     'Mô hình thử nghiệm đầu tiên trước khi sản xuất hàng loạt',
  quizQuestions: [
    { q: 'Bước đầu tiên trong quy trình thiết kế kỹ thuật là?', opts: ['Xác định vấn đề','Tạo nguyên mẫu','Thử nghiệm','Đánh giá'], ans: 0 },
    { q: 'Design Thinking gồm bao nhiêu giai đoạn?', opts: ['3','4','5','6'], ans: 2 },
    { q: 'Prototype dùng để làm gì?', opts: ['Bán sản phẩm','Kiểm tra ý tưởng','Viết tài liệu','Tính chi phí'], ans: 1 },
  ],
  duelQuestion:    'Mô hình 4C trong tư duy sáng tạo gồm những yếu tố nào?',
  reviewQuestions: ['Bài học tuần trước nói về chủ đề gì?', 'Liệt kê 3 điều quan trọng nhất bạn nhớ.'],
};
export function getGameContent(weekNumber: number): GameContent {
  if (typeof window === 'undefined') return DEFAULT_GAME_CONTENT;
  try { const a = JSON.parse(localStorage.getItem('mock_game_content') || '{}'); return { ...DEFAULT_GAME_CONTENT, ...(a[weekNumber] || {}) }; }
  catch { return DEFAULT_GAME_CONTENT; }
}
export function saveGameContent(weekNumber: number, patch: Partial<GameContent>): void {
  if (typeof window === 'undefined') return;
  const a = JSON.parse(localStorage.getItem('mock_game_content') || '{}');
  a[weekNumber] = { ...(a[weekNumber] || {}), ...patch };
  localStorage.setItem('mock_game_content', JSON.stringify(a));
}

// ─── Mock Profiles ────────────────────────────────────────────────────────────
const DEFAULT_PROFILES = [
  {
    id: 'jane-doe-uuid',
    full_name: 'Trần Thị Lan',
    avatar_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuA34VnqX9FFdaSMK1CiAOc6nPeKk_6EQtG239de6uYCNQaeqO-_V2nuU4f2L_LJBwfUUYqIahRSy0dEcaREeoZ3q8Bq4rJ_rEdR1qaQR97Di2AHA1677rB7_TOcksUbb_KdNXGXKu6eDLhw6KieqldAjXGFpsZ5gkTMMDJ9IIsE6J7ughPP6PkyWvMvsVaVkg3l_W2PgHoNZhY-VsyS_TJBW_ZdXzGx3LZ27iDtDEugTW-JfjZBnbMryJRZxP5t1nW3dm8w5zLE4n8',
    streak: 12, total_points: 450, attendance_rate: 98.0, email: 'lan.tran@student.edu.vn', role: 'student'
  },
  {
    id: 'mark-smith-uuid',
    full_name: 'Nguyễn Hoàng Nam',
    avatar_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuClsKc6Ieiu44C6_90TuM79aukUWgqrTHPf7UUJXB-VMN8NsOgfqOviFgmf2leLRFuj4hZGpnD2bif0skpWyXWKYrUH2VCuiGjV27GUAfPmXNO6X6P3JKNUU2mXgBCEMzXoStOZcLETZP8Icfajb7XcOSxcQnUckyxpDkBlvnznQD3QphwLr-jF2hSB-0O9u2btA4UPV6g-b6gQydmnmB6xOctr2U5Etwuic3joZtgxEfkW1EBq3ePrIFSZHI-Tf_tAYtD_ZvBk5H8',
    streak: 8,  total_points: 420, attendance_rate: 90.0, email: 'nam.nguyen@student.edu.vn', role: 'student'
  },
  {
    id: 'amy-lee-uuid',
    full_name: 'Lê Hải Yến',
    avatar_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCRB2lGfOoYir30qQ3qda6wsJ_VSkZfCJ1cM8vdA6E2bqIbZOab_4mzurh0m1nMKcrovSJkdrBM67F-LJ5ZYMdYwjxy5TuMuoqVwR0ZbpFMp6mp1vAhbF_Gl8850fl6xClvXfYRW7v-sWFHOQMmX692pMGMmiVMqSmSo-BueDZNVHqdu_w2gv1SbWtHwpLVKk-UHo8bZA84Q1gca--G6RABzkByKw5tGBtgLiw8xj8BbJZ5dBuYc8YcLRYz13ORX_lzf5JaKj0sN-8',
    streak: 10, total_points: 415, attendance_rate: 93.0, email: 'yen.le@student.edu.vn', role: 'student'
  },
  {
    id: 'tom-baker-uuid',
    full_name: 'Phạm Gia Bảo',
    avatar_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuD5-kXMc7RU3en05q9Uly7YAUrFlAwtMVuNiUwZRO_kHQ1AjMfgJVwycNaspmQ-5jClk7mtfw051rXz_HG94Y89lSDcUxKBVScvvKAZiWuHQEWYutiIJHjLF6W_5iX3bgLYn5kkuOYVVNbhp7w9kqpmPcRd7msvPEb1jVO0Ve-fn6uQ9ChSb4-lPTWWRaaYP3FGaQAGv6rsz4xrV1T6zFQnYeJl2xfv8kHpJ80AQ7EeoVB9PVkGyEXT-g12KTj_XD9WE_7-JomN8-8',
    streak: 4,  total_points: 248, attendance_rate: 85.0, email: 'bao.pham@student.edu.vn', role: 'student'
  }
];

const DEFAULT_ACTIVITIES = [
  { id: '1', user_id: 'me-uuid', activity_type: 'Điểm danh nhanh nhất',    description: `${SUBJECT_NAME} • Tuần 3`, points: 15, created_at: new Date(Date.now() - 3600000 * 2).toISOString() },
  { id: '2', user_id: 'me-uuid', activity_type: 'Kỷ lục chuỗi điểm danh', description: 'Đạt chuỗi 10 ngày! • Tuần 2',                    points: 50, created_at: new Date(Date.now() - 3600000 * 24 * 2).toISOString() },
  { id: '3', user_id: 'me-uuid', activity_type: 'Đã điểm danh lớp học',   description: `${SUBJECT_NAME} • Tuần 2`, points: 10, created_at: new Date(Date.now() - 3600000 * 24 * 3).toISOString() },
  { id: '4', user_id: 'me-uuid', activity_type: 'Khảo sát phản hồi',      description: 'Điền khảo sát nhanh • Tuần 2',                    points: 5,  created_at: new Date(Date.now() - 3600000 * 24 * 4).toISOString() },
  { id: '5', user_id: 'me-uuid', activity_type: 'Đã điểm danh lớp học',   description: `${SUBJECT_NAME} • Tuần 1`, points: 10, created_at: new Date(Date.now() - 3600000 * 24 * 5).toISOString() },
];

// ─── Mock Helpers ─────────────────────────────────────────────────────────────
function getMockSession() {
  if (typeof window === 'undefined') return null;
  const s = localStorage.getItem('mock_session');
  return s ? JSON.parse(s) : null;
}

function initializeMockDatabase() {
  if (typeof window === 'undefined') return;
  if (!localStorage.getItem('mock_profiles'))    localStorage.setItem('mock_profiles',         JSON.stringify(DEFAULT_PROFILES));
  if (!localStorage.getItem('mock_activities'))  localStorage.setItem('mock_activities',        JSON.stringify(DEFAULT_ACTIVITIES));
  if (!localStorage.getItem('mock_check_ins'))   localStorage.setItem('mock_check_ins',         JSON.stringify([]));
  if (!localStorage.getItem('mock_teacher_settings')) localStorage.setItem('mock_teacher_settings', JSON.stringify(DEFAULT_TEACHER_SETTINGS));
}

// ─── Mock Supabase Client ─────────────────────────────────────────────────────
function getMockSupabaseClient(): any {
  initializeMockDatabase();

  return {
    auth: {
      getUser: async () => {
        const session = getMockSession();
        if (!session) return { data: { user: null }, error: null };
        return { data: { user: session.user }, error: null };
      },
      getSession: async () => {
        const session = getMockSession();
        return { data: { session }, error: null };
      },
      signInWithPassword: async ({ email }: { email: string }) => {
        const isTeacher = email === TEACHER_EMAIL || email.endsWith('@teacher.edu.vn');
        const userId    = isTeacher ? TEACHER_ID : 'me-uuid';
        const role      = isTeacher ? 'teacher' : 'student';
        const user = {
          id: userId, email, role,
          user_metadata: {
            full_name: isTeacher ? 'Giảng viên' : 'Nguyễn Văn A',
            avatar_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAmGPFVAAaMkg5aUJhLN2BvApjkuO_Wpd0TV85ayhw0D1Chk4B0xjktsKqvWI4Xz49ZaFzD8xNev_EManm18MZUWoqzzPPZZ7tvFDc5S14ChgzBgZehfiAmsmwMxQrn7pWYjbn6IryJBnnXu0N5SYppwDPbOukSsSBL7XJ_lZKw-x7BVdOWKaQM13bHJXvc7WCjj7FvzZ_0fmJpiqWQIfbVviaclfTbJsYPI7rSzS-hpRMNrnp2CYB_3GIL0Ky0ZGWwtYp6ik_ovNo',
          },
        };
        const session = { user, access_token: 'mock-token' };
        localStorage.setItem('mock_session', JSON.stringify(session));

        if (!isTeacher) {
          const profiles = JSON.parse(localStorage.getItem('mock_profiles') || '[]');
          if (!profiles.some((p: any) => p.id === userId)) {
            profiles.push({ id: userId, full_name: 'Nguyễn Văn A', avatar_url: user.user_metadata.avatar_url, streak: 12, total_points: 210, attendance_rate: 95.0, email, role: 'student' });
            localStorage.setItem('mock_profiles', JSON.stringify(profiles));
          }
        }
        return { data: { session, user }, error: null };
      },
      signUp: async ({ email, options }: { email: string; options?: any }) => {
        const fullName = options?.data?.full_name || 'Nguyễn Văn A';
        const userId   = 'me-uuid';
        const user = {
          id: userId, email, role: 'student',
          user_metadata: { full_name: fullName, avatar_url: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAmGPFVAAaMkg5aUJhLN2BvApjkuO_Wpd0TV85ayhw0D1Chk4B0xjktsKqvWI4Xz49ZaFzD8xNev_EManm18MZUWoqzzPPZZ7tvFDc5S14ChgzBgZehfiAmsmwMxQrn7pWYjbn6IryJBnnXu0N5SYppwDPbOukSsSBL7XJ_lZKw-x7BVdOWKaQM13bHJXvc7WCjj7FvzZ_0fmJpiqWQIfbVviaclfTbJsYPI7rSzS-hpRMNrnp2CYB_3GIL0Ky0ZGWwtYp6ik_ovNo' },
        };
        const session = { user, access_token: 'mock-token' };
        localStorage.setItem('mock_session', JSON.stringify(session));
        const profiles = JSON.parse(localStorage.getItem('mock_profiles') || '[]');
        if (!profiles.some((p: any) => p.id === userId)) {
          profiles.push({ id: userId, full_name: fullName, avatar_url: user.user_metadata.avatar_url, streak: 0, total_points: 0, attendance_rate: 100.0, email, role: 'student' });
          localStorage.setItem('mock_profiles', JSON.stringify(profiles));
        }
        return { data: { session, user }, error: null };
      },
      signOut: async () => {
        localStorage.removeItem('mock_session');
        return { error: null };
      },
      onAuthStateChange: (callback: Function) => {
        const session = getMockSession();
        callback(session ? 'SIGNED_IN' : 'SIGNED_OUT', session);
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
    },

    from: (table: string) => {
      const builder = {
        _filters: [] as { col: string; val: any }[],
        _orderCol: null as string | null,
        _ascending: false,
        _isSingle: false,
        _insertData: null as any,
        _isDelete: false,

        select(_c?: string) { return this; },
        eq(col: string, val: any) { this._filters.push({ col, val }); return this; },
        order(col: string, opts?: { ascending?: boolean }) { this._orderCol = col; this._ascending = !!opts?.ascending; return this; },
        single() { this._isSingle = true; return this; },
        insert(data: any) { this._insertData = data; return this; },
        delete() { this._isDelete = true; return this; },

        then(resolve: any, _reject?: any) {
          try {
            // ── DELETE ──────────────────────────────────────────────────────
            if (this._isDelete) {
              if (table === 'check_ins') {
                let checkIns = JSON.parse(localStorage.getItem('mock_check_ins') || '[]');
                let toDelete = [...checkIns];
                this._filters.forEach(f => {
                  toDelete = toDelete.filter(p => p[f.col] === f.val);
                });

                if (toDelete.length > 0) {
                  const profiles = JSON.parse(localStorage.getItem('mock_profiles') || '[]');
                  toDelete.forEach((ci: any) => {
                    const profile = profiles.find((p: any) => p.id === ci.user_id);
                    if (profile) {
                      profile.total_points = Math.max(0, profile.total_points - ci.points_earned);
                      profile.streak = Math.max(0, profile.streak - 1);
                    }
                  });
                  localStorage.setItem('mock_profiles', JSON.stringify(profiles));
                }

                this._filters.forEach(f => {
                  checkIns = checkIns.filter((p: any) => p[f.col] !== f.val);
                });
                localStorage.setItem('mock_check_ins', JSON.stringify(checkIns));
                resolve({ data: toDelete, error: null });
                return;
              }
              resolve({ data: null, error: null });
              return;
            }

            // ── INSERT ──────────────────────────────────────────────────────
            if (this._insertData) {
              if (table === 'check_ins') {
                const checkIn = Array.isArray(this._insertData) ? this._insertData[0] : this._insertData;
                const checkIns = JSON.parse(localStorage.getItem('mock_check_ins') || '[]');
                checkIn.id = `checkin-${Date.now()}`;
                checkIn.created_at = new Date().toISOString();
                checkIns.push(checkIn);
                localStorage.setItem('mock_check_ins', JSON.stringify(checkIns));

                // Update profile points + streak
                const profiles = JSON.parse(localStorage.getItem('mock_profiles') || '[]');
                const myProfile = profiles.find((p: any) => p.id === 'me-uuid');
                if (myProfile) {
                  myProfile.total_points    += checkIn.points_earned;
                  myProfile.streak          += 1;
                  myProfile.attendance_rate  = 95.0;
                  localStorage.setItem('mock_profiles', JSON.stringify(profiles));
                }

                // Log activity
                const activities = JSON.parse(localStorage.getItem('mock_activities') || '[]');
                activities.unshift({
                  id: `act-${Date.now()}`,
                  user_id: 'me-uuid',
                  activity_type: checkIn.game_name || 'Đã điểm danh lớp học',
                  description: `${SUBJECT_NAME} • Tuần ${checkIn.week_number}`,
                  points: checkIn.points_earned,
                  created_at: new Date().toISOString(),
                });
                localStorage.setItem('mock_activities', JSON.stringify(activities));

                // Trigger real-time leaderboard callback
                if (typeof window !== 'undefined' && (window as any)._leaderboardCallback) {
                  setTimeout(() => (window as any)._leaderboardCallback({ new: myProfile, old: myProfile, eventType: 'UPDATE' }), 500);
                }

                resolve({ data: [checkIn], error: null });
                return;
              }
              resolve({ data: null, error: null });
              return;
            }

            // ── SELECT ──────────────────────────────────────────────────────
            let result: any = null;
            const applyFilters = (arr: any[]) => {
              let r = [...arr];
              this._filters.forEach(f => { r = r.filter(p => p[f.col] === f.val); });
              return r;
            };

            if (table === 'profiles') {
              let filtered = applyFilters(JSON.parse(localStorage.getItem('mock_profiles') || '[]'));
              if (this._orderCol) {
                const col = this._orderCol, asc = this._ascending;
                filtered.sort((a, b) => asc ? a[col] - b[col] : b[col] - a[col]);
              }
              result = this._isSingle ? (filtered[0] || null) : filtered;

            } else if (table === 'activity_log') {
              let filtered = applyFilters(JSON.parse(localStorage.getItem('mock_activities') || '[]'));
              filtered.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
              result = this._isSingle ? (filtered[0] || null) : filtered;

            } else if (table === 'check_ins') {
              let filtered = applyFilters(JSON.parse(localStorage.getItem('mock_check_ins') || '[]'));
              result = this._isSingle ? (filtered[0] || null) : filtered;

            } else {
              result = this._isSingle ? null : [];
            }

            resolve({ data: result, error: null });
          } catch (e: any) {
            resolve({ data: null, error: e });
          }
        },
      };
      return builder;
    },

    channel: (channelName: string) => ({
      on: (_event: string, _filter: any, callback: Function) => {
        if (typeof window !== 'undefined') (window as any)._leaderboardCallback = callback;
        return {
          subscribe: () => {
            const interval = setInterval(() => {
              const profiles = JSON.parse(localStorage.getItem('mock_profiles') || '[]');
              const others   = profiles.filter((p: any) => p.id !== 'me-uuid' && p.id !== TEACHER_ID);
              if (others.length > 0) {
                const rnd = others[Math.floor(Math.random() * others.length)];
                rnd.total_points += Math.floor(Math.random() * 15) + 5;
                if (Math.random() > 0.8) rnd.streak += 1;
                localStorage.setItem('mock_profiles', JSON.stringify(profiles));
                callback({ new: rnd, old: rnd, eventType: 'UPDATE' });
              }
            }, 12000);
            return { unsubscribe: () => clearInterval(interval) };
          },
        };
      },
    }),

    removeChannel: (channel: any) => {
      if (channel?.unsubscribe) channel.unsubscribe();
      return Promise.resolve({ error: null });
    },
  };
}

let cachedClient: any = null;

export function createClient() {
  if (cachedClient) return cachedClient;

  if (isMockEnabled) {
    cachedClient = getMockSupabaseClient();
  } else {
    cachedClient = createBrowserClient(supabaseUrl!, supabaseAnonKey!);
  }
  return cachedClient;
}
