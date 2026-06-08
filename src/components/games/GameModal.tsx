import { useState, useEffect, useRef, createContext, useContext } from 'react';
import type { Game } from '@/utils/supabase/client';
import { getGameContent } from '@/utils/supabase/client';

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

export default function GameModal({ game, weekNumber, streak, onComplete, onClose }: Props) {
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

  // Game 10: find opponent
  useEffect(() => {
    if (game.id === 10) {
      setSearching(true);
      const names = ['Trần Thị Lan', 'Nguyễn Hoàng Nam', 'Lê Hải Yến', 'Phạm Gia Bảo'];
      setTimeout(() => { setOpponent(names[Math.floor(Math.random() * names.length)]); setSearching(false); }, 1800);
    }
  }, [game.id]);

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
              <button onClick={() => { const r = Math.floor(Math.random() * 8) + 1; finish(r <= 3 ? 15 : 10); }}
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
        if (game.id === 10) return (
          <Wrap>
            {searching ? (
              <div className="text-center space-y-md py-lg">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
                <p className="font-semibold text-on-surface">Đang tìm đối thủ...</p>
              </div>
            ) : (
              <div className="space-y-md">
                <div className="flex items-center justify-between bg-primary-container/20 rounded-xl p-sm">
                  <span className="text-sm font-bold text-primary">Bạn</span>
                  <span className="font-extrabold text-on-surface">VS</span>
                  <span className="text-sm font-bold text-secondary">{opponent}</span>
                </div>
                <div className="bg-surface-container rounded-xl p-md">
                  <p className="text-xs font-bold text-on-surface-variant mb-xs">Câu hỏi thách đấu:</p>
                  <p className="font-semibold text-on-surface text-sm">{gc.duelQuestion}</p>
                </div>
                <textarea value={text} onChange={e => setText(e.target.value)} rows={3} placeholder="Trả lời của bạn..."
                  className="w-full p-md rounded-xl border border-outline-variant/40 focus:border-primary outline-none text-sm resize-none bg-surface-container-low" />
                <Btn disabled={text.trim().length < 3} onClick={() => finish(text.length > 30 ? 25 : 15)}>⚔️ Gửi câu trả lời!</Btn>
              </div>
            )}
          </Wrap>
        );

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


