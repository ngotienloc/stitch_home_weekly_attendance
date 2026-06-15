'use client';

import { useEffect, useState, useRef, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Header from '@/components/Header';
import BottomNav from '@/components/BottomNav';
import { createClient } from '@/utils/supabase/client';

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
  streak: number;
  total_points: number;
  email?: string;
}

export default function LeaderboardPage() {
  const router = useRouter();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'week' | 'friends'>('all');
  const [loading, setLoading] = useState(true);
  const [updatedUserId, setUpdatedUserId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const supabase = createClient();

  useEffect(() => {
    async function loadData() {
      // 1. Get current logged in user ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        document.cookie = 'mock_session=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        router.push('/login');
        return;
      }
      if (user) {
        setCurrentUserId(user.id);
      }

      // 2. Fetch profiles sorted by total_points
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .order('total_points', { ascending: false });
      
      if (data) {
        setProfiles(data as Profile[]);
      }
      setLoading(false);
    }
    
    loadData();

    // 3. Subscribe to real-time changes on profiles
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'profiles' },
        (payload: any) => {
          const updatedProfile = payload.new as Profile;
          
          // Flash the updated row
          setUpdatedUserId(updatedProfile.id);
          if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
          updateTimeoutRef.current = setTimeout(() => setUpdatedUserId(null), 1500);

          setProfiles((prev) => {
            const index = prev.findIndex((p) => p.id === updatedProfile.id);
            let updatedList = [...prev];
            if (index >= 0) {
              updatedList[index] = { ...updatedList[index], ...updatedProfile };
            } else {
              updatedList.push(updatedProfile);
            }
            // Sort descending
            return updatedList.sort((a, b) => b.total_points - a.total_points);
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (updateTimeoutRef.current) clearTimeout(updateTimeoutRef.current);
    };
  }, []);

  // Filter profiles based on active tab
  const filtered = useMemo(() => {
    if (activeTab === 'week') {
      // Simulated weekly offset or filter: for demo, subtract some points or filter
      return [...profiles]
        .map(p => ({
          ...p,
          // Subtract varying points to simulate weekly scores
          total_points: Math.max(0, p.total_points - (p.id === 'me-uuid' ? 40 : p.id.charCodeAt(0) % 50))
        }))
        .sort((a, b) => b.total_points - a.total_points);
    }
    
    if (activeTab === 'friends') {
      // Filter only current user and a subset of friends (e.g. Trần Thị Lan & Nguyễn Hoàng Nam)
      return profiles.filter(p => 
        p.id === currentUserId || 
        p.full_name === 'Trần Thị Lan' || 
        p.full_name === 'Nguyễn Hoàng Nam'
      );
    }
    
    return profiles;
  }, [profiles, activeTab, currentUserId]);

  // Find current user rank
  const userRankIndex = filtered.findIndex((p) => p.id === currentUserId);
  const userRank = userRankIndex >= 0 ? userRankIndex + 1 : null;
  const userProfile = userRankIndex >= 0 ? filtered[userRankIndex] : null;

  // Split into Top 3 and Others
  const top3 = filtered.slice(0, 3);
  const others = filtered.slice(3);

  // Default avatars
  const defaultAvatars: Record<string, string> = {
    'Trần Thị Lan': 'https://lh3.googleusercontent.com/aida-public/AB6AXuA34VnqX9FFdaSMK1CiAOc6nPeKk_6EQtG239de6uYCNQaeqO-_V2nuU4f2L_LJBwfUUYqIahRSy0dEcaREeoZ3q8Bq4rJ_rEdR1qaQR97Di2AHA1677rB7_TOcksUbb_KdNXGXKu6eDLhw6KieqldAjXGFpsZ5gkTMMDJ9IIsE6J7ughPP6PkyWvMvsVaVkg3l_W2PgHoNZhY-VsyS_TJBW_ZdXzGx3LZ27iDtDEugTW-JfjZBnbMryJRZxP5t1nW3dm8w5zLE4n8',
    'Nguyễn Hoàng Nam': 'https://lh3.googleusercontent.com/aida-public/AB6AXuClsKc6Ieiu44C6_90TuM79aukUWgqrTHPf7UUJXB-VMN8NsOgfqOviFgmf2leLRFuj4hZGpnD2bif0skpWyXWKYrUH2VCuiGjV27GUAfPmXNO6X6P3JKNUU2mXgBCEMzXoStOZcLETZP8Icfajb7XcOSxcQnUckyxpDkBlvnznQD3QphwLr-jF2hSB-0O9u2btA4UPV6g-b6gQydmnmB6xOctr2U5Etwuic3joZtgxEfkW1EBq3ePrIFSZHI-Tf_tAYtD_ZvBk5H8',
    'Lê Hải Yến': 'https://lh3.googleusercontent.com/aida-public/AB6AXuCRB2lGfOoYir30qQ3qda6wsJ_VSkZfCJ1cM8vdA6E2bqIbZOab_4mzurh0m1nMKcrovSJkdrBM67F-LJ5ZYMdYwjxy5TuMuoqVwR0ZbpFMp6mp1vAhbF_Gl8850fl6xClvXfYRW7v-sWFHOQMmX692pMGMmiVMqSmSo-BueDZNVHqdu_w2gv1SbWtHwpLVKk-UHo8bZA84Q1gca--G6RABzkByKw5tGBtgLiw8xj8BbJZ5dBuYc8YcLRYz13ORX_lzf5JaKj0sN-8',
    'Phạm Gia Bảo': 'https://lh3.googleusercontent.com/aida-public/AB6AXuD5-kXMc7RU3en05q9Uly7YAUrFlAwtMVuNiUwZRO_kHQ1AjMfgJVwycNaspmQ-5jClk7mtfw051rXz_HG94Y89lSDcUxKBVScvvKAZiWuHQEWYutiIJHjLF6W_5iX3bgLYn5kkuOYVVNbhp7w9kqpmPcRd7msvPEb1jVO0Ve-fn6uQ9ChSb4-lPTWWRaaYP3FGaQAGv6rsz4xrV1T6zFQnYeJl2xfv8kHpJ80AQ7EeoVB9PVkGyEXT-g12KTj_XD9WE_7-JomN8-8'
  };

  const getAvatar = (p: Profile) => {
    if (p.avatar_url) return p.avatar_url;
    return defaultAvatars[p.full_name] || 'https://lh3.googleusercontent.com/aida-public/AB6AXuAmGPFVAAaMkg5aUJhLN2BvApjkuO_Wpd0TV85ayhw0D1Chk4B0xjktsKqvWI4Xz49ZaFzD8xNev_EManm18MZUWoqzzPPZZ7tvFDc5S14ChgzBgZehfiAmsmwMxQrn7pWYjbn6IryJBnnXu0N5SYppwDPbOukSsSBL7XJ_lZKw-x7BVdOWKaQM13bHJXvc7WCjj7FvzZ_0fmJpiqWQIfbVviaclfTbJsYPI7rSzS-hpRMNrnp2CYB_3GIL0Ky0ZGWwtYp6ik_ovNo';
  };

  const getMedalEmoji = (rank: number) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return '';
  };

  const getRankBg = (rank: number) => {
    if (rank === 1) return 'bg-gold/10 border-gold/20';
    if (rank === 2) return 'bg-silver/10 border-silver/20';
    if (rank === 3) return 'bg-bronze/10 border-bronze/20';
    return '';
  };

  const getRankTextColour = (rank: number) => {
    if (rank === 1) return 'text-[#B8860B]';
    if (rank === 2) return 'text-[#707070]';
    if (rank === 3) return 'text-[#8B4513]';
    return 'text-on-surface-variant';
  };

  return (
    <div className="flex flex-col min-h-screen bg-background text-on-background pb-32">
      <Header />

      <main className="flex-grow w-full max-w-[600px] mx-auto px-container-margin pt-lg">
        
        {/* Leaderboard Hero Header */}
        <div className="bg-secondary-container rounded-[24px] p-lg mb-lg flex items-center justify-between text-on-secondary-container glow-secondary relative overflow-hidden animate-fade-in-up">
          <div className="absolute -right-4 -top-4 opacity-20">
            <span className="material-symbols-outlined text-[120px]" style={{ fontVariationSettings: "'FILL' 1" }}>emoji_events</span>
          </div>
          <div className="relative z-10">
            <h1 className="text-2xl font-extrabold font-display-hero">Bảng xếp hạng</h1>
            <p className="text-sm font-bold opacity-90 mt-1">Hôm nay ai là anh hùng dẫn đầu?</p>
          </div>
          <div className="relative z-10 bg-white/20 p-sm rounded-full backdrop-blur-sm animate-trophy-hero">
            <span className="material-symbols-outlined text-[40px] text-white" style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
          </div>
        </div>

        {/* Ranking Filter/Tabs */}
        <div className="flex gap-sm mb-md overflow-x-auto no-scrollbar py-xs animate-fade-in-up stagger-1">
          <button
            onClick={() => startTransition(() => setActiveTab('all'))}
            className={`px-lg py-sm rounded-full text-sm font-bold transition-all duration-300 active:scale-95 ${
              activeTab === 'all'
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container-high text-on-surface-variant hover:bg-primary-container/20'
            }`}
          >
            Tất cả
          </button>
          <button
            onClick={() => startTransition(() => setActiveTab('week'))}
            className={`px-lg py-sm rounded-full text-sm font-bold transition-all duration-300 active:scale-95 ${
              activeTab === 'week'
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container-high text-on-surface-variant hover:bg-primary-container/20'
            }`}
          >
            Tuần này
          </button>
          <button
            onClick={() => startTransition(() => setActiveTab('friends'))}
            className={`px-lg py-sm rounded-full text-sm font-bold transition-all duration-300 active:scale-95 ${
              activeTab === 'friends'
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container-high text-on-surface-variant hover:bg-primary-container/20'
            }`}
          >
            Bạn bè
          </button>
        </div>

        {/* Leaderboard List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <span className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></span>
            <p className="text-sm font-semibold text-on-surface-variant mt-md">Đang tải bảng xếp hạng...</p>
          </div>
        ) : (
          <div className="space-y-sm animate-fade-in-up stagger-2" id="leaderboard-list">
            
            {/* Top 3 Ranks */}
            {top3.map((profile, index) => {
              const rank = index + 1;
              const isMe = profile.id === currentUserId;
              const isUpdated = profile.id === updatedUserId;

              return (
                <div
                  key={profile.id}
                  className={`leaderboard-row border p-md rounded-[24px] flex items-center gap-md transition-all duration-500 hover:scale-[1.02] active:scale-95 shimmer ${
                    isMe 
                      ? 'bg-primary-container border-primary/20 glow-primary scale-[1.03] shadow-md' 
                      : getRankBg(rank)
                  } ${isUpdated ? 'ring-4 ring-tertiary-container border-transparent scale-[1.04]' : ''}`}
                >
                  <div className={`w-8 flex justify-center text-xl font-bold font-headline-md ${isMe ? 'text-on-primary-container' : getRankTextColour(rank)}`}>
                    {rank}
                  </div>
                  <div className="relative">
                    <img 
                      alt={`${profile.full_name} Avatar`} 
                      className="w-12 h-12 rounded-full border-2 border-white object-cover"
                      src={getAvatar(profile)}
                    />
                    <span className="absolute -bottom-1 -right-1 bg-white rounded-full p-[2px] text-[12px] shadow-sm select-none">
                      {getMedalEmoji(rank)}
                    </span>
                    {isMe && (
                      <div className="absolute -top-1 -left-1 bg-secondary text-[8px] text-white font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter animate-pulse-badge">
                        Bạn
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className={`font-bold font-headline-md text-base leading-tight ${isMe ? 'text-on-primary-container' : 'text-on-surface'}`}>
                      {profile.full_name}
                    </h3>
                    <div className="flex items-center gap-xs">
                      <span className={`text-xs font-semibold ${isMe ? 'text-on-primary-container/85' : 'text-secondary'}`}>
                        🔥 Chuỗi {profile.streak} ngày
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-xl font-bold font-headline-md ${isMe ? 'text-on-primary-container' : 'text-primary'}`}>
                      {profile.total_points}
                    </span>
                    <p className={`text-[10px] font-bold uppercase tracking-wider ${isMe ? 'text-on-primary-container/70' : 'text-outline'}`}>
                      điểm
                    </p>
                  </div>
                </div>
              );
            })}

            {/* If there are elements beyond rank 3 */}
            {others.length > 0 && (
              <>
                {/* Spacer dots (Only shown if "You" are in the "others" group, representing rankings in between) */}
                {userRank && userRank > 3 && (
                  <div className="flex flex-col items-center py-2 gap-1 animate-pulse" id="dots-spacer">
                    <div className="w-1.5 h-1.5 bg-outline-variant rounded-full"></div>
                    <div className="w-1.5 h-1.5 bg-outline-variant rounded-full"></div>
                    <div className="w-1.5 h-1.5 bg-outline-variant rounded-full"></div>
                  </div>
                )}

                {/* Highlighted Current User if outside top 3 */}
                {userRank && userRank > 3 && userProfile && (
                  <div
                    className={`leaderboard-row bg-primary-container p-md rounded-[24px] flex items-center gap-md border-2 border-primary/20 glow-primary transition-all duration-500 scale-[1.03] shadow-lg ${
                      updatedUserId === userProfile.id ? 'ring-4 ring-tertiary-container border-transparent scale-[1.04]' : ''
                    }`}
                  >
                    <div className="w-8 flex justify-center text-xl font-bold font-headline-md text-on-primary-container">
                      {userRank}
                    </div>
                    <div className="relative">
                      <img 
                        alt={`${userProfile.full_name} Avatar`} 
                        className="w-12 h-12 rounded-full border-2 border-white object-cover"
                        src={getAvatar(userProfile)}
                      />
                      <div className="absolute -top-1 -left-1 bg-secondary text-[8px] text-white font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter animate-pulse-badge">
                        Bạn
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-bold font-headline-md text-on-primary-container leading-tight">
                        {userProfile.full_name}
                      </h3>
                      <div className="flex items-center gap-xs">
                        <span className="text-xs font-semibold text-on-primary-container/85">
                          🔥 Chuỗi {userProfile.streak} ngày
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xl font-bold font-headline-md text-on-primary-container">
                        {userProfile.total_points}
                      </span>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-on-primary-container opacity-70">
                        điểm
                      </p>
                    </div>
                  </div>
                )}

                {/* Vertical spacer dots before showing trailing rows */}
                {(!userRank || userRank <= 3) && (
                  <div className="flex flex-col items-center py-2 gap-1" id="dots-spacer">
                    <div className="w-1 h-1 bg-outline-variant rounded-full"></div>
                    <div className="w-1 h-1 bg-outline-variant rounded-full"></div>
                    <div className="w-1 h-1 bg-outline-variant rounded-full"></div>
                  </div>
                )}

                {/* Display trailing users (limit to next few for mobile layout) */}
                {others
                  .filter((p) => p.id !== currentUserId) // Hide current user since they are highlighted above
                  .slice(0, 3) // Show first few of remaining list
                  .map((profile) => {
                    const originalRank = filtered.findIndex((p) => p.id === profile.id) + 1;
                    const isUpdated = profile.id === updatedUserId;

                    return (
                      <div
                        key={profile.id}
                        className={`leaderboard-row bg-surface-container-low p-md rounded-[24px] flex items-center gap-md opacity-75 border border-outline-variant/10 transition-all duration-500 hover:opacity-100 hover:scale-[1.02] active:scale-95 ${
                          isUpdated ? 'ring-4 ring-tertiary-container border-transparent scale-[1.04] opacity-100' : ''
                        }`}
                      >
                        <div className="w-8 flex justify-center text-sm font-bold text-on-surface-variant font-label-bold">
                          {originalRank}
                        </div>
                        <div className="relative">
                          <img 
                            alt={`${profile.full_name} Avatar`} 
                            className="w-10 h-10 rounded-full border border-white grayscale object-cover"
                            src={getAvatar(profile)}
                          />
                        </div>
                        <div className="flex-grow">
                          <h3 className="text-sm font-bold text-on-surface font-label-bold leading-tight">
                            {profile.full_name}
                          </h3>
                          <div className="flex items-center gap-xs">
                            <span className="text-[10px] font-semibold text-outline">
                              🔥 Chuỗi {profile.streak} ngày
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-bold text-on-surface-variant font-label-bold">
                            {profile.total_points}
                          </span>
                          <p className="text-[8px] font-bold uppercase text-outline">
                            điểm
                          </p>
                        </div>
                      </div>
                    );
                  })}
              </>
            )}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  );
}
