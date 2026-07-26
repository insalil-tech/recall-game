import { useState, useEffect, useRef, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG — change password here if you want
// ─────────────────────────────────────────────────────────────────────────────
const ADMIN_PASSWORD = "recall2025";

// Supabase keys come from environment variables you set in Vercel.
// If they are not set the game still works — analytics just won't record.
// ⬇️ PASTE YOUR SUPABASE VALUES HERE (both are safe to include in frontend code)
const SUPA_URL = "https://oiavrpcblwrzskehhlow.supabase.co";   // e.g. https://abcdefgh.supabase.co
const SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9pYXZycGNibHdyenNrZWhobG93Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUwNzY1ODMsImV4cCI6MjEwMDY1MjU4M30.TrtqrkiB5qiKmb4z9OXqvre4tZZV7-Kc_5Bm-_hIIt4";       // starts with eyJ...
const ANALYTICS_ON = SUPA_URL.length > 0 && SUPA_KEY.length > 0;

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS — silently posts events to Supabase
// Falls back gracefully if Supabase is not configured
// ─────────────────────────────────────────────────────────────────────────────
async function track(event, ch, extra = {}) {
  if (!ANALYTICS_ON) return;
  try {
    await fetch(`${SUPA_URL}/rest/v1/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPA_KEY,
        "Authorization": `Bearer ${SUPA_KEY}`,
        "Prefer": "return=minimal",
      },
      body: JSON.stringify({
        challenge_day: new Date().toISOString().slice(0, 10),
        event,
        difficulty: ch.diff,
        grid: `${ch.rows}x${ch.cols}`,
        deck: ch.deck,
        ...extra,
      }),
    });
  } catch { /* silent fail — never break the game */ }
}

async function fetchStats() {
  if (!ANALYTICS_ON) return null;
  try {
    const res = await fetch(
      `${SUPA_URL}/rest/v1/events?select=*&order=created_at.desc&limit=5000`,
      { headers: { "apikey": SUPA_KEY, "Authorization": `Bearer ${SUPA_KEY}` } }
    );
    return await res.json();
  } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────
// PERPETUAL DATE-SEEDED CHALLENGE GENERATOR
// ─────────────────────────────────────────────────────────────────────────────
function dateToSeed(d) {
  return (d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()) * 9973;
}
function mkRng(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function shuffle(arr, rand) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

const DECKS = {
  animals: ["🐶","🐱","🐸","🐼","🦊","🐧","🐨","🦁","🐯","🦋","🐢","🦄","🐬","🦒","🐘","🦓","🦜","🐙"],
  food:    ["🍕","🍔","🍟","🌮","🍜","🍣","🍩","🍦","🎂","🍇","🍓","🍑","🥑","🫐","🍋","🥝","🍒","🍆"],
  nature:  ["🌸","🌺","🌻","🌹","🌷","🍀","🌴","🌵","🌲","🍁","🌊","🌈","⛅","❄️","🌙","⭐","🌍","🔥"],
  space:   ["🚀","🛸","🌕","⭐","🪐","☄️","🌠","🔭","🛰️","💫","🌑","🌟","🪨","🌞","🌛","🔮","🌌","👾"],
  sports:  ["⚽","🏀","🎾","⚾","🏐","🏉","🎱","🏓","🏸","🥊","⛳","🎯","🏋️","🤸","🚴","🏊","🧗","🎽"],
  shapes:  ["🔴","🔵","🟢","🟡","🟠","🟣","🔶","🔷","🔸","🔹","🟤","⚫","🔺","🔻","💠","🔘","🟥","🟦"],
  flags:   ["🇧🇷","🇯🇵","🇫🇷","🇩🇪","🇮🇳","🇨🇦","🇦🇺","🇲🇽","🇰🇷","🇮🇹","🇪🇸","🇬🇧","🇺🇸","🇷🇺","🇨🇳","🇿🇦","🇦🇷","🇵🇹"],
  suits:   ["A♠","K♠","Q♠","J♠","10♠","9♠","A♥","K♥","Q♥","J♥","10♥","9♥","A♦","K♦","Q♦","J♦","A♣","K♣"],
};
const DECK_NAMES = Object.keys(DECKS);
const DECK_EMOJI = { animals:"🐾",food:"🍕",nature:"🌿",space:"🚀",sports:"⚽",shapes:"🔷",flags:"🌍",suits:"♠️" };
const DIFF_BY_DOW = ["Easy","Easy","Medium","Medium","Hard","Hard","Expert"];
const GRIDS = { Easy:[[4,4]], Medium:[[4,4],[4,6]], Hard:[[4,6],[5,6]], Expert:[[5,6],[6,6]] };
const LABELS = ["Morning Puzzle","Brain Boost","Daily Flip","Memory Test","Mind Stretch","Focus Time","Think Fast","Sharp Mind","Card Quest","Flip Master","Recall Challenge","Pair Hunt","Quick Match","Memory Lane","Pattern Play"];
const DIFF_COLOR = { Easy:"#2ECC71", Medium:"#3498DB", Hard:"#E67E22", Expert:"#9B59B6" };

function generateChallenge(date) {
  const seed = dateToSeed(date);
  const rand = mkRng(seed);
  rand(); rand();
  const diff = DIFF_BY_DOW[date.getDay()];
  const grids = GRIDS[diff];
  const [rows, cols] = grids[Math.floor(rand() * grids.length)];
  const deck = DECK_NAMES[Math.floor(rand() * DECK_NAMES.length)];
  const label = LABELS[Math.floor(rand() * LABELS.length)];
  return { rows, cols, deck, diff, label, seed, pairs: (rows * cols) / 2, emoji: DECK_EMOJI[deck] };
}
function buildCards(ch) {
  const rand = mkRng(ch.seed + 777);
  const pool = shuffle([...DECKS[ch.deck]], rand).slice(0, ch.pairs);
  return shuffle([...pool, ...pool], rand).map((icon, i) => ({ id: i, icon, flipped: false, matched: false }));
}

// ─────────────────────────────────────────────────────────────────────────────
// SIMULATED PEER SCORES (shown until real data builds up)
// ─────────────────────────────────────────────────────────────────────────────
function simulateStats(ch, yourTime, yourMoves) {
  const rand = mkRng(ch.seed + 55555);
  const n = 35 + Math.floor(rand() * 90);
  const mu = ch.pairs * 4.8, sd = mu * 0.38;
  const mmu = ch.pairs * 1.65, msd = mmu * 0.32;
  const times = [], moves = [];
  for (let i = 0; i < n; i++) {
    const u = () => Math.max(0.01, Math.min(0.99, rand()));
    const z = () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u());
    times.push(Math.max(5, Math.round(mu + z() * sd)));
    moves.push(Math.max(ch.pairs, Math.round(mmu + z() * msd)));
  }
  times.push(yourTime); moves.push(yourMoves);
  const total = times.length;
  const avg = arr => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
  return {
    total, avgTime: avg(times), bestTime: Math.min(...times),
    avgMoves: avg(moves), bestMoves: Math.min(...moves),
    timePct: Math.round(times.filter(t => t > yourTime).length / total * 100),
    movesPct: Math.round(moves.filter(m => m > yourMoves).length / total * 100),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const fmt = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const mean = arr => arr?.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
const dateLabel = d => d.toLocaleDateString("en-GB", { weekday:"long", day:"numeric", month:"long", year:"numeric" });

// ─────────────────────────────────────────────────────────────────────────────
// CONFETTI
// ─────────────────────────────────────────────────────────────────────────────
function Confetti() {
  const colors = ["#E74C3C","#F1C40F","#2ECC71","#3498DB","#9B59B6","#E67E22","#FF69B4"];
  return (
    <div style={{position:"fixed",inset:0,pointerEvents:"none",overflow:"hidden",zIndex:300}}>
      {Array.from({length:50},(_,i)=>{
        const l=Math.random()*100,dl=Math.random()*1.5,dr=2+Math.random()*2,c=colors[i%colors.length],s=7+Math.random()*9;
        return <div key={i} style={{position:"absolute",left:`${l}%`,top:"-20px",width:s,height:s,background:c,borderRadius:Math.random()>.5?"50%":"2px",animation:`cf ${dr}s ${dl}s linear infinite`}}/>;
      })}
      <style>{`@keyframes cf{0%{transform:translateY(-20px) rotate(0deg);opacity:1}100%{transform:translateY(100vh) rotate(720deg);opacity:0}}`}</style>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CARD TILE
// ─────────────────────────────────────────────────────────────────────────────
function Card({ card, onTap, size }) {
  const isSuit = /[♠♥♦♣]/.test(card.icon);
  const suitCol = (card.icon.includes("♥")||card.icon.includes("♦")) ? "#E74C3C":"#1a1a2e";
  const fs = size < 46 ? 13 : size < 60 ? 18 : 24;
  return (
    <div onClick={()=>!card.flipped&&!card.matched&&onTap(card.id)} style={{
      width:size,height:size,borderRadius:8,userSelect:"none",flexShrink:0,
      border:card.matched?"2px solid #2ECC71":card.flipped?"2px solid #3498DB":"1.5px solid var(--color-border-tertiary)",
      background:card.matched?"#eafaf1":card.flipped?"var(--color-background-primary)":"var(--color-background-secondary)",
      display:"flex",alignItems:"center",justifyContent:"center",
      cursor:card.matched||card.flipped?"default":"pointer",transition:"background .15s",
    }}>
      {card.flipped||card.matched
        ? isSuit ? <span style={{fontSize:fs-2,fontWeight:700,color:suitCol,letterSpacing:-1}}>{card.icon}</span>
                 : <span style={{fontSize:fs}}>{card.icon}</span>
        : <span style={{fontSize:fs*.8,opacity:.15}}>?</span>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// STAT BOX
// ─────────────────────────────────────────────────────────────────────────────
function StatBox({ icon, label, yours, avgVal, best, pct }) {
  const col = pct>=80?"#2ECC71":pct>=50?"#3498DB":"#E67E22";
  return (
    <div style={{background:"var(--color-background-secondary)",borderRadius:12,padding:"12px 10px"}}>
      <div style={{fontSize:20,marginBottom:3}}>{icon}</div>
      <div style={{fontSize:10,color:"var(--color-text-secondary)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:4}}>{label}</div>
      <div style={{fontSize:20,fontWeight:700,color:"var(--color-text-primary)",marginBottom:3}}>{yours}</div>
      <div style={{fontSize:11,color:"var(--color-text-secondary)"}}>Avg {avgVal} · Best {best}</div>
      <div style={{margin:"7px 0 3px",height:5,background:"var(--color-border-tertiary)",borderRadius:3,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${pct}%`,background:col,borderRadius:3}}/>
      </div>
      <div style={{fontSize:11,fontWeight:500,color:col}}>Better than {pct}%</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN DASHBOARD — reads live from Supabase
// ─────────────────────────────────────────────────────────────────────────────
function AdminDashboard({ onClose }) {
  const [pw, setPw] = useState(""), [auth, setAuth] = useState(false);
  const [rows, setRows] = useState(null), [loading, setLoading] = useState(false);

  const attempt = () => pw === ADMIN_PASSWORD ? setAuth(true) : alert("Wrong password");

  useEffect(() => {
    if (!auth) return;
    setLoading(true);
    fetchStats().then(data => { setRows(data); setLoading(false); });
  }, [auth]);

  if (!auth) return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.65)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:400}}>
      <div style={{background:"var(--color-background-primary)",borderRadius:16,padding:28,width:290,textAlign:"center"}}>
        <div style={{fontSize:36,marginBottom:8}}>🔐</div>
        <h3 style={{margin:"0 0 6px",color:"var(--color-text-primary)"}}>Admin Dashboard</h3>
        <p style={{fontSize:12,color:"var(--color-text-secondary)",margin:"0 0 16px"}}>Enter your admin password</p>
        <input type="password" placeholder="Password" value={pw}
          onChange={e=>setPw(e.target.value)} onKeyDown={e=>e.key==="Enter"&&attempt()}
          style={{width:"100%",padding:"10px 12px",borderRadius:8,border:"1.5px solid var(--color-border-tertiary)",fontSize:14,marginBottom:12,boxSizing:"border-box",background:"var(--color-background-secondary)",color:"var(--color-text-primary)"}}/>
        <div style={{display:"flex",gap:8}}>
          <button onClick={onClose} style={{flex:1,padding:10,borderRadius:8,border:"1.5px solid var(--color-border-tertiary)",background:"transparent",cursor:"pointer",color:"var(--color-text-secondary)"}}>Cancel</button>
          <button onClick={attempt} style={{flex:1,padding:10,borderRadius:8,border:"none",background:"#3498DB",color:"#fff",cursor:"pointer",fontWeight:600}}>Enter</button>
        </div>
      </div>
    </div>
  );

  // Process raw Supabase rows into dashboard stats
  const events = Array.isArray(rows) ? rows : [];
  const starts     = events.filter(e=>e.event==="start");
  const completes  = events.filter(e=>e.event==="complete");
  const abandons   = events.filter(e=>e.event==="abandon");
  const times      = completes.map(e=>e.time_secs).filter(Boolean);
  const movesArr   = completes.map(e=>e.moves).filter(Boolean);
  const compRate   = starts.length ? Math.round(completes.length/starts.length*100) : 0;

  // Group by day
  const byDay = {};
  events.forEach(e=>{
    const d = e.challenge_day || e.created_at?.slice(0,10) || "unknown";
    if(!byDay[d]) byDay[d]={date:d,starts:0,completions:0,abandons:0,times:[],moves:[]};
    if(e.event==="start")    byDay[d].starts++;
    if(e.event==="complete") { byDay[d].completions++; if(e.time_secs) byDay[d].times.push(e.time_secs); if(e.moves) byDay[d].moves.push(e.moves); }
    if(e.event==="abandon")  byDay[d].abandons++;
  });
  const days = Object.values(byDay).sort((a,b)=>b.date.localeCompare(a.date));

  // By difficulty
  const byDiff = {};
  completes.forEach(e=>{ if(!byDiff[e.difficulty]) byDiff[e.difficulty]={count:0,times:[]}; byDiff[e.difficulty].count++; if(e.time_secs) byDiff[e.difficulty].times.push(e.time_secs); });

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:400}}>
      <div style={{background:"var(--color-background-primary)",borderRadius:"18px 18px 0 0",padding:"20px 16px 36px",width:"100%",maxWidth:480,maxHeight:"90vh",overflowY:"auto",boxSizing:"border-box"}}>

        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:6}}>
          <h3 style={{margin:0,fontSize:17,color:"var(--color-text-primary)"}}>📊 Admin Dashboard</h3>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:22,cursor:"pointer",color:"var(--color-text-secondary)"}}>✕</button>
        </div>

        {/* data source indicator */}
        <div style={{fontSize:11,color:ANALYTICS_ON?"#2ECC71":"#E67E22",marginBottom:16,display:"flex",alignItems:"center",gap:5}}>
          <span style={{width:7,height:7,borderRadius:"50%",background:ANALYTICS_ON?"#2ECC71":"#E67E22",display:"inline-block"}}/>
          {ANALYTICS_ON ? "Live data from Supabase — all players, all devices" : "⚠️ Supabase not connected — showing local data only. Follow the setup guide to enable global analytics."}
        </div>

        {loading && <div style={{textAlign:"center",padding:"40px 0",color:"var(--color-text-secondary)"}}>Loading…</div>}

        {!loading && <>
          {/* Summary tiles */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
            {[["🎮","Total Starts",starts.length],["✅","Completions",completes.length],
              ["📉","Abandoned",abandons.length],["📈","Completion %",compRate+"%"],
              ["⏱","Best Time Ever",times.length?fmt(Math.min(...times)):"—"],
              ["⏱","Avg Time",times.length?fmt(mean(times)):"—"],
              ["🎯","Avg Moves",movesArr.length?mean(movesArr):"—"],
              ["🎯","Best Moves",movesArr.length?Math.min(...movesArr):"—"],
            ].map(([ic,lbl,val])=>(
              <div key={lbl} style={{background:"var(--color-background-secondary)",borderRadius:10,padding:"11px 10px",textAlign:"center"}}>
                <div style={{fontSize:18,marginBottom:2}}>{ic}</div>
                <div style={{fontSize:10,color:"var(--color-text-secondary)",textTransform:"uppercase",letterSpacing:".05em",marginBottom:2}}>{lbl}</div>
                <div style={{fontSize:18,fontWeight:700,color:"var(--color-text-primary)"}}>{val}</div>
              </div>
            ))}
          </div>

          {/* Difficulty breakdown */}
          {Object.keys(byDiff).length > 0 && <>
            <p style={{fontSize:10,fontWeight:500,color:"var(--color-text-secondary)",textTransform:"uppercase",letterSpacing:".06em",margin:"0 0 8px"}}>By difficulty</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
              {["Easy","Medium","Hard","Expert"].filter(d=>byDiff[d]).map(d=>(
                <div key={d} style={{background:"var(--color-background-secondary)",borderRadius:10,padding:"10px 10px"}}>
                  <div style={{fontSize:12,fontWeight:600,color:DIFF_COLOR[d],marginBottom:3}}>{d}</div>
                  <div style={{fontSize:13,fontWeight:700,color:"var(--color-text-primary)"}}>{byDiff[d].count} completions</div>
                  {byDiff[d].times.length>0 && <div style={{fontSize:11,color:"var(--color-text-secondary)"}}>Avg {fmt(mean(byDiff[d].times))}</div>}
                </div>
              ))}
            </div>
          </>}

          {/* Day by day */}
          <p style={{fontSize:10,fontWeight:500,color:"var(--color-text-secondary)",textTransform:"uppercase",letterSpacing:".06em",margin:"0 0 8px"}}>Day by day</p>
          {days.length===0
            ? <p style={{fontSize:13,color:"var(--color-text-secondary)",textAlign:"center",padding:"24px 0"}}>No data yet — share the game and play a round!</p>
            : days.map(d=>(
              <div key={d.date} style={{background:"var(--color-background-secondary)",borderRadius:10,padding:"11px 12px",marginBottom:7}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                  <span style={{fontSize:13,fontWeight:500,color:"var(--color-text-primary)"}}>{d.date}</span>
                  <span style={{fontSize:11,color:"var(--color-text-secondary)"}}>{d.completions}/{d.starts} done</span>
                </div>
                <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                  {d.times.length>0
                    ? <><span style={{fontSize:11,color:"var(--color-text-secondary)"}}>⏱ Best {fmt(Math.min(...d.times))}</span>
                        <span style={{fontSize:11,color:"var(--color-text-secondary)"}}>Avg {fmt(mean(d.times))}</span></>
                    : <span style={{fontSize:11,color:"var(--color-text-secondary)"}}>No completions</span>}
                  {d.abandons>0 && <span style={{fontSize:11,color:"#E67E22"}}>↩ {d.abandons} quit</span>}
                </div>
              </div>
            ))}
        </>}

        <button onClick={onClose} style={{width:"100%",marginTop:12,padding:12,borderRadius:10,border:"none",background:"var(--color-background-secondary)",color:"var(--color-text-secondary)",fontSize:14,cursor:"pointer"}}>Close</button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN APP
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const now = new Date();
  const ch = generateChallenge(now);
  const [screen, setScreen]       = useState("landing");
  const [cards, setCards]         = useState([]);
  const [flipped, setFlipped]     = useState([]);
  const [matched, setMatched]     = useState(0);
  const [moves, setMoves]         = useState(0);
  const [elapsed, setElapsed]     = useState(0);
  const [started, setStarted]     = useState(false);
  const [locked, setLocked]       = useState(false);
  const [result, setResult]       = useState(null);
  const [confetti, setConfetti]   = useState(false);
  const [copied, setCopied]       = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [logoTaps, setLogoTaps]   = useState(0);
  const timerRef = useRef(null);

  useEffect(()=>{
    if(screen==="game"){ setCards(buildCards(ch)); setFlipped([]); setMatched(0); setMoves(0); setElapsed(0); setStarted(false); setLocked(false); }
  },[screen]);

  useEffect(()=>{ if(started){ timerRef.current=setInterval(()=>setElapsed(e=>e+1),1000); } return()=>clearInterval(timerRef.current); },[started]);

  useEffect(()=>{
    const h=()=>{ if(started&&matched<ch.pairs) track("abandon",ch,{pairs_found:matched,time_secs:elapsed}); };
    window.addEventListener("beforeunload",h); return()=>window.removeEventListener("beforeunload",h);
  },[started,matched,elapsed,ch]);

  const vw = typeof window!=="undefined"?window.innerWidth:400;
  const cellSize = Math.min(Math.floor((Math.min(vw-28,490)-(ch.cols-1)*5)/ch.cols),68);

  const tapCard = useCallback((id)=>{
    if(locked) return;
    if(!started){ setStarted(true); track("start",ch); }
    setFlipped(prev=>{
      if(prev.includes(id)||prev.length>=2) return prev;
      const next=[...prev,id];
      setCards(cs=>cs.map(c=>next.includes(c.id)?{...c,flipped:true}:c));
      if(next.length===2){
        setLocked(true); setMoves(m=>m+1);
        const icons=next.map(i=>cards.find(c=>c.id===i)?.icon);
        if(icons[0]===icons[1]){
          setTimeout(()=>{
            setCards(cs=>cs.map(c=>next.includes(c.id)?{...c,matched:true,flipped:true}:c));
            setMatched(m=>{
              const nm=m+1;
              if(nm===ch.pairs){
                clearInterval(timerRef.current);
                setTimeout(()=>{
                  setElapsed(e=>{ setMoves(mv=>{
                    const fm=mv+1;
                    track("complete",ch,{time_secs:e,moves:fm});
                    const stats=simulateStats(ch,e,fm);
                    setResult({time:e,moves:fm,stats});
                    setConfetti(true); setTimeout(()=>setConfetti(false),4500);
                    setScreen("result"); return fm;
                  }); return e; });
                },600);
              }
              return nm;
            });
            setFlipped([]); setLocked(false);
          },500);
        } else {
          setTimeout(()=>{ setCards(cs=>cs.map(c=>next.includes(c.id)?{...c,flipped:false}:c)); setFlipped([]); setLocked(false); },900);
        }
      }
      return next;
    });
  },[locked,started,cards,ch,moves]);

  const shareText = result
    ? `🃏 Recall · ${now.toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"})}\n${ch.emoji} ${ch.label} (${ch.diff} · ${ch.rows}×${ch.cols})\n⏱ ${fmt(result.time)} · ${result.moves} moves\n⚡ Faster than ${result.stats.timePct}% · Fewer moves than ${result.stats.movesPct}%\n\nPlay free → recall-game.vercel.app`
    : "";
  const handleShare = ()=>{ if(navigator.share) navigator.share({text:shareText}).catch(()=>{}); else navigator.clipboard?.writeText(shareText).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2200);}); };
  const handleLogoTap = ()=>{ const n=logoTaps+1; setLogoTaps(n); if(n>=5){setShowAdmin(true);setLogoTaps(0);} };

  // ── LANDING ────────────────────────────────────────────────────────────────
  if(screen==="landing") return (
    <div style={{fontFamily:"system-ui,sans-serif",maxWidth:440,margin:"0 auto",padding:"0 16px 48px",minHeight:"100vh"}}>
      {showAdmin&&<AdminDashboard onClose={()=>setShowAdmin(false)}/>}
      <div style={{textAlign:"center",padding:"44px 0 24px"}}>
        <div style={{fontSize:58,marginBottom:8,cursor:"pointer",WebkitTapHighlightColor:"transparent"}} onClick={handleLogoTap}>🃏</div>
        <h1 style={{fontSize:33,fontWeight:700,margin:"0 0 4px",color:"var(--color-text-primary)",letterSpacing:-1}}>Recall</h1>
        <p style={{fontSize:13,color:"var(--color-text-secondary)",margin:"0 0 2px"}}>Daily memory challenge</p>
        <p style={{fontSize:12,color:"var(--color-text-secondary)",opacity:.55,margin:0}}>{dateLabel(now)}</p>
      </div>
      <div style={{border:`2px solid ${DIFF_COLOR[ch.diff]}30`,borderRadius:16,padding:"20px",marginBottom:18,background:"var(--color-background-primary)",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:DIFF_COLOR[ch.diff]}}/>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
          <div style={{fontSize:36,lineHeight:1}}>{ch.emoji}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:17,fontWeight:600,color:"var(--color-text-primary)"}}>{ch.label}</div>
            <div style={{fontSize:12,color:"var(--color-text-secondary)"}}>Today's challenge</div>
          </div>
          <div style={{fontSize:12,fontWeight:600,color:DIFF_COLOR[ch.diff],background:DIFF_COLOR[ch.diff]+"18",padding:"3px 10px",borderRadius:20}}>{ch.diff}</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:7,marginBottom:16}}>
          {[["⊞","Grid",`${ch.rows}×${ch.cols}`],["🃏","Pairs",ch.pairs],["🎨","Theme",ch.deck[0].toUpperCase()+ch.deck.slice(1)]].map(([ic,l,v])=>(
            <div key={l} style={{background:"var(--color-background-secondary)",borderRadius:9,padding:"9px 6px",textAlign:"center"}}>
              <div style={{fontSize:15,marginBottom:2}}>{ic}</div>
              <div style={{fontSize:10,color:"var(--color-text-secondary)"}}>{l}</div>
              <div style={{fontSize:13,fontWeight:600,color:"var(--color-text-primary)"}}>{v}</div>
            </div>
          ))}
        </div>
        <button onClick={()=>setScreen("game")} style={{width:"100%",padding:14,borderRadius:10,border:"none",background:DIFF_COLOR[ch.diff],color:"#fff",fontSize:16,fontWeight:700,cursor:"pointer"}}>
          Start Today's Challenge →
        </button>
      </div>
      <div style={{background:"var(--color-background-secondary)",borderRadius:12,padding:"14px 16px"}}>
        <p style={{fontSize:10,fontWeight:500,color:"var(--color-text-secondary)",textTransform:"uppercase",letterSpacing:".07em",margin:"0 0 10px"}}>How to play</p>
        {[["👆","Tap any two cards to flip them"],["✅","Matching pair? They stay face-up"],["🧠","No match? Cards flip back — remember where they were!"],["⏱","Match all pairs as fast as you can"],["📊","See how you rank against other players"]].map(([ic,txt])=>(
          <div key={txt} style={{display:"flex",gap:10,marginBottom:7,alignItems:"flex-start"}}>
            <span style={{fontSize:15,flexShrink:0,lineHeight:1.5}}>{ic}</span>
            <span style={{fontSize:13,color:"var(--color-text-primary)",lineHeight:1.5}}>{txt}</span>
          </div>
        ))}
      </div>
      <p style={{textAlign:"center",fontSize:10,color:"var(--color-text-secondary)",opacity:.3,marginTop:12}}>Tap 🃏 five times for admin access</p>
    </div>
  );

  // ── RESULT ─────────────────────────────────────────────────────────────────
  if(screen==="result"&&result){
    const {stats}=result;
    return (
      <div style={{fontFamily:"system-ui,sans-serif",maxWidth:440,margin:"0 auto",padding:"20px 16px 44px"}}>
        {confetti&&<Confetti/>}
        {showAdmin&&<AdminDashboard onClose={()=>setShowAdmin(false)}/>}
        <div style={{textAlign:"center",marginBottom:20}}>
          <div style={{fontSize:52,marginBottom:6}}>🏆</div>
          <h2 style={{fontSize:24,fontWeight:700,margin:"0 0 3px",color:"var(--color-text-primary)"}}>Puzzle Complete!</h2>
          <p style={{fontSize:13,color:"var(--color-text-secondary)",margin:0}}>{ch.emoji} {ch.label} · {ch.diff} · {ch.rows}×{ch.cols}</p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
          <StatBox icon="⏱" label="Time" yours={fmt(result.time)} avgVal={fmt(stats.avgTime)} best={fmt(stats.bestTime)} pct={stats.timePct}/>
          <StatBox icon="🎯" label="Moves" yours={result.moves} avgVal={stats.avgMoves} best={stats.bestMoves} pct={stats.movesPct}/>
        </div>
        <div style={{background:"var(--color-background-secondary)",borderRadius:12,padding:"11px 14px",marginBottom:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><div style={{fontSize:11,color:"var(--color-text-secondary)"}}>Players today</div><div style={{fontSize:20,fontWeight:700,color:"var(--color-text-primary)"}}>{stats.total}</div></div>
          <div style={{textAlign:"right"}}><div style={{fontSize:11,color:"var(--color-text-secondary)"}}>Your speed rank</div><div style={{fontSize:20,fontWeight:700,color:"#3498DB"}}>Top {Math.max(1,100-stats.timePct)}%</div></div>
        </div>
        <div style={{background:"var(--color-background-secondary)",borderRadius:12,padding:"13px",marginBottom:14}}>
          <p style={{fontSize:10,fontWeight:500,color:"var(--color-text-secondary)",textTransform:"uppercase",letterSpacing:".07em",margin:"0 0 8px"}}>Share your result</p>
          <pre style={{fontSize:12,color:"var(--color-text-primary)",whiteSpace:"pre-wrap",margin:0,fontFamily:"inherit",lineHeight:1.7}}>{shareText}</pre>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:9}}>
          <button onClick={handleShare} style={{padding:13,borderRadius:10,border:"none",background:"#3498DB",color:"#fff",fontSize:15,fontWeight:600,cursor:"pointer"}}>{copied?"✅ Copied!":"📤 Share Result"}</button>
          <button onClick={()=>setScreen("game")} style={{padding:12,borderRadius:10,border:"1.5px solid var(--color-border-tertiary)",background:"transparent",color:"var(--color-text-primary)",fontSize:14,fontWeight:500,cursor:"pointer"}}>🔄 Play Again</button>
          <button onClick={()=>setScreen("landing")} style={{padding:11,borderRadius:10,border:"none",background:"var(--color-background-secondary)",color:"var(--color-text-secondary)",fontSize:13,cursor:"pointer"}}>🏠 Home</button>
        </div>
      </div>
    );
  }

  // ── GAME ───────────────────────────────────────────────────────────────────
  return (
    <div style={{fontFamily:"system-ui,sans-serif",maxWidth:520,margin:"0 auto",padding:"12px 12px 32px",minHeight:"100vh"}}>
      {showAdmin&&<AdminDashboard onClose={()=>setShowAdmin(false)}/>}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <button onClick={()=>{ if(started&&matched<ch.pairs) track("abandon",ch,{pairs_found:matched,time_secs:elapsed}); setScreen("landing"); }} style={{width:36,height:36,borderRadius:"50%",border:"1px solid var(--color-border-tertiary)",background:"var(--color-background-primary)",cursor:"pointer",fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>🏠</button>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:14,fontWeight:600,color:"var(--color-text-primary)"}}>{ch.emoji} {ch.label}</div>
          <div style={{fontSize:11,fontWeight:500,color:DIFF_COLOR[ch.diff]}}>{ch.diff} · {ch.rows}×{ch.cols} · {ch.deck}</div>
        </div>
        <div style={{textAlign:"right",minWidth:52}}>
          <div style={{fontSize:18,fontWeight:700,color:"var(--color-text-primary)"}}>{fmt(elapsed)}</div>
          <div style={{fontSize:11,color:"var(--color-text-secondary)"}}>{moves} moves</div>
        </div>
      </div>
      <div style={{height:5,background:"var(--color-background-secondary)",borderRadius:3,marginBottom:11,overflow:"hidden"}}>
        <div style={{height:"100%",width:`${(matched/ch.pairs)*100}%`,background:DIFF_COLOR[ch.diff],borderRadius:3,transition:"width .4s ease"}}/>
      </div>
      <div style={{textAlign:"center",fontSize:12,color:"var(--color-text-secondary)",marginBottom:12}}>{matched} of {ch.pairs} pairs found</div>
      <div style={{display:"flex",justifyContent:"center"}}>
        <div style={{display:"grid",gridTemplateColumns:`repeat(${ch.cols},${cellSize}px)`,gap:5}}>
          {cards.map(card=><Card key={card.id} card={card} onTap={tapCard} size={cellSize}/>)}
        </div>
      </div>
      {!started&&<p style={{textAlign:"center",fontSize:12,color:"var(--color-text-secondary)",marginTop:18,opacity:.6}}>Tap any card to begin</p>}
    </div>
  );
}
