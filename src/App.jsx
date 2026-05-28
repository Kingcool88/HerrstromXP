import React, { useEffect, useMemo, useState } from 'react'
import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth'
import { getFirestore, doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore'
import { Trophy, Star, ShieldCheck, Gamepad2, Sparkles, BarChart3, LogOut, Users, Bell, Swords, Palette, Plus, Trash2, Save, Gift, CheckCircle2, XCircle, Flame } from 'lucide-react'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const firebaseReady = Object.values(firebaseConfig).every(Boolean)
const app = firebaseReady ? initializeApp(firebaseConfig) : null
const auth = app ? getAuth(app) : null
const db = app ? getFirestore(app) : null
const googleProvider = new GoogleAuthProvider()

const uid = () => Math.random().toString(36).slice(2, 9)
const todayKey = () => new Date().toISOString().slice(0, 10)
const weekdays = ['Sön','Mån','Tis','Ons','Tor','Fre','Lör']
const dayName = () => weekdays[new Date().getDay()]
const daysAll = ['Mån','Tis','Ons','Tor','Fre','Lör','Sön']
const levelFromXp = xp => Math.max(1, Math.floor((xp || 0) / 250) + 1)
const clone = obj => structuredClone ? structuredClone(obj) : JSON.parse(JSON.stringify(obj))
const code = () => Math.random().toString(36).slice(2, 8).toUpperCase()

function starterFamily(ownerUid, ownerName) {
  return {
    id: `fam-${uid()}`,
    code: code(),
    ownerUid,
    ownerName,
    theme: 'nintendo',
    adminPin: '2468',
    friendCodes: [],
    onboardingDone: false,
    season: { name: 'Veckans liga', goal: 100, resetDay: 'Mån' },
    notifications: { pushEnabled: false, parentApprovals: true, rewardPurchases: true, dailyReset: true },
    children: [
      { id: 'annie', name: 'Annie', nickname: 'Annie', emoji: '🦄', color: '#ff4fd8', xp: 0, level: 1, streak: 0, bestStreak: 0, leaguePoints: 0, achievements: [] },
      { id: 'albin', name: 'Albin', nickname: 'Albin', emoji: '🦖', color: '#37ff7a', xp: 0, level: 1, streak: 0, bestStreak: 0, leaguePoints: 0, achievements: [] },
    ],
    tasks: [
      { id: 'packa-vaska', title: 'Packa skolväska/förskoleväska', xp: 10, league: 10, difficulty: 'normal', days: ['Mån','Tis','Ons','Tor','Fre'], approval: true, requiredForRewards: false, category: 'Morgon' },
      { id: 'tandborstning', title: 'Borsta tänderna', xp: 10, league: 10, difficulty: 'easy', days: daysAll, approval: false, requiredForRewards: true, category: 'Kväll' },
      { id: 'laxa', title: 'Läxor/läsning', xp: 20, league: 20, difficulty: 'hard', days: ['Mån','Tis','Ons','Tor'], approval: true, requiredForRewards: true, category: 'Skola' },
    ],
    rewards: [
      { id: 'tvspel-30', title: 'TV-spel 30 min', cost: 100, minutes: 30, days: ['Fre','Lör','Sön'], requiresTasks: ['tandborstning'], type: 'screen' },
      { id: 'filmkvall', title: 'Välja film', cost: 80, minutes: 0, days: ['Fre','Lör'], requiresTasks: [], type: 'family' },
    ],
    rules: {
      requireToothbrushBeforeRewards: true,
      requireHomeworkBeforeTv: true,
      weekendBonus: true,
      weekendBonusPercent: 25,
      maxScreenMinutesPerDay: 60,
      differentRulesPerChild: false,
      childRules: {},
    },
    daily: {},
    history: [],
    friendLeague: [
      { id: 'demo1', name: 'Kompisfamilj: Leo', avatar: '🦊', leaguePoints: 85, streak: 4 },
      { id: 'demo2', name: 'Kompisfamilj: Maja', avatar: '🐼', leaguePoints: 70, streak: 3 },
    ],
    createdAt: Date.now(),
  }
}

function isTodayTask(task){ return !task.days?.length || task.days.includes(dayName()) }
function isTodayReward(reward){ return !reward.days?.length || reward.days.includes(dayName()) }
function daysText(days){ return (days || []).join(', ') }
function childDay(family, childId){
  const t = todayKey()
  return family.daily?.[t]?.children?.[childId] || { tasks: {}, rewards: {}, screenMinutes: 0 }
}
function taskStatus(family, childId, task) {
  const rec = childDay(family, childId).tasks?.[task.id]
  if (!rec) return 'idle'
  if (rec.pending) return 'pending'
  if (rec.rejected) return 'rejected'
  if (rec.done) return 'approved'
  return 'idle'
}
function taskDone(family, childId, taskId){ return !!childDay(family, childId).tasks?.[taskId]?.done }
function rewardBought(family, childId, rewardId){ return !!childDay(family, childId).rewards?.[rewardId]?.bought }
function pushHistory(nf, item) { nf.history.unshift({ id: uid(), date: todayKey(), at: Date.now(), ...item }); nf.history = nf.history.slice(0, 500) }
function maybeAchievements(ch) {
  const ach = new Set(ch.achievements || [])
  if ((ch.xp || 0) >= 100) ach.add('first-100')
  if ((ch.xp || 0) >= 500) ach.add('xp-500')
  if ((ch.leaguePoints || 0) >= 100) ach.add('league-100')
  if ((ch.bestStreak || 0) >= 7) ach.add('streak-7')
  ch.achievements = [...ach]
}

function Landing({ onLogin }){
  return <div className="landing">
    <div className="hero-card">
      <div className="brand-row"><Gamepad2/><span>HerrstromXP</span></div>
      <h1>Familjeuppdrag som barnen faktiskt vill göra.</h1>
      <p>Skapa barnprofiler, dela ut XP, bygg belöningar, sätt smarta regler och låt barnen tävla rättvist med kompisfamiljer via League Points.</p>
      <div className="hero-actions"><button className="primary" onClick={onLogin}>Registrera / logga in med Google</button><a href="#howto">Se hur det fungerar</a></div>
    </div>
    <section id="howto" className="howto-grid">
      <article><ShieldCheck/><h3>1. Skapa familj</h3><p>Vuxna loggar in med Google. Barnen får profiler utan egna Google-konton.</p></article>
      <article><Star/><h3>2. Uppdrag & XP</h3><p>Barnen gör uppdrag, får XP och kan köpa belöningar som TV-spel eller filmkväll.</p></article>
      <article><Swords/><h3>3. Kompisliga</h3><p>Familjer kan dela kod. Barnen tävlar med League Points så olika hemregler blir rättvist.</p></article>
      <article><Palette/><h3>4. Välj tema</h3><p>Nintendo-inspirerat speltema eller ett lugnare, stilrent tema.</p></article>
    </section>
  </div>
}

function Onboarding({ user, onCreateCloud }){
  const [name,setName] = useState('Familjen')
  const [theme,setTheme] = useState('nintendo')
  const [join,setJoin] = useState('')
  return <div className="onboarding panel wide">
    <h1>Välkommen {user?.displayName || 'förälder'}!</h1>
    <p className="lead">Första gången skapar du en egen familj. Sen kan du lägga till barn, uppdrag, belöningar och bjuda in kompisfamiljer.</p>
    <div className="onboard-grid">
      <div className="form-card">
        <h3>Skapa ny familj</h3>
        <label>Familjenamn <input value={name} onChange={e=>setName(e.target.value)} /></label>
        <label>Tema <select value={theme} onChange={e=>setTheme(e.target.value)}><option value="nintendo">Nintendo/spel</option><option value="clean">Stilrent</option></select></label>
        <button className="primary" onClick={()=>onCreateCloud(name, theme)}>Skapa familj</button>
      </div>
      <div className="form-card muted">
        <h3>Gå med via kod</h3>
        <p>Förberett för familjekod. Just nu används kod för kompisliga; full join-koppling kan slås på när reglerna låses.</p>
        <input value={join} onChange={e=>setJoin(e.target.value.toUpperCase())} placeholder="T.ex. HMV7K2" />
        <button onClick={()=>alert('Kod sparas i nästa version när publikt familjeindex är aktiverat.')}>Gå med</button>
      </div>
    </div>
  </div>
}

function Top({ user, family, onLogin, onLogout, updateFamily }){
  return <header className="topbar">
    <div><h1>HerrstromXP</h1><p>{family ? `${family.name || 'Familj'} · Kod ${family.code} · ${firebaseReady ? 'Synkad' : 'Lokalt'}` : 'Familje-quests med XP'}</p></div>
    <div className="top-actions">
      {family && <select value={family.theme || 'nintendo'} onChange={e=>updateFamily(f=>({...f, theme:e.target.value}))}><option value="nintendo">🎮 Nintendo</option><option value="clean">Stilrent</option></select>}
      {user ? <button onClick={onLogout}><LogOut size={16}/> Logga ut</button> : <button onClick={onLogin}>Logga in</button>}
    </div>
  </header>
}

function LeagueCompact({ family }){
  const rows = [...(family.children || []).map(c=>({ id:c.id, name:c.nickname || c.name, avatar:c.emoji, leaguePoints:c.leaguePoints||0, streak:c.streak||0, own:true })), ...(family.friendLeague || [])]
    .sort((a,b)=>(b.leaguePoints||0)-(a.leaguePoints||0)).slice(0,5)
  return <div className="league-compact panel">
    <div className="league-title"><Trophy size={18}/> Kompisliga</div>
    {rows.map((c,i)=><div className={`league-row ${c.own?'own':''}`} key={c.id}><span>{i+1}. {c.avatar} {c.name}</span><b>{c.leaguePoints||0} LP</b></div>)}
  </div>
}

function LeagueFull({ family }){
  const rows = [...(family.children || []).map(c=>({ id:c.id, name:c.nickname || c.name, avatar:c.emoji, leaguePoints:c.leaguePoints||0, streak:c.streak||0, own:true })), ...(family.friendLeague || [])]
    .sort((a,b)=>(b.leaguePoints||0)-(a.leaguePoints||0))
  return <section className="panel">
    <div className="section-head"><h2>Kompisligan</h2><p>Här visas League Points. Barnens vanliga XP hemma påverkas inte av kompisarnas regler.</p></div>
    <div className="leaderboard">{rows.map((r,i)=><div className={`leader-row ${r.own?'own':''}`} key={r.id}><span className="rank">#{i+1}</span><span className="avatar small">{r.avatar}</span><div><b>{r.name}</b><p>{r.streak || 0} dagars streak</p></div><strong>{r.leaguePoints||0} LP</strong></div>)}</div>
  </section>
}

function TaskCard({ family, child, task, updateFamily }){
  const status = taskStatus(family, child.id, task)
  const active = status !== 'idle'
  const complete = () => updateFamily(f => {
    const nf = clone(f)
    nf.daily[todayKey()] ||= { children: {} }
    nf.daily[todayKey()].children[child.id] ||= { tasks: {}, rewards: {}, screenMinutes: 0 }
    const weekend = nf.rules?.weekendBonus && ['Lör','Sön'].includes(dayName())
    const bonus = weekend ? Math.round((task.xp || 0) * ((nf.rules.weekendBonusPercent || 0) / 100)) : 0
    const xpGain = (task.xp || 0) + bonus
    nf.daily[todayKey()].children[child.id].tasks[task.id] = task.approval ? { pending:true, at:Date.now() } : { done:true, xp:xpGain, at:Date.now() }
    if (!task.approval) {
      const ch = nf.children.find(x=>x.id===child.id)
      ch.xp = (ch.xp || 0) + xpGain
      ch.leaguePoints = (ch.leaguePoints || 0) + (task.league || 10)
      ch.level = levelFromXp(ch.xp)
      ch.streak = (ch.streak || 0) + 1
      ch.bestStreak = Math.max(ch.bestStreak || 0, ch.streak || 0)
      maybeAchievements(ch)
      pushHistory(nf, { type:'task', childId:child.id, title:task.title, xp:xpGain, league:task.league || 10 })
    } else pushHistory(nf, { type:'pending-approval', childId:child.id, title:task.title, xp:0 })
    return nf
  })
  const undo = () => updateFamily(f => {
    const nf = clone(f)
    const rec = nf.daily?.[todayKey()]?.children?.[child.id]?.tasks?.[task.id]
    if (rec?.done) {
      const ch = nf.children.find(x=>x.id===child.id)
      ch.xp = Math.max(0, (ch.xp || 0) - (rec.xp || task.xp || 0))
      ch.leaguePoints = Math.max(0, (ch.leaguePoints || 0) - (task.league || 10))
      ch.level = levelFromXp(ch.xp)
      pushHistory(nf, { type:'undo-task', childId:child.id, title:task.title, xp:-(rec.xp || task.xp || 0) })
    }
    if (nf.daily?.[todayKey()]?.children?.[child.id]?.tasks) delete nf.daily[todayKey()].children[child.id].tasks[task.id]
    return nf
  })
  return <div className={`task-card ${status}`}>
    <div className="task-main"><div><h3>{task.title}</h3><div className="task-card-meta"><div className="task-days"><span>📅</span><span>{daysText(task.days)}</span></div>{status==='approved' && <span className="task-status-badge approved">✅ Godkänd</span>}{status==='pending' && <span className="task-status-badge pending">⏳ Väntar på godkännande</span>}{status==='rejected' && <span className="task-status-badge rejected">✕ Ej godkänd</span>}{task.requiredForRewards && <span className="task-status-badge required">🔒 Krävs före belöning</span>}</div></div><button className="action-pill" onClick={active?undo:complete}>{status==='pending'?'Avbryt':status==='approved'?'Ångra':'Klart'}</button></div>
    <div className="reward-mini"><span>{task.xp} XP</span><span>{task.league || 10} LP</span><span>{task.difficulty || 'normal'}</span></div>
  </div>
}

function canBuyReward(family, child, reward) {
  const childToday = childDay(family, child.id)
  if (!isTodayReward(reward)) return { ok:false, reason:'Inte tillgänglig idag' }
  if ((child.xp || 0) < (reward.cost || 0)) return { ok:false, reason:'För lite XP' }
  if (rewardBought(family, child.id, reward.id)) return { ok:false, reason:'Redan köpt idag' }
  if (family.rules?.maxScreenMinutesPerDay && reward.type === 'screen' && ((childToday.screenMinutes || 0) + (reward.minutes || 0)) > family.rules.maxScreenMinutesPerDay) return { ok:false, reason:'Max skärmtid idag' }
  const reqs = new Set(reward.requiresTasks || [])
  if (family.rules?.requireToothbrushBeforeRewards) reqs.add('tandborstning')
  if (family.rules?.requireHomeworkBeforeTv && reward.type === 'screen') reqs.add('laxa')
  for (const id of reqs) if (!taskDone(family, child.id, id)) return { ok:false, reason:`Kräver ${id}` }
  return { ok:true, reason:'' }
}

function Rewards({ family, child, updateFamily }){
  return <div className="rewards-list">{family.rewards.filter(isTodayReward).map(r=>{
    const state = canBuyReward(family, child, r)
    return <div className="reward-card" key={r.id}><div><b><Gift size={15}/> {r.title}</b><p>{r.cost} XP · {r.minutes ? `${r.minutes} min` : 'privilegium'} · {daysText(r.days)}</p>{!state.ok && <span className="small-warn">{state.reason}</span>}</div><button disabled={!state.ok} onClick={()=>updateFamily(f=>{ const nf=clone(f); nf.daily[todayKey()] ||= {children:{}}; nf.daily[todayKey()].children[child.id] ||= {tasks:{}, rewards:{}, screenMinutes:0}; nf.daily[todayKey()].children[child.id].rewards[r.id] = {bought:true, at:Date.now()}; nf.daily[todayKey()].children[child.id].screenMinutes = (nf.daily[todayKey()].children[child.id].screenMinutes || 0) + (r.minutes || 0); const ch=nf.children.find(x=>x.id===child.id); ch.xp=Math.max(0,(ch.xp||0)-(r.cost||0)); ch.level=levelFromXp(ch.xp); pushHistory(nf,{type:'reward', childId:child.id, title:r.title, xp:-(r.cost||0)}); return nf })}>Köp</button></div>
  })}</div>
}

function ChildPanel({ family, child, updateFamily }){
  const [showRewards, setShowRewards] = useState(false)
  const tasks = family.tasks.filter(isTodayTask)
  const xpPct = Math.min(100, ((child.xp || 0) % 250) / 250 * 100)
  return <section className="child-panel" style={{'--accent': child.color}}>
    <header className="child-head"><div className="avatar">{child.emoji}</div><div><h2>{child.name}</h2><p>Nivå {child.level} · {child.xp} XP · {child.leaguePoints||0} LP · 🔥 {child.streak||0}</p></div></header>
    <div className="xpbar"><span style={{width:`${xpPct}%`}}/></div>
    <div className="child-actions"><button onClick={()=>setShowRewards(false)} className={!showRewards?'active':''}>Uppdrag</button><button onClick={()=>setShowRewards(true)} className={showRewards?'active':''}>Belöningar</button></div>
    {!showRewards ? <div className="task-list">{tasks.map(t=><TaskCard key={t.id} family={family} child={child} task={t} updateFamily={updateFamily}/>)}</div> : <Rewards family={family} child={child} updateFamily={updateFamily}/>} 
  </section>
}

function Admin({ family, updateFamily }){
  const [tab,setTab]=useState('approve')
  const pending = []
  family.children.forEach(c=>family.tasks.forEach(t=>{ if(taskStatus(family,c.id,t)==='pending') pending.push({child:c, task:t}) }))
  const approve = (child,task,ok) => updateFamily(f=>{ const nf=clone(f); const rec=nf.daily[todayKey()].children[child.id].tasks[task.id]; if(ok){ rec.pending=false; rec.done=true; rec.xp=task.xp; const ch=nf.children.find(x=>x.id===child.id); ch.xp=(ch.xp||0)+(task.xp||0); ch.leaguePoints=(ch.leaguePoints||0)+(task.league||10); ch.level=levelFromXp(ch.xp); ch.streak=(ch.streak||0)+1; ch.bestStreak=Math.max(ch.bestStreak||0,ch.streak||0); maybeAchievements(ch); pushHistory(nf,{type:'task-approved',childId:child.id,title:task.title,xp:task.xp,league:task.league||10}) } else { rec.pending=false; rec.rejected=true; pushHistory(nf,{type:'rejected',childId:child.id,title:task.title,xp:0}) } return nf })
  const labels = { approve:'Godkänn', children:'Barn', tasks:'Uppdrag', rewards:'Belöningar', rules:'Smarta regler', league:'Liga', stats:'Statistik', settings:'Inställningar' }
  return <section className="admin-panel panel"><div className="admin-header"><h2>Föräldra-admin</h2><p>Hantera familj, uppdrag, belöningar, smarta regler, kompisliga, statistik och tema.</p><div className="admin-tabs">{Object.keys(labels).map(t=><button key={t} className={tab===t?'active':''} onClick={()=>setTab(t)}>{labels[t]}</button>)}</div></div>
    {tab==='approve' && <div className="admin-list">{pending.length===0?<p>Inga uppdrag väntar.</p>:pending.map(p=><div className="admin-row" key={p.child.id+p.task.id}><span>{p.child.emoji} {p.child.name}: {p.task.title}</span><div><button onClick={()=>approve(p.child,p.task,true)}><CheckCircle2 size={15}/> Godkänn</button><button className="danger" onClick={()=>approve(p.child,p.task,false)}><XCircle size={15}/> Neka</button></div></div>)}</div>}
    {tab==='children' && <ChildrenEditor family={family} updateFamily={updateFamily}/>} {tab==='tasks' && <TasksEditor family={family} updateFamily={updateFamily}/>} {tab==='rewards' && <RewardsEditor family={family} updateFamily={updateFamily}/>} {tab==='rules' && <RulesEditor family={family} updateFamily={updateFamily}/>} {tab==='league' && <LeagueEditor family={family} updateFamily={updateFamily}/>} {tab==='stats' && <Stats family={family}/>} {tab==='settings' && <SettingsEditor family={family} updateFamily={updateFamily}/>} </section>
}
function ChildrenEditor({ family, updateFamily }){ return <div className="admin-list">{family.children.map(c=><div className="edit-row" key={c.id}><input value={c.name} onChange={e=>updateFamily(f=>({...f, children:f.children.map(x=>x.id===c.id?{...x,name:e.target.value}:x)}))}/><input value={c.nickname||''} placeholder="Smeknamn" onChange={e=>updateFamily(f=>({...f, children:f.children.map(x=>x.id===c.id?{...x,nickname:e.target.value}:x)}))}/><input className="tiny" value={c.emoji} onChange={e=>updateFamily(f=>({...f, children:f.children.map(x=>x.id===c.id?{...x,emoji:e.target.value}:x)}))}/><button className="danger" onClick={()=>updateFamily(f=>({...f, children:f.children.filter(x=>x.id!==c.id)}))}><Trash2 size={15}/></button></div>)}<button onClick={()=>updateFamily(f=>({...f, children:[...f.children,{id:uid(),name:'Nytt barn',nickname:'',emoji:'⭐',color:'#6ee7ff',xp:0,level:1,streak:0,bestStreak:0,leaguePoints:0,achievements:[]}]}))}><Plus size={15}/> Lägg till barn</button></div> }
function DayPicker({ value=[], onChange }){ return <div className="days-picker">{daysAll.map(d=><button type="button" key={d} className={value.includes(d)?'active':''} onClick={()=>onChange(value.includes(d)?value.filter(x=>x!==d):[...value,d])}>{d}</button>)}</div> }
function TasksEditor({ family, updateFamily }){ return <div className="admin-list">{family.tasks.map(t=><div className="edit-card" key={t.id}><div className="edit-grid"><label>ID<input value={t.id} onChange={e=>updateFamily(f=>({...f,tasks:f.tasks.map(x=>x.id===t.id?{...x,id:e.target.value}:x)}))}/></label><label>Titel<input value={t.title} onChange={e=>updateFamily(f=>({...f,tasks:f.tasks.map(x=>x.id===t.id?{...x,title:e.target.value}:x)}))}/></label><label>XP<input type="number" value={t.xp} onChange={e=>updateFamily(f=>({...f,tasks:f.tasks.map(x=>x.id===t.id?{...x,xp:+e.target.value}:x)}))}/></label><label>LP<input type="number" value={t.league||10} onChange={e=>updateFamily(f=>({...f,tasks:f.tasks.map(x=>x.id===t.id?{...x,league:+e.target.value}:x)}))}/></label><label>Svårighet<select value={t.difficulty||'normal'} onChange={e=>updateFamily(f=>({...f,tasks:f.tasks.map(x=>x.id===t.id?{...x,difficulty:e.target.value}:x)}))}><option value="easy">Lätt</option><option value="normal">Normal</option><option value="hard">Svår</option><option value="bonus">Bonus</option></select></label></div><DayPicker value={t.days} onChange={days=>updateFamily(f=>({...f,tasks:f.tasks.map(x=>x.id===t.id?{...x,days}:x)}))}/><div className="check-row"><label><input type="checkbox" checked={!!t.approval} onChange={e=>updateFamily(f=>({...f,tasks:f.tasks.map(x=>x.id===t.id?{...x,approval:e.target.checked}:x)}))}/> Kräver godkännande</label><label><input type="checkbox" checked={!!t.requiredForRewards} onChange={e=>updateFamily(f=>({...f,tasks:f.tasks.map(x=>x.id===t.id?{...x,requiredForRewards:e.target.checked}:x)}))}/> Krävs före belöning</label><button className="danger" onClick={()=>updateFamily(f=>({...f,tasks:f.tasks.filter(x=>x.id!==t.id)}))}>Ta bort</button></div></div>)}<button onClick={()=>updateFamily(f=>({...f,tasks:[...f.tasks,{id:`uppdrag-${uid()}`,title:'Nytt uppdrag',xp:10,league:10,difficulty:'normal',days:daysAll,approval:false,requiredForRewards:false}]}))}><Plus size={15}/> Lägg till uppdrag</button></div> }
function RewardsEditor({ family, updateFamily }){ return <div className="admin-list">{family.rewards.map(r=><div className="edit-card" key={r.id}><div className="edit-grid"><label>ID<input value={r.id} onChange={e=>updateFamily(f=>({...f,rewards:f.rewards.map(x=>x.id===r.id?{...x,id:e.target.value}:x)}))}/></label><label>Titel<input value={r.title} onChange={e=>updateFamily(f=>({...f,rewards:f.rewards.map(x=>x.id===r.id?{...x,title:e.target.value}:x)}))}/></label><label>Kostnad<input type="number" value={r.cost} onChange={e=>updateFamily(f=>({...f,rewards:f.rewards.map(x=>x.id===r.id?{...x,cost:+e.target.value}:x)}))}/></label><label>Minuter<input type="number" value={r.minutes||0} onChange={e=>updateFamily(f=>({...f,rewards:f.rewards.map(x=>x.id===r.id?{...x,minutes:+e.target.value}:x)}))}/></label><label>Typ<select value={r.type||'normal'} onChange={e=>updateFamily(f=>({...f,rewards:f.rewards.map(x=>x.id===r.id?{...x,type:e.target.value}:x)}))}><option value="screen">Skärm</option><option value="family">Familj</option><option value="normal">Normal</option></select></label></div><DayPicker value={r.days} onChange={days=>updateFamily(f=>({...f,rewards:f.rewards.map(x=>x.id===r.id?{...x,days}:x)}))}/><label>Kräver uppdrag <select onChange={e=>e.target.value && updateFamily(f=>({...f,rewards:f.rewards.map(x=>x.id===r.id?{...x,requiresTasks:[...(x.requiresTasks||[]),e.target.value]}:x)}))}><option value="">Välj uppdrags-ID</option>{family.tasks.map(t=><option value={t.id} key={t.id}>{t.id} - {t.title}</option>)}</select></label><p className="chips">{(r.requiresTasks||[]).map(id=><button key={id} onClick={()=>updateFamily(f=>({...f,rewards:f.rewards.map(x=>x.id===r.id?{...x,requiresTasks:x.requiresTasks.filter(y=>y!==id)}:x)}))}>{id} ×</button>)}</p><button className="danger" onClick={()=>updateFamily(f=>({...f,rewards:f.rewards.filter(x=>x.id!==r.id)}))}>Ta bort</button></div>)}<button onClick={()=>updateFamily(f=>({...f,rewards:[...f.rewards,{id:`beloning-${uid()}`,title:'Ny belöning',cost:50,minutes:0,days:daysAll,requiresTasks:[],type:'normal'}]}))}><Plus size={15}/> Lägg till belöning</button></div> }
function RulesEditor({ family, updateFamily }){ const r=family.rules; const set=(k,v)=>updateFamily(f=>({...f,rules:{...f.rules,[k]:v}})); return <div className="admin-list form-card"><label><input type="checkbox" checked={!!r.requireToothbrushBeforeRewards} onChange={e=>set('requireToothbrushBeforeRewards',e.target.checked)}/> Inga belöningar innan tandborstning</label><label><input type="checkbox" checked={!!r.requireHomeworkBeforeTv} onChange={e=>set('requireHomeworkBeforeTv',e.target.checked)}/> TV/skärm endast efter läxor</label><label><input type="checkbox" checked={!!r.weekendBonus} onChange={e=>set('weekendBonus',e.target.checked)}/> Bonus-XP på helgen</label><label>Helgbonus % <input type="number" value={r.weekendBonusPercent||0} onChange={e=>set('weekendBonusPercent',+e.target.value)}/></label><label>Max skärmtid per dag <input type="number" value={r.maxScreenMinutesPerDay||0} onChange={e=>set('maxScreenMinutesPerDay',+e.target.value)}/></label><p className="hint">Olika regler per barn är förberett i datamodellen och kan byggas ut mer detaljerat senare.</p></div> }
function LeagueEditor({ family, updateFamily }){ return <div className="admin-list"><p>Familjekod att dela med kompisar: <b>{family.code}</b></p>{(family.friendLeague||[]).map(fr=><div className="edit-row" key={fr.id}><input value={fr.avatar} onChange={e=>updateFamily(f=>({...f,friendLeague:f.friendLeague.map(x=>x.id===fr.id?{...x,avatar:e.target.value}:x)}))}/><input value={fr.name} onChange={e=>updateFamily(f=>({...f,friendLeague:f.friendLeague.map(x=>x.id===fr.id?{...x,name:e.target.value}:x)}))}/><input type="number" value={fr.leaguePoints||0} onChange={e=>updateFamily(f=>({...f,friendLeague:f.friendLeague.map(x=>x.id===fr.id?{...x,leaguePoints:+e.target.value}:x)}))}/><button className="danger" onClick={()=>updateFamily(f=>({...f,friendLeague:f.friendLeague.filter(x=>x.id!==fr.id)}))}><Trash2 size={15}/></button></div>)}<button onClick={()=>updateFamily(f=>({...f,friendLeague:[...(f.friendLeague||[]),{id:uid(),name:'Ny kompis',avatar:'🙂',leaguePoints:0,streak:0}]}))}><Plus size={15}/> Lägg till kompis manuellt</button></div> }
function SettingsEditor({ family, updateFamily }){ return <div className="admin-list form-card"><label>Familjenamn <input value={family.name||''} onChange={e=>updateFamily(f=>({...f,name:e.target.value}))}/></label><label>Tema <select value={family.theme||'nintendo'} onChange={e=>updateFamily(f=>({...f,theme:e.target.value}))}><option value="nintendo">Nintendo/spel</option><option value="clean">Stilrent</option></select></label><label>Säsongsnamn <input value={family.season?.name||''} onChange={e=>updateFamily(f=>({...f,season:{...f.season,name:e.target.value}}))}/></label><label><input type="checkbox" checked={!!family.notifications?.parentApprovals} onChange={e=>updateFamily(f=>({...f,notifications:{...f.notifications,parentApprovals:e.target.checked}}))}/> Notis vid godkännande</label><label><input type="checkbox" checked={!!family.notifications?.rewardPurchases} onChange={e=>updateFamily(f=>({...f,notifications:{...f.notifications,rewardPurchases:e.target.checked}}))}/> Notis vid köp av belöning</label></div> }
function Stats({family}){ const days=[...Array(7)].map((_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);return d.toISOString().slice(0,10)}); const best=[...family.children].sort((a,b)=>(b.bestStreak||0)-(a.bestStreak||0))[0]; const most=[...family.children].sort((a,b)=>(b.leaguePoints||0)-(a.leaguePoints||0))[0]; return <div className="stats-grid"><div className="stat-card"><b><Flame/> Bästa streak</b><p>{best?.emoji} {best?.name}: {best?.bestStreak||0} dagar</p></div><div className="stat-card"><b><Trophy/> Mest LP</b><p>{most?.emoji} {most?.name}: {most?.leaguePoints||0} LP</p></div><div className="stat-card wide-stat"><b><BarChart3/> Chores heatmap</b><div className="heatmap">{days.map(d=>{const n=family.history.filter(h=>h.date===d && (h.type||'').includes('task')).length;return <span key={d} title={`${d}: ${n}`} className={n>4?'hot':n>1?'warm':''}><small>{d.slice(5)}</small><b>{n}</b></span>})}</div></div><div className="stat-card wide-stat"><b>Senaste händelser</b>{family.history.slice(0,8).map(h=><p key={h.id}>{h.date} · {h.title} · {h.xp} XP</p>)}</div></div> }

export default function App(){
  const [user,setUser] = useState(null)
  const [family,setFamily] = useState(null)
  const [loading,setLoading] = useState(true)
  useEffect(()=>{ if(!auth){ setLoading(false); setFamily(JSON.parse(localStorage.getItem('herrstromxp-family')||'null') || starterFamily('local','Lokal användare')); return } return onAuthStateChanged(auth, async u=>{ setUser(u); setLoading(false); if(u){ const ref=doc(db,'users',u.uid); const snap=await getDoc(ref); if(snap.exists()){ const famId=snap.data().familyId; return onSnapshot(doc(db,'families',famId), fs=>{ if(fs.exists()) setFamily(fs.data()) }) } else setFamily(null) } else setFamily(null) }) }, [])
  const updateFamily = async updater => { const next = typeof updater === 'function' ? updater(family) : updater; setFamily(next); if(user && db) await setDoc(doc(db,'families',next.id), next, { merge:true }); else localStorage.setItem('herrstromxp-family', JSON.stringify(next)) }
  const login = () => auth ? signInWithPopup(auth, googleProvider) : alert('Firebase saknas. Lägg in GitHub secrets först.')
  const createCloud = async (name, theme) => { const fam = {...starterFamily(user.uid, user.displayName), name, theme, onboardingDone:true}; await setDoc(doc(db,'families',fam.id), fam); await setDoc(doc(db,'users',user.uid), { familyId:fam.id, createdAt:serverTimestamp() }); setFamily(fam) }
  if (loading) return <div className="app"><div className="panel">Laddar...</div></div>
  if (!user && firebaseReady) return <Landing onLogin={login}/>
  if (user && !family) return <div className="app theme-nintendo"><Top user={user} family={family} onLogin={login} onLogout={()=>auth&&signOut(auth)} updateFamily={()=>{}}/><Onboarding user={user} onCreateCloud={createCloud}/></div>
  if (!family) return <Landing onLogin={login}/>
  return <div className={`app theme-${family.theme || 'nintendo'}`}><Top user={user} family={family} onLogin={login} onLogout={()=>auth&&signOut(auth)} updateFamily={updateFamily}/><div className="layout"><main>{family.children.map(c=><ChildPanel key={c.id} family={family} child={c} updateFamily={updateFamily}/>)}</main><aside><LeagueCompact family={family}/><LeagueFull family={family}/><Admin family={family} updateFamily={updateFamily}/></aside></div></div>
}
