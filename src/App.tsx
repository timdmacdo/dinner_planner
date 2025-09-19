
import React, { useEffect, useMemo, useRef, useState } from "react";

// === Types ===
type Step = {
  id: string;
  parent: string; // recipe name
  title: string;
  start_min: number; // minutes from t0
  duration_min: number; // minutes
  description: string; // plain text
};

type DataFile = Step[]; // v1: an array of Step objects

// === Demo data (for quick preview) ===
const DEMO: DataFile = [
  {
    id: "preheat_oven",
    parent: "Side – Roasted Veg",
    title: "Preheat oven to 425F",
    start_min: 0,
    duration_min: 65,
    description: "Move rack to middle. Put sheet pan in oven to preheat.",
  },
  {
    id: "cut_veg",
    parent: "Side – Roasted Veg",
    title: "Cut vegetables",
    start_min: 3,
    duration_min: 12,
    description: "Cut into 1-inch chunks. Toss with oil/salt.",
  },
  {
    id: "roast_veg",
    parent: "Side – Roasted Veg",
    title: "Roast vegetables",
    start_min: 16,
    duration_min: 30,
    description: "Spread on hot pan, stir at 15 min.",
  },
  {
    id: "sear_steaks",
    parent: "Main – Ribeye",
    title: "Sear steaks",
    start_min: 25,
    duration_min: 8,
    description: "Pat dry. Heat pan until just smoking. 2–3 min/side. Rest 5 min.",
  },
  {
    id: "make_pan_sauce",
    parent: "Main – Ribeye",
    title: "Make pan sauce",
    start_min: 33,
    duration_min: 10,
    description: "Deglaze with stock/wine, reduce, finish with butter.",
  },
  {
    id: "greens_salad",
    parent: "Salad",
    title: "Dress greens",
    start_min: 40,
    duration_min: 66,
    description: "Toss just before serving.",
  },
];

// === Utility: color palette by lane ===
const PALETTE = [
  "#4C78A8",
  "#F58518",
  "#E45756",
  "#72B7B2",
  "#54A24B",
  "#EECA3B",
  "#B279A2",
  "#FF9DA6",
  "#9D755D",
  "#BAB0AC",
];

function useNowPlaying(enabled: boolean) {
  const [tMs, setTMs] = useState(0); // elapsed in ms
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const step = (ts: number) => {
      if (startRef.current == null) startRef.current = ts;
      setTMs(ts - startRef.current);
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      startRef.current = null;
    };
  }, [enabled]);

  return tMs;
}

function fmtMMSS(totalSeconds: number) {
  const sec = Math.max(0, Math.floor(totalSeconds));
  const mm = Math.floor(sec / 60);
  const ss = sec % 60;
  return `${mm}:${ss.toString().padStart(2, "0")}`;
}

// Helper for displaying duration nicely (e.g., 65 -> "1h 5m")
function fmtDuration(mins: number) {
  const m = Math.max(0, Math.round(mins));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem === 0 ? `${h}h` : `${h}h ${rem}m`;
}

// Small controlled form to add a person
function AddPersonForm({ onAdd }: { onAdd: (name: string) => void }) {
  const [val, setVal] = useState("");
  return (
    <div className="flex items-center gap-2">
      <input className="flex-1 px-2 py-1 rounded-lg border text-sm" value={val} onChange={(e) => setVal(e.target.value)} placeholder="Add person" />
      <button className="px-2 py-1 rounded-lg border text-sm" onClick={() => { if (val.trim()) { onAdd(val.trim()); setVal(""); } }}>Add</button>
    </div>
  );
}

// === Bank of Timers ===
interface UxTimer {
  id: string;
  name: string;
  minStr: string;
  secStr: string;
  remaining: number; // seconds
  running: boolean;
  cleared?: boolean;
  mode?: 'down' | 'up';
}

