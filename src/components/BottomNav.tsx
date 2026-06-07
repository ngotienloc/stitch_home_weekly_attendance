'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient, isUserTeacher } from '@/utils/supabase/client';

export default function BottomNav() {
  const pathname  = usePathname();
  const router    = useRouter();
  const supabase  = createClient();
  const [isTeacher, setIsTeacher] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then((res: any) => {
      const user = res?.data?.user;
      setIsTeacher(!!user && isUserTeacher(user));
    }).catch((err) => {
      console.error('Failed to get user in BottomNav:', err);
    });
  }, [supabase]);

  // Teacher gets a separate nav
  if (isTeacher) {
    const teacherTabs = [
      { name: 'Quản lý', path: '/teacher',     icon: 'admin_panel_settings' },
      { name: 'BXH',     path: '/leaderboard', icon: 'leaderboard'          },
    ];
    return (
      <nav className="bg-secondary-container fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[600px] flex justify-around items-center py-xs px-md pb-safe rounded-t-[20px] z-50 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] border-t border-outline-variant/10">
        {teacherTabs.map(tab => {
          const isActive = pathname === tab.path;
          return (
            <button
              key={tab.path}
              onClick={() => router.push(tab.path)}
              className="flex flex-col items-center justify-center flex-1 py-1 transition-all duration-300 ease-out active:scale-95 text-center group cursor-pointer"
            >
              <div className={`w-16 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${isActive ? 'bg-secondary text-white shadow-md scale-105' : 'text-on-secondary-container/70 group-hover:bg-white/20'}`}>
                <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>
                  {tab.icon}
                </span>
              </div>
              <span className={`text-[11px] font-bold mt-1 transition-colors duration-300 ${isActive ? 'text-on-secondary-container font-extrabold' : 'text-on-secondary-container/60 font-semibold'}`}>
                {tab.name}
              </span>
            </button>
          );
        })}
      </nav>
    );
  }

  // Student nav
  const tabs = [
    { name: 'Trang chủ',      path: '/home',        icon: 'home'        },
    { name: 'Bảng xếp hạng', path: '/leaderboard', icon: 'leaderboard' },
    { name: 'Cá nhân',        path: '/profile',     icon: 'person'      },
  ];

  return (
    <nav className="bg-white fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[600px] flex justify-around items-center py-xs px-md pb-safe rounded-t-[20px] z-50 shadow-[0_-4px_16px_rgba(0,0,0,0.04)] border-t border-outline-variant/10">
      {tabs.map(tab => {
        const isActive = pathname === tab.path;
        return (
          <button
            key={tab.path}
            onClick={() => router.push(tab.path)}
            className="flex flex-col items-center justify-center flex-1 py-1 transition-all duration-300 ease-out active:scale-95 text-center group cursor-pointer"
          >
            <div className={`w-16 h-8 rounded-full flex items-center justify-center transition-all duration-300 ${isActive ? 'bg-primary text-white shadow-[0_4px_10px_rgba(77,65,223,0.3)] scale-105' : 'text-on-surface-variant group-hover:bg-surface-container-high'}`}>
              <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0" }}>
                {tab.icon}
              </span>
            </div>
            <span className={`text-[11px] font-bold mt-1 transition-colors duration-300 ${isActive ? 'text-primary font-extrabold' : 'text-on-surface-variant font-semibold'}`}>
              {tab.name}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
