import React, { useState, useEffect, useRef, useCallback } from "react";

// ── 상수 및 스타일 설정 ──────────────────────────────────────────
const C = {
  bg: "#f8f8f8", surface: "#ffffff", card: "#ffffff",
  border: "#e4e4e4", border2: "#d0d0d0",
  accent: "#ff6b6b", accentMid: "#444444",
  muted: "#888", faint: "#f2f2f2", placeholder: "#bbbbbb",
  red: "#ff6b6b", green: "#2e7d52", blue: "#4dabf7", amber: "#b07d1a",
  shadow: "rgba(0,0,0,0.06)",
};

// ── 헬퍼 함수 ──────────────────────────────────────────────
const todayKey = () => new Date().toISOString().slice(0, 10);
const addDays = (d, n) => { 
  const dt = new Date(d + "T00:00:00"); 
  dt.setDate(dt.getDate() + n); 
  return dt.toISOString().slice(0, 10); 
};
const fmtDate = (d) => new Date(d + "T00:00:00").toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
const fmtSec = (s) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sc = s % 60;
  return h > 0 
    ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sc).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(sc).padStart(2, "0")}`;
};
const calcDays = (start, end) => {
  if (!start) return 0;
  const s = new Date(start + "T00:00:00");
  const e = new Date((end || todayKey()) + "T00:00:00");
  return Math.floor((e - s) / 86400000) + 1;
};
const REVIEW_DAYS = [1, 3, 7, 30]; // 1일, 3일, 7일, 1달 후

// ── 공통 UI 컴포넌트 ────────────────────────────────────────────
const Card = ({ children, style = {}, onClick }) => (
  <div onClick={onClick} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 14, padding: "16px 18px", boxShadow: `0 1px 6px ${C.shadow}`, ...(onClick ? { cursor: "pointer" } : {}), ...style }}>{children}</div>
);
const Btn = ({ children, onClick, variant = "fill", small, style = {}, disabled, color }) => {
  const bg = disabled ? C.border : variant === "fill" ? (color || C.accent) : "transparent";
  const cl = disabled ? C.muted : variant === "fill" ? "#fff" : (color || C.accent);
  return (
    <button onClick={onClick} disabled={disabled} style={{ padding: small ? "6px 14px" : "10px 20px", borderRadius: small ? 20 : 10, border: variant === "outline" ? `1.5px solid ${color || C.accent}` : "none", background: bg, color: cl, fontSize: small ? 12 : 13, fontWeight: 700, cursor: disabled ? "default" : "pointer", ...style }}>{children}</button>
  );
};
const Chip = ({ children, color = C.accent }) => (
  <span style={{ display: "inline-block", fontSize: 11, color, background: `${color}14`, padding: "2px 8px", borderRadius: 20, fontWeight: 700 }}>{children}</span>
);
const Input = ({ value, onChange, placeholder, type = "text", style = {}, onKeyDown }) => (
  <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} type={type} onKeyDown={onKeyDown}
    style={{ width: "100%", background: C.faint, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 13px", color: C.accent, fontSize: 14, outline: "none", boxSizing: "border-box", ...style }} />
);
const STitle = ({ children, action }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
    <div style={{ color: C.accent, fontSize: 16, fontWeight: 800, letterSpacing: -0.3 }}>{children}</div>
    {action}
  </div>
);

// ── 데이터 저장 훅 ──────────────────────────────────────────────
function usePersist(key, def) {
  const [val, setVal] = useState(() => {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : def; } catch { return def; }
  });
  const set = useCallback((v) => {
    setVal(prev => {
      const next = typeof v === "function" ? v(prev) : v;
      try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [key]);
  return [val, set];
}

// ── 1. 오늘 탭 ──────────────────────────────────────────────
function TodayTab({ routines, setRoutines, events, setEvents, todos, setTodos, routineLogs, setRoutineLogs, nickname }) {
  const tk = todayKey();
  const imageInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const [activeId, setActiveId] = useState(null);
  const [startTime, setStartTime] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [memos, setMemos] = useState({});
  const [studyImage, setStudyImage] = useState(null);
  const [studyAudio, setStudyAudio] = useState(null);
  const [viewReviewId, setViewReviewId] = useState(null);

  useEffect(() => {
    let interval;
    if (activeId && startTime) {
      interval = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    }
    return () => clearInterval(interval);
  }, [activeId, startTime]);

  const weekEvents = events.filter(e => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay());
    const start = d.toISOString().slice(0, 10);
    const end = addDays(start, 6);
    return e.date >= start && e.date <= end;
  }).sort((a, b) => a.date + a.time > b.date + b.time ? 1 : -1);

  const activeTodos = todos.filter(t => !t.done || t.date === tk);
  const studyRoutines = routines.filter(r => r.isStudy && !r.endedAt);
  const normalRoutines = routines.filter(r => !r.isStudy && !r.endedAt);
  
  const reviews = routineLogs.flatMap(log =>
    (log.entries || []).flatMap(entry =>
      (entry.reviews || []).filter(r => r.dueDate <= tk && !r.done)
        .map(r => ({ ...r, entryId: entry.id, logId: log.id, entryTitle: entry.title, memo: entry.memo, image: entry.image, audio: entry.audio, originalDate: entry.date }))
    )
  );

  const toggleTimer = (id) => {
    if (activeId === id) {
      setActiveId(null); setStartTime(null); setElapsed(0);
    } else {
      setActiveId(id); setStartTime(Date.now()); setElapsed(0);
    }
  };

  const endProject = (id) => {
    if (window.confirm("이 프로젝트를 완전히 완결하시겠습니까? 오늘 탭에서 사라집니다.")) {
      setRoutines(prev => prev.map(r => r.id === id ? { ...r, endedAt: tk } : r));
      setActiveId(null);
    }
  };

  const saveLog = (rId, isStudy) => {
    const entry = { 
      id: Date.now(), 
      title: isStudy ? (memos[rId]?.slice(0, 15) || "학습 기록") : "루틴 수행", 
      memo: memos[rId] || "", 
      image: isStudy ? studyImage : null, 
      audio: isStudy ? studyAudio : null,
      date: tk, 
      reviews: isStudy ? REVIEW_DAYS.map(d => ({ id: `${Date.now()}-${d}`, days: d, label: d === 30 ? "1달 후" : `${d}일 후`, dueDate: addDays(tk, d), done: false })) : [] 
    };
    setRoutineLogs(prev => {
      const ex = prev.find(l => l.routineId === rId && l.date === tk);
      if (ex) return prev.map(l => l.routineId === rId && l.date === tk ? { ...l, totalSec: (l.totalSec || 0) + elapsed, entries: [...(l.entries || []), entry] } : l);
      return [...prev, { id: Date.now() + 1, routineId: rId, date: tk, totalSec: elapsed, entries: [entry] }];
    });
    alert("기록이 저장되었습니다.");
    setElapsed(0); setStartTime(Date.now()); setStudyImage(null); setStudyAudio(null);
  };

  const completeReviewAction = (logId, entryId, reviewId) => {
    setRoutineLogs(prev => prev.map(log => log.id !== logId ? log : {
      ...log, entries: (log.entries || []).map(en => en.id !== entryId ? en : {
        ...en, reviews: en.reviews.map(r => r.id === reviewId ? { ...r, done: true, doneDate: tk } : r)
      })
    }));
  };

  return (
    <div style={{ paddingBottom: 60 }}>
      <STitle>{nickname ? `${nickname}님의 오늘` : "☀️ 오늘 대시보드"}</STitle>
      

      <div style={{ color: C.muted, fontSize: 11, fontWeight: 700, marginBottom: 8 }}>주간 일정</div>
      <Card style={{ marginBottom: 14 }}>
        {weekEvents.length === 0 ? <div style={{ color: C.placeholder, fontSize: 13, textAlign: "center" }}>예정된 일정이 없습니다.</div> : weekEvents.map(e => (
          <div key={e.id} style={{ display: "flex", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.faint}`, alignItems: "center" }}>
            <div style={{ color: C.accent, fontSize: 13, fontWeight: 600, flex: 1 }}>{e.title}</div>
            <div style={{ color: C.muted, fontSize: 11 }}>{fmtDate(e.date)} {e.time}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => {
                const n = window.prompt("일정 이름 수정:", e.title);
                if (n) setEvents(prev => prev.map(ev => ev.id === e.id ? { ...ev, title: n } : ev));
              }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12 }}>✏️</button>
              <button onClick={() => {
                if (window.confirm("삭제하시겠습니까?")) setEvents(prev => prev.filter(ev => ev.id !== e.id));
              }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12 }}>🗑️</button>
            </div>
          </div>
        ))}
      </Card>

      <div style={{ color: C.muted, fontSize: 11, fontWeight: 700, marginBottom: 8 }}>할일 목록</div>
      <Card style={{ marginBottom: 14 }}>
        {activeTodos.length === 0 ? <div style={{ color: C.placeholder, fontSize: 13, textAlign: "center" }}>할일이 없습니다.</div> : activeTodos.map(t => (
          <div key={t.id} style={{ borderBottom: `1px solid ${C.faint}`, paddingBottom: 10, marginBottom: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={() => setTodos(p => p.map(x => x.id === t.id ? { ...x, done: !x.done } : x))} style={{ width: 22, height: 22, borderRadius: 6, border: `1.5px solid ${t.done ? C.accent : C.border2}`, background: t.done ? C.accent : "transparent", color: "#fff", cursor: "pointer" }}>{t.done && "✓"}</button>
              <span style={{ fontSize: 14, fontWeight: 600, textDecoration: t.done ? "line-through" : "none", flex: 1 }}>{t.text}</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => {
                  const n = window.prompt("할일 내용 수정:", t.text);
                  if (n) setTodos(prev => prev.map(td => td.id === t.id ? { ...td, text: n } : td));
                }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12 }}>✏️</button>
                <button onClick={() => {
                  if (window.confirm("삭제하시겠습니까?")) setTodos(prev => prev.filter(td => td.id !== t.id));
                }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12 }}>🗑️</button>
              </div>
            </div>
            {!t.done && <Input value={t.memo || ""} onChange={val => setTodos(p => p.map(x => x.id === t.id ? { ...x, memo: val } : x))} placeholder="메모 입력..." style={{ marginTop: 5, background: "none", padding: "5px 0", border: "none", borderBottom: `1px solid ${C.border}` }} />}
          </div>
        ))}
      </Card>

      <div style={{ color: C.blue, fontSize: 11, fontWeight: 700, marginBottom: 8 }}>학습 프로젝트</div>
      {studyRoutines.map(r => (
        <Card key={r.id} style={{ marginBottom: 12, border: activeId === r.id ? `2px solid ${C.blue}` : `1px solid ${C.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>
              <span>{r.icon} {r.name}</span>
              <div style={{ display: "inline-flex", gap: 8, marginLeft: 10 }}>
                <button onClick={() => {
                  const n = window.prompt("프로젝트 이름 수정:", r.name);
                  if (n) setRoutines(prev => prev.map(rt => rt.id === r.id ? { ...rt, name: n } : rt));
                }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12 }}>✏️</button>
                <button onClick={() => {
                  if (window.confirm("삭제하시겠습니까?")) setRoutines(prev => prev.filter(rt => rt.id !== r.id));
                }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12 }}>🗑️</button>
              </div>
            </div>
            {activeId === r.id && <div style={{ color: C.red, fontWeight: 800 }}>{fmtSec(elapsed)}</div>}
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
            <Input value={memos[r.id] || ""} onChange={val => setMemos(p => ({ ...p, [r.id]: val }))} placeholder="기록 및 메모..." style={{ flex: 1, fontSize: 13 }} />
            <button onClick={() => imageInputRef.current.click()} style={{ background: C.faint, border: `1px solid ${C.border}`, borderRadius: 10, padding: "0 8px", fontSize: 16, cursor: "pointer" }}>{studyImage ? "✅" : "📸"}</button>
            <button onClick={() => audioInputRef.current.click()} style={{ background: C.faint, border: `1px solid ${C.border}`, borderRadius: 10, padding: "0 8px", fontSize: 16, cursor: "pointer" }}>{studyAudio ? "✅" : "🎙️"}</button>
            <input type="file" ref={imageInputRef} hidden accept="image/*" onChange={e => {
              const file = e.target.files[0]; if (!file) return;
              const reader = new FileReader(); reader.onload = ev => setStudyImage(ev.target.result); reader.readAsDataURL(file);
            }} />
            <input type="file" ref={audioInputRef} hidden accept="audio/*" onChange={e => {
              const file = e.target.files[0]; if (!file) return;
              const reader = new FileReader(); reader.onload = ev => setStudyAudio(ev.target.result); reader.readAsDataURL(file);
            }} />
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <Btn small style={{ flex: 1 }} color={C.blue} variant={activeId === r.id ? "outline" : "fill"} onClick={() => toggleTimer(r.id)}>{activeId === r.id ? "정지" : "학습 시작"}</Btn>
            {activeId === r.id && <Btn small style={{ flex: 1 }} color={C.blue} onClick={() => saveLog(r.id, true)}>기록저장</Btn>}
            <Btn small variant="outline" color={C.red} onClick={() => endProject(r.id)}>완결</Btn>
          </div>
        </Card>
      ))}

      <div style={{ color: C.accent, fontSize: 11, fontWeight: 700, marginBottom: 8, marginTop: 10 }}>생활 루틴</div>
      {normalRoutines.map(r => (
        <Card key={r.id} style={{ marginBottom: 12, border: activeId === r.id ? `2px solid ${C.accent}` : `1px solid ${C.border}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>
              <span>{r.icon} {r.name}</span>
              <div style={{ display: "inline-flex", gap: 8, marginLeft: 10 }}>
                <button onClick={() => {
                  const n = window.prompt("루틴 이름 수정:", r.name);
                  if (n) setRoutines(prev => prev.map(rt => rt.id === r.id ? { ...rt, name: n } : rt));
                }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12 }}>✏️</button>
                <button onClick={() => {
                  if (window.confirm("삭제하시겠습니까?")) setRoutines(prev => prev.filter(rt => rt.id !== r.id));
                }} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12 }}>🗑️</button>
              </div>
            </div>
            {activeId === r.id && <div style={{ color: C.red, fontWeight: 800 }}>{fmtSec(elapsed)}</div>}
          </div>
          <Input value={memos[r.id] || ""} onChange={val => setMemos(p => ({ ...p, [r.id]: val }))} placeholder="메모 입력..." style={{ marginBottom: 10, fontSize: 13 }} />
          <div style={{ display: "flex", gap: 6 }}>
            <Btn small style={{ flex: 1 }} variant={activeId === r.id ? "outline" : "fill"} onClick={() => toggleTimer(r.id)}>{activeId === r.id ? "정지" : "루틴 시작"}</Btn>
            {activeId === r.id && <Btn small style={{ flex: 1 }} onClick={() => saveLog(r.id, false)}>기록저장</Btn>}
            <Btn small variant="outline" color={C.red} onClick={() => endProject(r.id)}>완결</Btn>
          </div>
        </Card>
      ))}

      {reviews.length > 0 && (
        <Card style={{ background: `${C.amber}10`, border: `1px solid ${C.amber}`, marginTop: 14 }}>
          <div style={{ color: C.amber, fontWeight: 800, fontSize: 12, marginBottom: 10 }}>🔔 오늘 복습할 항목</div>
          {reviews.map(rv => (
            <div key={rv.id} style={{ borderBottom: `1px solid ${C.border}`, paddingBottom: 10, marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>{rv.entryTitle}</div>
                  <div onClick={() => setViewReviewId(viewReviewId === rv.id ? null : rv.id)} style={{ fontSize: 11, color: C.blue, cursor: "pointer", textDecoration: "underline", marginTop: 2 }}>
                    원본 기록일: {rv.originalDate} ({rv.label})
                  </div>
                </div>
                <Btn small onClick={() => completeReviewAction(rv.logId, rv.entryId, rv.id)}>완료</Btn>
              </div>
              {viewReviewId === rv.id && (
                <div style={{ marginTop: 10, padding: 10, background: C.surface, borderRadius: 8, border: `1px solid ${C.border}` }}>
                  {rv.image && <img src={rv.image} alt="study" style={{ width: "100%", borderRadius: 6, marginBottom: 8 }} />}
                  {rv.audio && <audio controls src={rv.audio} style={{ width: "100%", marginBottom: 8 }} />}
                  <div style={{ fontSize: 13, color: C.accentMid, whiteSpace: "pre-wrap" }}>{rv.memo || "메모가 없습니다."}</div>
                </div>
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ── 2. 계획 탭 ──────────────────────────────────────────────
function PlanTab({ events, setEvents, todos, setTodos, routines, setRoutines }) {
  const [month, setMonth] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [sel, setSel] = useState(todayKey());
  const [title, setTitle] = useState("");

  const tk = todayKey(); 
  const y = month.getFullYear(), m = month.getMonth();
  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const dKey = (d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  return (
    <div>
      <STitle>📅 계획 및 추가</STitle>
      <Card style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <button onClick={() => setMonth(new Date(y, m - 1, 1))} style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 11px", color: C.accentMid, cursor: "pointer" }}>‹</button>
          <span style={{ color: C.accent, fontSize: 15, fontWeight: 800 }}>{y}년 {m + 1}월</span>
          <button onClick={() => setMonth(new Date(y, m + 1, 1))} style={{ background: "transparent", border: `1px solid ${C.border}`, borderRadius: 8, padding: "5px 11px", color: C.accentMid, cursor: "pointer" }}>›</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: 6 }}>
          {["일","월","화","수","목","금","토"].map((d, i) => (
            <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 600, color: i === 0 ? C.red : i === 6 ? C.blue : C.muted, padding: "3px 0" }}>{d}</div>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
          {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const d = i + 1, key = dKey(d); 
            const isSel = key === sel, isToday = key === tk;
            return (
              <button key={d} onClick={() => setSel(key)} style={{ aspectRatio: "1", borderRadius: 8, border: isSel ? `2px solid ${C.accent}` : isToday ? `2px solid ${C.border2}` : "2px solid transparent", background: isSel ? C.accent : "transparent", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 13, fontWeight: isToday ? 700 : 400, color: isSel ? "#fff" : C.accent }}>{d}</span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card style={{ marginBottom: 14 }}>
        <div style={{ textAlign: "center", fontWeight: 800, marginBottom: 10 }}>{fmtDate(sel)}</div>
        <Input value={title} onChange={setTitle} placeholder="무엇을 계획하시나요?" />
        <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
          <Btn small style={{ flex: 1 }} onClick={() => { if(!title) return; setEvents(p => [...p, { id: Date.now(), title, date: sel, time: "09:00" }]); setTitle(""); }}>일정추가</Btn>
          <Btn small style={{ flex: 1 }} onClick={() => { if(!title) return; setTodos(p => [...p, { id: Date.now(), text: title, date: sel, done: false }]); setTitle(""); }}>할일추가</Btn>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 10, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
          <Btn small style={{ flex: 1 }} color={C.blue} onClick={() => { if(!title) return; setRoutines(p => [...p, { id: Date.now(), name: title, icon: "📚", createdAt: sel, isStudy: true }]); setTitle(""); }}>📚 학습 추가</Btn>
          <Btn small style={{ flex: 1 }} variant="outline" onClick={() => { if(!title) return; setRoutines(p => [...p, { id: Date.now(), name: title, icon: "📌", createdAt: sel, isStudy: false }]); setTitle(""); }}>📌 루틴 추가</Btn>
        </div>
      </Card>
    </div>
  );
}

// ── 3. 기록 탭 ──────────────────────────────────────────────
function RecordTab({ routines, routineLogs }) {
  const [view, setView] = useState({ type: "main", id: null });
  const tk = todayKey();

  const last7Days = Array.from({ length: 7 }, (_, i) => addDays(tk, -i));
  const weekLogs = routineLogs.filter(l => last7Days.includes(l.date));
  
  const studyWeek = weekLogs.filter(l => routines.find(r => r.id === l.routineId)?.isStudy);
  const routineWeek = weekLogs.filter(l => routines.find(r => r.id === l.routineId) && !routines.find(r => r.id === l.routineId).isStudy);

  if (view.type === "study") {
    const studyProjects = routines.filter(r => r.isStudy);
    return (
      <div>
        <button onClick={() => setView({ type: "main", id: null })} style={{ background: "transparent", border: "none", color: C.blue, cursor: "pointer", fontWeight: 700, marginBottom: 16, padding: 0 }}>← 뒤로가기</button>
        <STitle>📚 학습 프로젝트 기록</STitle>
        {studyProjects.map(p => {
          const logs = routineLogs.filter(l => l.routineId === p.id);
          const duration = calcDays(p.createdAt, p.endedAt);
          return (
            <Card key={p.id} style={{ marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <div style={{ fontSize: 15, fontWeight: 800 }}>{p.name} {p.endedAt ? <Chip color={C.green}>완료</Chip> : <Chip color={C.blue}>진행중</Chip>}</div>
                <div style={{ fontSize: 12, color: C.muted }}>{p.createdAt} ~ {p.endedAt || "현재"}</div>
              </div>
              <div style={{ display: "flex", gap: 16 }}>
                <div><span style={{ fontSize: 11, color: C.muted }}>소요기간</span><div style={{ fontWeight: 700 }}>{duration}일</div></div>
                <div><span style={{ fontSize: 11, color: C.muted }}>수행횟수</span><div style={{ fontWeight: 700 }}>{logs.length}회</div></div>
                <div><span style={{ fontSize: 11, color: C.muted }}>누적시간</span><div style={{ fontWeight: 700 }}>{fmtSec(logs.reduce((a, b) => a + (b.totalSec || 0), 0))}</div></div>
              </div>
            </Card>
          );
        })}
      </div>
    );
  }

  if (view.type === "routine_detail") {
    const routine = routines.find(r => r.id === view.id);
    const logs = routineLogs.filter(l => l.routineId === view.id).sort((a, b) => b.date > a.date ? 1 : -1);
    return (
      <div>
        <button onClick={() => setView({ type: "main", id: null })} style={{ background: "transparent", border: "none", color: C.blue, cursor: "pointer", fontWeight: 700, marginBottom: 16, padding: 0 }}>← 뒤로가기</button>
        <STitle>{routine?.icon} {routine?.name} 상세 기록</STitle>
        <Card style={{ marginBottom: 16, background: C.faint }}>
          <div style={{ fontSize: 13 }}>누적 수행 시간: <strong>{fmtSec(logs.reduce((a, b) => a + (b.totalSec || 0), 0))}</strong></div>
          <div style={{ fontSize: 13 }}>수행 기간: <strong>{calcDays(routine?.createdAt, routine?.endedAt)}일째</strong></div>
        </Card>
        {logs.map(l => (
          <div key={l.id} style={{ marginBottom: 10, padding: "10px 0", borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.accentMid }}>{l.date}</div>
            {(l.entries || []).map(e => (
              <div key={e.id} style={{ fontSize: 13, marginTop: 4, color: C.accent }}>• {e.memo || "메모 없음"}</div>
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <STitle>📊 주간 요약</STitle>
      <div style={{ display: "flex", gap: 10 }}>
        <Card style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>주간 학습</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{studyWeek.length}회</div>
          <div style={{ fontSize: 12, color: C.blue }}>{fmtSec(studyWeek.reduce((a, b) => a + (b.totalSec || 0), 0))}</div>
        </Card>
        <Card style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>주간 루틴</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{routineWeek.length}회</div>
          <div style={{ fontSize: 12, color: C.green }}>{fmtSec(routineWeek.reduce((a, b) => a + (b.totalSec || 0), 0))}</div>
        </Card>
      </div>

      <Btn variant="outline" onClick={() => setView({ type: "study", id: null })} style={{ width: "100%", padding: 16 }}>📚 학습 프로젝트별 통계 보기 →</Btn>

      <STitle>🏃 루틴별 기록</STitle>
      {routines.filter(r => !r.isStudy).map(r => (
        <Card key={r.id} onClick={() => setView({ type: "routine_detail", id: r.id })} style={{ marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700 }}>{r.icon} {r.name}</div>
            <div style={{ fontSize: 11, color: C.muted }}>총 {routineLogs.filter(l => l.routineId === r.id).length}회 수행</div>
          </div>
          <div style={{ fontSize: 18, color: C.placeholder }}>›</div>
        </Card>
      ))}
    </div>
  );
}

// ── 4. 설정 탭 ──────────────────────────────────────────────
function SettingsTab({ routines, setRoutines, todos, setTodos, events, setEvents, routineLogs, setRoutineLogs, nickname, setNickname }) {
  const [nicknameInput, setNicknameInput] = useState(nickname || "");
  const importRef = useRef(null);

  const saveNickname = () => {
    if (!nicknameInput.trim()) return alert("별명을 입력해주세요.");
    setNickname(nicknameInput.trim());
    alert("별명이 저장되었습니다.");
  };

  const exportData = () => {
    const data = { routines, todos, events, routineLogs, nickname };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mylife_backup_${todayKey()}.json`;
    a.click();
  };

  const importData = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target.result);
        if (json.routines) setRoutines(json.routines);
        if (json.todos) setTodos(json.todos);
        if (json.events) setEvents(json.events);
        if (json.routineLogs) setRoutineLogs(json.routineLogs);
        if (json.nickname) setNickname(json.nickname);
        alert("데이터를 불러왔습니다.");
      } catch { alert("올바른 백업 파일이 아닙니다."); }
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card>
        <STitle>👤 사용자 설정</STitle>
        <div style={{ display: "flex", gap: 8 }}>
          <Input value={nicknameInput} onChange={setNicknameInput} placeholder="사용자 별명 입력" />
          <Btn onClick={saveNickname}>저장</Btn>
        </div>
      </Card>
      <Card>
        <STitle>💾 데이터 백업 및 복원</STitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Btn variant="outline" onClick={exportData}>내보내기 (JSON)</Btn>
          <Btn variant="outline" onClick={() => importRef.current.click()}>가져오기 (JSON)</Btn>
          <input type="file" ref={importRef} hidden accept=".json" onChange={importData} />
        </div>
      </Card>
      <Card style={{ borderColor: C.red + "44" }}>
        <STitle color={C.red}>⚠️ 데이터 초기화</STitle>
        <Btn variant="outline" color={C.red} onClick={() => { if(window.confirm("전체 초기화하시겠습니까? 모든 데이터가 삭제됩니다.")) { localStorage.clear(); window.location.reload(); } }}>전체 데이터 초기화</Btn>
      </Card>
    </div>
  );
}

// ── 메인 앱 컴포넌트 ───────────────────────────────────────────
export default function App() {
  const [routines, setRoutines] = usePersist("ml3_routines", []);
  const [todos, setTodos] = usePersist("ml3_todos", []);
  const [events, setEvents] = usePersist("ml3_events", []);
  const [routineLogs, setRoutineLogs] = usePersist("ml3_routineLogs", []);
  const [nickname, setNickname] = usePersist("ml3_nickname", "");
  const [activeTab, setActiveTab] = useState("today");

  const TABS = [
    { id: "today", icon: "☀️", label: "오늘" },
    { id: "plan", icon: "📅", label: "계획" },
    { id: "record", icon: "📊", label: "기록" },
    { id: "settings", icon: "⚙️", label: "설정" }
  ];

  const renderContent = () => {
    switch (activeTab) {
      case "today": return <TodayTab routines={routines} setRoutines={setRoutines} events={events} todos={todos} setTodos={setTodos} routineLogs={routineLogs} setRoutineLogs={setRoutineLogs} nickname={nickname} />;
      case "plan": return <PlanTab events={events} setEvents={setEvents} todos={todos} setTodos={setTodos} routines={routines} setRoutines={setRoutines} />;
      case "record": return <RecordTab routines={routines} routineLogs={routineLogs} />;
      case "settings": return <SettingsTab routines={routines} setRoutines={setRoutines} todos={todos} setTodos={setTodos} events={events} setEvents={setEvents} routineLogs={routineLogs} setRoutineLogs={setRoutineLogs} nickname={nickname} setNickname={setNickname} />;
      default: return null;
    }
  };

  return (
    <div style={{ background: C.bg, minHeight: "100vh", fontFamily: "sans-serif", color: C.accent, maxWidth: 430, margin: "0 auto", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, padding: "20px 20px 88px", overflowY: "auto" }}>
        {renderContent()}
      </div>

      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: C.surface, borderTop: `1px solid ${C.border}`, zIndex: 100, paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div style={{ display: "flex", padding: "8px 10px 12px", justifyContent: "space-around" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, background: "transparent", border: "none", cursor: "pointer", opacity: activeTab === t.id ? 1 : 0.4 }}>
              <div style={{ fontSize: 20 }}>{t.icon}</div>
              <div style={{ fontSize: 10, fontWeight: 700 }}>{t.label}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