// === Main Component ===
export default function MealGantt() {
  const [steps, setSteps] = useState<DataFile>(DEMO);
  const [error, setError] = useState<string | null>(null);

  // time state (in minutes)
  const [playing, setPlaying] = useState(false);
  const [baseMinutes, setBaseMinutes] = useState(0); // accumulated minutes when paused
  const [jumpInput, setJumpInput] = useState<string>("0");

  const elapsedMs = useNowPlaying(playing);
  const currentMin = useMemo(() => baseMinutes + (playing ? elapsedMs / 60000 : 0), [baseMinutes, playing, elapsedMs]);
  const elapsedSeconds = useMemo(() => Math.floor(currentMin * 60), [currentMin]);

  // ==== Timer bank state ====
  const [timers, setTimers] = useState<UxTimer[]>([
  { id: "t1", name: "", minStr: "0", secStr: "00", remaining: 0, running: false, cleared: true, mode: 'down' },
  { id: "t2", name: "", minStr: "0", secStr: "00", remaining: 0, running: false, cleared: true, mode: 'down' },
  { id: "t3", name: "", minStr: "0", secStr: "00", remaining: 0, running: false, cleared: true, mode: 'down' },
  ]);

  // global tick for timers
  useEffect(() => {
    const iv = setInterval(() => {
      setTimers((prev) =>
        prev.map((t) => {
          if (!t.running) return t;
          if (t.mode === 'up') {
            // counting up
            return { ...t, remaining: t.remaining + 1, running: true, cleared: false };
          }
          // counting down
          const next = Math.max(0, t.remaining - 1);
          const runningNow = next > 0 && t.running;
          // if it hit zero, mark as expired (cleared=false) so UI shows expired state until user clears
          const clearedNow = next === 0 ? false : (t.cleared ?? false);
          return { ...t, remaining: next, running: runningNow, cleared: clearedNow };
        })
      );
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  const setTimerField = (id: string, patch: Partial<UxTimer>) =>
    setTimers((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  const startTimer = (id: string) => {
    setTimers((prev) =>
      prev.map((t) => {
        if (t.id !== id) return t;
        let remaining = t.remaining;
        if (remaining === 0) {
          const mins = Math.max(0, parseInt(t.minStr || "0", 10));
          const secs = Math.max(0, Math.min(59, parseInt(t.secStr || "0", 10)));
          remaining = mins * 60 + secs;
          // if mode is 'up', start from 0 instead of mins*60
          if (t.mode === 'up') remaining = 0;
        }
  // starting a timer means it's not in the 'cleared' state
  return { ...t, remaining, running: true, cleared: false };
      })
    );
  };

  const stopTimer = (id: string) => setTimerField(id, { running: false });
  const clearTimer = (id: string) => setTimerField(id, { running: false, remaining: 0, cleared: true });
  const removeTimer = (id: string) => setTimers((prev) => prev.filter((t) => t.id !== id));
  const addTimer = () =>
    setTimers((prev) => [
      ...prev,
  { id: `t${prev.length + 1}`, name: "", minStr: "0", secStr: "00", remaining: 0, running: false, cleared: true, mode: 'down' },
    ]);
  const resetTimers = () => setTimers((prev) => prev.map((t) => ({ ...t, running: false, remaining: 0, cleared: true })));

  // ==== Grouping & stacking (separate rows for overlaps within each recipe) ====
  type LaneRow = { end: number };
  type AssignedStep = Step & { row: number };
  type LaneInfo = { parent: string; color: string; steps: AssignedStep[]; rows: number; yTop: number; height: number };

    // === People / responsibility ===
    type Person = { id: string; name: string; color: string };
    const [people, setPeople] = useState<Person[]>([
      { id: "p1", name: "Tim", color: "#fe9b22ff" },
      { id: "p2", name: "Tiff", color: "#3e9751ff" },
    ]);
  // assignment: map from step id -> array of person ids responsible for that step
  const [stepAssignments, setStepAssignments] = useState<Record<string, string[]>>({});

    const addPerson = (name: string) => {
      const id = `p${people.length + 1}`;
      // pick a color from palette (loop) or fallback to gray
      const color = PALETTE[people.length % PALETTE.length] ?? "#6b7280";
      setPeople((p) => [...p, { id, name, color }]);
    };

    // toggle assignment for a single step
    const toggleAssignStep = (stepId: string, personId: string) => {
      setStepAssignments((prev) => {
        const cur = new Set(prev[stepId] || []);
        if (cur.has(personId)) cur.delete(personId);
        else cur.add(personId);
        return { ...prev, [stepId]: Array.from(cur) };
      });
    };

    // toggle assignment for all steps in a lane (bulk): if all steps already have person, remove; else add to all
    const toggleAssignLane = (laneParent: string, personId: string) => {
      setStepAssignments((prev) => {
        const next = { ...prev };
        const stepIds = steps.filter((s) => s.parent === laneParent).map((s) => s.id);
        const allAssigned = stepIds.length > 0 && stepIds.every((id) => (prev[id] || []).includes(personId));
        for (const id of stepIds) {
          const cur = new Set(next[id] || []);
          if (allAssigned) cur.delete(personId);
          else cur.add(personId);
          next[id] = Array.from(cur);
        }
        return next;
      });
    };

    const removePerson = (personId: string) => {
      // remove from people list and clear from all step assignments
      setPeople((prev) => prev.filter((p) => p.id !== personId));
      setStepAssignments((prev) => {
        const next: Record<string, string[]> = {};
        for (const [sid, arr] of Object.entries(prev)) {
          const filtered = arr.filter((id) => id !== personId);
          if (filtered.length) next[sid] = filtered;
        }
        return next;
      });
    };

  const lanes: LaneInfo[] = useMemo(() => {
    // group
    const parentMap = new Map<string, Step[]>();
    for (const s of steps) {
      if (!parentMap.has(s.parent)) parentMap.set(s.parent, []);
      parentMap.get(s.parent)!.push(s);
    }
    const parents = Array.from(parentMap.keys()).sort((a, b) => a.localeCompare(b));

    // assign rows per lane (interval graph greedy coloring)
    const laneInfos: LaneInfo[] = [];
    parents.forEach((parent, idx) => {
      const list = parentMap.get(parent)!.slice().sort((a, b) => a.start_min - b.start_min || a.duration_min - b.duration_min);
      const rows: LaneRow[] = []; // track last end time per row
      const assigned: AssignedStep[] = [];
      for (const s of list) {
        const sStart = s.start_min;
        const sEnd = s.start_min + s.duration_min;
        let placedRow = -1;
        for (let r = 0; r < rows.length; r++) {
          if (rows[r].end <= sStart) { placedRow = r; break; }
        }
        if (placedRow === -1) { rows.push({ end: sEnd }); placedRow = rows.length - 1; }
        else { rows[placedRow].end = sEnd; }
        assigned.push({ ...s, row: placedRow });
      }
      laneInfos.push({ parent, color: PALETTE[idx % PALETTE.length], steps: assigned, rows: rows.length, yTop: 0, height: 0 });
    });
    return laneInfos;
  }, [steps]);

  // === Layout config ===
  const rowHeight = 48; // px per row — increased so each bar can show two lines of text comfortably
  const rowGap = 6; // px between rows
  const laneVPad = 12; // top/bottom padding per lane block
  const labelWidth = 180;
  const topAxisPad = 80; // increased so minute labels are fully visible
  const pxPerMin = 12; // horizontal scale

  // compute vertical positions and chart size
  const chartWidth = useMemo(() => {
    const maxEnd = Math.ceil(steps.reduce((m, s) => Math.max(m, s.start_min + s.duration_min), 0));
    return Math.max(800, maxEnd * pxPerMin + labelWidth);
  }, [steps]);

  let yCursor = 0;
  const lanesWithY: LaneInfo[] = lanes.map((lane) => {
    const height = lane.rows * rowHeight + Math.max(0, lane.rows - 1) * rowGap + laneVPad * 2;
    const info = { ...lane, yTop: yCursor, height };
    yCursor += height;
    return info;
  });
  const chartHeight = yCursor + topAxisPad;

  // Hover / tooltip / pin
  const [hover, setHover] = useState<{ step: Step; x: number; y: number } | null>(null);
  // keep ordered array of pinned steps (most recent appended); capped at 3
  const [pinned, setPinned] = useState<Step[]>([]);

  // File handling
  const onFile = async (file: File) => {
    setError(null);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      if (!Array.isArray(json)) throw new Error("Root must be an array of step objects");
      const parsed: Step[] = json.map((o, i) => {
        const missing = ["id", "parent", "title", "start_min", "duration_min", "description"].filter((k) => !(k in o));
        if (missing.length) throw new Error(`Item ${i} missing: ${missing.join(", ")}`);
        const s: Step = {
          id: String(o.id),
          parent: String(o.parent),
          title: String(o.title),
          start_min: Number(o.start_min),
          duration_min: Number(o.duration_min),
          description: String(o.description ?? ""),
        };
        if (Number.isNaN(s.start_min) || Number.isNaN(s.duration_min)) throw new Error(`Item ${i} has non-numeric start/duration`);
        if (s.start_min < 0 || s.duration_min <= 0) throw new Error(`Item ${i} invalid start/duration values`);
        return s;
      });
      setSteps(parsed);
      // reset timeline
      setPlaying(false);
      setBaseMinutes(0);
      setJumpInput("0");
  setPinned([]);
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? "Failed to parse file");
    }
  };

  const onDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]);
  };

  const start = () => { setPlaying(true); };
  const pause = () => { setBaseMinutes((m) => m + elapsedMs / 60000); setPlaying(false); };
  const reset = () => { setPlaying(false); setBaseMinutes(0); };
  const jump = () => {
    const v = Number(jumpInput);
    if (!Number.isNaN(v)) { setPlaying(false); setBaseMinutes(Math.max(0, v)); }
  };

  // Axis ticks (every 5 minutes)
  const maxEndMin = useMemo(() => Math.ceil(steps.reduce((m, s) => Math.max(m, s.start_min + s.duration_min), 0)), [steps]);
  const ticks = useMemo(() => {
    const arr: number[] = [];
    for (let m = 0; m <= maxEndMin; m += 5) arr.push(m);
    return arr;
  }, [maxEndMin]);

  return (
    <div className="min-h-screen w-full bg-white text-gray-900 p-6">
      <div className="max-w-[1300px] mx-auto space-y-4">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-4">
            <h1 className="text-2xl font-semibold">Cooking Plan</h1>
            <div className="text-sm text-gray-600">Elapsed: <span className="font-mono text-base text-gray-900">{fmtMMSS(elapsedSeconds)}</span></div>
          </div>
          <div className="flex items-center gap-2">
            <label className="px-3 py-2 rounded-xl border shadow-sm cursor-pointer hover:bg-gray-50">
              Load JSON
              <input
                type="file"
                accept="application/json,.json,.txt"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onFile(f);
                }}
              />
            </label>
            <button onClick={start} className="px-3 py-2 rounded-xl border shadow-sm hover:bg-gray-50">Start</button>
            <button onClick={pause} className="px-3 py-2 rounded-xl border shadow-sm hover:bg-gray-50">Pause</button>
            <button onClick={reset} className="px-3 py-2 rounded-xl border shadow-sm hover:bg-gray-50">Reset</button>
            <div className="flex items-center gap-2 ml-3">
              <input
                className="w-24 px-2 py-1 rounded-lg border"
                value={jumpInput}
                onChange={(e) => setJumpInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') jump(); }}
              />
              <button onClick={jump} className="px-3 py-2 rounded-xl border shadow-sm hover:bg-gray-50">Jump (min)</button>
            </div>
          </div>
        </header>

        {error && (
          <div className="p-3 rounded-lg border border-red-300 bg-red-50 text-red-800">{error}</div>
        )}

  <div className="grid gap-4" style={{ gridTemplateColumns: '220px 1fr 420px' }}>
          {/* Left pinned column */}
          <div className="col-span-1">
            <div className="p-4 rounded-2xl border bg-white shadow-sm">
              <div className="text-xs uppercase tracking-wide text-gray-500">Pinned</div>
              <div className="mt-2 space-y-3">
                {pinned.length > 0 ? (
                  pinned.slice(0, 3).map((p) => (
                    <div key={p.id} className="p-2 rounded-md border bg-gray-50">
                      <div className="font-semibold">{p.title}</div>
                      <div className="text-sm text-gray-600">{p.parent}</div>
                      <div className="text-xs text-gray-500">{fmtDuration(p.duration_min)} ({p.start_min}-{p.start_min + p.duration_min}m)</div>
                      <div className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">{p.description}</div>
                      <div className="mt-2">
                        <button className="px-2 py-1 rounded-lg border text-sm" onClick={() => setPinned((cur) => cur.filter((it) => it.id !== p.id))}>Unpin</button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-gray-500">Click a bar to pin step details here.</div>
                )}
              </div>
            </div>
          </div>

          {/* Chart area */}
          <div className="rounded-2xl border bg-gray-50 shadow-inner overflow-auto" style={{ maxHeight: 560, paddingTop: 20 }} onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
            <svg width={chartWidth} height={chartHeight} className="block">
              {/* Background grid */}
              <g transform={`translate(${labelWidth}, ${topAxisPad})`}>
                {ticks.map((m) => (
                  <g key={m}>
                    <line x1={m * pxPerMin} y1={0} x2={m * pxPerMin} y2={chartHeight - topAxisPad} stroke="#e5e7eb" strokeWidth={m % 10 === 0 ? 1.25 : 0.75} strokeDasharray={m % 10 === 0 ? "" : "4 4"} />
                    <text x={m * pxPerMin} y={-topAxisPad + 28} fontSize={12} textAnchor="middle" fill="#6b7280">{m}</text>
                  </g>
                ))}

                {/* Lanes with stacked rows */}
                {lanesWithY.map((lane, i) => (
                  <g key={lane.parent} transform={`translate(0, ${lane.yTop})`}>
                        {/* lane background */}
                        <rect x={-labelWidth} y={0} width={chartWidth} height={lane.height} fill={i % 2 === 0 ? "#fafafa" : "#ffffff"} />
                        {/* label with person dots */}
                        {/* label area: label stays near left edge, dots placed to its left */}
                        <text x={-12} y={18} textAnchor="end" className="font-medium" fill="#111827">{lane.parent}</text>
                        {people.map((p, idx) => {
                          const assignedAny = steps.filter((s) => s.parent === lane.parent).some((s) => (stepAssignments[s.id] || []).includes(p.id));
                          // place dots starting at -labelWidth + 16, spaced 18px apart
                          const dotX = -labelWidth + 16 + idx * 18;
                          // place dots a bit lower so they don't overlap the top border / axis labels
                          const dotY = 26;
                          return (
                            <g key={p.id} transform={`translate(${dotX}, ${dotY})`} style={{ cursor: 'pointer' }} onClick={() => toggleAssignLane(lane.parent, p.id)}>
                              <circle cx={0} cy={0} r={6} fill={p.color} opacity={assignedAny ? 1 : 0.25} stroke={assignedAny ? '#000000' : 'none'} strokeWidth={assignedAny ? 1.5 : 0} />
                            </g>
                          );
                        })}

                    {/* steps */}
                    {lane.steps.map((s) => {
                      const x = s.start_min * pxPerMin;
                      const w = Math.max(2, s.duration_min * pxPerMin);
                      const y = laneVPad + s.row * (rowHeight + rowGap);
                      const h = rowHeight;
                      return (
                        <g key={s.id} onMouseEnter={(e) => setHover({ step: s, x: e.clientX, y: e.clientY })} onMouseMove={(e) => setHover({ step: s, x: e.clientX, y: e.clientY })} onMouseLeave={() => setHover(null)} onClick={() => {
                            setPinned((cur) => {
                              const arr = cur.filter((it) => it.id !== s.id);
                              arr.unshift(s); // newest first
                              while (arr.length > 3) arr.pop();
                              return arr;
                            });
                        }} style={{ cursor: "pointer" }}>
                              {/* main fill */}
                              <rect x={x} y={y} width={w} height={h} rx={10} fill={lane.color} opacity={0.85} />
                              <rect x={x} y={y} width={w} height={h} rx={10} fill="#000" opacity={0.06} />
                              {/* outlines per assigned person */}
                              {(stepAssignments[s.id] || []).map((pid: string, pidx: number) => {
                                const person = people.find((pp) => pp.id === pid);
                                if (!person) return null;
                                // draw progressively inset strokes so multiple outlines show
                                const inset = pidx * 2; // px
                                return (
                                  <rect key={pid} x={x + inset} y={y + inset} width={Math.max(2, w - inset * 2)} height={Math.max(2, h - inset * 2)} rx={10 - inset} fill="none" stroke={person.color} strokeWidth={2} onClick={() => toggleAssignStep(s.id, pid)} style={{ cursor: 'pointer' }} />
                                );
                              })}
                              {/* tightened top padding: place first line closer to rect top */}
                              <text x={x + 8} y={y + 12} fontSize={13} fill="#fff">{s.title}</text>
                              <text x={x + 8} y={y + 30} fontSize={12} fill="#eef2ff">{fmtDuration(s.duration_min)} ({s.start_min}-{s.start_min + s.duration_min}m)</text>
                              {/* per-step person dots (inside bar, top-right) */}
                              {people.map((p, pdx) => {
                                const assigned = (stepAssignments[s.id] || []).includes(p.id);
                                const dotR = 6;
                                const dotSpacing = 18;
                                const dotCx = x + Math.max(w - (pdx + 1) * dotSpacing - 8, 24);
                                const dotCy = y + 22;
                                return (
                                  <g key={p.id} transform={`translate(${dotCx}, ${dotCy})`} onClick={(e) => { e.stopPropagation(); toggleAssignStep(s.id, p.id); }} style={{ cursor: 'pointer' }}>
                                    <circle cx={0} cy={0} r={dotR} fill={p.color} opacity={assigned ? 1 : 0.25} stroke={assigned ? '#000' : 'none'} strokeWidth={assigned ? 1.2 : 0} />
                                  </g>
                                );
                              })}
                        </g>
                      );
                    })}
                  </g>
                ))}

                {/* Playhead */}
                <g>
                  <line x1={currentMin * pxPerMin} y1={0} x2={currentMin * pxPerMin} y2={chartHeight - topAxisPad} stroke="#111827" strokeWidth={2} />
                  <rect x={currentMin * pxPerMin - 22} y={-topAxisPad + 12} width={44} height={20} rx={6} fill="#111827" />
                  <text x={currentMin * pxPerMin} y={-topAxisPad + 32} fontSize={12} textAnchor="middle" fill="#fff">{Math.max(0, Math.round(currentMin))}m</text>
                </g>
              </g>
            </svg>
          </div>

          {/* Right sidebar: Timers + Pinned detail */}
          <div className="col-span-1 space-y-4">
            {/* Timer bank */}
            <div className="p-4 rounded-2xl border bg-white shadow-sm">
              <div className="flex items-baseline justify-between">
                <div className="text-lg font-semibold">Timers</div>
                <div className="flex gap-2">
                  <button className="px-2 py-1 rounded-lg border text-xs hover:bg-gray-50" onClick={addTimer}>Add</button>
                  <button className="px-2 py-1 rounded-lg border text-xs hover:bg-gray-50" onClick={resetTimers}>Clear All</button>
                </div>
              </div>
              <div className="mt-3 space-y-3">
                {timers.map((t) => {
                  // determine visual state
                  const isCountingUp = t.running && t.mode === 'up';
                  const isCountingDown = t.running && t.mode !== 'up' && t.remaining > 0;
                  // consider whether this timer had a non-zero initial value
                  const hadInitial = (parseInt(t.minStr || '0', 10) > 0) || (parseInt(t.secStr || '0', 10) > 0);
                  // expired: reached zero while counting down and not cleared by user
                  const isExpired = !t.running && t.mode !== 'up' && t.remaining === 0 && !t.cleared && hadInitial;
                  // cleared: explicit user clear or default-new timer state
                  const isCleared = (!!t.cleared) && t.remaining === 0 && t.mode !== 'up';
                  const bg = isExpired ? '#fecaca' : isCountingUp ? '#bfdbfe' : isCountingDown ? '#bbf7d0' : isCleared ? '#f3f4f6' : '#f3f4f6';
                  return (
                    <div key={t.id} className="p-3 rounded-xl border" style={{ background: bg }}>
                      <div className="flex items-center gap-2">
                        <input className="flex-1 px-2 py-1 mb-2 rounded-lg border" placeholder="Name (optional)" value={t.name} onChange={(e) => setTimerField(t.id, { name: e.target.value })} />
                        <select value={t.mode} onChange={(e) => setTimerField(t.id, { mode: e.target.value as 'up' | 'down' })} className="px-2 py-1 rounded-lg border text-sm">
                          <option value="down">down</option>
                          <option value="up">up</option>
                        </select>
                        <button className="px-2 py-1 rounded-lg border text-xs" onClick={() => removeTimer(t.id)}>Remove</button>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gray-600">Min</label>
                        <input className="w-14 px-2 py-1 rounded-lg border" value={t.minStr} onChange={(e) => setTimerField(t.id, { minStr: e.target.value.replace(/[^0-9]/g, "") })} />
                        <label className="text-xs text-gray-600">Sec</label>
                        <input className="w-14 px-2 py-1 rounded-lg border" value={t.secStr} onChange={(e) => setTimerField(t.id, { secStr: e.target.value.replace(/[^0-9]/g, "") })} />
                        <div className="ml-auto font-mono text-base">{fmtMMSS(t.remaining)}</div>
                      </div>
                      <div className="mt-2 flex gap-2">
                        <button className="px-2 py-1 rounded-lg border text-sm hover:bg-gray-50" onClick={() => startTimer(t.id)}>{t.running ? "Restart" : "Start"}</button>
                        <button className="px-2 py-1 rounded-lg border text-sm hover:bg-gray-50" onClick={() => stopTimer(t.id)}>Stop</button>
                        <button className="px-2 py-1 rounded-lg border text-sm hover:bg-gray-50" onClick={() => clearTimer(t.id)}>Clear</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* People panel */}
            <div className="p-4 rounded-2xl border bg-white shadow-sm">
              <div className="flex items-baseline justify-between">
                <div className="text-lg font-semibold">People</div>
              </div>
              <div className="mt-3">
                <AddPersonForm onAdd={(name) => { if (name.trim()) addPerson(name.trim()); }} />
                <div className="mt-3 space-y-2">
                  {people.map((p) => (
                    <div key={p.id} className="flex items-center gap-3">
                      <div style={{ width: 18, height: 18, borderRadius: 6, background: p.color, border: '1px solid #ccc' }} />
                      <div className="text-sm flex-1">{p.name}</div>
                      <button className="px-2 py-1 rounded-lg border text-xs" onClick={() => removePerson(p.id)}>Remove</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Pinned steps appear in the left column now (up to 3) */}
            <div className="p-4 rounded-2xl border bg-white shadow-sm text-sm text-gray-500">Pinned steps now show to the left of the chart.</div>
          </div>
        </div>
      </div>

      {/* Tooltip (portal-ish simple absolute box) */}
      {hover && (
        <div className="fixed z-50 max-w-sm pointer-events-none" style={{ left: hover.x + 12, top: hover.y + 12 }}>
          <div className="rounded-xl border bg-white shadow-lg p-3 text-sm">
            <div className="font-semibold">{hover.step.title}</div>
            <div className="text-gray-600">{hover.step.parent}</div>
            <div className="text-gray-600">{fmtDuration(hover.step.duration_min)} ({hover.step.start_min}-{hover.step.start_min + hover.step.duration_min}m)</div>
            <div className="mt-2 whitespace-pre-wrap text-gray-800">{hover.step.description}</div>
          </div>
        </div>
      )}
    </div>
  );
}
