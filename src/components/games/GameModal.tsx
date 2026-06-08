import { useState, useEffect, useRef, createContext, useContext } from 'react';
import type { Game } from '@/utils/supabase/client';
import { getGameContent, createClient, isMockEnabled } from '@/utils/supabase/client';

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
      <div className="bg-surface-container-lowest rounded-xxl w-full max-w-[450px] shadow-2xl border border-outline-variant/20 overflow-hidden animate-pop-in relative">
        {/* Header */}
        <div className="bg-primary p-md flex items-center justify-between">
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
        <div className="p-lg">{children}</div>
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

  // Matchmaking states & references
  const [currentUser, setCurrentUser] = useState<{ id: string; full_name: string } | null>(null);
  const [searchTimer, setSearchTimer] = useState<number>(0);
  const [sessionCode, setSessionCode] = useState<string>('');
  const matchmakingChannelRef = useRef<any>(null);
  const gameChannelRef = useRef<any>(null);

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


        // ── GAME 1: Speed Check-in ─────────────────────────────────────────────────
        if (game.id === 1) return (
          <Wrap>
            <div className="text-center space-y-lg">
              <div className="text-5xl animate-bounce">⚡</div>
              <h3 className="text-xl font-extrabold text-on-surface">Điểm danh nhanh nhất!</h3>
              <p className="text-sm text-on-surface-variant">Nhấn nút ngay khi buổi học bắt đầu — nhanh nhất được thêm điểm!</p>
              <button onClick={() => {
                const rank = Math.floor(Math.random() * 5) + 1;
                const earned = rank === 1 ? 15 : rank <= 3 ? 12 : 10;
                finish(earned);
              }} className="w-full py-xl text-2xl font-extrabold bg-primary text-on-primary rounded-xxl active:scale-95 hover:bg-primary/90 transition-all cta-pulse shadow-xl">
                ⚡ ĐIỂM DANH NGAY!
              </button>
            </div>
          </Wrap>
        );

        // ── GAME 2: Secret Question ────────────────────────────────────────────────
        if (game.id === 2) return (
          <Wrap>
            <div className="space-y-md">
              <div className="bg-secondary-container/20 rounded-xl p-md border border-secondary/20">
                <p className="text-xs font-bold text-secondary uppercase mb-xs">Câu hỏi từ giảng viên</p>
                <p className="font-semibold text-on-surface">{gc.secretQuestion}</p>
              </div>
              <textarea value={text} onChange={e => setText(e.target.value)} rows={3} placeholder="Nhập câu trả lời của bạn..."
                className="w-full p-md rounded-xl border border-outline-variant/40 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none text-sm resize-none bg-surface-container-low" />
              <Btn onClick={() => finish(10)} disabled={text.trim().length < 3}>Gửi câu trả lời (+10 điểm)</Btn>
            </div>
          </Wrap>
        );

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
              <div className="bg-primary-container/30 rounded-xl p-md border border-primary/20">
                <p className="text-xs font-bold text-primary uppercase mb-xs">Thử thách nhóm</p>
                <p className="font-semibold text-on-surface text-sm">{gc.teamChallenge}</p>
              </div>
              <div className="bg-surface-container rounded-xl p-sm">
                <p className="text-xs font-bold text-on-surface-variant mb-xs">Thành viên cùng nhóm:</p>
                {['Trần Thị Lan', 'Nguyễn Hoàng Nam', 'Lê Hải Yến'].map(n => (
                  <div key={n} className="flex items-center gap-sm py-xs"><span className="w-2 h-2 bg-tertiary rounded-full" /><span className="text-sm text-on-surface">{n}</span></div>
                ))}
              </div>
              <Btn onClick={() => finish(20)}>✅ Tham gia thử thách (+20 điểm)</Btn>
            </div>
          </Wrap>
        );

        // ── GAME 5: Keyword Guess ──────────────────────────────────────────────────
        if (game.id === 5) return (
          <Wrap>
            <div className="space-y-md">
              <div className="bg-tertiary-container/20 rounded-xl p-md border border-tertiary/20">
                <p className="text-xs font-bold text-tertiary uppercase mb-xs">💡 Gợi ý</p>
                <p className="text-sm font-medium text-on-surface">{gc.keywordHint}</p>
                {hintShown && <p className="text-xs text-on-surface-variant mt-xs">Từ bắt đầu bằng: <b>{gc.keyword?.[0].toUpperCase()}</b></p>}
              </div>
              <input value={text} onChange={e => setText(e.target.value)} placeholder="Nhập từ khóa bạn đoán..."
                className="w-full p-md rounded-xl border border-outline-variant/40 focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none bg-surface-container-low" />
              <div className="flex gap-sm">
                <button onClick={() => setHintShown(true)} className="flex-1 py-sm rounded-xl border border-outline-variant/40 text-sm font-semibold text-on-surface-variant hover:bg-surface-container transition-all">Gợi ý thêm</button>
                <button onClick={() => { if (text.trim().toLowerCase() === gc.keyword?.toLowerCase()) finish(15); else finish(5); }}
                  disabled={!text.trim()} className="flex-1 py-sm rounded-xl bg-primary text-on-primary font-bold active:scale-95 disabled:opacity-40 transition-all">Đoán!</button>
              </div>
            </div>
          </Wrap>
        );

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

        // ── GAME 9: Mini Quiz ─────────────────────────────────────────────────────
        if (game.id === 9) {
          const qs = gc.quizQuestions || [];
          const q = qs[quizIdx];
          if (!q) return <Wrap><div className="text-center"><p className="font-bold text-on-surface">Chưa có câu hỏi.</p><Btn onClick={onClose}>Đóng</Btn></div></Wrap>;
          return (
            <Wrap>
              <div className="space-y-md">
                <div className="flex justify-between items-center">
                  <p className="text-xs font-bold text-on-surface-variant">Câu {quizIdx + 1}/{qs.length}</p>
                  <div className="flex gap-1">{qs.map((_, i) => <div key={i} className={`w-6 h-1.5 rounded-full ${i < quizIdx ? 'bg-tertiary' : i === quizIdx ? 'bg-primary' : 'bg-surface-container-high'}`} />)}</div>
                </div>
                <p className="font-semibold text-on-surface">{q.q}</p>
                <div className="space-y-sm">
                  {q.opts.map((opt, i) => (
                    <button key={i} onClick={() => setSelected(i)}
                      className={`w-full p-sm rounded-xl text-left text-sm font-medium border transition-all ${selected === i ? 'bg-primary text-on-primary border-primary' : 'bg-surface-container border-outline-variant/30 hover:border-primary/40'}`}>
                      {opt}
                    </button>
                  ))}
                </div>
                <Btn disabled={selected === null} onClick={() => {
                  const correct = selected === q.ans;
                  const ns = quizScore + (correct ? 5 : 0);
                  setScore(ns); setSelected(null);
                  if (quizIdx + 1 >= qs.length) finish(ns, `Đạt ${ns}/${qs.length * 5} điểm`);
                  else setQuizIdx(quizIdx + 1);
                }}>
                  {quizIdx + 1 < qs.length ? 'Câu tiếp theo →' : 'Hoàn thành Quiz'}
                </Btn>
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
              <p className="font-semibold text-on-surface">💡 Chia sẻ ý tưởng sáng tạo của bạn:</p>
              <textarea value={text} onChange={e => setText(e.target.value)} rows={4} placeholder="Mô tả ý tưởng của bạn để giải quyết vấn đề trong bài học..."
                className="w-full p-md rounded-xl border border-outline-variant/40 focus:border-primary outline-none text-sm resize-none bg-surface-container-low" />
              <Btn disabled={text.trim().length < 10} onClick={() => finish(10)}>📤 Gửi ý tưởng (+10 điểm)</Btn>
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

        // ── GAME 15: Review Questions ────────────────────────────────────────────
        if (game.id === 15) {
          const rqs = gc.reviewQuestions || [];
          return (
            <Wrap>
              <div className="space-y-md">
                <p className="font-semibold text-on-surface">📚 Ôn tập bài cũ:</p>
                {rqs.map((q, i) => (
                  <div key={i} className="space-y-xs">
                    <p className="text-sm font-semibold text-on-surface">{i + 1}. {q}</p>
                    <textarea rows={2} placeholder="Câu trả lời của bạn..."
                      value={reviewAns[i] || ''}
                      onChange={e => setReviewAns({ ...reviewAns, [i]: e.target.value })}
                      className="w-full p-sm rounded-xl border border-outline-variant/40 focus:border-primary outline-none text-sm resize-none bg-surface-container-low" />
                  </div>
                ))}
                <Btn onClick={() => finish(10, Object.entries(reviewAns).map(([idx, ans]) => `Câu ${Number(idx)+1}: ${ans}`).join(' | '))} disabled={rqs.some((_, i) => !reviewAns[i]?.trim())}>✅ Nộp bài ôn tập (+10 điểm)</Btn>
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


