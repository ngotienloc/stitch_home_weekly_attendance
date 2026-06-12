'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import Link from 'next/link';
import HandbookModal from './HandbookModal';

export default function Header() {
  const router = useRouter();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showHandbook, setShowHandbook] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    let active = true;
    async function fetchProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && active) {
        const { data } = await supabase
          .from('profiles')
          .select('avatar_url')
          .eq('id', user.id)
          .single();
        
        if (data?.avatar_url && active) {
          setAvatarUrl(data.avatar_url);
        }
      }
    }
    fetchProfile();
    return () => {
      active = false;
    };
  }, []);

  const defaultAvatar = 'https://lh3.googleusercontent.com/aida-public/AB6AXuDfrAGyVgY_j9atz5t_aIB7roKIQMwLCC63LYTIL2oAurzXGE8DvZAgM0vKg5P219N-KLDqhPjR4nuM2TB4cez2yTY10VmZIHPe3owGYfcULAlFNZv5P5ca1XkgFENpcSzNfsFQeQofPzWDRUfNRLpGmW3HUiu6Uts59VJExDqPq6w21o3MCRl537mlp6mcLj3Ni2pc2I1BFOUwUQ9MG5tnrNqOloyiq6ZiuGDOkIIlzHJRIkjj13a9riAih5qfws146BKwSFWhjQo';

  const handleStartTour = () => {
    setShowHandbook(false);
    if (window.location.pathname === '/home') {
      window.dispatchEvent(new CustomEvent('start-onboarding-tour'));
    } else {
      router.push('/home?startTour=true');
    }
  };

  return (
    <>
      <header className="bg-white w-full rounded-b-xl shadow-[0_4px_16px_rgba(0,0,0,0.03)] border-b border-outline-variant/10 sticky top-0 z-50">
        <div className="flex justify-between items-center px-container-margin py-md w-full max-w-[600px] mx-auto">
          <Link href="/home" className="flex items-center gap-2 interactive-scale cursor-pointer select-none">
            <span className="material-symbols-outlined text-primary text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>school</span>
            <h1 className="text-xl font-extrabold text-primary tracking-tight font-headline-lg">AttendanceHero</h1>
          </Link>
          <div className="flex items-center gap-sm">
            {/* Help/Handbook trigger */}
            <button
              onClick={() => setShowHandbook(true)}
              className="w-10 h-10 rounded-full text-on-surface-variant hover:text-primary hover:bg-surface-container-low flex items-center justify-center transition-all active:scale-90 cursor-pointer"
              title="Xem cẩm nang hướng dẫn"
            >
              <span className="material-symbols-outlined text-[24px]">help_outline</span>
            </button>

            <div 
              onClick={() => router.push('/profile')}
              className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary-fixed interactive-scale cursor-pointer shadow-sm shrink-0"
            >
              <img 
                alt="Ảnh đại diện sinh viên" 
                className="w-full h-full object-cover"
                src={avatarUrl || defaultAvatar}
              />
            </div>
          </div>
        </div>
      </header>

      {showHandbook && (
        <HandbookModal
          onClose={() => setShowHandbook(false)}
          onStartTour={handleStartTour}
        />
      )}
    </>
  );
}

