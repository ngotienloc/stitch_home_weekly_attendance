import { useState, useEffect, useRef, createContext, useContext } from 'react';
import type { Game } from '@/utils/supabase/client';
import { getGameContent, saveGameContent, createClient, isMockEnabled } from '@/utils/supabase/client';

interface Props {
  game: Game;
  weekNumber: number;
  streak: number;
  onComplete: (pts: number, studentInput?: string) => void;
  onClose: () => void;
}

const GameModalContext = createContext<{ game: Game; weekNumber: number; onClose: () => void; pts: number } | null>(null);

// Move helper sub-components outside to prevent them from being recreated on every render
const Wrap = ({ children }: { children: React.ReactNode }) => {
  const ctx = useContext(GameModalContext);
  if (!ctx) return null;
  const { game, weekNumber, onClose } = ctx;
  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest rounded-xxl w-full max-w-[450px] max-h-[90vh] flex flex-col shadow-2xl border border-outline-variant/20 overflow-hidden animate-pop-in relative">
        {/* Header */}
        <div className="bg-primary p-md flex items-center justify-between shrink-0">
          <div className="flex items-center gap-sm">
            <span className="text-2xl">{game.icon}</span>
            <div>
              <h2 className="text-base font-extrabold text-on-primary">{game.name}</h2>
              <p className="text-xs text-on-primary/70">+{game.points} điểm • Tuần {weekNumber}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-on-primary/70 hover:text-on-primary active:scale-90 transition-all">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-lg overflow-y-auto flex-1">{children}</div>
      </div>
    </div>
  );
};

const Done = () => {
  const ctx = useContext(GameModalContext);
  if (!ctx) return null;
  const { pts } = ctx;
  return (
    <div className="text-center space-y-md">
      <div className="text-6xl animate-bounce">🎉</div>
      <h3 className="text-2xl font-extrabold text-primary">+{pts} Điểm!</h3>
      <p className="text-on-surface-variant font-medium">Đã ghi nhận điểm thưởng của bạn</p>
    </div>
  );
};

const Btn = ({ onClick, children, disabled = false, cls = '' }: any) => (
  <button onClick={onClick} disabled={disabled}
    className={`w-full py-md font-bold rounded-xl transition-all active:scale-95 ${disabled ? 'bg-surface-container text-on-surface-variant' : 'bg-primary text-on-primary hover:bg-primary/90'} ${cls}`}>
    {children}
  </button>
);

const DUEL_QUESTIONS = [
  {
    q: "Đâu là giai đoạn đầu tiên trong quy trình Design Thinking?",
    opts: ["Xác định vấn đề (Define)", "Thấu cảm (Empathize)", "Thử nghiệm (Test)", "Tạo ý tưởng (Ideate)"],
    ans: 1
  },
  {
    q: "Mục đích chính của việc làm Nguyên mẫu (Prototype) là gì?",
    opts: ["Để bán ra thị trường", "Để giới thiệu sản phẩm", "Để thử nghiệm và cải tiến ý tưởng", "Để tiết kiệm chi phí"],
    ans: 2
  },
  {
    q: "Yếu tố nào dưới đây KHÔNG thuộc mô hình 4C trong sáng tạo?",
    opts: ["Critical Thinking (Tư duy phản biện)", "Communication (Giao tiếp)", "Calculation (Tính toán)", "Creativity (Sáng tạo)"],
    ans: 2
  }
];

const BOMB_QUESTIONS = [
  { q: "Bước đầu tiên trong quy trình thiết kế kỹ thuật là gì?", opts: ["Xác định vấn đề và tiêu chí thiết kế", "Chế tạo sản phẩm mẫu (Prototype)", "Thử nghiệm và đánh giá giải pháp", "Đề xuất các phương án thay thế"], ans: 0 },
  { q: "Trong thiết kế kỹ thuật, 'tiêu chí thiết kế' (Design Criteria) nghĩa là gì?", opts: ["Giới hạn tối đa về thời gian thi công", "Đặc điểm mong muốn mà giải pháp thiết kế cần đạt được", "Quy định pháp lý bắt buộc phải tuân theo", "Ngân sách tối đa của dự án chế tạo"], ans: 1 },
  { q: "Yếu tố nào sau đây là một 'ràng buộc' (Constraint) điển hình trong thiết kế?", opts: ["Màu sắc ưa thích của kỹ sư", "Hạn chế về ngân sách, vật liệu hoặc thời hạn hoàn thành", "Sự đồng thuận của tất cả thành viên trong nhóm", "Tên thương hiệu dự kiến của sản phẩm"], ans: 1 },
  { q: "Mục đích chính của việc chế tạo 'sản phẩm mẫu' (Prototype) là gì?", opts: ["Để phân phối bán lẻ cho khách hàng ngay lập tức", "Để thử nghiệm thực tế, phát hiện lỗi và tối ưu hóa thiết kế", "Để lưu trữ trong kho lưu niệm của trường/công ty", "Để đăng ký sở hữu trí tuệ trước khi thử nghiệm"], ans: 1 },
  { q: "Quy trình thiết kế kỹ thuật có đặc điểm cốt lõi nào sau đây?", opts: ["Chỉ đi theo một chiều thẳng, không bao giờ quay lại bước trước", "Là quy trình lặp (Iterative), liên tục cải tiến sau mỗi vòng đánh giá", "Không cần thực hiện bất kỳ nghiên cứu nền tảng lý thuyết nào", "Chỉ được áp dụng trong lĩnh vực cơ khí và chế tạo máy"], ans: 1 }
];

