'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, isMockEnabled, isUserTeacher, getTeacherSettings, saveTeacherSettings, SUBJECT_NAME, TOTAL_WEEKS, TEACHER_ID, DEFAULT_TEACHER_SETTINGS, ALL_GAMES, getGameContent, saveGameContent } from '@/utils/supabase/client';
import type { TeacherSettings, Game } from '@/utils/supabase/client';

interface CheckedInStudent {
  id: string;
  full_name: string;
  avatar_url: string | null;
  points_earned: number;
  game_name: string;
  created_at: string;
  student_input?: string | null;
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
  const [completedWeeks, setCompletedWeeks] = useState<Set<number>>(new Set());

  const [customSecretQuestion, setCustomSecretQuestion] = useState('');
  const [customTeamChallenge, setCustomTeamChallenge] = useState('');
  const [customQuizQuestions, setCustomQuizQuestions] = useState<any[]>([]);

  // Game 6 (Lucky hand-raiser spinner) states
  const [wheelSpinning, setWheelSpinning] = useState(false);
  const [wheelRotation, setWheelRotation] = useState(0);
  const [selectedWinner, setSelectedWinner] = useState<any | null>(null);
  const [winnerBonusAwarded, setWinnerBonusAwarded] = useState(false);

  // Game 11 (Idea Voting) states
  const [teacherVotingState, setTeacherVotingState] = useState<'idle' | 'active' | 'ended'>('idle');
  const [teacherVotingIdeas, setTeacherVotingIdeas] = useState<string[]>([
    'Hệ thống phân làn xe buýt điện thông minh',
    'Trạm sạc xe điện kết hợp cafe năng lượng mặt trời',
    'Bản đồ mật độ giao thông đô thị thời gian thực',
    'Ứng dụng gọi xe đạp công cộng qua QR Code'
  ]);
  const [teacherVotingScores, setTeacherVotingScores] = useState<Record<string, number>>({});
  const [teacherVotingTimeLeft, setTeacherVotingTimeLeft] = useState<number>(120);
  const [teacherVotedUsersCount, setTeacherVotedUsersCount] = useState<number>(0);
  const teacherVotingTimerRef = useRef<any>(null);
  const votingScoresRef = useRef<Record<string, number>>({});
  const votingChannelRef = useRef<any>(null);
  const classSessionChannelRef = useRef<any>(null);

  // Game 1 (Đại chiến Bom) states
  const [bombActiveUsers, setBombActiveUsers] = useState<{ [id: string]: { name: string; lastSeen: number } }>({});
  const [bombHolderId, setBombHolderId] = useState<string | null>(null);
  const [bombTimeLeft, setBombTimeLeft] = useState<number>(15);
  const [bombStatus, setBombStatus] = useState<'idle' | 'active' | 'exploded'>('idle');
  const bombChannelRef = useRef<any>(null);

  // Game 2 (Đấu trường sinh tử) states
  const [battleStep, setBattleStep] = useState<'idle' | 'playing' | 'ended'>('idle');
  const [battleQuestionIdx, setBattleQuestionIdx] = useState<number>(0);
  const [battleSurvivors, setBattleSurvivors] = useState<{ [id: string]: { name: string; lives: number; lastSeen: number } }>({});
  const battleChannelRef = useRef<any>(null);

  // Game 5 (Kẻ giả mạo) states
  const [undercoverStep, setUndercoverStep] = useState<'idle' | 'describing' | 'voting' | 'ended'>('idle');
  const [undercoverGroupSelected, setUndercoverGroupSelected] = useState<string>('Nhóm 1');
  const [undercoverKeywordPair, setUndercoverKeywordPair] = useState<{ normal: string; undercover: string }>({ normal: 'Bản vẽ 2D', undercover: 'Mô hình 3D' });
  const [undercoverAssignments, setUndercoverAssignments] = useState<{ [id: string]: 'normal' | 'undercover' | 'mrwhite' }>({});
  const [undercoverGroupMembers, setUndercoverGroupMembers] = useState<{ id: string; name: string }[]>([]);
  const [undercoverDescriptions, setUndercoverDescriptions] = useState<{ [id: string]: { name: string; desc: string } }>({});
  const [undercoverVotes, setUndercoverVotes] = useState<{ [id: string]: number }>({});
  const undercoverChannelRef = useRef<any>(null);

  // Game 9 (Cuộc đua nối từ) states
  const [wordChainCurrentWord, setWordChainCurrentWord] = useState<string>('');
  const [wordChainList, setWordChainList] = useState<string[]>([]);
  const [wordChainLastWinner, setWordChainLastWinner] = useState<string | null>(null);
  const wordChainChannelRef = useRef<any>(null);

  // Game 15 (Đại chiến Phản xạ) states
  const [reflexClicks, setReflexClicks] = useState<{ name: string; time: number }[]>([]);
  const reflexChannelRef = useRef<any>(null);