export default function GameModal({ game, weekNumber, streak, onComplete, onClose }: Props) {
  const supabase = createClient();
  const gc = getGameContent(weekNumber);
  const [done, setDone] = useState(false);
  const [pts, setPts] = useState(0);
  const [text, setText] = useState('');
  const [stars, setStars] = useState(0);
  const [codeInput, setCode] = useState(['', '', '', '']);
  const [codeErr, setCodeErr] = useState(false);
  const [quizIdx, setQuizIdx] = useState(0);
  const [quizScore, setScore] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [timer, setTimer] = useState(30);
  const [searching, setSearching] = useState(false);
  const [opponent, setOpponent] = useState('');
  const [reviewAns, setReviewAns] = useState<Record<number, string>>({});
  const [activeTeamChallenge, setActiveTeamChallenge] = useState(gc.teamChallenge || '');
  const [hintShown, setHintShown] = useState(false);
  const timerRef = useRef<any>(null);
  
  const [qrError, setQrError] = useState<string | null>(null);
  const html5QrCodeRef = useRef<any>(null);

  // Game 10 (1v1 Duel) state
  const [duelStep, setDuelStep] = useState<'idle' | 'searching' | 'playing' | 'round_result' | 'finished'>('idle');
  const [duelOpponent, setDuelOpponent] = useState<string>('');
  const [duelQuestionIdx, setDuelQuestionIdx] = useState<number>(0);
  const [duelTimer, setDuelTimer] = useState<number>(10);
  const [duelPlayerAns, setDuelPlayerAns] = useState<{ ans: number; timeSpent: number } | null>(null);
  const [duelOpponentAns, setDuelOpponentAns] = useState<{ ans: number; timeSpent: number } | null>(null);
  const [duelScores, setDuelScores] = useState<{ player: number; opponent: number }>({ player: 0, opponent: 0 });
  const [duelRoundPoints, setDuelRoundPoints] = useState<{ player: number; opponent: number }>({ player: 0, opponent: 0 });
  const duelIntervalRef = useRef<any>(null);
  const opponentTimeoutRef = useRef<any>(null);

  // Game 4 (Group Challenge) state
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [stickyNotes, setStickyNotes] = useState<any[]>([]);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [currentNoteText, setCurrentNoteText] = useState<string>('');
  const [currentChatText, setCurrentChatText] = useState<string>('');
  const [solutionText, setSolutionText] = useState<string>('');
  const [activeGroupCheckins, setActiveGroupCheckins] = useState<any[]>([]);
  const [activeGroupTab, setActiveGroupTab] = useState<'board' | 'chat'>('board');
  const [onlineMembers, setOnlineMembers] = useState<{ [id: string]: { name: string; lastSeen: number } }>({});

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('course_team_name');
      if (saved) setSelectedGroup(saved);
    }
  }, []);

  // Matchmaking states & references
  const [currentUser, setCurrentUser] = useState<{ id: string; full_name: string } | null>(null);
  const [searchTimer, setSearchTimer] = useState<number>(0);
  const [sessionCode, setSessionCode] = useState<string>('');
  const matchmakingChannelRef = useRef<any>(null);
  const gameChannelRef = useRef<any>(null);
  const groupChannelRef = useRef<any>(null);
  const votingChannelRef = useRef<any>(null);

  // Game 11 (Idea Voting) student state
  const [votingState, setVotingState] = useState<'waiting' | 'voting' | 'ended'>('waiting');
  const [votingIdeas, setVotingIdeas] = useState<{ id: string; label: string }[]>([]);
  const [votedRank1, setVotedRank1] = useState<string | null>(null);
  const [votedRank2, setVotedRank2] = useState<string | null>(null);
  const [votedRank3, setVotedRank3] = useState<string | null>(null);
  const [votingEndTime, setVotingEndTime] = useState<number>(0);
  const [votingTimer, setVotingTimer] = useState<number>(120);
  const [votingScores, setVotingScores] = useState<Record<string, number>>({});
  const [votedSubmitted, setVotedSubmitted] = useState<boolean>(false);

  // Game 1 (Đại chiến Bom) state
  const [bombHolderId, setBombHolderId] = useState<string | null>(null);
  const [bombTimeLeft, setBombTimeLeft] = useState<number>(15);
  const [bombQuestion, setBombQuestion] = useState<{ q: string; opts: string[]; ans: number } | null>(null);
  const [bombLockedUntil, setBombLockedUntil] = useState<number>(0);
  const [bombActiveUsers, setBombActiveUsers] = useState<{ [id: string]: { name: string; lastSeen: number } }>({});
  const [bombStatusText, setBombStatusText] = useState<string>('Đang đợi giảng viên kích hoạt bom...');
  const [bombScore, setBombScore] = useState<number>(0);
  const [bombCompleted, setBombCompleted] = useState<boolean>(false);
  const [bombExploded, setBombExploded] = useState<boolean>(false);
  const bombChannelRef = useRef<any>(null);

  // Game 2 (Đấu trường sinh tử) state
  const [battleLives, setBattleLives] = useState<number>(3);
  const [battleStep, setBattleStep] = useState<'waiting' | 'playing' | 'spectating' | 'finished'>('waiting');
  const [battleQuestion, setBattleQuestion] = useState<{ q: string; opts: string[]; ans: number; idx: number; total: number } | null>(null);
  const [battleSelectedIdx, setBattleSelectedIdx] = useState<number | null>(null);
  const [battleHasSubmitted, setBattleHasSubmitted] = useState<boolean>(false);
  const [battleTotalCorrect, setBattleTotalCorrect] = useState<number>(0);
  const [battleSurvivors, setBattleSurvivors] = useState<{ id: string; name: string; lives: number }[]>([]);
  const [battleFloatingEmojis, setBattleFloatingEmojis] = useState<{ id: string; emoji: string; left: number }[]>([]);
  const battleChannelRef = useRef<any>(null);

  // Game 5 (Kẻ giả mạo) state
  const [undercoverWord, setUndercoverWord] = useState<string | null>(null);
  const [undercoverRole, setUndercoverRole] = useState<'normal' | 'undercover' | 'mrwhite' | null>(null);
  const [undercoverStep, setUndercoverStep] = useState<'waiting' | 'describing' | 'voting' | 'ended'>('waiting');
  const [undercoverSelectedDesc, setUndercoverSelectedDesc] = useState<string | null>(null);
  const [undercoverDescriptions, setUndercoverDescriptions] = useState<{ [id: string]: { name: string; desc: string } }>({});
  const [undercoverVotes, setUndercoverVotes] = useState<{ [id: string]: number }>({});
  const [undercoverHasVoted, setUndercoverHasVoted] = useState<boolean>(false);
  const [undercoverWinner, setUndercoverWinner] = useState<string | null>(null);
  const undercoverChannelRef = useRef<any>(null);

  // Game 9 (Cuộc đua nối từ) state
  const [wordChainList, setWordChainList] = useState<string[]>([]);
  const [wordChainOptions, setWordChainOptions] = useState<string[]>([]);
  const [wordChainCurrentWord, setWordChainCurrentWord] = useState<string>('');
  const [wordChainLastWinner, setWordChainLastWinner] = useState<string | null>(null);
  const [wordChainLocked, setWordChainLocked] = useState<boolean>(false);
  const [wordChainCount, setWordChainCount] = useState<number>(0);
  const wordChainChannelRef = useRef<any>(null);

  // Game 15 (Đại chiến phản xạ) state
  const [reflexState, setReflexState] = useState<'idle' | 'countdown' | 'go' | 'clicked'>('idle');
  const [reflexCountdown, setReflexCountdown] = useState<number>(3);
  const [reflexGoTime, setReflexGoTime] = useState<number>(0);
  const [reflexTime, setReflexTime] = useState<number | null>(null);
  const [reflexLeaderboard, setReflexLeaderboard] = useState<{ name: string; time: number }[]>([]);
  const reflexChannelRef = useRef<any>(null);

  // Fetch current profile for matchmaking
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }: { data: { user: any } }) => {
      if (user) {
        if (isMockEnabled) {
          const profiles = JSON.parse(localStorage.getItem('mock_profiles') || '[]');
          const profile = profiles.find((p: any) => p.id === user.id);
          setCurrentUser({
            id: user.id,
            full_name: profile?.full_name || 'Học viên Mock'
          });
        } else {
          supabase
            .from('profiles')
            .select('full_name')
            .eq('id', user.id)
            .single()
            .then(({ data }: { data: any }) => {
              setCurrentUser({
                id: user.id,
                full_name: data?.full_name || 'Học viên ẩn danh'
              });
            });
        }
      }
    });
  }, []);

  // Game 6 (Raise Hand) start time
  const handRaiseStartTimeRef = useRef<number | null>(null);

  // Game 6: Record modal open time
  useEffect(() => {
    if (game.id === 6) {
      handRaiseStartTimeRef.current = Date.now();
    }
  }, [game.id]);

  const finish = (p: number, inputVal?: string | null) => {
    setPts(p);
    setDone(true);
    const finalInput = inputVal !== undefined ? inputVal : (text.trim() ? text.trim() : (stars > 0 ? `${stars} sao` : null));
    setTimeout(() => onComplete(p, finalInput || undefined), 1800);
  };

  // Game 13: 30-second countdown
  useEffect(() => {
    if (game.id === 13 && !done) {
      timerRef.current = setInterval(() => setTimer(t => { if (t <= 1) { clearInterval(timerRef.current); return 0; } return t - 1; }), 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [game.id, done]);

  // Game 10: 1v1 duel matching and lifecycle
  useEffect(() => {
    if (game.id === 10) {
      setDuelStep('searching');
      setSearchTimer(0);
      setDuelQuestionIdx(0);
      setDuelTimer(10);
      setDuelPlayerAns(null);
      setDuelOpponentAns(null);
      setDuelScores({ player: 0, opponent: 0 });
      setSessionCode('');
    }
  }, [game.id]);

  // Game 10: Matchmaking Lobby Channel Subscription
  useEffect(() => {
    if (game.id !== 10 || duelStep !== 'searching' || !currentUser) return;

    const channelName = isMockEnabled ? 'mock_duel_matchmaking' : 'real_duel_matchmaking';
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false }
      }
    });

    matchmakingChannelRef.current = channel;

    const startRealMatch = (oppName: string, session: string) => {
      setSessionCode(session);
      setDuelOpponent(oppName);
      setDuelStep('playing');
      setDuelQuestionIdx(0);
      setDuelTimer(10);
      setDuelPlayerAns(null);
      setDuelOpponentAns(null);
      setDuelScores({ player: 0, opponent: 0 });
    };

    channel
      .on('broadcast', { event: 'ping_search' }, ({ payload }: { payload: any }) => {
        const { userId: oppId, name: oppName } = payload;
        if (oppId === currentUser.id) return;

        // Deterministic matching: lower UUID waits, higher UUID initiates request
        if (currentUser.id > oppId) {
          channel.send({
            type: 'broadcast',
            event: 'match_request',
            payload: { hostId: oppId, guestId: currentUser.id, guestName: currentUser.full_name }
          });
        }
      })
      .on('broadcast', { event: 'match_request' }, ({ payload }: { payload: any }) => {
        const { hostId, guestId, guestName } = payload;
        if (hostId === currentUser.id) {
          const session = `${hostId}-${guestId}-${Date.now()}`;
          channel.send({
            type: 'broadcast',
            event: 'match_accept',
            payload: { hostId, guestId, sessionId: session, hostName: currentUser.full_name }
          });
          
          startRealMatch(guestName, session);
        }
      })
      .on('broadcast', { event: 'match_accept' }, ({ payload }: { payload: any }) => {
        const { hostId, guestId, sessionId, hostName } = payload;
        if (guestId === currentUser.id) {
          startRealMatch(hostName, sessionId);
        }
      })
      .subscribe();

    const pingInterval = setInterval(() => {
      channel.send({
        type: 'broadcast',
        event: 'ping_search',
        payload: { userId: currentUser.id, name: currentUser.full_name }
      });
    }, 1500);

    return () => {
      clearInterval(pingInterval);
      if (matchmakingChannelRef.current) {
        supabase.removeChannel(matchmakingChannelRef.current);
        matchmakingChannelRef.current = null;
      }
    };
  }, [game.id, duelStep, currentUser]);

  // Game 10: Searching Timer
  useEffect(() => {
    if (game.id === 10 && duelStep === 'searching') {
      const interval = setInterval(() => {
        setSearchTimer(t => t + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [game.id, duelStep]);

  // Game 10: P2P Match Session Channel Subscription
  useEffect(() => {
    if (game.id !== 10 || duelStep !== 'playing' || !sessionCode || sessionCode === 'bot' || !currentUser) return;

    const channelName = isMockEnabled ? `mock_duel_session_${sessionCode}` : `real_duel_session_${sessionCode}`;
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false }
      }
    });

    gameChannelRef.current = channel;

    channel
      .on('broadcast', { event: 'submit_answer' }, ({ payload }: { payload: any }) => {
        const { qIdx, ans, timeSpent } = payload;
        if (qIdx === duelQuestionIdx) {
          setDuelOpponentAns({ ans, timeSpent });
        }
      })
      .subscribe();

    return () => {
      if (gameChannelRef.current) {
        supabase.removeChannel(gameChannelRef.current);
        gameChannelRef.current = null;
      }
    };
  }, [game.id, duelStep, sessionCode, duelQuestionIdx, currentUser]);

  // Game 10: Timer and Opponent AI loop
  useEffect(() => {
    if (game.id === 10 && duelStep === 'playing') {
      if (duelIntervalRef.current) clearInterval(duelIntervalRef.current);
      setDuelTimer(10);
      
      duelIntervalRef.current = setInterval(() => {
        setDuelTimer((prev) => {
          if (prev <= 1) {
            clearInterval(duelIntervalRef.current);
            handleDuelRoundEnd(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      // AI opponent picks an answer ONLY if matched with bot
      if (!sessionCode || sessionCode === 'bot' || duelOpponent === 'Hệ thống (Bot)') {
        const opponentDelay = Math.random() * 5000 + 2000;
        opponentTimeoutRef.current = setTimeout(() => {
          const currentQ = DUEL_QUESTIONS[duelQuestionIdx];
          const isCorrect = Math.random() < 0.75; // 75% accuracy
          const chosenAns = isCorrect ? currentQ.ans : (currentQ.ans + 1) % 4;
          const timeSpent = parseFloat((opponentDelay / 1000).toFixed(2));
          
          setDuelOpponentAns({
            ans: chosenAns,
            timeSpent
          });
        }, opponentDelay);
      }
    }

    return () => {
      if (duelIntervalRef.current) clearInterval(duelIntervalRef.current);
      if (opponentTimeoutRef.current) clearTimeout(opponentTimeoutRef.current);
    };
  }, [game.id, duelStep, duelQuestionIdx, sessionCode, duelOpponent]);

  // Game 10: Watch both answers to proceed
  useEffect(() => {
    if (game.id === 10 && duelStep === 'playing' && duelPlayerAns !== null && duelOpponentAns !== null) {
      if (duelIntervalRef.current) clearInterval(duelIntervalRef.current);
      if (opponentTimeoutRef.current) clearTimeout(opponentTimeoutRef.current);
      handleDuelRoundEnd(false);
    }
  }, [game.id, duelStep, duelPlayerAns, duelOpponentAns]);

  // Game 4 (Team Challenge) database query for members and checking existing submission
  useEffect(() => {
    if (game.id === 4 && selectedGroup) {
      if (isMockEnabled) {
        const mockCheckins = [
          { full_name: 'Nguyễn Hoàng Nam', student_input: `${selectedGroup} | Ý tưởng: Cảm biến AI giao thông` },
          { full_name: 'Lê Hải Yến', student_input: `${selectedGroup} | Ý tưởng: Làn bus điện BRT` },
        ];
        setActiveGroupCheckins(mockCheckins);
      } else {
        supabase
          .from('check_ins')
          .select('student_input, user_id, profiles(full_name)')
          .eq('week_number', 4)
          .then(({ data }: { data: any }) => {
            if (data) {
              const formatted = data.map((c: any) => ({
                full_name: c.profiles?.full_name || 'Học viên',
                student_input: c.student_input
              }));
              setActiveGroupCheckins(formatted);

              // Check if someone in the same group has already submitted
              const groupCheckin = data.find((c: any) => c.student_input && c.student_input.startsWith(selectedGroup));
              if (groupCheckin) {
                // Automatically complete for this student!
                finish(20, groupCheckin.student_input);
              }
            }
          });
      }
    }
  }, [game.id, selectedGroup]);

  // Game 4 (Team Challenge) Realtime Channel
  useEffect(() => {
    if (game.id !== 4 || !selectedGroup || !currentUser) return;

    // Normalize group slug to ASCII: e.g. "Nhóm 1" -> "nhom_1"
    const groupSlug = selectedGroup
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D")
      .replace(/[^a-zA-Z0-9_-]/g, "_")
      .toLowerCase();

    const channelName = isMockEnabled ? `mock_group_${groupSlug}` : `real_group_${groupSlug}`;
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false }
      }
    });

    groupChannelRef.current = channel;

    channel
      .on('broadcast', { event: 'post_note' }, ({ payload }: { payload: any }) => {
        const { note } = payload;
        setStickyNotes(prev => {
          if (prev.some(n => n.id === note.id)) return prev;
          return [...prev, note];
        });
      })
      .on('broadcast', { event: 'send_chat' }, ({ payload }: { payload: any }) => {
        const { msg } = payload;
        setChatMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      })
      .on('broadcast', { event: 'group_ping' }, ({ payload }: { payload: any }) => {
        const { userId, name } = payload;
        setOnlineMembers(prev => ({
          ...prev,
          [userId]: { name, lastSeen: Date.now() }
        }));
      })
      .on('broadcast', { event: 'submit_solution' }, ({ payload }: { payload: any }) => {
        const { solution } = payload;
        finish(20, solution);
      })
      .subscribe();

    return () => {
      if (groupChannelRef.current) {
        supabase.removeChannel(groupChannelRef.current);
        groupChannelRef.current = null;
      }
    };
  }, [game.id, selectedGroup, currentUser]);

  // Periodic group presence ping
  useEffect(() => {
    if (game.id !== 4 || !selectedGroup || !currentUser) return;
    const interval = setInterval(() => {
      if (groupChannelRef.current) {
        groupChannelRef.current.send({
          type: 'broadcast',
          event: 'group_ping',
          payload: { userId: currentUser.id, name: currentUser.full_name }
        });
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [game.id, selectedGroup, currentUser]);

  // Listen to class global topic updates from teacher
  useEffect(() => {
    if (game.id !== 4) return;
    
    const channel = supabase.channel('class_session_global');
    
    channel.on('broadcast', { event: 'update_topic' }, ({ payload }: { payload: any }) => {
      const { week, topic } = payload;
      if (week === 4 && topic) {
        saveGameContent(4, { teamChallenge: topic });
        setActiveTeamChallenge(topic);
      }
    }).subscribe();

    // Request the current topic from teacher after a small delay
    const timer = setTimeout(() => {
      channel.send({
        type: 'broadcast',
        event: 'request_current_topic',
        payload: { week: 4 }
      });
    }, 5000);

    return () => {
      supabase.removeChannel(channel);
      clearTimeout(timer);
    };
  }, [game.id]);

  // Game 1 (Đại chiến Bom) student realtime effect
  useEffect(() => {
    if (game.id !== 1 || !currentUser) return;

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
      .on('broadcast', { event: 'start_bomb' }, ({ payload }: { payload: any }) => {
        const { holderId, question } = payload;
        setBombHolderId(holderId);
        setBombQuestion(question);
        setBombTimeLeft(15);
        setBombExploded(false);
        setBombCompleted(false);
        setBombStatusText(holderId === currentUser.id ? '💣 BẠN ĐANG GIỮ BOM! Trả lời ngay!' : `💣 Quả bom đang ở chỗ ${bombActiveUsers[holderId]?.name || 'một bạn khác'}`);
      })
      .on('broadcast', { event: 'pass_bomb' }, ({ payload }: { payload: any }) => {
        const { newHolderId, question } = payload;
        setBombHolderId(newHolderId);
        setBombQuestion(question);
        setBombTimeLeft(15);
        setBombStatusText(newHolderId === currentUser.id ? '💣 BẠN ĐANG GIỮ BOM! Trả lời ngay!' : `💣 Quả bom được chuyền tới ${bombActiveUsers[newHolderId]?.name || 'một bạn khác'}`);
      })
      .on('broadcast', { event: 'bomb_exploded' }, ({ payload }: { payload: any }) => {
        const { holderId } = payload;
        setBombHolderId(null);
        setBombExploded(true);
        setBombStatusText(`💥 Quả bom đã nổ tung ở chỗ ${bombActiveUsers[holderId]?.name || 'một bạn khác'}!`);
        if (holderId === currentUser.id) {
          finish(5, 'Bị bom nổ (+5đ)');
        } else {
          finish(15, 'Sống sót (+15đ)');
        }
      })
      .subscribe();

    // Send periodic presence ping for bomb game
    const pingInterval = setInterval(() => {
      channel.send({
        type: 'broadcast',
        event: 'bomb_ping',
        payload: { userId: currentUser.id, name: currentUser.full_name }
      });
    }, 2000);

    return () => {
      supabase.removeChannel(channel);
      bombChannelRef.current = null;
      clearInterval(pingInterval);
    };
  }, [game.id, currentUser?.id, currentUser?.full_name]);

  // Countdown timer for Game 1 bomb holder
  useEffect(() => {
    if (game.id !== 1 || !bombHolderId || bombCompleted) return;

    const t = setInterval(() => {
      setBombTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(t);
          if (bombHolderId === currentUser?.id) {
            // Explode bomb!
            bombChannelRef.current?.send({
              type: 'broadcast',
              event: 'bomb_exploded',
              payload: { holderId: currentUser.id }
            });
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(t);
  }, [game.id, bombHolderId, bombCompleted, currentUser?.id]);

  // Game 2 (Đấu trường sinh tử) student realtime effect
  useEffect(() => {
    if (game.id !== 2 || !currentUser) return;

    const channel = supabase.channel('battle_royale_global', {
      config: {
        broadcast: { self: true }
      }
    });
    battleChannelRef.current = channel;

    channel
      .on('broadcast', { event: 'battle_ping' }, ({ payload }: { payload: any }) => {
        const { userId, name, lives } = payload;
        setBattleSurvivors(prev => {
          const idx = prev.findIndex(s => s.id === userId);
          const next = [...prev];
          if (idx >= 0) {
            next[idx] = { id: userId, name, lives };
          } else {
            next.push({ id: userId, name, lives });
          }
          return next;
        });
      })
      .on('broadcast', { event: 'start_battle' }, () => {
        setBattleLives(3);
        setBattleStep('playing');
        setBattleTotalCorrect(0);
        setBattleQuestion(null);
        setBattleSelectedIdx(null);
        setBattleHasSubmitted(false);
      })
      .on('broadcast', { event: 'battle_question' }, ({ payload }: { payload: any }) => {
        const { question } = payload;
        setBattleQuestion(question);
        setBattleSelectedIdx(null);
        setBattleHasSubmitted(false);
      })
      .on('broadcast', { event: 'battle_emoji' }, ({ payload }: { payload: any }) => {
        const { emoji } = payload;
        const newEmojiObj = {
          id: Math.random().toString(),
          emoji,
          left: Math.random() * 80 + 10
        };
        setBattleFloatingEmojis(prev => [...prev.slice(-15), newEmojiObj]);
      })
      .on('broadcast', { event: 'end_battle' }, () => {
        setBattleStep('finished');
        if (battleLives > 0) {
          finish(15, `Sinh tồn thành công: ${battleLives} Tim (+15đ)`);
        } else {
          finish(5, `Bị loại (+5đ)`);
        }
      })
      .subscribe();

    const pingInterval = setInterval(() => {
      channel.send({
        type: 'broadcast',
        event: 'battle_ping',
        payload: { userId: currentUser.id, name: currentUser.full_name, lives: battleLives }
      });
    }, 2000);

    return () => {
      supabase.removeChannel(channel);
      battleChannelRef.current = null;
      clearInterval(pingInterval);
    };
  }, [game.id, currentUser, battleLives]);

  // Game 5 (Kẻ giả mạo) student realtime effect
  useEffect(() => {
    if (game.id !== 5 || !currentUser || !selectedGroup) return;

    const channel = supabase.channel(`undercover_group_${selectedGroup}`, {
      config: {
        broadcast: { self: true }
      }
    });
    undercoverChannelRef.current = channel;

    channel
      .on('broadcast', { event: 'undercover_start' }, ({ payload }: { payload: any }) => {
        const { keywordPair, assignments } = payload;
        const role = assignments[currentUser.id] || 'normal';
        setUndercoverRole(role);
        setUndercoverWord(role === 'normal' ? keywordPair.normal : role === 'undercover' ? keywordPair.undercover : '?');
        setUndercoverStep('describing');
        setUndercoverDescriptions({});
        setUndercoverVotes({});
        setUndercoverHasVoted(false);
        setUndercoverWinner(null);
      })
      .on('broadcast', { event: 'undercover_describe' }, ({ payload }: { payload: any }) => {
        const { userId, name, desc } = payload;
        setUndercoverDescriptions(prev => ({
          ...prev,
          [userId]: { name, desc }
        }));
      })
      .on('broadcast', { event: 'undercover_step_vote' }, () => {
        setUndercoverStep('voting');
      })
      .on('broadcast', { event: 'undercover_vote' }, ({ payload }: { payload: any }) => {
        const { targetId } = payload;
        setUndercoverVotes(prev => ({
          ...prev,
          [targetId]: (prev[targetId] || 0) + 1
        }));
      })
      .on('broadcast', { event: 'undercover_end' }, ({ payload }: { payload: any }) => {
        const { winner } = payload;
        setUndercoverWinner(winner);
        setUndercoverStep('ended');
        if (winner === 'undercover' && undercoverRole === 'undercover') {
          finish(15, 'Kẻ giả mạo thắng (+15đ)');
        } else if (winner === 'mrwhite' && undercoverRole === 'mrwhite') {
          finish(15, 'Mr White thắng (+15đ)');
        } else if (winner === 'normal' && undercoverRole === 'normal') {
          finish(15, 'Dân thường thắng (+15đ)');
        } else {
          finish(10, 'Tham gia chơi (+10đ)');
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      undercoverChannelRef.current = null;
    };
  }, [game.id, currentUser, selectedGroup, undercoverRole]);

  // Game 9 (Cuộc đua nối từ) student realtime effect
  useEffect(() => {
    if (game.id !== 9 || !currentUser) return;

    const channel = supabase.channel('word_chain_global', {
      config: {
        broadcast: { self: true }
      }
    });
    wordChainChannelRef.current = channel;

    channel
      .on('broadcast', { event: 'start_word_chain' }, ({ payload }: { payload: any }) => {
        const { word, options } = payload;
        setWordChainCurrentWord(word);
        setWordChainOptions(options || []);
        setWordChainList([word]);
        setWordChainLastWinner(null);
        setWordChainCount(0);
        setWordChainLocked(false);
      })
      .on('broadcast', { event: 'word_chain_next' }, ({ payload }: { payload: any }) => {
        const { word, options, winnerName, chainLength } = payload;
        setWordChainCurrentWord(word);
        setWordChainOptions(options || []);
        setWordChainList(prev => [...prev, word]);
        setWordChainLastWinner(winnerName);
        setWordChainCount(chainLength || 0);
        setWordChainLocked(false);
      })
      .on('broadcast', { event: 'end_word_chain' }, () => {
        finish(15, `Tham gia nối từ (+15đ)`);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      wordChainChannelRef.current = null;
    };
  }, [game.id, currentUser]);

  // Game 15 (Đại chiến phản xạ) student realtime effects
  useEffect(() => {
    if (game.id !== 15 || !currentUser) return;

    const channel = supabase.channel('reflex_rush_global', {
      config: {
        broadcast: { self: true }
      }
    });
    reflexChannelRef.current = channel;

    let countdownInterval: any = null;

    channel
      .on('broadcast', { event: 'reflex_start_countdown' }, () => {
        setReflexState('countdown');
        setReflexCountdown(3);
        setReflexTime(null);

        if (countdownInterval) clearInterval(countdownInterval);
        let count = 3;
        countdownInterval = setInterval(() => {
          count -= 1;
          if (count <= 0) {
            clearInterval(countdownInterval);
            setReflexState('go');
            setReflexGoTime(Date.now());
          } else {
            setReflexCountdown(count);
          }
        }, 1000);
      })
      .on('broadcast', { event: 'reflex_leaderboard_update' }, ({ payload }: { payload: any }) => {
        const { leaderboard } = payload;
        setReflexLeaderboard(leaderboard || []);
      })
      .on('broadcast', { event: 'reflex_end' }, () => {
        setReflexState('idle');
      })
      .subscribe();

    return () => {
      if (countdownInterval) clearInterval(countdownInterval);
      supabase.removeChannel(channel);
      reflexChannelRef.current = null;
    };
  }, [game.id, currentUser]);

  // Game 11 (Idea Voting) student realtime effects
  useEffect(() => {
    if (game.id !== 11) return;

    const channel = supabase.channel('idea_voting_global', {
      config: {
        broadcast: { self: false }
      }
    });
    votingChannelRef.current = channel;

    channel
      .on('broadcast', { event: 'start_voting' }, ({ payload }: { payload: any }) => {
        const { ideas, endTime, state, scores } = payload;
        setVotingIdeas(ideas || []);
        setVotingEndTime(endTime || 0);
        setVotingState(state === 'active' ? 'voting' : (state || 'voting'));
        setVotingScores(scores || {});
      })
      .on('broadcast', { event: 'sync_voting_state' }, ({ payload }: { payload: any }) => {
        const { ideas, endTime, state, scores } = payload;
        setVotingIdeas(ideas || []);
        setVotingEndTime(endTime || 0);
        setVotingState(state === 'active' ? 'voting' : (state || 'voting'));
        setVotingScores(scores || {});
      })
      .on('broadcast', { event: 'update_leaderboard' }, ({ payload }: { payload: any }) => {
        const { scores } = payload;
        setVotingScores(scores || {});
      })
      .on('broadcast', { event: 'close_voting' }, () => {
        setVotingState('ended');
      })
      .subscribe();

    // Handshake request for state
    const tReq = setTimeout(() => {
      channel.send({
        type: 'broadcast',
        event: 'request_voting_state'
      });
    }, 1000);

    return () => {
      supabase.removeChannel(channel);
      votingChannelRef.current = null;
      clearTimeout(tReq);
    };
  }, [game.id]);

  // Countdown timer effect
  useEffect(() => {
    if (game.id === 11 && votingState === 'voting' && votingEndTime > 0) {
      const t = setInterval(() => {
        const diff = Math.max(0, Math.floor((votingEndTime - Date.now()) / 1000));
        setVotingTimer(diff);
        if (diff <= 0) {
          setVotingState('ended');
          clearInterval(t);
        }
      }, 1000);
      return () => clearInterval(t);
    }
  }, [game.id, votingState, votingEndTime]);



  const getGroupMembers = () => {
    const names = new Set<string>();
    if (currentUser) {
      names.add(currentUser.full_name);
    }
    const now = Date.now();
    Object.keys(onlineMembers).forEach(id => {
      if (now - onlineMembers[id].lastSeen < 8000) {
        names.add(onlineMembers[id].name);
      }
    });
    activeGroupCheckins.forEach(c => {
      if (c.student_input && c.student_input.startsWith(selectedGroup || '')) {
        names.add(c.full_name);
      }
    });
    return Array.from(names);
  };

  const postStickyNote = (content: string) => {
    if (!content.trim() || !currentUser || !selectedGroup) return;
    const colors = [
      'bg-amber-100 border-amber-300 text-amber-900',
      'bg-emerald-100 border-emerald-300 text-emerald-900',
      'bg-rose-100 border-rose-300 text-rose-900',
      'bg-sky-100 border-sky-300 text-sky-900'
    ];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const note = {
      id: `${currentUser.id}-${Date.now()}`,
      name: currentUser.full_name,
      content: content.trim(),
      color: randomColor
    };

    setStickyNotes(prev => [...prev, note]);

    if (groupChannelRef.current) {
      groupChannelRef.current.send({
        type: 'broadcast',
        event: 'post_note',
        payload: { note }
      });
    }
  };

  const sendGroupChat = (msgText: string) => {
    if (!msgText.trim() || !currentUser || !selectedGroup) return;
    const msg = {
      id: `${currentUser.id}-${Date.now()}`,
      sender: currentUser.full_name,
      text: msgText.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages(prev => [...prev, msg]);

    if (groupChannelRef.current) {
      groupChannelRef.current.send({
        type: 'broadcast',
        event: 'send_chat',
        payload: { msg }
      });
    }
  };

  const handleGroupChallengeSubmit = () => {
    if (!selectedGroup) return;
    const notesSummary = stickyNotes.map(n => `[${n.name}]: ${n.content}`).join('; ');
    const solutionSummary = solutionText.trim() || 'Thảo luận nhóm thiết kế giải pháp';
    const finalInput = `${selectedGroup} | Ý tưởng: ${notesSummary} | Giải pháp: ${solutionSummary}`;
    
    if (groupChannelRef.current) {
      groupChannelRef.current.send({
        type: 'broadcast',
        event: 'submit_solution',
        payload: { solution: finalInput }
      });
    }

    finish(20, finalInput);
  };

  const submitStudentVote = () => {
    if (!votedRank1 || !votedRank2 || !votedRank3) return;
    
    if (votingChannelRef.current) {
      votingChannelRef.current.send({
        type: 'broadcast',
        event: 'submit_vote',
        payload: { votes: [votedRank1, votedRank2, votedRank3] }
      });
    }

    setVotingScores(prev => {
      const next = { ...prev };
      next[votedRank1] = (next[votedRank1] || 0) + 3;
      next[votedRank2] = (next[votedRank2] || 0) + 2;
      next[votedRank3] = (next[votedRank3] || 0) + 1;
      return next;
    });

    setVotedSubmitted(true);

    const label1 = votingIdeas.find(i => i.id === votedRank1)?.label || votedRank1;
    const label2 = votingIdeas.find(i => i.id === votedRank2)?.label || votedRank2;
    const label3 = votingIdeas.find(i => i.id === votedRank3)?.label || votedRank3;

    finish(10, `Bình chọn ý tưởng - Hạng 1: ${label1} | Hạng 2: ${label2} | Hạng 3: ${label3}`);
  };

  const handleDuelPlayerAnswer = (optionIdx: number) => {
    if (duelPlayerAns !== null || duelStep !== 'playing') return;
    const timeSpent = parseFloat((10 - duelTimer).toFixed(2));
    setDuelPlayerAns({
      ans: optionIdx,
      timeSpent
    });

    // Broadcast our answer to the opponent!
    if (sessionCode && sessionCode !== 'bot' && gameChannelRef.current) {
      gameChannelRef.current.send({
        type: 'broadcast',
        event: 'submit_answer',
        payload: { qIdx: duelQuestionIdx, ans: optionIdx, timeSpent }
      });
    }
  };

  const handleDuelRoundEnd = (isTimeout: boolean) => {
    let pAns = duelPlayerAns;
    if (isTimeout && pAns === null) {
      pAns = { ans: -1, timeSpent: 10 };
      setDuelPlayerAns(pAns);

      // Broadcast timeout to opponent
      if (sessionCode && sessionCode !== 'bot' && gameChannelRef.current) {
        gameChannelRef.current.send({
          type: 'broadcast',
          event: 'submit_answer',
          payload: { qIdx: duelQuestionIdx, ans: -1, timeSpent: 10 }
        });
      }
    }
    
    let oAns = duelOpponentAns;
    if (isTimeout && oAns === null) {
      oAns = { ans: -1, timeSpent: 10 };
      setDuelOpponentAns(oAns);
    }

    const currentQ = DUEL_QUESTIONS[duelQuestionIdx];
    const playerCorrect = pAns ? pAns.ans === currentQ.ans : false;
    const opponentCorrect = oAns ? oAns.ans === currentQ.ans : false;

    let pPoints = playerCorrect ? 10 : 0;
    let oPoints = opponentCorrect ? 10 : 0;

    if (playerCorrect && opponentCorrect && pAns && oAns) {
      if (pAns.timeSpent < oAns.timeSpent) {
        pPoints += 5;
      } else if (oAns.timeSpent < pAns.timeSpent) {
        oPoints += 5;
      }
    }

    setDuelRoundPoints({ player: pPoints, opponent: oPoints });
    setDuelScores((prev) => ({
      player: prev.player + pPoints,
      opponent: prev.opponent + oPoints
    }));

    setDuelStep('round_result');

    setTimeout(() => {
      if (duelQuestionIdx + 1 < DUEL_QUESTIONS.length) {
        setDuelQuestionIdx((prev) => prev + 1);
        setDuelPlayerAns(null);
        setDuelOpponentAns(null);
        setDuelStep('playing');
      } else {
        setDuelStep('finished');
      }
    }, 2800);
  };

  // Game 3: QR scanner lifecycle
  useEffect(() => {
    let html5QrCode: any = null;
    if (game.id === 3 && searching) {
      // Load html5-qrcode dynamically for safe SSR
      const { Html5Qrcode } = require('html5-qrcode');
      
      const timer = setTimeout(() => {
        const element = document.getElementById('qr-reader');
        if (!element) return;
        
        try {
          html5QrCode = new Html5Qrcode("qr-reader");
          html5QrCodeRef.current = html5QrCode;
          
          html5QrCode.start(
            { facingMode: "environment" },
            {
              fps: 10,
              qrbox: { width: 180, height: 180 }
            },
            (decodedText: string) => {
              const expectedCode = `StitchHomeWeeklyAttendance_Teacher_CheckIn_Week_${weekNumber}`;
              if (decodedText === expectedCode) {
                if (html5QrCode) {
                  html5QrCode.stop().then(() => {
                    finish(10, 'Quét mã QR GV thành công');
                  }).catch((err: any) => {
                    console.error("Stop scanner error", err);
                    finish(10, 'Quét mã QR GV thành công');
                  });
                } else {
                  finish(10, 'Quét mã QR GV thành công');
                }
              } else {
                setQrError('Mã QR không hợp lệ cho tuần học này!');
              }
            },
            () => {
              // Silence scanner frame errors
            }
          ).catch((err: any) => {
            console.error("Camera access error", err);
            setQrError("Không thể truy cập camera. Vui lòng cấp quyền sử dụng camera.");
          });
        } catch (e) {
          console.error("Failed to construct Html5Qrcode", e);
        }
      }, 300);

      return () => {
        clearTimeout(timer);
        if (html5QrCode) {
          try {
            if (html5QrCode.isScanning) {
              html5QrCode.stop().catch((err: any) => console.error("Clean stop error", err));
            }
          } catch (err) {
            console.error("Clean stop error", err);
          }
        }
      };
    }
  }, [searching, game.id, weekNumber]);

  return (
    <GameModalContext.Provider value={{ game, weekNumber, onClose, pts }}>
      {(() => {
        if (done) return <Wrap><Done /></Wrap>;


        // ── GAME 1: Hot Potato Bomb ───────────────────────────────────────────────
        if (game.id === 1) {
          const isHolder = bombHolderId === currentUser?.id;
          const isLocked = Date.now() < bombLockedUntil;
          
          let displayStatusText = 'Đang đợi giảng viên kích hoạt bom...';
          if (bombExploded) {
            const holderName = bombHolderId === currentUser?.id ? 'BẠN' : (bombActiveUsers[bombHolderId || '']?.name || 'một bạn khác');
            displayStatusText = `💥 Quả bom đã nổ tung ở chỗ ${holderName}!`;
          } else if (bombHolderId) {
            const holderName = bombHolderId === currentUser?.id ? 'BẠN' : (bombActiveUsers[bombHolderId]?.name || 'một bạn khác');
            displayStatusText = bombHolderId === currentUser?.id ? '💣 BẠN ĐANG GIỮ BOM! Trả lời ngay!' : `💣 Quả bom đang ở chỗ ${holderName}`;
          }

          return (
            <Wrap>
              <div className="space-y-md">
                <div className={`p-lg rounded-xxl text-center transition-all duration-300 ${
                  isHolder 
                    ? 'bg-error-container/20 border-2 border-error animate-pulse' 
                    : 'bg-surface-container border border-outline-variant/30'
                }`}>
                  <div className={`text-6xl mb-xs ${isHolder ? 'animate-bounce' : ''}`}>
                    {bombExploded ? '💥' : isHolder ? '💣' : '⏳'}
                  </div>
                  <h3 className="text-xl font-extrabold text-on-surface">Đại chiến bom hẹn giờ</h3>
                  <p className="text-xs font-semibold text-on-surface-variant mt-1">{displayStatusText}</p>

                  {bombHolderId && !bombExploded && (
                    <div className="mt-md flex flex-col items-center justify-center">
                      <p className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">Thời gian còn lại</p>
                      <span className={`text-4xl font-black font-mono mt-xs ${bombTimeLeft <= 5 ? 'text-error animate-ping' : 'text-primary'}`}>
                        {bombTimeLeft}s
                      </span>
                    </div>
                  )}
                </div>

                {isHolder && bombQuestion && !bombExploded && (
                  <div className="space-y-sm animate-pop-in">
                    <div className="p-md bg-secondary-container/20 rounded-xl border border-secondary/20">
                      <p className="text-xs font-bold text-secondary uppercase mb-xs">Câu hỏi gỡ bom</p>
                      <p className="font-semibold text-on-surface text-sm">{bombQuestion.q}</p>
                    </div>
                    
                    <div className="space-y-sm">
                      {bombQuestion.opts.map((opt: string, idx: number) => (
                        <button
                          key={idx}
                          disabled={isLocked}
                          onClick={() => {
                            if (idx === bombQuestion.ans) {
                              setBombCompleted(true);
                              const others = Object.keys(bombActiveUsers).filter(id => id !== currentUser?.id);
                              if (others.length > 0) {
                                const nextId = others[Math.floor(Math.random() * others.length)];
                                const nextQ = BOMB_QUESTIONS[Math.floor(Math.random() * BOMB_QUESTIONS.length)];
                                bombChannelRef.current?.send({
                                  type: 'broadcast',
                                  event: 'pass_bomb',
                                  payload: { newHolderId: nextId, question: nextQ }
                                });
                              } else {
                                finish(15, 'Gỡ bom thành công (+15đ)');
                              }
                            } else {
                              setBombLockedUntil(Date.now() + 1500);
                            }
                          }}
                          className={`w-full p-sm rounded-xl text-left text-sm font-medium border transition-all ${
                            isLocked ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary/40'
                          } bg-surface-container border-outline-variant/30`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                    {isLocked && (
                      <p className="text-center text-xs font-bold text-error animate-pulse">Trả lời sai! Đang bị khóa 1.5s...</p>
                    )}
                  </div>
                )}

                {!isHolder && !bombExploded && (
                  <div className="space-y-sm">
                    <p className="text-xs font-extrabold uppercase tracking-wider text-on-surface-variant">Thành viên trong phòng ({Object.keys(bombActiveUsers).length})</p>
                    <div className="grid grid-cols-2 gap-xs max-h-40 overflow-y-auto p-1 bg-surface-container-low rounded-xl">
                      {Object.values(bombActiveUsers).map((u: any, idx) => (
                        <div key={idx} className="flex items-center gap-xs p-xs text-xs font-medium text-on-surface bg-surface-container rounded-lg">
                          <span className="w-2 h-2 rounded-full bg-success" />
                          <span className="truncate">{u.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Wrap>
          );
        }

        // ── GAME 2: Battle Royale ──────────────────────────────────────────────────
        if (game.id === 2) {
          const isPlaying = battleStep === 'playing';
          const isSpectating = battleStep === 'spectating';
          return (
            <Wrap>
              <div className="space-y-md relative overflow-hidden">
                <div className="absolute inset-0 pointer-events-none z-10">
                  {battleFloatingEmojis.map(fe => (
                    <div
                      key={fe.id}
                      className="absolute bottom-0 text-3xl animate-float-up"
                      style={{ left: `${fe.left}%` }}
                    >
                      {fe.emoji}
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center bg-surface-container p-sm rounded-xl border border-outline-variant/30">
                  <div className="flex gap-xs">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <span key={i} className="text-xl">
                        {i < battleLives ? '❤️' : '🖤'}
                      </span>
                    ))}
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                      {isSpectating ? 'Chế độ khán giả' : `Sống sót: ${battleLives}/3 Tim`}
                    </p>
                  </div>
                </div>

                {battleStep === 'waiting' && (
                  <div className="text-center py-lg space-y-md">
                    <div className="text-5xl animate-bounce">🦖</div>
                    <h4 className="font-extrabold text-on-surface">Đấu trường sinh tử</h4>
                    <p className="text-xs text-on-surface-variant font-semibold">Đang đợi giảng viên bắt đầu trận đấu trắc nghiệm sinh tồn...</p>
                  </div>
                )}

                {isPlaying && battleQuestion && (
                  <div className="space-y-sm animate-pop-in">
                    <div className="flex justify-between items-center text-xs font-bold text-on-surface-variant">
                      <span>Câu {battleQuestion.idx + 1}/{battleQuestion.total}</span>
                    </div>
                    <div className="p-md bg-primary-container/20 rounded-xl border border-primary/20">
                      <p className="font-bold text-on-surface text-sm">{battleQuestion.q}</p>
                    </div>

                    <div className="space-y-sm">
                      {battleQuestion.opts.map((opt: string, idx: number) => {
                        const isSelected = battleSelectedIdx === idx;
                        return (
                          <button
                            key={idx}
                            disabled={battleHasSubmitted}
                            onClick={() => {
                              setBattleSelectedIdx(idx);
                              setBattleHasSubmitted(true);
                              const isCorrect = idx === battleQuestion.ans;
                              if (isCorrect) {
                                setBattleTotalCorrect(prev => prev + 1);
                              } else {
                                setBattleLives(prev => {
                                  const next = prev - 1;
                                  if (next <= 0) {
                                    setBattleStep('spectating');
                                  }
                                  return next;
                                });
                              }
                            }}
                            className={`w-full p-sm rounded-xl text-left text-sm font-medium border transition-all ${
                              isSelected 
                                ? 'bg-primary text-on-primary border-primary' 
                                : 'bg-surface-container border-outline-variant/30 hover:border-primary/40'
                            }`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {isSpectating && (
                  <div className="text-center py-md space-y-md">
                    <div className="text-5xl animate-pulse">💀</div>
                    <h4 className="font-extrabold text-error">Bạn đã bị loại!</h4>
                    <p className="text-xs text-on-surface-variant">Nhưng bạn vẫn có thể thả biểu cảm để cổ vũ:</p>
                    <div className="flex justify-center gap-sm">
                      {['🎉', '🔥', '💀', '👏', '💥', '👻'].map(emoji => (
                        <button
                          key={emoji}
                          onClick={() => {
                            battleChannelRef.current?.send({
                              type: 'broadcast',
                              event: 'battle_emoji',
                              payload: { emoji }
                            });
                          }}
                          className="w-12 h-12 text-2xl bg-surface-container rounded-full active:scale-95 hover:scale-105 transition-all shadow-md flex items-center justify-center cursor-pointer border border-outline-variant/20"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {(isPlaying || isSpectating) && (
                  <div className="space-y-xs pt-xs border-t border-outline-variant/20">
                    <p className="text-[10px] font-extrabold uppercase tracking-wider text-on-surface-variant">Sinh viên đang sinh tồn ({battleSurvivors.filter(s => s.lives > 0).length})</p>
                    <div className="grid grid-cols-2 gap-xs max-h-24 overflow-y-auto p-1 bg-surface-container-low rounded-xl">
                      {battleSurvivors.filter(s => s.lives > 0).map((s, idx) => (
                        <div key={idx} className="flex items-center justify-between p-xs text-xs font-semibold bg-surface-container rounded-lg">
                          <span className="truncate max-w-[80px]">{s.name}</span>
                          <span className="text-xs">{'❤️'.repeat(s.lives)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Wrap>
          );
        }

        // ── GAME 3: QR Code Attendance ─────────────────────────────────────────────
        if (game.id === 3) {
          const qrTab = selected === null ? 0 : selected;
          return (
            <Wrap>
              <div className="space-y-lg text-center">
                {/* Tab selector */}
                <div className="flex bg-surface-container-low p-1 rounded-xl border border-outline-variant/30">
                  <button
                    onClick={() => setSelected(0)}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${qrTab === 0 ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-high'
                      }`}
                  >
                    📷 Quét mã GV
                  </button>
                  <button
                    onClick={() => { setSelected(1); setSearching(false); setQrError(null); }}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${qrTab === 1 ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-high'
                      }`}
                  >
                    📱 Mã QR của tôi
                  </button>
                </div>

                {qrTab === 0 ? (
                  <div className="space-y-md">
                    <p className="text-sm text-on-surface-variant font-medium">Đặt mã QR của Giảng viên vào khung quét:</p>

                    {searching ? (
                      <div className="space-y-md flex flex-col items-center">
                        <div className="relative w-48 h-48 mx-auto border-4 border-green-500/30 rounded-xl overflow-hidden bg-black flex items-center justify-center shadow-inner">
                          <div id="qr-reader" className="w-full h-full object-cover absolute inset-0 animate-pulse" />
                          {/* Glowing grid */}
                          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(34,197,94,0.1)_1px,transparent_1px),linear-gradient(to_right,rgba(34,197,94,0.1)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />
                          {/* Laser line */}
                          <div className="absolute left-0 right-0 h-1 bg-green-500 shadow-[0_0_12px_#22c55e] top-0 animate-[bounce_1.5s_infinite] pointer-events-none" />
                        </div>
                        {qrError ? (
                          <p className="text-xs text-error font-bold leading-tight bg-error-container/10 p-sm rounded border border-error/20 max-w-[220px]">
                            ⚠️ {qrError}
                          </p>
                        ) : (
                          <p className="text-xs text-green-600 font-bold animate-pulse">Đang quét mã QR của giảng viên...</p>
                        )}
                        <button
                          onClick={() => {
                            setSearching(false);
                            setQrError(null);
                          }}
                          className="px-md py-xs rounded-lg text-xs font-bold bg-surface-container-high text-on-surface-variant hover:bg-surface-container-highest active:scale-95 transition-all mt-sm"
                        >
                          Hủy quét
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-md">
                        <div className="relative w-48 h-48 mx-auto border-4 border-outline-variant/40 rounded-xl overflow-hidden bg-surface-container-low flex items-center justify-center shadow-inner">
                          <span className="material-symbols-outlined text-6xl text-outline/50">photo_camera</span>
                        </div>
                        <Btn onClick={() => {
                          setSearching(true);
                          setQrError(null);
                        }}>
                          📸 Bắt đầu quét QR (+10 điểm)
                        </Btn>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-md flex flex-col items-center">
                    <p className="text-sm text-on-surface-variant font-medium">Đưa mã QR này cho giảng viên quét:</p>
                    <div className="bg-white p-sm rounded-xl border border-outline-variant/40 shadow-md">
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=StitchHomeWeeklyAttendance_Student_${streak}_Week_${weekNumber}`}
                        alt="Student Attendance QR"
                        className="w-40 h-40 select-none pointer-events-none"
                      />
                    </div>
                    <p className="text-[11px] text-on-surface-variant italic font-medium">Mã điểm danh Tuần {weekNumber} • Chuỗi {streak} ngày</p>
                    <Btn onClick={() => finish(10)}>
                      🤝 GV đã quét xong (+10 điểm)
                    </Btn>
                  </div>
                )}
              </div>
            </Wrap>
          );
        }

        // ── GAME 4: Team Challenge ─────────────────────────────────────────────────
        if (game.id === 4) return (
          <Wrap>
            <div className="space-y-md">
              {/* Phase 1: Group Selection */}
              {!selectedGroup && (
                <div className="space-y-md text-center py-sm">
                  <p className="text-sm font-bold text-on-surface-variant mb-md">
                    Chọn Nhóm thực tế của bạn học phần này:
                  </p>
                  <div className="grid grid-cols-2 gap-sm max-h-[300px] overflow-y-auto pr-xs">
                    {Array.from({ length: 10 }).map((_, i) => {
                      const groupName = `Nhóm ${i + 1}`;
                      return (
                        <button
                          key={groupName}
                          onClick={() => {
                            setSelectedGroup(groupName);
                            localStorage.setItem('course_team_name', groupName);
                          }}
                          className="p-md rounded-2xl border border-outline-variant/30 hover:border-primary/50 hover:bg-primary/5 active:scale-95 transition-all text-sm font-extrabold text-on-surface flex flex-col items-center gap-1 cursor-pointer bg-white"
                        >
                          <span className="text-2xl">👥</span>
                          {groupName}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Phase 2: Group Workspace */}
              {selectedGroup && (
                <div className="space-y-sm">
                  {/* Challenge prompt */}
                  <div className="bg-primary/5 rounded-2xl p-md border border-primary/10 space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase tracking-wider text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        🎯 {selectedGroup}
                      </span>
                      <button
                        onClick={() => {
                          setSelectedGroup(null);
                          localStorage.removeItem('course_team_name');
                        }}
                        className="text-[10px] font-bold text-on-surface-variant hover:text-error hover:underline transition-colors"
                      >
                        Đổi nhóm
                      </button>
                    </div>
                    <p className="text-xs font-bold text-on-surface leading-tight mt-1">{activeTeamChallenge || gc.teamChallenge}</p>
                  </div>

                  {/* Tabs Selector */}
                  <div className="flex border-b border-outline-variant/20">
                    <button
                      onClick={() => setActiveGroupTab('board')}
                      className={`flex-1 py-2 text-xs font-black transition-all border-b-2 ${activeGroupTab === 'board' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant'}`}
                    >
                      Bảng Ý Tưởng 📌 ({stickyNotes.length})
                    </button>
                    <button
                      onClick={() => setActiveGroupTab('chat')}
                      className={`flex-1 py-2 text-xs font-black transition-all border-b-2 ${activeGroupTab === 'chat' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant'}`}
                    >
                      Thảo Luận Nhóm 💬 ({chatMessages.length})
                    </button>
                  </div>

                  {/* Tab Content: Board */}
                  {activeGroupTab === 'board' && (
                    <div className="space-y-sm">
                      <div className="grid grid-cols-2 gap-sm bg-surface-container/30 p-sm rounded-2xl border border-outline-variant/10 min-h-[140px] max-h-[220px] overflow-y-auto">
                        {stickyNotes.length === 0 ? (
                          <div className="col-span-2 flex flex-col items-center justify-center p-md text-center text-xs text-on-surface-variant font-medium">
                            <span>📌 Ý tưởng của nhóm sẽ xuất hiện ở đây.</span>
                            <span>Hãy là người đầu tiên ghim ghi chú!</span>
                          </div>
                        ) : (
                          stickyNotes.map((note) => (
                            <div
                              key={note.id}
                              className={`p-sm rounded-xl border shadow-sm flex flex-col justify-between min-h-[85px] transition-all hover:-translate-y-0.5 ${note.color}`}
                            >
                              <p className="text-[11px] font-bold leading-snug break-words">"{note.content}"</p>
                              <span className="text-[9px] font-black mt-2 self-end opacity-85">📌 {note.name}</span>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Post Note Input */}
                      <div className="flex gap-sm">
                        <input
                          type="text"
                          value={currentNoteText}
                          onChange={(e) => setCurrentNoteText(e.target.value)}
                          placeholder="Nhập ý tưởng của bạn..."
                          className="flex-grow px-sm py-xs text-xs rounded-xl border border-outline-variant/40 focus:outline-none focus:border-primary bg-surface-container-low"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              postStickyNote(currentNoteText);
                              setCurrentNoteText('');
                            }
                          }}
                        />
                        <button
                          onClick={() => {
                            postStickyNote(currentNoteText);
                            setCurrentNoteText('');
                          }}
                          disabled={!currentNoteText.trim()}
                          className="px-md py-xs bg-primary text-on-primary font-bold text-xs rounded-xl active:scale-95 transition-all disabled:opacity-40"
                        >
                          Ghim 📌
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Tab Content: Chat */}
                  {activeGroupTab === 'chat' && (
                    <div className="space-y-sm">
                      <div className="flex flex-col gap-sm bg-surface-container/30 p-sm rounded-2xl border border-outline-variant/10 min-h-[140px] max-h-[220px] overflow-y-auto">
                        {chatMessages.length === 0 ? (
                          <div className="flex items-center justify-center p-md text-center text-xs text-on-surface-variant font-medium h-full">
                            Bắt đầu thảo luận với nhóm của bạn...
                          </div>
                        ) : (
                          chatMessages.map((msg) => (
                            <div key={msg.id} className="flex flex-col gap-0.5">
                              <div className="flex items-baseline gap-1">
                                <span className="text-[10px] font-black text-on-surface">{msg.sender}</span>
                                <span className="text-[8px] text-on-surface-variant font-medium">{msg.time}</span>
                              </div>
                              <p className="text-xs bg-surface-container-low px-sm py-xs rounded-xl border border-outline-variant/10 text-on-surface max-w-[85%] self-start leading-tight">
                                {msg.text}
                              </p>
                            </div>
                          ))
                        )}
                        <p className="text-[9px] text-on-surface-variant font-semibold animate-pulse italic mt-xs">
                          🟢 {getGroupMembers().join(', ')} đang online...
                        </p>
                      </div>

                      {/* Chat Input */}
                      <div className="flex gap-sm">
                        <input
                          type="text"
                          value={currentChatText}
                          onChange={(e) => setCurrentChatText(e.target.value)}
                          placeholder="Nhập nội dung thảo luận..."
                          className="flex-grow px-sm py-xs text-xs rounded-xl border border-outline-variant/40 focus:outline-none focus:border-primary bg-surface-container-low"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              sendGroupChat(currentChatText);
                              setCurrentChatText('');
                            }
                          }}
                        />
                        <button
                          onClick={() => {
                            sendGroupChat(currentChatText);
                            setCurrentChatText('');
                          }}
                          disabled={!currentChatText.trim()}
                          className="px-md py-xs bg-secondary text-on-secondary font-bold text-xs rounded-xl active:scale-95 transition-all disabled:opacity-40"
                        >
                          Gửi 💬
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Submission and solution text */}
                  <div className="space-y-sm pt-sm border-t border-outline-variant/20 mt-sm">
                    <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-wider block">
                      📝 Tóm tắt giải pháp của nhóm:
                    </label>
                    <textarea
                      value={solutionText}
                      onChange={(e) => setSolutionText(e.target.value)}
                      placeholder="Nhập tóm tắt giải pháp cuối cùng của nhóm bạn sau khi thống nhất..."
                      rows={2}
                      className="w-full p-sm text-xs rounded-xl border border-outline-variant/40 focus:border-primary focus:ring-1 focus:ring-primary/20 outline-none bg-surface-container-low"
                    />
                    <button
                      onClick={handleGroupChallengeSubmit}
                      disabled={stickyNotes.length === 0}
                      className="w-full py-sm bg-primary text-on-primary font-black text-xs rounded-xl shadow-md active:scale-95 transition-all disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1 mt-xs"
                    >
                      <span className="material-symbols-outlined text-xs">cloud_upload</span>
                      Nộp bài giải nhóm (+20 điểm)
                    </button>
                    {stickyNotes.length === 0 && (
                      <p className="text-[9px] text-center text-error font-bold">
                        ⚠️ Hãy thảo luận và đăng ít nhất 1 ý tưởng lên bảng trước khi nộp giải pháp!
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </Wrap>
        );

        // ── GAME 5: Undercover / Mr. White ─────────────────────────────────────────
        if (game.id === 5) {
          const isNormal = undercoverRole === 'normal';
          const isUndercover = undercoverRole === 'undercover';
          const isWhite = undercoverRole === 'mrwhite';
          const undercovers = Object.entries(undercoverDescriptions);

          const undercoverClues: Record<string, string[]> = {
            'React': ['Thư viện JS', 'Facebook', 'Virtual DOM', 'Component-based'],
            'Vue': ['Framework JS', 'Evan You', 'Dễ học', 'Template-based'],
            'Python': ['Độ thụt lề', 'Đơn giản', 'Trí tuệ nhân tạo', 'Scripting'],
            'Java': ['Hướng đối tượng', 'JVM', 'Cú pháp nghiêm ngặt', 'Android'],
            'SQL': ['Truy vấn', 'Bảng dữ liệu', 'Quan hệ', 'Structured'],
            'NoSQL': ['Không lược đồ', 'Tài liệu', 'Khả năng mở rộng', 'Key-value'],
            '?': ['Tôi không biết', 'Khó đoán', 'Bí ẩn', 'Trừu tượng']
          };

          const options = undercoverClues[undercoverWord || 'React'] || ['Công cụ lập trình', 'Hiện đại', 'Phổ biến', 'Hiệu quả'];

          return (
            <Wrap>
              <div className="space-y-md">
                <div className="bg-surface-container p-md rounded-xl text-center border border-outline-variant/30">
                  <div className="text-5xl mb-xs">🕵️</div>
                  <h3 className="text-lg font-extrabold text-on-surface">Kẻ giả mạo lớp học</h3>
                  <p className="text-xs font-medium text-on-surface-variant">Nhóm thực tế của bạn: <span className="font-extrabold text-primary">{selectedGroup || 'Chưa thiết lập'}</span></p>
                </div>

                {undercoverStep === 'waiting' && (
                  <div className="text-center py-lg space-y-xs">
                    <p className="font-bold text-on-surface text-sm animate-pulse">Đang chờ giảng viên phát từ khóa...</p>
                    <p className="text-xs text-on-surface-variant">Hãy đảm bảo nhóm của bạn đã được thiết lập đúng!</p>
                  </div>
                )}

                {undercoverStep === 'describing' && undercoverWord && (
                  <div className="space-y-sm animate-pop-in">
                    <div className="p-md bg-secondary-container/20 rounded-xl text-center border border-secondary/20">
                      <p className="text-xs font-bold text-secondary uppercase mb-xs">Từ khóa bí mật của bạn</p>
                      <p className="text-2xl font-black text-on-surface">{undercoverWord}</p>
                      {isWhite && <p className="text-[10px] text-error font-extrabold mt-xs">Bạn là Mr. White! Hãy quan sát mô tả của người khác để đoán từ khóa!</p>}
                    </div>

                    {!undercoverSelectedDesc ? (
                      <div className="space-y-sm">
                        <p className="text-xs font-extrabold uppercase tracking-wider text-on-surface-variant">Chọn 1 từ mô tả từ khóa của bạn:</p>
                        {options.map((opt, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              setUndercoverSelectedDesc(opt);
                              undercoverChannelRef.current?.send({
                                type: 'broadcast',
                                event: 'undercover_describe',
                                payload: { userId: currentUser?.id, name: currentUser?.full_name, desc: opt }
                              });
                            }}
                            className="w-full p-sm rounded-xl text-left text-sm font-semibold bg-surface-container border border-outline-variant/30 hover:border-primary/40 transition-all cursor-pointer"
                          >
                            💬 {opt}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-md space-y-xs bg-surface-container-low rounded-xl border border-outline-variant/20">
                        <p className="text-xs text-on-surface-variant font-semibold">Bạn đã gửi mô tả của mình:</p>
                        <p className="font-extrabold text-primary">"{undercoverSelectedDesc}"</p>
                        <p className="text-[10px] text-on-surface-variant animate-pulse mt-sm">Đang đợi các thành viên khác mô tả...</p>
                      </div>
                    )}
                  </div>
                )}

                {undercoverStep === 'voting' && (
                  <div className="space-y-sm animate-pop-in">
                    <p className="text-xs font-extrabold uppercase tracking-wider text-on-surface-variant">Chọn người bạn nghi ngờ là Kẻ giả mạo hoặc Mr. White:</p>
                    <div className="space-y-sm max-h-60 overflow-y-auto pr-xs">
                      {undercovers.map(([uid, u]: [string, any]) => {
                        const voteCount = undercoverVotes[uid] || 0;
                        return (
                          <div key={uid} className="flex justify-between items-center p-sm bg-surface-container border border-outline-variant/30 rounded-xl">
                            <div>
                              <p className="text-xs font-bold text-on-surface">{u.name} {uid === currentUser?.id && '(Bạn)'}</p>
                              <p className="text-sm font-extrabold text-primary">"{u.desc}"</p>
                            </div>
                            <button
                              disabled={undercoverHasVoted || uid === currentUser?.id}
                              onClick={() => {
                                setUndercoverHasVoted(true);
                                undercoverChannelRef.current?.send({
                                  type: 'broadcast',
                                  event: 'undercover_vote',
                                  payload: { voterId: currentUser?.id, targetId: uid }
                                });
                              }}
                              className={`px-sm py-xs text-xs font-extrabold rounded-lg transition-all ${
                                undercoverHasVoted
                                  ? 'bg-surface-container-high text-on-surface-variant'
                                  : 'bg-error text-on-error hover:bg-error/90 active:scale-95 cursor-pointer'
                              }`}
                            >
                              Vote {voteCount > 0 ? `(${voteCount})` : ''}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {undercoverStep === 'ended' && (
                  <div className="text-center py-lg space-y-md animate-pop-in">
                    <div className="text-5xl">🏆</div>
                    <h3 className="text-xl font-black text-primary">Trò chơi kết thúc!</h3>
                    <div className="bg-secondary-container/20 rounded-xl p-md border border-secondary/20 inline-block">
                      <p className="text-xs font-bold text-secondary uppercase">Phe chiến thắng</p>
                      <p className="text-lg font-extrabold text-on-surface">
                        {undercoverWinner === 'normal' ? 'Dân thường 🙋‍♂️' : undercoverWinner === 'undercover' ? 'Kẻ giả mạo 🕵️' : 'Mr. White 👻'}
                      </p>
                    </div>
                    <p className="text-xs text-on-surface-variant font-semibold mt-sm">Vai trò của bạn là: <b>{isNormal ? 'Dân thường' : isUndercover ? 'Kẻ giả mạo' : 'Mr. White'}</b></p>
                  </div>
                )}
              </div>
            </Wrap>
          );
        }

        // ── GAME 6: Raise Hand ────────────────────────────────────────────────────
        if (game.id === 6) return (
          <Wrap>
            <div className="text-center space-y-lg">
              <p className="text-sm text-on-surface-variant">Giơ tay để trả lời câu hỏi giảng viên!</p>
              <button onClick={() => {
                const elapsed = handRaiseStartTimeRef.current
                  ? (Date.now() - handRaiseStartTimeRef.current) / 1000
                  : 1.0;
                finish(10, `Giơ tay lúc ${elapsed.toFixed(2)}s`);
              }}
                className="w-32 h-32 mx-auto rounded-full bg-secondary-container text-7xl flex items-center justify-center active:scale-90 hover:scale-105 transition-all shadow-xl cursor-pointer border-4 border-secondary">
                ✋
              </button>
              <p className="text-xs text-on-surface-variant">Nhấn để giơ tay</p>
            </div>
          </Wrap>
        );

        // ── GAME 7: Feedback Survey ───────────────────────────────────────────────
        if (game.id === 7) return (
          <Wrap>
            <div className="space-y-md">
              <p className="font-semibold text-on-surface text-center">Buổi học hôm nay thế nào?</p>
              <div className="flex justify-center gap-sm">
                {[1, 2, 3, 4, 5].map(s => (
                  <button key={s} onClick={() => setStars(s)} className={`text-4xl transition-all active:scale-90 ${s <= stars ? 'opacity-100' : 'opacity-30'}`}>⭐</button>
                ))}
              </div>
              <textarea value={text} onChange={e => setText(e.target.value)} rows={2} placeholder="Góp ý thêm (không bắt buộc)..."
                className="w-full p-md rounded-xl border border-outline-variant/40 focus:border-primary outline-none text-sm resize-none bg-surface-container-low" />
              <Btn onClick={() => finish(5, `${stars} sao${text.trim() ? ` • ${text.trim()}` : ''}`)} disabled={stars === 0}>Gửi phản hồi (+5 điểm)</Btn>
            </div>
          </Wrap>
        );

        // ── GAME 8: Streak Bonus ──────────────────────────────────────────────────
        if (game.id === 8) return (
          <Wrap>
            <div className="text-center space-y-lg">
              <div className="text-6xl animate-bounce">🔥</div>
              <div>
                <h3 className="text-4xl font-extrabold text-primary">{streak}</h3>
                <p className="text-on-surface font-semibold">ngày liên tiếp điểm danh!</p>
              </div>
              <div className="bg-secondary-container/20 rounded-xl p-md">
                <p className="text-sm font-medium text-on-surface">Điểm thưởng chuỗi: <span className="font-extrabold text-primary">+{Math.min(streak * 2, 10)} điểm</span></p>
              </div>
              <Btn onClick={() => finish(Math.min(streak * 2, 10))}>🔥 Nhận điểm thưởng!</Btn>
            </div>
          </Wrap>
        );

        // ── GAME 9: Word Chain Blitz ──────────────────────────────────────────────
        if (game.id === 9) {
          return (
            <Wrap>
              <div className="space-y-md">
                <div className="bg-surface-container p-md rounded-xl text-center border border-outline-variant/30">
                  <div className="text-5xl mb-xs animate-pulse">🔗</div>
                  <h3 className="text-lg font-extrabold text-on-surface">Cuộc đua nối từ chuyên ngành</h3>
                  <p className="text-xs font-medium text-on-surface-variant">Sinh viên cả lớp cùng tranh tài gõ nối tiếp từ khóa.</p>
                </div>

                {!wordChainCurrentWord ? (
                  <div className="text-center py-lg space-y-xs">
                    <p className="font-bold text-on-surface text-sm animate-pulse">Đang chờ giảng viên phát từ bắt đầu...</p>
                  </div>
                ) : (
                  <div className="space-y-sm animate-pop-in">
                    <div className="flex justify-between items-center text-xs font-bold text-on-surface-variant">
                      <span>Độ dài chuỗi: <b className="text-primary">{wordChainCount} từ</b></span>
                      {wordChainLastWinner && (
                        <span className="text-success truncate max-w-[150px]">⚡ {wordChainLastWinner}</span>
                      )}
                    </div>

                    <div className="p-lg bg-tertiary-container/20 rounded-xxl text-center border border-tertiary/20">
                      <p className="text-xs font-bold text-tertiary uppercase tracking-wider mb-xs">Từ khóa hiện tại</p>
                      <p className="text-2xl font-black text-on-surface">{wordChainCurrentWord}</p>
                    </div>

                    <div className="space-y-sm">
                      <p className="text-xs font-extrabold uppercase tracking-wider text-on-surface-variant">Chọn từ nối tiếp phù hợp:</p>
                      <div className="grid grid-cols-2 gap-sm">
                        {wordChainOptions.map((opt, idx) => (
                          <button
                            key={idx}
                            disabled={wordChainLocked}
                            onClick={() => {
                              const words = wordChainCurrentWord.trim().split(/\s+/);
                              const lastWord = words[words.length - 1].toLowerCase();
                              const optFirstWord = opt.trim().split(/\s+/)[0].toLowerCase();
                              
                              if (optFirstWord === lastWord) {
                                setWordChainLocked(true);
                                wordChainChannelRef.current?.send({
                                  type: 'broadcast',
                                  event: 'word_chain_submit',
                                  payload: { word: opt, studentName: currentUser?.full_name }
                                });
                              } else {
                                setWordChainLocked(true);
                                setTimeout(() => setWordChainLocked(false), 1500);
                              }
                            }}
                            className="p-md text-xs font-bold text-on-surface bg-surface-container border border-outline-variant/30 rounded-xl hover:border-primary/40 active:scale-95 transition-all text-center cursor-pointer"
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-sm border-t border-outline-variant/20">
                      <p className="text-[10px] font-extrabold uppercase tracking-wider text-on-surface-variant">Chuỗi từ hiện tại:</p>
                      <div className="flex gap-xs overflow-x-auto py-xs whitespace-nowrap scrollbar-thin">
                        {wordChainList.map((w, idx) => (
                          <div key={idx} className="flex items-center gap-xs">
                            <span className="px-xs py-1.5 text-xs font-extrabold bg-surface-container rounded-lg border border-outline-variant/30 text-on-surface">{w}</span>
                            {idx < wordChainList.length - 1 && <span className="text-xs text-on-surface-variant">➔</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Wrap>
          );
        }

        // ── GAME 10: 1v1 Duel ────────────────────────────────────────────────────
        if (game.id === 10) {
          const currentQ = DUEL_QUESTIONS[duelQuestionIdx];
          return (
            <Wrap>
              {/* searching step */}
              {duelStep === 'searching' && (
                <div className="text-center space-y-lg py-xl flex flex-col items-center">
                  <div className="relative w-36 h-36 border-2 border-primary/30 rounded-full flex items-center justify-center animate-pulse">
                    <div className="absolute inset-2 border border-primary/20 rounded-full" />
                    <div className="absolute inset-8 border border-primary/10 rounded-full" />
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-primary/5 to-primary/20 rounded-full animate-spin" style={{ animationDuration: '3s' }} />
                    <span className="material-symbols-outlined text-4xl text-primary animate-pulse">radar</span>
                  </div>
                  <div className="space-y-sm flex flex-col items-center">
                    <h3 className="font-extrabold text-lg text-on-surface">Đang tìm đối thủ...</h3>
                    <p className="text-xs text-on-surface-variant font-medium animate-pulse">Đang kết nối với các bạn học sinh online...</p>
                    
                    {/* Fallback to Bot match if waiting too long */}
                    <div className="pt-md w-full max-w-[240px] space-y-xs">
                      <p className="text-[10px] text-on-surface-variant font-bold">
                        ⏱️ Đã tìm kiếm: <span className="text-primary">{searchTimer}s</span>
                      </p>
                      
                      {searchTimer >= 6 && (
                        <button
                          onClick={() => {
                            setSessionCode('bot');
                            setDuelOpponent('Hệ thống (Bot)');
                            setDuelStep('playing');
                            setDuelQuestionIdx(0);
                            setDuelTimer(10);
                            setDuelPlayerAns(null);
                            setDuelOpponentAns(null);
                            setDuelScores({ player: 0, opponent: 0 });
                          }}
                          className="w-full py-sm bg-secondary text-on-secondary font-black text-xs rounded-xl shadow-md active:scale-95 transition-all cursor-pointer hover:bg-secondary/90 flex items-center justify-center gap-1 animate-fade-in-up mt-sm"
                        >
                          <span className="material-symbols-outlined text-sm">smart_toy</span>
                          Thách đấu với Bot (AI)
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* playing or round_result steps */}
              {(duelStep === 'playing' || duelStep === 'round_result') && (
                <div className="space-y-md">
                  {/* Live Head-to-Head header */}
                  <div className="flex items-center justify-between bg-surface-container-high rounded-2xl p-md border border-outline-variant/10 shadow-sm">
                    {/* Player info */}
                    <div className="flex items-center gap-sm flex-1">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm border-2 border-primary/30 shadow-sm">
                        Bạn
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-bold text-on-surface">Bạn</p>
                        <p className="text-lg font-black text-primary font-display">{duelScores.player}đ</p>
                        {duelPlayerAns ? (
                          <span className="text-[10px] text-green-600 font-bold bg-green-500/10 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            ⚡ {duelPlayerAns.timeSpent}s
                          </span>
                        ) : (
                          <span className="text-[10px] text-on-surface-variant animate-pulse">Đang suy nghĩ...</span>
                        )}
                      </div>
                    </div>

                    {/* VS Divider */}
                    <div className="px-md flex flex-col items-center justify-center">
                      <span className="text-xs font-black text-outline bg-white px-2 py-1 rounded-full border border-outline-variant/20 shadow-sm">VS</span>
                    </div>

                    {/* Opponent info */}
                    <div className="flex items-center gap-sm flex-1 flex-row-reverse text-right">
                      <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center text-secondary font-bold text-sm border-2 border-secondary/30 shadow-sm">
                        {duelOpponent.slice(0, 2)}
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-on-surface truncate max-w-[80px]">{duelOpponent}</p>
                        <p className="text-lg font-black text-secondary font-display">{duelScores.opponent}đ</p>
                        {duelOpponentAns ? (
                          <span className="text-[10px] text-green-600 font-bold bg-green-500/10 px-1.5 py-0.5 rounded flex items-center gap-0.5 ml-auto w-max">
                            ⚡ {duelOpponentAns.timeSpent}s
                          </span>
                        ) : (
                          <span className="text-[10px] text-on-surface-variant animate-pulse">Đang suy nghĩ...</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Progress & Question */}
                  <div className="bg-surface-container p-md rounded-2xl border border-outline-variant/10 relative overflow-hidden">
                    {/* Timer progress bar */}
                    <div className="absolute bottom-0 left-0 h-1 bg-outline-variant/20 w-full animate-pulse">
                      <div
                        className={`h-full transition-all duration-1000 ${
                          duelTimer > 5 ? 'bg-primary' : duelTimer > 2 ? 'bg-warning' : 'bg-error animate-pulse'
                        }`}
                        style={{ width: `${(duelTimer / 10) * 100}%` }}
                      />
                    </div>

                    <div className="flex justify-between items-center mb-sm">
                      <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                        Câu hỏi {duelQuestionIdx + 1}/3
                      </span>
                      <span className="text-xs font-black text-on-surface flex items-center gap-0.5">
                        ⏱️ {duelTimer}s
                      </span>
                    </div>
                    <p className="font-bold text-on-surface text-sm leading-snug">{currentQ.q}</p>
                  </div>

                  {/* Option Buttons */}
                  <div className="grid grid-cols-1 gap-sm">
                    {currentQ.opts.map((opt, oIdx) => {
                      const isSelected = duelPlayerAns?.ans === oIdx;
                      const isCorrectAns = currentQ.ans === oIdx;
                      
                      let btnStyle = "bg-white text-on-surface border-outline-variant/30 hover:bg-surface-container-low";
                      if (duelStep === 'round_result') {
                        if (isCorrectAns) {
                          btnStyle = "bg-green-500/15 text-green-700 border-green-500/40 font-bold";
                        } else if (isSelected) {
                          btnStyle = "bg-red-500/15 text-red-700 border-red-500/40";
                        } else {
                          btnStyle = "bg-white text-on-surface/50 border-outline-variant/10 opacity-60";
                        }
                      } else if (duelPlayerAns !== null) {
                        btnStyle = isSelected
                          ? "bg-primary/10 text-primary border-primary/40 font-bold"
                          : "bg-white text-on-surface/50 border-outline-variant/10 opacity-60";
                      }

                      return (
                        <button
                          key={oIdx}
                          disabled={duelPlayerAns !== null || duelStep !== 'playing'}
                          onClick={() => handleDuelPlayerAnswer(oIdx)}
                          className={`p-md rounded-xl border text-left text-xs transition-all duration-200 flex items-center justify-between ${btnStyle} ${
                            duelPlayerAns === null && duelStep === 'playing' ? 'active:scale-98 cursor-pointer' : ''
                          }`}
                        >
                          <span>{opt}</span>
                          {duelStep === 'round_result' && (
                            <div className="flex gap-xs">
                              {isSelected && (
                                <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${isCorrectAns ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                                  Bạn
                                </span>
                              )}
                              {duelOpponentAns?.ans === oIdx && (
                                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded bg-secondary text-white">
                                  {duelOpponent.slice(0, 3)}
                                </span>
                              )}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Live feedback during round results */}
                  {duelStep === 'round_result' && (
                    <div className="text-center p-sm bg-primary/5 rounded-xl border border-primary/10 animate-pulse text-xs font-bold text-primary">
                      {(() => {
                        const pCorrect = duelPlayerAns?.ans === currentQ.ans;
                        const oCorrect = duelOpponentAns?.ans === currentQ.ans;
                        if (pCorrect && oCorrect) {
                          return duelPlayerAns!.timeSpent < duelOpponentAns!.timeSpent
                            ? "⚡ Bạn nhanh hơn! +5đ thưởng tốc độ!"
                            : `⚡ ${duelOpponent} nhanh hơn!`;
                        }
                        if (pCorrect) return "🎉 Bạn trả lời đúng!";
                        if (oCorrect) return `😢 ${duelOpponent} trả lời đúng!`;
                        return "❌ Cả hai đều trả lời sai!";
                      })()}
                    </div>
                  )}
                </div>
              )}

              {/* finished step */}
              {duelStep === 'finished' && (
                <div className="space-y-lg text-center flex flex-col items-center">
                  {duelScores.player > duelScores.opponent ? (
                    <div className="space-y-sm">
                      <span className="text-6xl animate-bounce block">🏆</span>
                      <h3 className="text-xl font-extrabold text-green-600">BẠN ĐÃ CHIẾN THẮNG!</h3>
                      <p className="text-xs font-medium text-on-surface-variant">Chiến thắng thuyết phục trước {duelOpponent}!</p>
                    </div>
                  ) : duelScores.player < duelScores.opponent ? (
                    <div className="space-y-sm">
                      <span className="text-6xl block">😢</span>
                      <h3 className="text-xl font-extrabold text-error">RẤT TIẾC, BẠN THẤT BẠI!</h3>
                      <p className="text-xs font-medium text-on-surface-variant">{duelOpponent} đã chơi quá xuất sắc!</p>
                    </div>
                  ) : (
                    <div className="space-y-sm">
                      <span className="text-6xl block">🤝</span>
                      <h3 className="text-xl font-extrabold text-primary">KẾT QUẢ HÒA!</h3>
                      <p className="text-xs font-medium text-on-surface-variant">Cả hai đấu trí ngang tài ngang sức!</p>
                    </div>
                  )}

                  <div className="w-full bg-surface-container p-md rounded-2xl border border-outline-variant/10 flex justify-around items-center">
                    <div className="text-center">
                      <p className="text-xs font-bold text-on-surface-variant">Bạn</p>
                      <p className="text-2xl font-black text-primary font-display">{duelScores.player}đ</p>
                    </div>
                    <div className="h-8 w-[1px] bg-outline-variant/40" />
                    <div className="text-center">
                      <p className="text-xs font-bold text-on-surface-variant">{duelOpponent}</p>
                      <p className="text-2xl font-black text-secondary font-display">{duelScores.opponent}đ</p>
                    </div>
                  </div>

                  <div className="w-full space-y-sm pt-md">
                    <p className="text-xs text-on-surface-variant font-bold">
                      Tổng điểm tích lũy: <span className="text-primary text-sm font-extrabold">+{Math.max(10, duelScores.player)} điểm</span>
                    </p>
                    <Btn onClick={() => finish(Math.max(10, duelScores.player), `Thách đấu 1-1 với ${duelOpponent}: ${duelScores.player > duelScores.opponent ? 'Thắng' : duelScores.player < duelScores.opponent ? 'Thua' : 'Hòa'} (${duelScores.player}-${duelScores.opponent})`)}>
                      🤝 Nhận Điểm Thưởng
                    </Btn>
                  </div>
                </div>
              )}
            </Wrap>
          );
        }

        // ── GAME 11: Vote Idea ────────────────────────────────────────────────────
        if (game.id === 11) return (
          <Wrap>
            <div className="space-y-md">
              {votingState === 'waiting' && (
                <div className="flex flex-col items-center justify-center py-lg space-y-md text-center">
                  <div className="text-5xl animate-bounce">💡</div>
                  <p className="font-extrabold text-on-surface text-sm">Đang đợi giảng viên công bố danh sách ý tưởng...</p>
                  <p className="text-xs text-on-surface-variant max-w-[280px]">
                    Khi giảng viên bắt đầu, danh sách ý tưởng sẽ tự động xuất hiện ở đây để bạn bình chọn.
                  </p>
                </div>
              )}

              {(votingState === 'voting' || votingState === 'ended') && (
                <div className="space-y-md">
                  {/* Timer Header */}
                  <div className="flex justify-between items-center bg-primary/5 p-md rounded-2xl border border-primary/10">
                    <span className="text-xs font-black text-primary uppercase">
                      {votingState === 'voting' ? '⏱️ ĐANG BÌNH CHỌN' : '🔒 ĐÃ KẾT THÚC'}
                    </span>
                    <span className="text-sm font-black text-error">
                      {votingTimer > 0 ? `${Math.floor(votingTimer / 60)}:${(votingTimer % 60).toString().padStart(2, '0')}` : '0:00'}
                    </span>
                  </div>

                  {!votedSubmitted ? (
                    <div className="space-y-sm">
                      <p className="text-xs font-bold text-on-surface-variant leading-tight mb-2">
                        Bình chọn 3 ý tưởng tốt nhất theo thứ tự ưu tiên 1, 2, 3:
                      </p>

                      <div className="space-y-sm">
                        <div>
                          <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-wider block mb-1">
                            🥇 Hạng 1 (Đáng giá 3 điểm):
                          </label>
                          <select
                            value={votedRank1 || ''}
                            onChange={e => setVotedRank1(e.target.value || null)}
                            className="w-full p-md text-xs rounded-xl border border-outline-variant/40 bg-surface-container-low focus:border-primary outline-none"
                          >
                            <option value="">-- Chọn ý tưởng tốt nhất --</option>
                            {votingIdeas.map(i => (
                              <option key={i.id} value={i.id} disabled={i.id === votedRank2 || i.id === votedRank3}>
                                {i.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-wider block mb-1">
                            🥈 Hạng 2 (Đáng giá 2 điểm):
                          </label>
                          <select
                            value={votedRank2 || ''}
                            onChange={e => setVotedRank2(e.target.value || null)}
                            className="w-full p-md text-xs rounded-xl border border-outline-variant/40 bg-surface-container-low focus:border-primary outline-none"
                          >
                            <option value="">-- Chọn ý tưởng tốt thứ hai --</option>
                            {votingIdeas.map(i => (
                              <option key={i.id} value={i.id} disabled={i.id === votedRank1 || i.id === votedRank3}>
                                {i.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-black text-on-surface-variant uppercase tracking-wider block mb-1">
                            🥉 Hạng 3 (Đáng giá 1 điểm):
                          </label>
                          <select
                            value={votedRank3 || ''}
                            onChange={e => setVotedRank3(e.target.value || null)}
                            className="w-full p-md text-xs rounded-xl border border-outline-variant/40 bg-surface-container-low focus:border-primary outline-none"
                          >
                            <option value="">-- Chọn ý tưởng tốt thứ ba --</option>
                            {votingIdeas.map(i => (
                              <option key={i.id} value={i.id} disabled={i.id === votedRank1 || i.id === votedRank2}>
                                {i.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="pt-sm">
                        <Btn
                          onClick={submitStudentVote}
                          disabled={!votedRank1 || !votedRank2 || !votedRank3 || votingState === 'ended'}
                        >
                          📤 Gửi bình chọn của bạn (+10 điểm)
                        </Btn>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-md">
                      <div className="p-md bg-emerald-50 text-emerald-900 rounded-xl text-center text-xs font-extrabold border border-emerald-200">
                        🎉 Cảm ơn bạn đã bình chọn! Bạn được cộng +10đ.
                      </div>

                      <div className="space-y-sm">
                        <p className="text-xs font-black text-on-surface-variant uppercase tracking-wider">
                          Bảng xếp hạng bình chọn hiện tại:
                        </p>
                        <div className="space-y-xs">
                          {votingIdeas
                            .map(i => ({ ...i, score: votingScores[i.id] || 0 }))
                            .sort((a, b) => b.score - a.score)
                            .map((item, index) => {
                              const maxScore = Math.max(...Object.values(votingScores), 1);
                              const percent = Math.min((item.score / maxScore) * 100, 100);
                              return (
                                <div key={item.id} className="space-y-1">
                                  <div className="flex justify-between text-xs font-bold">
                                    <span className="truncate max-w-[280px]">
                                      <span className="font-bold text-primary mr-1">#{index + 1}</span> {item.label}
                                    </span>
                                    <span className="text-primary">{item.score} điểm</span>
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
                    </div>
                  )}
                </div>
              )}
            </div>
          </Wrap>
        );

        // ── GAME 12: Quick Submit ─────────────────────────────────────────────────
        if (game.id === 12) return (
          <Wrap>
            <div className="space-y-md">
              <p className="font-semibold text-on-surface">📝 Nộp bài tập nhanh:</p>
              <input value={text} onChange={e => setText(e.target.value)} placeholder="Link bài nộp hoặc mã bài tập..."
                className="w-full p-md rounded-xl border border-outline-variant/40 focus:border-primary outline-none bg-surface-container-low" />
              <textarea rows={2} placeholder="Ghi chú thêm (không bắt buộc)..."
                className="w-full p-md rounded-xl border border-outline-variant/40 focus:border-primary outline-none text-sm resize-none bg-surface-container-low" />
              <Btn disabled={!text.trim()} onClick={() => finish(10)}>✅ Nộp bài (+10 điểm)</Btn>
            </div>
          </Wrap>
        );

        // ── GAME 13: 30-second Story ──────────────────────────────────────────────
        if (game.id === 13) return (
          <Wrap>
            <div className="space-y-md">
              <div className="text-center">
                <div className={`text-5xl font-extrabold transition-colors ${timer <= 10 ? 'text-error' : 'text-primary'}`}>{timer}s</div>
                <p className="text-xs text-on-surface-variant">Thời gian còn lại</p>
              </div>
              <p className="font-semibold text-on-surface text-center">🎤 Kể lại điều bạn học được hôm nay:</p>
              <textarea value={text} onChange={e => setText(e.target.value)} rows={4} placeholder="Chia sẻ trong 30 giây..."
                className="w-full p-md rounded-xl border border-outline-variant/40 focus:border-primary outline-none text-sm resize-none bg-surface-container-low" />
              <Btn disabled={text.trim().length < 5} onClick={() => { clearInterval(timerRef.current); finish(timer > 0 ? 15 : 5); }}>
                {timer > 0 ? '📤 Nộp trước giờ (+15 điểm)' : '⏱ Nộp muộn (+5 điểm)'}
              </Btn>
            </div>
          </Wrap>
        );

        // ── GAME 14: Special Bonus ───────────────────────────────────────────────
        if (game.id === 14) return (
          <Wrap>
            <div className="text-center space-y-lg py-md">
              <div className="text-6xl animate-bounce">⭐</div>
              <div>
                <h3 className="text-2xl font-extrabold text-on-surface">Tuần Đặc Biệt!</h3>
                <p className="text-on-surface-variant font-medium mt-xs">Giảng viên đã mở điểm thưởng đặc biệt cho tuần này</p>
              </div>
              <div className="bg-secondary-container/20 rounded-xl p-md">
                <p className="text-3xl font-extrabold text-primary">+50 Điểm</p>
                <p className="text-sm text-on-surface-variant">Điểm thưởng cao nhất trong kỳ học</p>
              </div>
              <Btn onClick={() => finish(50)}>🎉 Nhận ngay!</Btn>
            </div>
          </Wrap>
        );

        // ── GAME 15: Reflex Rush (Đại chiến phản xạ) ─────────────────────────────
        if (game.id === 15) {
          const pts = reflexTime === null ? 0 : reflexTime <= 400 ? 15 : reflexTime <= 800 ? 12 : 10;
          return (
            <Wrap>
              <div className="space-y-md">
                <div className="bg-surface-container p-md rounded-xl text-center border border-outline-variant/30">
                  <div className="text-5xl mb-xs">⚡</div>
                  <h3 className="text-lg font-extrabold text-on-surface">Đại chiến phản xạ nhanh</h3>
                  <p className="text-xs font-medium text-on-surface-variant">Ai có ngón tay nhanh nhất lớp?</p>
                </div>

                {reflexState === 'idle' && (
                  <div className="text-center py-lg space-y-xs">
                    <p className="font-bold text-on-surface text-sm animate-pulse">Đang chờ giảng viên phát lệnh bắt đầu...</p>
                    <p className="text-xs text-on-surface-variant">Hãy chuẩn bị sẵn sàng ngón tay trên màn hình!</p>
                  </div>
                )}

                {reflexState === 'countdown' && (
                  <div className="flex flex-col items-center justify-center py-lg space-y-sm animate-pop-in">
                    <div className="text-7xl font-black text-primary animate-ping">{reflexCountdown}</div>
                    <p className="text-sm font-bold text-on-surface-variant">CHUẨN BỊ...</p>
                  </div>
                )}

                {reflexState === 'go' && (
                  <button
                    onClick={() => {
                      const elapsed = Date.now() - reflexGoTime;
                      setReflexTime(elapsed);
                      setReflexState('clicked');
                      reflexChannelRef.current?.send({
                        type: 'broadcast',
                        event: 'reflex_click',
                        payload: { userId: currentUser?.id, name: currentUser?.full_name, time: elapsed }
                      });
                    }}
                    className="w-full h-48 rounded-xxl bg-success hover:bg-success/90 active:scale-95 transition-all text-on-success text-3xl font-black flex items-center justify-center shadow-lg border-4 border-success-container cursor-pointer animate-pop-in"
                  >
                    🚀 BẤM NGAY!!!
                  </button>
                )}

                {reflexState === 'clicked' && (
                  <div className="space-y-md animate-pop-in">
                    <div className="text-center py-md bg-secondary-container/20 rounded-xl border border-secondary/20 space-y-xs">
                      <p className="text-xs font-bold text-secondary uppercase">Thời gian phản xạ của bạn</p>
                      <p className="text-3xl font-black text-on-surface">{reflexTime} ms</p>
                      <p className="text-xs font-bold text-success">Bạn nhận được +{pts} điểm!</p>
                    </div>

                    <div className="space-y-sm">
                      <p className="text-xs font-extrabold uppercase tracking-wider text-on-surface-variant">Bảng xếp hạng phản xạ cả lớp:</p>
                      <div className="space-y-sm max-h-40 overflow-y-auto pr-xs">
                        {reflexLeaderboard.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center p-sm bg-surface-container border border-outline-variant/30 rounded-xl">
                            <span className="text-xs font-bold text-on-surface">
                              <span className="text-primary font-extrabold mr-1">#{idx + 1}</span> {item.name}
                            </span>
                            <span className="text-xs font-extrabold text-secondary">{item.time} ms</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <Btn onClick={() => finish(pts, `Phản xạ: ${reflexTime} ms`)}>🔥 Nhận điểm thưởng</Btn>
                  </div>
                )}
              </div>
            </Wrap>
          );
        }

        // ── GAME 16: Share Learning ──────────────────────────────────────────────
        return (
          <Wrap>
            <div className="space-y-md">
              <p className="font-semibold text-on-surface">💬 Chia sẻ điều bạn học được hôm nay:</p>
              <textarea value={text} onChange={e => setText(e.target.value)} rows={4} placeholder="Hôm nay tôi học được rằng..."
                className="w-full p-md rounded-xl border border-outline-variant/40 focus:border-primary outline-none text-sm resize-none bg-surface-container-low"
              />
              <div className="flex justify-between text-xs text-on-surface-variant">
                <span>Tối thiểu 20 ký tự</span><span className={text.length >= 20 ? 'text-tertiary font-bold' : ''}>{text.length}/20</span>
              </div>
              <Btn disabled={text.trim().length < 20} onClick={() => finish(5)}>📤 Chia sẻ (+5 điểm)</Btn>
            </div>
          </Wrap>
        );
      })()}
    </GameModalContext.Provider>
  );
}