  // Custom Reset Confirmation Modal states
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);
  const [resetErrorMessage, setResetErrorMessage] = useState<string | null>(null);

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

  useEffect(() => {
    if (mounted) {
      const content2 = getGameContent(2);
      setCustomSecretQuestion(content2.secretQuestion || '');

      const content4 = getGameContent(4);
      setCustomTeamChallenge(content4.teamChallenge || '');

      const content9 = getGameContent(9);
      setCustomQuizQuestions(content9.quizQuestions || []);
    }
  }, [mounted, settings.currentWeek]);

  // Realtime channel for teacher to sync topics
  useEffect(() => {
    if (!mounted) return;
    const channel = supabase.channel('class_session_global', {
      config: {
        broadcast: { self: false }
      }
    });
    classSessionChannelRef.current = channel;

    channel
      .on('broadcast', { event: 'request_current_topic' }, ({ payload }: { payload: any }) => {
        const { week } = payload;
        if (week === 4) {
          const content4 = getGameContent(4);
          channel.send({
            type: 'broadcast',
            event: 'update_topic',
            payload: { week: 4, topic: content4.teamChallenge || '' }
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      classSessionChannelRef.current = null;
    };
  }, [mounted]);

  const votingStateRef = useRef(teacherVotingState);
  votingStateRef.current = teacherVotingState;
  const votingIdeasRef = useRef(teacherVotingIdeas);
  votingIdeasRef.current = teacherVotingIdeas;
  const votingTimeLeftRef = useRef(teacherVotingTimeLeft);
  votingTimeLeftRef.current = teacherVotingTimeLeft;

  // Game 11: Realtime event listener for student votes
  useEffect(() => {
    if (!mounted) return;
    const channel = supabase.channel('idea_voting_global', {
      config: {
        broadcast: { self: false }
      }
    });
    votingChannelRef.current = channel;

    channel
      .on('broadcast', { event: 'request_voting_state' }, () => {
        if (votingStateRef.current !== 'idle') {
          const endTime = Date.now() + (votingTimeLeftRef.current * 1000);
          channel.send({
            type: 'broadcast',
            event: 'sync_voting_state',
            payload: {
              ideas: votingIdeasRef.current.map((label, idx) => ({ id: `idea_${idx}`, label })),
              endTime,
              state: votingStateRef.current === 'active' ? 'voting' : votingStateRef.current,
              scores: votingScoresRef.current
            }
          });
        }
      })
      .on('broadcast', { event: 'submit_vote' }, ({ payload }: { payload: any }) => {
        const { votes } = payload;
        if (votingStateRef.current === 'active') {
          const nextScores = { ...votingScoresRef.current };
          if (votes[0]) nextScores[votes[0]] = (nextScores[votes[0]] || 0) + 3;
          if (votes[1]) nextScores[votes[1]] = (nextScores[votes[1]] || 0) + 2;
          if (votes[2]) nextScores[votes[2]] = (nextScores[votes[2]] || 0) + 1;
          
          votingScoresRef.current = nextScores;
          setTeacherVotingScores(nextScores);
          setTeacherVotedUsersCount((prev) => prev + 1);

          channel.send({
            type: 'broadcast',
            event: 'update_leaderboard',
            payload: { scores: nextScores }
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      votingChannelRef.current = null;
    };
  }, [mounted]);

  // Game 1 (Đại chiến Bom) teacher realtime effect
  useEffect(() => {
    if (!mounted) return;
    const channel = supabase.channel('bomb_challenge_global', {
      config: {
        broadcast: { self: true }
      }
    });
    bombChannelRef.current = channel;

    channel
      .on('broadcast', { event: 'bomb_ping' }, ({ payload }: { payload: any }) => {
        const { userId, name } = payload;
        setBombActiveUsers(prev => ({
          ...prev,
          [userId]: { name, lastSeen: Date.now() }
        }));
      })
      .on('broadcast', { event: 'pass_bomb' }, ({ payload }: { payload: any }) => {
        const { newHolderId } = payload;
        setBombHolderId(newHolderId);
        setBombTimeLeft(15);
      })
      .on('broadcast', { event: 'bomb_exploded' }, ({ payload }: { payload: any }) => {
        const { holderId } = payload;
        setBombHolderId(holderId);
        setBombStatus('exploded');
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      bombChannelRef.current = null;
    };
  }, [mounted]);

  // Countdown timer on teacher side for Bomb Game
  useEffect(() => {
    if (bombStatus !== 'active' || !bombHolderId) return;

    const t = setInterval(() => {
      setBombTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(t);
          setBombStatus('exploded');
          
          // Broadcast to all that the bomb exploded
          bombChannelRef.current?.send({
            type: 'broadcast',
            event: 'bomb_exploded',
            payload: { holderId: bombHolderId }
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(t);
  }, [bombStatus, bombHolderId]);

  // Game 2 (Đấu trường sinh tử) teacher realtime effect
  useEffect(() => {
    if (!mounted) return;
    const channel = supabase.channel('battle_royale_global', {
      config: {
        broadcast: { self: true }
      }
    });
    battleChannelRef.current = channel;

    channel
      .on('broadcast', { event: 'battle_ping' }, ({ payload }: { payload: any }) => {
        const { userId, name, lives } = payload;
        setBattleSurvivors(prev => ({
          ...prev,
          [userId]: { name, lives, lastSeen: Date.now() }
        }));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      battleChannelRef.current = null;
    };
  }, [mounted]);

  // Game 5 (Kẻ giả mạo) teacher realtime effect
  useEffect(() => {
    if (!mounted || !undercoverGroupSelected) return;
    const channel = supabase.channel(`undercover_group_${undercoverGroupSelected}`, {
      config: {
        broadcast: { self: true }
      }
    });
    undercoverChannelRef.current = channel;

    channel
      .on('broadcast', { event: 'undercover_describe' }, ({ payload }: { payload: any }) => {
        const { userId, name, desc } = payload;
        setUndercoverDescriptions(prev => ({
          ...prev,
          [userId]: { name, desc }
        }));
      })
      .on('broadcast', { event: 'undercover_vote' }, ({ payload }: { payload: any }) => {
        const { targetId } = payload;
        setUndercoverVotes(prev => ({
          ...prev,
          [targetId]: (prev[targetId] || 0) + 1
        }));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      undercoverChannelRef.current = null;
    };
  }, [mounted, undercoverGroupSelected]);

  // Game 9 (Cuộc đua nối từ) teacher realtime effect
  useEffect(() => {
    if (!mounted) return;
    const channel = supabase.channel('word_chain_global', {
      config: {
        broadcast: { self: true }
      }
    });
    wordChainChannelRef.current = channel;

    channel
      .on('broadcast', { event: 'word_chain_submit' }, ({ payload }: { payload: any }) => {
        const { word, studentName } = payload;
        setWordChainList(prev => {
          if (prev.includes(word)) return prev;
          const nextList = [...prev, word];
          setWordChainCurrentWord(word);
          setWordChainLastWinner(studentName);

          const words = word.trim().split(/\s+/);
          const lastWord = words[words.length - 1];
          
          const techDesignDictionary: Record<string, string[]> = {
            'thiết': ['thiết kế kỹ thuật', 'thiết bị công nghệ', 'thiết kế hệ thống', 'thiết kế tối ưu'],
            'kế': ['kế hoạch thử nghiệm', 'kế hoạch chế tạo', 'kế hoạch thiết kế'],
            'công': ['công nghệ mới', 'công năng sản phẩm', 'công cụ hỗ trợ', 'công suất vận hành'],
            'nghệ': ['nghệ thuật tạo hình', 'nghệ thuật thiết kế'],
            'tư': ['tư duy hệ thống', 'tư duy công nghệ', 'tư duy thiết kế', 'tư duy sáng tạo'],
            'duy': ['duy trì hệ thống', 'duy trì hoạt động'],
            'hệ': ['hệ thống công nghệ', 'hệ thống điều khiển', 'hệ sinh thái kỹ thuật', 'hệ thống phản hồi'],
            'thử': ['thử nghiệm sản phẩm', 'thử nghiệm thực tế', 'thử nghiệm mẫu'],
            'mẫu': ['mẫu thử nghiệm', 'mẫu sản phẩm', 'mẫu phác thảo', 'mẫu chế tạo'],
            'vật': ['vật liệu chế tạo', 'vật liệu thông minh', 'vật liệu tái chế'],
            'giải': ['giải pháp kỹ thuật', 'giải pháp thay thế', 'giải pháp tối ưu'],
            'tiêu': ['tiêu chí thiết kế', 'tiêu chí đánh giá', 'tiêu chí kỹ thuật']
          };

          const candidates = techDesignDictionary[lastWord.toLowerCase()] || [
            `${lastWord} công nghệ`,
            `${lastWord} hệ thống`,
            `${lastWord} thiết kế`,
            `${lastWord} kỹ thuật`
          ];

          const nextOptions = [...candidates].sort(() => Math.random() - 0.5);

          channel.send({
            type: 'broadcast',
            event: 'word_chain_next',
            payload: {
              word,
              options: nextOptions,
              winnerName: studentName,
              chainLength: nextList.length
            }
          });

          return nextList;
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      wordChainChannelRef.current = null;
    };
  }, [mounted]);

  // Game 15 (Đại chiến Phản xạ) teacher realtime effect
  useEffect(() => {
    if (!mounted) return;
    const channel = supabase.channel('reflex_rush_global', {
      config: {
        broadcast: { self: true }
      }
    });
    reflexChannelRef.current = channel;

    channel
      .on('broadcast', { event: 'reflex_click' }, ({ payload }: { payload: any }) => {
        const { name, time } = payload;
        setReflexClicks(prev => {
          const filtered = prev.filter(c => c.name !== name);
          const nextClicks = [...filtered, { name, time }].sort((a, b) => a.time - b.time);
          
          channel.send({
            type: 'broadcast',
            event: 'reflex_leaderboard_update',
            payload: { leaderboard: nextClicks }
          });
          
          return nextClicks;
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      reflexChannelRef.current = null;
    };
  }, [mounted]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (teacherVotingTimerRef.current) clearInterval(teacherVotingTimerRef.current);
    };
  }, []);

  const startIdeaVoting = () => {
    setTeacherVotingState('active');
    setTeacherVotedUsersCount(0);
    setTeacherVotingTimeLeft(120);
    
    const initialScores: Record<string, number> = {};
    teacherVotingIdeas.forEach((_, idx) => {
      initialScores[`idea_${idx}`] = 0;
    });
    setTeacherVotingScores(initialScores);
    votingScoresRef.current = initialScores;

    const endTime = Date.now() + 120000;
    
    votingChannelRef.current?.send({
      type: 'broadcast',
      event: 'start_voting',
      payload: {
        ideas: teacherVotingIdeas.map((label, idx) => ({ id: `idea_${idx}`, label })),
        endTime,
        state: 'voting',
        scores: initialScores
      }
    });

    if (teacherVotingTimerRef.current) clearInterval(teacherVotingTimerRef.current);
    teacherVotingTimerRef.current = setInterval(() => {
      setTeacherVotingTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(teacherVotingTimerRef.current);
          setTeacherVotingState('ended');
          votingChannelRef.current?.send({
            type: 'broadcast',
            event: 'close_voting'
          });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const closeIdeaVoting = () => {
    setTeacherVotingState('ended');
    if (teacherVotingTimerRef.current) clearInterval(teacherVotingTimerRef.current);
    
    votingChannelRef.current?.send({
      type: 'broadcast',
      event: 'close_voting'
    });
  };

  const BOMB_QUESTIONS = [
    { q: "Bước đầu tiên trong quy trình thiết kế kỹ thuật là gì?", opts: ["Xác định vấn đề và tiêu chí thiết kế", "Chế tạo sản phẩm mẫu (Prototype)", "Thử nghiệm và đánh giá giải pháp", "Đề xuất các phương án thay thế"], ans: 0 },
    { q: "Trong thiết kế kỹ thuật, 'tiêu chí thiết kế' (Design Criteria) nghĩa là gì?", opts: ["Giới hạn tối đa về thời gian thi công", "Đặc điểm mong muốn mà giải pháp thiết kế cần đạt được", "Quy định pháp lý bắt buộc phải tuân theo", "Ngân sách tối đa của dự án chế tạo"], ans: 1 },
    { q: "Yếu tố nào sau đây là một 'ràng buộc' (Constraint) điển hình trong thiết kế?", opts: ["Màu sắc ưa thích của kỹ sư", "Hạn chế về ngân sách, vật liệu hoặc thời hạn hoàn thành", "Sự đồng thuận của tất cả thành viên trong nhóm", "Tên thương hiệu dự kiến của sản phẩm"], ans: 1 },
    { q: "Mục đích chính của việc chế tạo 'sản phẩm mẫu' (Prototype) là gì?", opts: ["Để phân phối bán lẻ cho khách hàng ngay lập tức", "Để thử nghiệm thực tế, phát hiện lỗi và tối ưu hóa thiết kế", "Để lưu trữ trong kho lưu niệm của trường/công ty", "Để đăng ký sở hữu trí tuệ trước khi thử nghiệm"], ans: 1 },
    { q: "Quy trình thiết kế kỹ thuật có đặc điểm cốt lõi nào sau đây?", opts: ["Chỉ đi theo một chiều thẳng, không bao giờ quay lại bước trước", "Là quy trình lặp (Iterative), liên tục cải tiến sau mỗi vòng đánh giá", "Không cần thực hiện bất kỳ nghiên cứu nền tảng lý thuyết nào", "Chỉ được áp dụng trong lĩnh vực cơ khí và chế tạo máy"], ans: 1 }
  ];

  // Game 1: Bomb Challenge control functions
  const startBombGame = (selectedUserToStartId?: string) => {
    setBombStatus('active');
    setBombTimeLeft(15);
    
    let startHolderId = selectedUserToStartId;
    if (!startHolderId) {
      const activeIds = Object.keys(bombActiveUsers);
      if (activeIds.length > 0) {
        startHolderId = activeIds[Math.floor(Math.random() * activeIds.length)];
      }
    }

    if (!startHolderId) {
      alert("Không có sinh viên online để nhận bom!");
      setBombStatus('idle');
      return;
    }

    setBombHolderId(startHolderId);

    const firstQ = BOMB_QUESTIONS[Math.floor(Math.random() * BOMB_QUESTIONS.length)];
    bombChannelRef.current?.send({
      type: 'broadcast',
      event: 'start_bomb',
      payload: {
        holderId: startHolderId,
        question: firstQ
      }
    });
  };

  const resetBombGame = () => {
    setBombStatus('idle');
    setBombHolderId(null);
    setBombTimeLeft(15);
    bombChannelRef.current?.send({
      type: 'broadcast',
      event: 'start_bomb',
      payload: { holderId: null, question: null }
    });
  };

  // Game 2: Battle Royale control functions
  const BATTLE_QUESTIONS = [
    { q: "Quy trình lặp (Iterative process) trong thiết kế kỹ thuật giúp ích gì nhất?", opts: ["Giảm bớt số lượng kỹ sư tham gia dự án", "Tối ưu hóa thiết kế thông qua cải tiến liên tục sau mỗi vòng thử nghiệm", "Rút ngắn thời gian thiết kế xuống còn một ngày", "Loại bỏ hoàn toàn bước lập kế hoạch ban đầu"], ans: 1 },
    { q: "'Tư duy hệ thống' (Systems Thinking) trong thiết kế công nghệ yêu cầu kỹ sư làm gì?", opts: ["Chỉ tập trung tối đa vào một chi tiết nhỏ cô lập", "Xem xét sản phẩm như tập hợp các thành phần tương tác chặt chẽ", "Luôn sử dụng máy tính cho mọi công đoạn", "Bỏ qua các yếu tố tác động từ môi trường bên ngoài"], ans: 1 },
    { q: "Bước nào ngay sau bước 'Đề xuất các giải pháp thay thế'?", opts: ["Xác định vấn đề thiết kế", "Lựa chọn phương án tối ưu nhất dựa trên tiêu chí và ràng buộc", "Chế tạo hàng loạt sản phẩm thương mại", "Viết tài liệu hướng dẫn sử dụng sản phẩm"], ans: 1 },
    { q: "Trong sơ đồ khối hệ thống công nghệ, 'Phản hồi' (Feedback) có vai trò gì?", opts: ["Chuyển đổi năng lượng đầu vào thành đầu ra", "Giúp hệ thống tự điều chỉnh và duy trì sự ổn định dựa trên đầu ra", "Tiêu hao năng lượng dư thừa của hệ thống", "Cung cấp nguồn nguyên liệu thô ban đầu"], ans: 1 },
    { q: "Thiết kế công nghiệp (Industrial Design) chú trọng nhất vào khía cạnh nào?", opts: ["Độ bền kéo và ứng suất của khung kim loại bên trong", "Tính thẩm mỹ, trải nghiệm người dùng và công năng sử dụng thực tế", "Giá thành nguyên liệu rẻ nhất có thể", "Phương thức đóng gói vận chuyển bằng container"], ans: 1 }
  ];

  const startBattleRoyale = () => {
    setBattleStep('playing');
    setBattleQuestionIdx(0);
    setBattleSurvivors({});

    battleChannelRef.current?.send({
      type: 'broadcast',
      event: 'start_battle'
    });

    setTimeout(() => {
      sendBattleQuestion(0);
    }, 1500);
  };

  const sendBattleQuestion = (idx: number) => {
    setBattleQuestionIdx(idx);
    const q = BATTLE_QUESTIONS[idx];
    if (!q) {
      endBattleRoyale();
      return;
    }
    battleChannelRef.current?.send({
      type: 'broadcast',
      event: 'battle_question',
      payload: {
        question: {
          q: q.q,
          opts: q.opts,
          ans: q.ans,
          idx: idx,
          total: BATTLE_QUESTIONS.length
        }
      }
    });
  };

  const endBattleRoyale = () => {
    setBattleStep('ended');
    battleChannelRef.current?.send({
      type: 'broadcast',
      event: 'end_battle'
    });
  };

  // Game 5: Undercover control functions
  const fetchGroupMembers = async (groupName: string) => {
    try {
      const { data, error } = await supabase
        .from('attendance')
        .select('student_id, student_name')
        .eq('week_number', settings.currentWeek)
        .like('student_input', `${groupName}%`);
      if (error) throw error;
      
      if (data) {
        const uniqueMembers = data.filter((v: any, i: number, a: any[]) => a.findIndex((t: any) => t.student_id === v.student_id) === i);
        setUndercoverGroupMembers(uniqueMembers.map((m: any) => ({ id: m.student_id, name: m.student_name })));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const startUndercoverGame = () => {
    if (undercoverGroupMembers.length < 3) {
      alert("Cần tối thiểu 3 thành viên trong nhóm online để chơi!");
      return;
    }

    setUndercoverStep('describing');
    setUndercoverDescriptions({});
    setUndercoverVotes({});

    const memberIds = undercoverGroupMembers.map(m => m.id).sort(() => Math.random() - 0.5);
    const assignments: { [id: string]: 'normal' | 'undercover' | 'mrwhite' } = {};
    
    assignments[memberIds[0]] = 'undercover';
    if (memberIds.length >= 4) {
      assignments[memberIds[1]] = 'mrwhite';
      for (let i = 2; i < memberIds.length; i++) {
        assignments[memberIds[i]] = 'normal';
      }
    } else {
      for (let i = 1; i < memberIds.length; i++) {
        assignments[memberIds[i]] = 'normal';
      }
    }

    setUndercoverAssignments(assignments);

    undercoverChannelRef.current?.send({
      type: 'broadcast',
      event: 'undercover_start',
      payload: {
        keywordPair: undercoverKeywordPair,
        assignments
      }
    });
  };

  const moveToUndercoverVoting = () => {
    setUndercoverStep('voting');
    undercoverChannelRef.current?.send({
      type: 'broadcast',
      event: 'undercover_step_vote'
    });
  };

  const endUndercoverGame = (winnerRole: 'normal' | 'undercover' | 'mrwhite') => {
    setUndercoverStep('ended');
    undercoverChannelRef.current?.send({
      type: 'broadcast',
      event: 'undercover_end',
      payload: { winner: winnerRole }
    });
  };

  // Game 9: Word Chain control functions
  const startWordChain = () => {
    setWordChainList(['thiết kế']);
    setWordChainCurrentWord('thiết kế');
    setWordChainLastWinner(null);

    wordChainChannelRef.current?.send({
      type: 'broadcast',
      event: 'start_word_chain',
      payload: {
        word: 'thiết kế',
        options: ['kế hoạch thử nghiệm', 'kế hoạch chế tạo', 'kế hoạch thiết kế']
      }
    });
  };

  const endWordChain = () => {
    setWordChainCurrentWord('');
    wordChainChannelRef.current?.send({
      type: 'broadcast',
      event: 'end_word_chain'
    });
  };

  // Game 15: Reflex Rush control functions
  const startReflexRush = () => {
    setReflexClicks([]);
    reflexChannelRef.current?.send({
      type: 'broadcast',
      event: 'reflex_start_countdown'
    });
  };

  const endReflexRush = () => {
    reflexChannelRef.current?.send({
      type: 'broadcast',
      event: 'reflex_end'
    });
  };

  // Word Cloud calculation
  const getWordCloudWords = () => {
    const wordCounts: Record<string, number> = {};
    const stopwords = new Set([
      'và', 'là', 'của', 'để', 'trong', 'cho', 'có', 'các', 'nhưng', 'khi', 'này', 'nào', 'với', 'một', 'những', 'được', 'ra', 'về', 'sao', 'điểm', 'trả', 'lời', 'câu', 'hỏi', 'bài', 'học', 'tuần', 'em'
    ]);
    
    students.forEach(s => {
      if (s.student_input && !s.student_input.startsWith('Vòng quay:')) {
        const textWithoutSpin = s.student_input.split(' | Vòng quay:')[0];
        const cleanText = textWithoutSpin.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, ' ');
        const words = cleanText.split(/\s+/);
        words.forEach(w => {
          const trimmed = w.trim();
          if (trimmed.length > 1 && !stopwords.has(trimmed) && isNaN(Number(trimmed))) {
            wordCounts[trimmed] = (wordCounts[trimmed] || 0) + 1;
          }
        });
      }
    });
    
    return Object.entries(wordCounts)
      .map(([text, count]) => ({ text, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  };

  const handleExportCSV = () => {
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
    link.setAttribute('download', `DiemDanh_Tuan_${settings.currentWeek}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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
          student_input: c.student_input || null,
        };
      });
      setStudents(result);

      // Extract unique week numbers that have check-ins
      const uniqueWeeks = new Set<number>(checkIns.map((c: any) => c.week_number));
      setCompletedWeeks(uniqueWeeks);
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
              student_input: c.student_input || null,
            };
          });
          setStudents(result);
        }

        // Fetch all check-ins to find which weeks have students
        const { data: allCis, error: allErr } = await supabase
          .from('check_ins')
          .select('week_number');
        if (!allErr && allCis) {
          const uniqueWeeks = new Set<number>(allCis.map((c: any) => c.week_number));
          setCompletedWeeks(uniqueWeeks);
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

  const getHandRaisers = useCallback(() => {
    return students
      .map(s => {
        const match = s.student_input?.match(/^Giơ tay lúc ([\d.]+)s/);
        const seconds = match ? parseFloat(match[1]) : 5.0;
        return { ...s, seconds };
      })
      .sort((a, b) => {
        if (a.seconds !== b.seconds) {
          return a.seconds - b.seconds;
        }
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      })
      .slice(0, 5);
  }, [students]);

  const buildConicGradient = (raisers: any[]) => {
    if (raisers.length === 0) return 'gray';
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'];
    let grad = 'conic-gradient(';
    raisers.forEach((r, idx) => {
      const start = idx * (360 / raisers.length);
      const end = (idx + 1) * (360 / raisers.length);
      const color = colors[idx % colors.length];
      grad += `${color} ${start}deg ${end}deg${idx < raisers.length - 1 ? ', ' : ''}`;
    });
    grad += ')';
    return grad;
  };

  const handleSpinWheel = (raisers: any[]) => {
    if (raisers.length === 0 || wheelSpinning) return;
    
    setWheelSpinning(true);
    setSelectedWinner(null);
    setWinnerBonusAwarded(false);
    
    const winnerIdx = Math.floor(Math.random() * raisers.length);
    const chosenStudent = raisers[winnerIdx];
    
    const segmentAngle = 360 / raisers.length;
    // Rotate 5 full turns + stop at the segment's middle angle relative to 12 o'clock pointer (360 deg)
    const targetAngle = 1800 + (360 - (winnerIdx * segmentAngle + segmentAngle / 2));
    
    setWheelRotation(targetAngle);
    
    setTimeout(() => {
      setWheelSpinning(false);
      setSelectedWinner(chosenStudent);
    }, 4000);
  };

  const handleAwardBonus = async () => {
    if (!selectedWinner || winnerBonusAwarded) return;
    
    setSaving(true);
    if (isMockEnabled) {
      const checkIns = JSON.parse(localStorage.getItem('mock_check_ins') || '[]');
      const updated = checkIns.map((c: any) => {
        if (c.id === selectedWinner.id) {
          return {
            ...c,
            points_earned: c.points_earned + 10,
            student_input: `${c.student_input} | Chọn trả lời (+10đ)`
          };
        }
        return c;
      });
      localStorage.setItem('mock_check_ins', JSON.stringify(updated));
      setWinnerBonusAwarded(true);
      setSaving(false);
      loadStudents();
    } else {
      try {
        const { data: currentCi } = await supabase
          .from('check_ins')
          .select('points_earned, student_input')
          .eq('id', selectedWinner.id)
          .single();
          
        const newPoints = (currentCi?.points_earned || selectedWinner.points_earned) + 10;
        const newInput = `${currentCi?.student_input || selectedWinner.student_input} | Chọn trả lời (+10đ)`;
        
        const { error } = await supabase
          .from('check_ins')
          .update({
            points_earned: newPoints,
            student_input: newInput
          })
          .eq('id', selectedWinner.id);
          
        if (error) throw error;
        setWinnerBonusAwarded(true);
        loadStudents();
      } catch (err) {
        console.error('Failed to award bonus points:', err);
      } finally {
        setSaving(false);
      }
    }
  };

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

  const handleResetAttendance = () => {
    setResetConfirmOpen(true);
  };

  const executeResetAttendance = async () => {
    setResetConfirmOpen(false);
    try {
      const { error } = await supabase
        .from('check_ins')
        .delete()
        .eq('week_number', settings.currentWeek);

      if (error) throw error;

      await loadStudents();
      setResetSuccessMessage(`Đã đặt lại thành công điểm danh Tuần ${settings.currentWeek}!`);
    } catch (err) {
      console.error('Failed to reset attendance:', err);
      setResetErrorMessage('Không thể đặt lại điểm danh. Vui lòng thử lại.');
    }
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
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: TOTAL_WEEKS }, (_, i) => i + 1).map(w => {
                const isCompleted = completedWeeks.has(w);
                const isActive = settings.currentWeek === w;

                return (
                  <button
                    key={w}
                    onClick={() => handleWeekChange(w)}
                    className={`w-9 h-9 rounded-full text-xs font-bold transition-all duration-200 active:scale-90 relative flex items-center justify-center ${
                      isActive
                        ? 'bg-white text-secondary shadow-md scale-110'
                        : 'bg-white/20 text-on-secondary-container hover:bg-white/35'
                    }`}
                  >
                    {w}
                    {isCompleted && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-tertiary text-on-tertiary text-[9px] rounded-full flex items-center justify-center shadow-sm">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
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
              {settings.sessionOpen && settings.currentWeek === 3 && (
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
              {settings.currentWeek === 2 || settings.currentWeek === 9 || settings.currentWeek === 11 ? 'Có thể tùy biến' : 'Cố định'}
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

        {/* Game Customisation Card */}
        {mounted && [1, 2, 4, 5, 6, 9, 11, 15].includes(settings.currentWeek) && (
          <section className="bg-white p-lg rounded-xxl shadow-sm border border-outline-variant/20 animate-fade-in-up mt-sm">
            <h4 className="text-sm font-bold text-on-surface mb-sm flex items-center gap-1">
              <span className="material-symbols-outlined text-[18px] text-primary">
                {[1, 2, 5, 9, 11, 15].includes(settings.currentWeek) ? 'sports_esports' : 'edit_note'}
              </span>
              {[1, 2, 5, 9, 11, 15].includes(settings.currentWeek)
                ? `Bảng điều khiển: Trò chơi Tuần ${settings.currentWeek}`
                : settings.currentWeek === 6
                  ? 'Điều khiển Thử thách: Giơ tay trả lời'
                  : `Tùy biến câu hỏi tuần ${settings.currentWeek}`}
            </h4>
            
            {settings.currentWeek === 1 && (
              <div className="space-y-md">
                <div className="p-md bg-secondary-container/20 border border-secondary/20 rounded-xl space-y-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-on-surface-variant">Trạng thái bom:</span>
                    <span className={`text-xs font-black uppercase px-2 py-0.5 rounded-full ${
                      bombStatus === 'active' ? 'bg-error/10 text-error' : bombStatus === 'exploded' ? 'bg-zinc-800 text-white' : 'bg-surface-container-high text-on-surface-variant'
                    }`}>
                      {bombStatus === 'active' ? '💥 ĐANG HOẠT ĐỘNG' : bombStatus === 'exploded' ? '💀 ĐÃ NỔ!' : '⏱️ CHƯA KÍCH HOẠT'}
                    </span>
                  </div>

                  {bombStatus === 'active' && bombHolderId && (
                    <div className="text-center py-sm bg-surface-container-low rounded-lg">
                      <p className="text-[10px] text-on-surface-variant font-bold">Người đang giữ bom:</p>
                      <p className="text-base font-extrabold text-error">
                        {bombActiveUsers[bombHolderId]?.name || 'Không rõ'}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-sm">
                  <button
                    disabled={bombStatus === 'active'}
                    onClick={() => startBombGame()}
                    className="flex-1 py-sm bg-primary text-on-primary font-bold text-xs rounded-xl shadow-md hover:bg-primary/95 disabled:opacity-40 transition-all cursor-pointer"
                  >
                    🚀 Bắt đầu Game (Phát Bom ngẫu nhiên)
                  </button>
                  <button
                    onClick={resetBombGame}
                    className="py-sm px-md bg-surface-container border border-outline-variant/30 text-on-surface font-bold text-xs rounded-xl hover:bg-surface-container-high transition-all cursor-pointer"
                  >
                    Đặt lại 🔄
                  </button>
                </div>

                <div className="space-y-sm">
                  <p className="text-xs font-bold text-on-surface-variant uppercase">Danh sách Online hoạt động (nhận bom):</p>
                  <div className="max-h-40 overflow-y-auto space-y-xs pr-xs">
                    {Object.entries(bombActiveUsers).length === 0 ? (
                      <p className="text-xs text-on-surface-variant italic text-center py-sm bg-surface-container-low rounded-xl">Đang đợi sinh viên ping online...</p>
                    ) : (
                      Object.entries(bombActiveUsers).map(([uid, u]) => (
                        <div key={uid} className="flex justify-between items-center p-sm bg-surface-container border border-outline-variant/20 rounded-xl">
                          <span className="text-xs font-bold text-on-surface">{u.name}</span>
                          <button
                            disabled={bombStatus === 'active'}
                            onClick={() => startBombGame(uid)}
                            className="px-sm py-1 text-[10px] font-bold text-primary border border-primary/30 rounded-lg hover:bg-primary/10 transition-all cursor-pointer"
                          >
                            Phát bom cho bạn này
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {settings.currentWeek === 2 && (
              <div className="space-y-md">
                <div className="p-md bg-secondary-container/20 border border-secondary/20 rounded-xl space-y-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-on-surface-variant">Trạng thái:</span>
                    <span className={`text-xs font-black uppercase px-2 py-0.5 rounded-full ${
                      battleStep === 'playing' ? 'bg-primary/10 text-primary animate-pulse' : 'bg-surface-container-high text-on-surface-variant'
                    }`}>
                      {battleStep === 'playing' ? '🎮 ĐANG THI ĐẤU' : battleStep === 'ended' ? '🏁 ĐÃ KẾT THÚC' : '⏱️ ĐANG CHỜ'}
                    </span>
                  </div>

                  {battleStep === 'playing' && (
                    <div className="text-center py-sm bg-surface-container-low rounded-lg">
                      <p className="text-[10px] text-on-surface-variant font-bold">Câu hỏi hiện tại:</p>
                      <p className="text-sm font-extrabold text-primary">
                        Câu {battleQuestionIdx + 1}: {BATTLE_QUESTIONS[battleQuestionIdx]?.q}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-sm flex-wrap">
                  {battleStep !== 'playing' ? (
                    <button
                      onClick={startBattleRoyale}
                      className="flex-1 py-sm bg-primary text-on-primary font-bold text-xs rounded-xl shadow-md hover:bg-primary/95 transition-all cursor-pointer"
                    >
                      🚀 Bắt đầu thi đấu
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => sendBattleQuestion(battleQuestionIdx + 1)}
                        className="flex-1 py-sm bg-success text-on-success font-bold text-xs rounded-xl shadow-md hover:bg-success/95 transition-all cursor-pointer"
                      >
                        Câu tiếp theo ➡️
                      </button>
                      <button
                        onClick={endBattleRoyale}
                        className="py-sm px-md bg-error text-on-error font-bold text-xs rounded-xl hover:bg-error/90 transition-all cursor-pointer"
                      >
                        Kết thúc Trận 🏁
                      </button>
                    </>
                  )}
                </div>

                <div className="space-y-sm">
                  <p className="text-xs font-bold text-on-surface-variant uppercase">Trạng thái Tim sinh tồn thời gian thực:</p>
                  <div className="grid grid-cols-2 gap-sm max-h-40 overflow-y-auto pr-xs">
                    {Object.entries(battleSurvivors).length === 0 ? (
                      <p className="col-span-2 text-xs text-on-surface-variant italic text-center py-sm bg-surface-container-low rounded-xl">Đang đợi sinh viên kết nối...</p>
                    ) : (
                      Object.entries(battleSurvivors).map(([uid, u]) => (
                        <div key={uid} className="flex justify-between items-center p-sm bg-surface-container border border-outline-variant/20 rounded-xl">
                          <span className="text-xs font-bold text-on-surface truncate max-w-[120px]">{u.name}</span>
                          <span className="text-xs">{Array(Math.max(0, u.lives)).fill('❤️').join('') || '💀'}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {settings.currentWeek === 4 && (
              <div className="space-y-sm">
                <label className="text-xs font-bold text-on-surface-variant">Nhập chủ đề thảo luận nhóm:</label>
                <textarea
                  value={customTeamChallenge}
                  onChange={(e) => {
                    setCustomTeamChallenge(e.target.value);
                    saveGameContent(4, { teamChallenge: e.target.value });
                    
                    // Broadcast immediately to online students
                    classSessionChannelRef.current?.send({
                      type: 'broadcast',
                      event: 'update_topic',
                      payload: { week: 4, topic: e.target.value }
                    });
                  }}
                  rows={3}
                  className="w-full px-md py-sm rounded-xl border border-outline-variant/40 text-sm focus:outline-none focus:border-primary bg-surface-container-low"
                  placeholder="Ví dụ: Thiết kế giải pháp giải quyết vấn đề giao thông đô thị trong 10 phút."
                />
              </div>
            )}

            {settings.currentWeek === 5 && (
              <div className="space-y-md">
                <div className="grid grid-cols-2 gap-sm">
                  <div>
                    <label className="text-[10px] font-black text-on-surface-variant uppercase">Nhóm theo dõi:</label>
                    <select
                      value={undercoverGroupSelected}
                      onChange={e => {
                        setUndercoverGroupSelected(e.target.value);
                        fetchGroupMembers(e.target.value);
                      }}
                      className="w-full p-sm text-xs rounded-xl border border-outline-variant/40 bg-surface-container-low focus:border-primary outline-none"
                    >
                      {['Nhóm 1', 'Nhóm 2', 'Nhóm 3', 'Nhóm 5', 'Nhóm 6', 'Nhóm 7', 'Nhóm 8', 'Nhóm 9', 'Nhóm 10', 'Nhóm 11', 'Nhóm 12', 'Nhóm 13'].map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-on-surface-variant uppercase">Từ khóa (Dân thường / Kẻ giả mạo):</label>
                    <select
                      value={`${undercoverKeywordPair.normal}-${undercoverKeywordPair.undercover}`}
                      onChange={e => {
                        const [n, u] = e.target.value.split('-');
                        setUndercoverKeywordPair({ normal: n, undercover: u });
                      }}
                      className="w-full p-sm text-xs rounded-xl border border-outline-variant/40 bg-surface-container-low focus:border-primary outline-none"
                    >
                      <option value="Bản vẽ 2D-Mô hình 3D">Bản vẽ 2D / Mô hình 3D</option>
                      <option value="Tiêu chí-Ràng buộc">Tiêu chí / Ràng buộc</option>
                      <option value="Mẫu thử-Thành phẩm">Mẫu thử / Thành phẩm</option>
                      <option value="Đầu vào-Đầu ra">Đầu vào / Đầu ra</option>
                      <option value="Pin mặt trời-Tuabin gió">Pin mặt trời / Tuabin gió</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-sm">
                  <button
                    onClick={() => fetchGroupMembers(undercoverGroupSelected)}
                    className="py-sm px-sm bg-surface-container border border-outline-variant/30 text-on-surface font-bold text-xs rounded-xl hover:bg-surface-container-high transition-all cursor-pointer"
                  >
                    Kiểm tra Thành viên 🔄
                  </button>
                  {undercoverStep === 'idle' ? (
                    <button
                      onClick={startUndercoverGame}
                      className="flex-1 py-sm bg-primary text-on-primary font-bold text-xs rounded-xl shadow-md hover:bg-primary/95 transition-all cursor-pointer"
                    >
                      🚀 Phát từ khóa bí mật
                    </button>
                  ) : undercoverStep === 'describing' ? (
                    <button
                      onClick={moveToUndercoverVoting}
                      className="flex-1 py-sm bg-success text-on-success font-bold text-xs rounded-xl shadow-md hover:bg-success/95 transition-all cursor-pointer"
                    >
                      Bình chọn giả mạo 🗳️
                    </button>
                  ) : undercoverStep === 'voting' ? (
                    <div className="flex-1 flex gap-xs">
                      <button
                        onClick={() => endUndercoverGame('normal')}
                        className="flex-1 py-sm bg-emerald-600 text-white font-bold text-[10px] rounded-xl hover:bg-emerald-700 transition-all cursor-pointer"
                      >
                        Phe Dân Thắng 🙋‍♂️
                      </button>
                      <button
                        onClick={() => endUndercoverGame('undercover')}
                        className="flex-1 py-sm bg-amber-600 text-white font-bold text-[10px] rounded-xl hover:bg-amber-700 transition-all cursor-pointer"
                      >
                        Giả Mạo Thắng 🕵️
                      </button>
                      <button
                        onClick={() => endUndercoverGame('mrwhite')}
                        className="flex-1 py-sm bg-neutral-600 text-white font-bold text-[10px] rounded-xl hover:bg-neutral-700 transition-all cursor-pointer"
                      >
                        Mr.White Thắng 👻
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setUndercoverStep('idle')}
                      className="flex-1 py-sm bg-surface-container-high text-on-surface font-bold text-xs rounded-xl hover:bg-surface-container transition-all cursor-pointer"
                    >
                      Lượt chơi mới 🔄
                    </button>
                  )}
                </div>

                <div className="space-y-sm bg-surface-container-low p-sm rounded-xl border border-outline-variant/20">
                  <div className="flex justify-between items-center text-xs font-bold text-on-surface-variant">
                    <span>Thành viên trong nhóm ({undercoverGroupMembers.length}):</span>
                    <span>Bước: <b className="text-primary uppercase">{undercoverStep}</b></span>
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-xs pr-xs">
                    {undercoverGroupMembers.map(m => {
                      const desc = undercoverDescriptions[m.id]?.desc;
                      const role = undercoverAssignments[m.id];
                      const votes = undercoverVotes[m.id] || 0;
                      return (
                        <div key={m.id} className="flex justify-between items-center p-sm bg-white border border-outline-variant/10 rounded-lg">
                          <div>
                            <p className="text-xs font-bold text-on-surface">
                              {m.name} <span className="text-[10px] text-primary/70">({role === 'undercover' ? 'Giả mạo' : role === 'mrwhite' ? 'White' : 'Dân'})</span>
                            </p>
                            <p className="text-xs text-primary font-semibold">Mô tả: "{desc || 'Chưa gửi'}"</p>
                          </div>
                          {votes > 0 && (
                            <span className="text-[10px] font-black text-error bg-error/10 px-2 py-0.5 rounded-full">
                              🗳️ {votes} Vote
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {settings.currentWeek === 6 && (
              <div className="space-y-md">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-lg items-center">
                  <div className="space-y-sm">
                    <h5 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Top 5 sinh viên giơ tay nhanh nhất:</h5>
                    {(() => {
                      const raisers = getHandRaisers();
                      if (raisers.length === 0) {
                        return (
                          <div className="p-md text-center bg-surface-container rounded-xl text-xs text-on-surface-variant font-medium">
                            Chưa có sinh viên nào giơ tay điểm danh!
                          </div>
                        );
                      }
                      return (
                        <div className="space-y-xs">
                          {raisers.map((r, idx) => (
                            <div key={r.id} className="flex items-center justify-between p-sm bg-surface-container-low rounded-xl border border-outline-variant/10">
                              <div className="flex items-center gap-xs">
                                <span className="text-xs font-black text-primary bg-primary/10 w-5 h-5 rounded-full flex items-center justify-center">
                                  {idx + 1}
                                </span>
                                <span className="text-xs font-bold text-on-surface">{r.full_name}</span>
                              </div>
                              <span className="text-[10px] font-black text-green-700 bg-green-500/10 px-2 py-0.5 rounded-full">
                                ⏱️ {r.seconds.toFixed(2)}s
                              </span>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  <div className="flex flex-col items-center justify-center py-md space-y-md border-t md:border-t-0 md:border-l border-outline-variant/20">
                    {(() => {
                      const raisers = getHandRaisers();
                      if (raisers.length === 0) return (
                        <p className="text-xs text-on-surface-variant italic text-center">
                          Vòng quay sẽ xuất hiện khi có sinh viên giơ tay.
                        </p>
                      );
                      return (
                        <>
                          <div className="relative">
                            <div className="absolute top-[-12px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[10px] border-l-transparent border-r-[10px] border-r-transparent border-t-[18px] border-t-error z-20 filter drop-shadow-md" />
                            
                            <div
                              className="w-44 h-44 rounded-full border-4 border-on-surface shadow-2xl relative overflow-hidden flex items-center justify-center"
                              style={{
                                transform: `rotate(${wheelRotation}deg)`,
                                backgroundImage: buildConicGradient(raisers),
                                transition: wheelSpinning ? 'transform 4000ms cubic-bezier(0.2, 0.8, 0.2, 1)' : 'none'
                              }}
                            >
                              {raisers.map((r, idx) => {
                                const angle = idx * (360 / raisers.length) + (360 / raisers.length) / 2;
                                return (
                                  <div
                                    key={idx}
                                    className="absolute text-[9px] font-black text-white select-none pointer-events-none text-center truncate max-w-[60px]"
                                    style={{
                                      top: '50%',
                                      left: '50%',
                                      transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-52px)`,
                                      transformOrigin: 'center center',
                                    }}
                                  >
                                    {r.full_name.split(' ').pop()}
                                  </div>
                                );
                              })}
                            </div>

                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white border-4 border-on-surface flex items-center justify-center shadow-md z-20">
                              <div className="w-2 h-2 rounded-full bg-error animate-pulse" />
                            </div>
                          </div>

                          <div className="w-full max-w-[200px] text-center">
                            <button
                              disabled={wheelSpinning || raisers.length === 0}
                              onClick={() => handleSpinWheel(raisers)}
                              className="w-full py-sm bg-primary text-on-primary font-black text-xs rounded-xl shadow-md active:scale-95 disabled:opacity-40 transition-all cursor-pointer hover:bg-primary/95 flex items-center justify-center gap-1"
                            >
                              <span className="material-symbols-outlined text-sm">settings_backup_restore</span>
                              {wheelSpinning ? 'Đang quay...' : 'QUAY NGẪU NHIÊN 🎯'}
                            </button>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {selectedWinner && (
                  <div className="mt-md p-md bg-green-500/10 border border-green-500/30 rounded-2xl text-center space-y-sm animate-pop-in w-full">
                    <p className="text-xs text-green-700 font-bold uppercase tracking-wider">🎉 Chúc mừng người được chọn! 🎉</p>
                    <h4 className="text-md font-black text-on-surface">{selectedWinner.full_name}</h4>
                    <p className="text-[11px] text-on-surface-variant">Giơ tay nhanh thứ: <span className="font-bold text-primary">{getHandRaisers().findIndex(r => r.id === selectedWinner.id) + 1}</span> (⏱️ {getHandRaisers().find(r => r.id === selectedWinner.id)?.seconds.toFixed(2)}s)</p>
                    
                    <button
                      disabled={winnerBonusAwarded || saving}
                      onClick={handleAwardBonus}
                      className={`w-full py-sm font-bold text-xs rounded-xl transition-all shadow-sm ${
                        winnerBonusAwarded
                          ? 'bg-green-600 text-white cursor-default'
                          : 'bg-secondary text-on-secondary hover:bg-secondary/90 active:scale-95 cursor-pointer'
                      }`}
                    >
                      {winnerBonusAwarded ? '✅ Đã Cộng +10 Điểm Thưởng' : '🎁 Cộng +10 Điểm Thưởng Trả Lời'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {settings.currentWeek === 9 && (
              <div className="space-y-md">
                <div className="p-md bg-secondary-container/20 border border-secondary/20 rounded-xl space-y-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-on-surface-variant">Từ khóa hiện tại:</span>
                    <span className="text-xs font-extrabold text-primary">{wordChainCurrentWord || 'Chưa bắt đầu'}</span>
                  </div>

                  <div className="flex justify-between items-center text-xs font-bold text-on-surface-variant">
                    <span>Độ dài chuỗi:</span>
                    <span className="text-primary font-black">{wordChainList.length} từ</span>
                  </div>
                </div>

                <div className="flex gap-sm">
                  <button
                    onClick={startWordChain}
                    className="flex-1 py-sm bg-primary text-on-primary font-bold text-xs rounded-xl shadow-md hover:bg-primary/95 transition-all cursor-pointer"
                  >
                    🚀 Bắt đầu Game (Từ: "phần mềm")
                  </button>
                  <button
                    onClick={endWordChain}
                    className="py-sm px-md bg-error text-on-error font-bold text-xs rounded-xl hover:bg-error/90 transition-all cursor-pointer"
                  >
                    Đóng Game 🏁
                  </button>
                </div>

                <div className="space-y-sm bg-surface-container-low p-sm rounded-xl border border-outline-variant/20">
                  <p className="text-xs font-bold text-on-surface-variant uppercase">Chuỗi nối từ hiện tại:</p>
                  <div className="flex flex-wrap gap-xs max-h-32 overflow-y-auto pr-xs py-xs">
                    {wordChainList.map((w, idx) => (
                      <div key={idx} className="px-xs py-1 text-xs font-extrabold bg-white rounded-lg border border-outline-variant/30 text-on-surface">
                        {w}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {settings.currentWeek === 11 && (
              <div className="space-y-md">
                <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block">Quản lý Bình chọn Ý tưởng (Tuần 11)</label>
                
                {teacherVotingState === 'idle' ? (
                  <div className="space-y-sm">
                    <p className="text-xs text-on-surface-variant font-medium">Nhập danh sách các ý tưởng thảo luận từ các nhóm để cả lớp bình chọn:</p>
                    
                    <div className="space-y-xs">
                      {teacherVotingIdeas.map((idea, idx) => (
                        <div key={idx} className="flex gap-sm items-center">
                          <span className="text-xs font-black text-primary w-16">Nhóm {idx + 1}:</span>
                          <input
                            type="text"
                            value={idea}
                            onChange={(e) => {
                              const updated = [...teacherVotingIdeas];
                              updated[idx] = e.target.value;
                              setTeacherVotingIdeas(updated);
                            }}
                            className="flex-1 px-md py-xs rounded-xl border border-outline-variant/40 text-xs focus:outline-none focus:border-primary bg-surface-container-low"
                            placeholder={`Ý tưởng của Nhóm ${idx + 1}...`}
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const updated = teacherVotingIdeas.filter((_, i) => i !== idx);
                              setTeacherVotingIdeas(updated);
                            }}
                            className="text-error hover:scale-110 active:scale-90 transition-transform p-1"
                          >
                            <span className="material-symbols-outlined text-[18px]">delete</span>
                          </button>
                        </div>
                      ))}
                    </div>
                    
                    <div className="flex gap-sm pt-xs">
                      <button
                        type="button"
                        onClick={() => setTeacherVotingIdeas([...teacherVotingIdeas, ''])}
                        className="flex-1 py-sm bg-surface-container-high text-primary text-xs font-bold rounded-xl active:scale-95 transition-all"
                      >
                        ➕ Thêm Ý Tưởng
                      </button>
                      <button
                        type="button"
                        onClick={startIdeaVoting}
                        disabled={teacherVotingIdeas.filter(i => i.trim()).length < 2}
                        className="flex-1 py-sm bg-primary text-on-primary text-xs font-black rounded-xl active:scale-95 disabled:opacity-40 transition-all shadow-md animate-pop-in"
                      >
                        🚀 Bắt Đầu Bình Chọn
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-md bg-surface-container-low p-md rounded-2xl border border-outline-variant/20">
                    <div className="flex justify-between items-center">
                      <div>
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${teacherVotingState === 'active' ? 'bg-emerald-100 text-emerald-800 animate-pulse' : 'bg-outline-variant text-on-surface-variant'}`}>
                          ● {teacherVotingState === 'active' ? 'ĐANG BÌNH CHỌN' : 'ĐÃ ĐÓNG'}
                        </span>
                        {teacherVotingState === 'active' && (
                          <span className="text-xs font-bold text-error ml-2">
                            Còn lại: {Math.floor(teacherVotingTimeLeft / 60)}:{(teacherVotingTimeLeft % 60).toString().padStart(2, '0')}
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-bold text-on-surface-variant">
                        👤 {teacherVotedUsersCount} học viên đã bình chọn
                      </span>
                    </div>

                    {/* Live Leaderboard */}
                    <div className="space-y-sm">
                      <h5 className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Bảng xếp hạng ý tưởng thực tế:</h5>
                      <div className="space-y-xs">
                        {teacherVotingIdeas
                          .map((idea, idx) => ({
                            id: `idea_${idx}`,
                            label: idea || `Ý tưởng Nhóm ${idx + 1}`,
                            score: teacherVotingScores[`idea_${idx}`] || 0
                          }))
                          .sort((a, b) => b.score - a.score)
                          .map((item, index) => {
                            const maxScore = Math.max(...Object.values(teacherVotingScores), 1);
                            const percent = Math.min((item.score / maxScore) * 100, 100);
                            return (
                              <div key={item.id} className="space-y-1">
                                <div className="flex justify-between text-xs font-medium">
                                  <span className="truncate max-w-[280px]">
                                    <span className="font-bold text-primary mr-1">#{index + 1}</span> {item.label}
                                  </span>
                                  <span className="font-black text-primary">{item.score} điểm</span>
                                </div>
                                <div className="h-2 w-full bg-outline-variant/20 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                                    style={{ width: `${percent}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>

                    <div className="flex gap-sm pt-xs">
                      {teacherVotingState === 'active' && (
                        <button
                          type="button"
                          onClick={closeIdeaVoting}
                          className="w-full py-sm bg-error text-white text-xs font-black rounded-xl active:scale-95 transition-all shadow-md"
                        >
                          🔒 Đóng bình chọn sớm
                        </button>
                      )}
                      {teacherVotingState === 'ended' && (
                        <button
                          type="button"
                          onClick={() => setTeacherVotingState('idle')}
                          className="w-full py-sm bg-primary text-on-primary text-xs font-black rounded-xl active:scale-95 transition-all shadow-md"
                        >
                          🔄 Tạo Bình Chọn Mới
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {settings.currentWeek === 15 && (
              <div className="space-y-md">
                <div className="p-md bg-secondary-container/20 border border-secondary/20 rounded-xl space-y-sm text-center">
                  <p className="text-xs text-on-surface-variant font-bold uppercase">Báo cáo click phản xạ nhanh</p>
                  <p className="text-2xl font-black text-primary">{reflexClicks.length} sinh viên đã click</p>
                </div>

                <div className="flex gap-sm">
                  <button
                    onClick={startReflexRush}
                    className="flex-1 py-sm bg-primary text-on-primary font-bold text-xs rounded-xl shadow-md hover:bg-primary/95 transition-all cursor-pointer"
                  >
                    🚀 Phát lệnh đếm ngược đồng loạt
                  </button>
                  <button
                    onClick={endReflexRush}
                    className="py-sm px-md bg-error text-on-error font-bold text-xs rounded-xl hover:bg-error/90 transition-all cursor-pointer"
                  >
                    Kết thúc 🏁
                  </button>
                </div>

                <div className="space-y-sm">
                  <p className="text-xs font-bold text-on-surface-variant uppercase">Bảng xếp hạng tốc độ phản xạ:</p>
                  <div className="max-h-40 overflow-y-auto space-y-xs pr-xs">
                    {reflexClicks.length === 0 ? (
                      <p className="text-xs text-on-surface-variant italic text-center py-sm bg-surface-container-low rounded-xl">Đang đợi sinh viên click...</p>
                    ) : (
                      reflexClicks.map((c, idx) => (
                        <div key={idx} className="flex justify-between items-center p-sm bg-surface-container border border-outline-variant/20 rounded-xl">
                          <span className="text-xs font-bold text-on-surface">
                            <span className="text-primary font-extrabold mr-1">#{idx + 1}</span> {c.name}
                          </span>
                          <span className="text-xs font-extrabold text-secondary">{c.time} ms</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── Word Cloud Section ───────────────────────────────────────────── */}
        {mounted && students.some(s => s.student_input && !s.student_input.startsWith('Vòng quay:')) && (
          <section className="bg-white p-lg rounded-xxl shadow-[0_4px_12px_rgba(0,0,0,0.05)] border border-outline-variant/15 mt-sm">
            <h3 className="text-sm font-bold text-on-surface mb-sm flex items-center gap-1">
              <span className="material-symbols-outlined text-[18px] text-primary">cloud</span>
              Từ khóa thảo luận nổi bật (Word Cloud)
            </h3>
            <p className="text-xs text-on-surface-variant mb-md">Tổng hợp từ khóa xuất hiện nhiều nhất trong câu trả lời của sinh viên tuần này.</p>
            
            <div className="flex flex-wrap items-center justify-center gap-sm bg-surface-container-low p-lg rounded-xl min-h-[120px]">
              {getWordCloudWords().map((word, wIdx) => {
                const size = word.count > 3 ? 'text-lg font-extrabold' : word.count > 1 ? 'text-sm font-bold' : 'text-xs font-semibold';
                const colors = ['text-primary', 'text-secondary', 'text-tertiary', 'text-error'];
                const colorClass = colors[wIdx % colors.length];
                
                return (
                  <span
                    key={word.text}
                    className={`px-3 py-1 bg-white rounded-full border border-outline-variant/10 shadow-sm transition-all duration-300 hover:scale-110 cursor-pointer ${size} ${colorClass}`}
                    title={`${word.count} lượt nhắc đến`}
                  >
                    {word.text}
                    <span className="text-[9px] opacity-60 ml-0.5">({word.count})</span>
                  </span>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Checked-in Students ──────────────────────────────────────────── */}
        <section className="animate-fade-in-up stagger-3">
          <div className="flex justify-between items-center mb-md">
            <h3 className="text-xl font-extrabold text-on-surface font-display-hero">Sinh viên đã điểm danh</h3>
            <div className="flex items-center gap-sm">
              {students.length > 0 && (
                <div className="flex gap-2">
                  <button
                    onClick={handleExportCSV}
                    className="px-sm py-xs rounded-lg font-bold text-xs bg-primary/10 text-primary hover:bg-primary/20 active:scale-95 transition-all border border-primary/20 flex items-center gap-0.5"
                    title="Xuất file báo cáo điểm danh Excel CSV"
                  >
                    <span className="material-symbols-outlined text-[14px]">download</span>
                    Xuất Excel
                  </button>
                  <button
                    onClick={handleResetAttendance}
                    className="px-sm py-xs rounded-lg font-bold text-xs bg-error/10 text-error hover:bg-error/20 active:scale-95 transition-all border border-error/20 flex items-center gap-0.5"
                    title="Đặt lại toàn bộ điểm danh tuần này"
                  >
                    <span className="material-symbols-outlined text-[14px]">restart_alt</span>
                    Đặt lại
                  </button>
                </div>
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

      {/* Custom Reset Confirmation Modal */}
      {resetConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-xxl w-full max-w-[400px] shadow-2xl border border-outline-variant/20 overflow-hidden animate-pop-in relative p-lg text-center space-y-lg">
            <div className="flex flex-col items-center space-y-md">
              <div className="w-12 h-12 bg-error/10 rounded-full flex items-center justify-center text-error">
                <span className="material-symbols-outlined text-[28px]">warning</span>
              </div>
              
              <h3 className="text-base font-extrabold text-on-surface">Đặt lại điểm danh?</h3>
              
              <p className="text-xs font-semibold text-on-surface-variant leading-relaxed">
                Cảnh báo: Bạn có chắc chắn muốn xóa toàn bộ điểm danh của <span className="text-error font-extrabold">Tuần {settings.currentWeek}</span>? Tất cả sinh viên đã điểm danh tuần này sẽ bị xóa khỏi danh sách và phải điểm danh lại.
              </p>

              <div className="flex gap-sm w-full pt-xs">
                <button
                  onClick={() => setResetConfirmOpen(false)}
                  className="flex-1 py-sm bg-surface-container-high border border-outline-variant/30 text-on-surface font-bold text-xs rounded-xl hover:bg-surface-container-highest transition-all cursor-pointer active:scale-95"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={executeResetAttendance}
                  className="flex-1 py-sm bg-error text-white font-bold text-xs rounded-xl hover:bg-error/90 transition-all cursor-pointer active:scale-95 shadow-md shadow-error/10"
                >
                  Xác nhận
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Custom Success Alert Modal */}
      {resetSuccessMessage && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-xxl w-full max-w-[400px] shadow-2xl border border-outline-variant/20 overflow-hidden animate-pop-in relative p-lg text-center space-y-lg">
            <div className="flex flex-col items-center space-y-md">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary">
                <span className="material-symbols-outlined text-[28px]">check_circle</span>
              </div>
              
              <h3 className="text-base font-extrabold text-on-surface">Thành công</h3>
              <p className="text-xs font-semibold text-on-surface-variant leading-relaxed">
                {resetSuccessMessage}
              </p>

              <button
                onClick={() => setResetSuccessMessage(null)}
                className="w-full py-sm bg-primary text-on-primary font-bold text-xs rounded-xl hover:bg-primary/95 transition-all cursor-pointer active:scale-95 shadow-md"
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Error Alert Modal */}
      {resetErrorMessage && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-xxl w-full max-w-[400px] shadow-2xl border border-outline-variant/20 overflow-hidden animate-pop-in relative p-lg text-center space-y-lg">
            <div className="flex flex-col items-center space-y-md">
              <div className="w-12 h-12 bg-error/10 rounded-full flex items-center justify-center text-error">
                <span className="material-symbols-outlined text-[28px]">error</span>
              </div>
              
              <h3 className="text-base font-extrabold text-on-surface">Đã xảy ra lỗi</h3>
              <p className="text-xs font-semibold text-on-surface-variant leading-relaxed">
                {resetErrorMessage}
              </p>

              <button
                onClick={() => setResetErrorMessage(null)}
                className="w-full py-sm bg-primary text-on-primary font-bold text-xs rounded-xl hover:bg-primary/95 transition-all cursor-pointer active:scale-95 shadow-md"
              >
                Đồng ý
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
