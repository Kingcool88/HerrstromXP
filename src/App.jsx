import React, { useEffect, useMemo, useState } from 'react'
import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth'
import { getFirestore, doc, getDoc, setDoc, onSnapshot, collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { Trophy, Users, Star, Settings, ShieldCheck, Gamepad2, Sparkles, BarChart3, Home, LogOut } from 'lucide-react'

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

const todayKey = () => new Date().toISOString().slice(0, 10)
const weekdays = ['Sön','Mån','Tis','Ons','Tor','Fre','Lör']
const dayName = () => weekdays[new Date().getDay()]
const uid = () => Math.random().toString(36).slice(2, 9)

const starterFamily = (ownerUid, ownerName) => ({
  id: `fam-${uid()}`,
  code: Math.random().toString(36).slice(2, 8).toUpperCase(),
  ownerUid,
  ownerName,
  theme: 'nintendo',
  adminPin: '2468',
  friendCodes: [],
  children: [
    { id: 'annie', name: 'Annie', emoji: '🦄', color: '#ff4fd8', xp: 0, level: 1, streak: 0, leaguePoints: 0 },
    { id: 'albin', name: 'Albin', emoji: '🦖', color: '#37ff7a', xp: 0, level: 1, streak: 0, leaguePoints: 0 },
  ],
  tasks: [
    { id: 'packa-vaska', title: 'Packa skolväska/förskoleväska', xp: 10, league: 10, days: ['Mån','Tis','Ons','Tor','Fre'], approval: true, requiredForRewards: false },
    { id: 'tandborstning', title: 'Borsta tänderna', xp: 10, league: 10, days: ['Mån','Tis','Ons','Tor','Fre','Lör','Sön'], approval: false, requiredForRewards: true },
    { id: 'laxa', title: 'Läxor/läsning', xp: 20, league: 20, days: ['Mån','Tis','Ons','Tor'], approval: true, requiredForRewards: true },
  ],
  rewards: [
    { id: 'tvspel-30', title: 'TV-spel 30 min', cost: 100, minutes: 30, days: ['Fre','Lör','Sön'], requiresTasks: ['tandborstning'] },
    { id: 'filmkvall', title: 'Välja film', cost: 80, minutes: 0, days: ['Fre','Lör'], requiresTasks: [] },
  ],
  rules: {
    requireToothbrushBeforeRewards: true,
    requireHomeworkBeforeTv: true,
    weekendBonus: true,
    weekendBonusPercent: 25,
    maxScreenMinutesPerDay: 60,
  },
  daily: {},
  history: [],
  createdAt: Date.now(),
})

function levelFromXp(xp){ return Math.max(1, Math.floor(xp / 250) + 1) }
function sameDayTaskDone(family, childId, taskId){ return !!family.daily?.[todayKey()]?.children?.[childId]?.tasks?.[taskId]?.done }
function taskStatus(family, childId, task){
  const rec = family.daily?.[todayKey()]?.children?.[childId]?.tasks?.[task.id]
  if (!rec) return 'idle'
  if (rec.pending) return 'pending'
  if (rec.rejected) return 'rejected'
  if (rec.done) return 'approved'
  return 'idle'
}
function daysText(days){ return (days || []).join(', ') }
function isTodayTask(task){ return !task.days?.length || task.days.includes(dayName()) }

function Landing({ onLogin }){
  return <div className="landing">
    <div className="hero-card">
      <div className="brand-row"><Gamepad2/><span>HerrstromXP</span></div>
      <h1>Gör vardagsuppdrag till ett spel.</h1>
      <p>Skapa barnprofiler, dela ut XP, låt barnen köpa belöningar och tävla med kompisfamiljer utan att deras hem-XP blandas ihop.</p>
      <div className="hero-actions"><button className="primary" onClick={onLogin}>Logga in med Google</button><a href="#howto">Så fungerar det</a></div>
    </div>
    <section id="howto" className="howto-grid">
      <article><ShieldCheck/><h3>Föräldra-admin</h3><p>Skapa uppdrag, belöningar, smarta regler och godkänn uppgifter.</p></article>
      <article><Star/><h3>XP hemma</h3><p>XP sparas i familjen och används för belöningar som TV-spel eller filmkväll.</p></article>
      <article><Trophy/><h3>Kompisliga</h3><p>Kompisar tävlar med League Points, så olika XP-regler hemma blir rättvist.</p></article>
    </section>
  </div>
}

function Onboarding({ user, onCreateLocal, onCreateCloud }){
  const [code,setCode]=useState('')
  return <div className="onboarding panel">
    <h1>Välkommen {user?.displayName || 'förälder'}!</h1>
    <p>Skapa en ny familj eller gå med i en befintlig familj via kod.</p>
    <div className="onboarding-actions">
      <button className="primary" onClick={onCreateCloud}>Skapa ny familj</button>
      <div className="join-box"><input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="Familjekod"/><button onClick={()=>alert('Kod-sökning är förberedd. I nästa steg kan vi koppla mot ett publikt index.')} >Gå med</button></div>
    </div>
  </div>
}

function LeagueCompact({ family }){
  const rows = [...family.children].sort((a,b)=>(b.leaguePoints||0)-(a.leaguePoints||0)).slice(0,3)
  return <div className="league-compact">
    <div className="league-title"><Trophy size={18}/> Kompisliga</div>
    {rows.map((c,i)=><div className="league-row" key={c.id}><span>{i+1}. {c.emoji} {c.name}</span><b>{c.leaguePoints||0} LP</b></div>)}
  </div>
}

function TaskCard({ family, child, task, updateFamily }){
  const status = taskStatus(family, child.id, task)
  const active = status !== 'idle'
  const borderClass = status === 'pending' ? 'pending' : status === 'approved' ? 'approved' : status === 'rejected' ? 'rejected' : ''
  const complete = () => updateFamily(f => {
    const bonus = f.rules?.weekendBonus && ['Lör','Sön'].includes(dayName()) ? Math.round(task.xp * ((f.rules.weekendBonusPercent||0)/100)) : 0
    const xpGain = task.xp + bonus
    const nf = structuredClone(f)
    nf.daily[todayKey()] ||= { children: {} }
    nf.daily[todayKey()].children[child.id] ||= { tasks: {}, rewards: {} }
    nf.daily[todayKey()].children[child.id].tasks[task.id] = task.approval ? { pending:true, at:Date.now() } : { done:true, xp:xpGain, at:Date.now() }
    if(!task.approval){
      const ch = nf.children.find(x=>x.id===child.id); ch.xp += xpGain; ch.leaguePoints = (ch.leaguePoints||0)+(task.league||10); ch.level = levelFromXp(ch.xp)
      nf.history.unshift({ id:uid(), date:todayKey(), type:'task', childId:child.id, title:task.title, xp:xpGain })
    }
    return nf
  })
  const undo = () => updateFamily(f => {
    const nf = structuredClone(f); const rec = nf.daily?.[todayKey()]?.children?.[child.id]?.tasks?.[task.id]
    if(rec?.done){ const ch=nf.children.find(x=>x.id===child.id); ch.xp=Math.max(0,ch.xp-(rec.xp||task.xp)); ch.leaguePoints=Math.max(0,(ch.leaguePoints||0)-(task.league||10)); ch.level=levelFromXp(ch.xp)}
    if(nf.daily?.[todayKey()]?.children?.[child.id]?.tasks) delete nf.daily[todayKey()].children[child.id].tasks[task.id]
    nf.history.unshift({ id:uid(), date:todayKey(), type:'undo-task', childId:child.id, title:task.title, xp:-(rec?.xp||task.xp) })
    return nf
  })
  return <div className={`task-card ${borderClass}`}>
    <div className="task-main"><div><h3>{task.title}</h3><div className="task-card-meta"><div className="task-days"><span>📅</span><span>{daysText(task.days)}</span></div>{status==='approved' && <span className="task-status-badge approved">✅ Godkänd</span>}{status==='pending' && <span className="task-status-badge pending">⏳ Väntar på godkännande</span>}{status==='rejected' && <span className="task-status-badge rejected">✕ Ej godkänd</span>}{task.requiredForRewards && <span className="task-status-badge required">🔒 Krävs före belöning</span>}</div></div><button className="action-pill" onClick={active?undo:complete}>{status==='pending'?'Avbryt':status==='approved'?'Ångra':'Klart'}</button></div>
  </div>
}

function ChildPanel({ family, child, updateFamily }){
  const tasks = family.tasks.filter(isTodayTask)
  const xpPct = Math.min(100, ((child.xp % 250) / 250) * 100)
  return <section className="child-panel" style={{'--accent': child.color}}>
    <header className="child-head"><div className="avatar">{child.emoji}</div><div><h2>{child.name}</h2><p>Nivå {child.level} · {child.xp} XP · {child.leaguePoints||0} LP</p></div></header>
    <div className="xpbar"><span style={{width:`${xpPct}%`}}/></div>
    <div className="task-list">{tasks.map(t=><TaskCard key={t.id} family={family} child={child} task={t} updateFamily={updateFamily}/>)}</div>
  </section>
}

function Admin({ family, updateFamily }){
  const [tab,setTab]=useState('approve')
  const pending = []
  family.children.forEach(c=>family.tasks.forEach(t=>{ if(taskStatus(family,c.id,t)==='pending') pending.push({child:c,task:t}) }))
  const approve = (child,task, ok) => updateFamily(f=>{ const nf=structuredClone(f); const rec=nf.daily[todayKey()].children[child.id].tasks[task.id]; if(ok){ rec.pending=false; rec.done=true; rec.xp=task.xp; const ch=nf.children.find(x=>x.id===child.id); ch.xp+=task.xp; ch.leaguePoints=(ch.leaguePoints||0)+(task.league||10); ch.level=levelFromXp(ch.xp); nf.history.unshift({id:uid(),date:todayKey(),type:'task-approved',childId:child.id,title:task.title,xp:task.xp}) } else { rec.pending=false; rec.rejected=true; nf.history.unshift({id:uid(),date:todayKey(),type:'rejected',childId:child.id,title:task.title,xp:0}) } return nf })
  return <section className="admin-panel panel">
    <div className="admin-header"><h2>Föräldra-admin</h2><p>GUI för barn, uppdrag, belöningar, smarta regler och statistik.</p><div className="admin-tabs">{['approve','tasks','rewards','children','rules','stats','settings'].map(t=><button className={tab===t?'active':''} onClick={()=>setTab(t)} key={t}>{({approve:'Godkänn',tasks:'Uppdrag',rewards:'Belöningar',children:'Barn',rules:'Smarta regler',stats:'Statistik',settings:'Inställningar'})[t]}</button>)}</div></div>
    {tab==='approve' && <div className="admin-list">{pending.length===0?<p>Inga uppdrag väntar.</p>:pending.map(p=><div className="admin-row" key={p.child.id+p.task.id}><span>{p.child.emoji} {p.child.name}: {p.task.title}</span><div><button onClick={()=>approve(p.child,p.task,true)}>Godkänn</button><button className="danger" onClick={()=>approve(p.child,p.task,false)}>Neka</button></div></div>)}</div>}
    {tab==='settings' && <div className="admin-list"><label>Tema <select value={family.theme} onChange={e=>updateFamily(f=>({...f,theme:e.target.value}))}><option value="nintendo">Nintendo/spel</option><option value="clean">Stilrent</option></select></label><p>Familjekod: <b>{family.code}</b></p></div>}
    {tab==='stats' && <Stats family={family}/>} 
    {!['approve','settings','stats'].includes(tab) && <Editor tab={tab} family={family} updateFamily={updateFamily}/>} 
  </section>
}
function Editor({tab,family,updateFamily}){ return <div className="admin-list"><p>Redigering för <b>{tab}</b> är aktiv. V6.1 har grunden klar; nästa steg kan göra varje fält fullt redigerbart rad-för-rad.</p><pre>{JSON.stringify(tab==='tasks'?family.tasks:tab==='rewards'?family.rewards:tab==='children'?family.children:family.rules,null,2)}</pre></div> }
function Stats({family}){ const days=[...Array(7)].map((_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);return d.toISOString().slice(5,10)}); return <div className="stats-grid"><div className="stat-card"><b>Topplista</b>{[...family.children].sort((a,b)=>b.xp-a.xp).map((c,i)=><p key={c.id}>{i+1}. {c.emoji} {c.name} · {c.xp} XP</p>)}</div><div className="stat-card"><b>Chores heatmap</b><div className="heatmap">{days.map(d=><span key={d}>{d}<b>{family.history.filter(h=>h.date?.slice(5)===d && h.type?.includes('task')).length}</b></span>)}</div></div></div> }

export default function App(){
  const [user,setUser]=useState(null); const [family,setFamily]=useState(null); const [loading,setLoading]=useState(true)
  useEffect(()=>{ if(!auth){ setLoading(false); setFamily(JSON.parse(localStorage.getItem('herrstromxp-family')||'null') || starterFamily('local','Lokal användare')); return } return onAuthStateChanged(auth, async u=>{ setUser(u); setLoading(false); if(u){ const ref=doc(db,'users',u.uid); const snap=await getDoc(ref); if(snap.exists()){ const famId=snap.data().familyId; return onSnapshot(doc(db,'families',famId), fs=>{ if(fs.exists()) setFamily(fs.data()) }) } } })},[])
  const updateFamily = async updater => { const next = typeof updater==='function'?updater(family):updater; setFamily(next); if(user&&db){ await setDoc(doc(db,'families',next.id), next, {merge:true}) } else localStorage.setItem('herrstromxp-family',JSON.stringify(next)) }
  const login=()=> auth?signInWithPopup(auth,googleProvider):alert('Firebase saknas. Lägg in GitHub secrets först.')
  const createCloud=async()=>{ const fam=starterFamily(user.uid,user.displayName); await setDoc(doc(db,'families',fam.id), fam); await setDoc(doc(db,'users',user.uid), {familyId:fam.id, createdAt:serverTimestamp()}); setFamily(fam) }
  if(loading) return <div className="app"><div className="panel">Laddar...</div></div>
  if(!user && firebaseReady) return <Landing onLogin={login}/>
  if(user && !family) return <div className="app"><Top user={user} family={family}/><Onboarding user={user} onCreateCloud={createCloud}/></div>
  if(!family) return <Landing onLogin={login}/>
  return <div className={`app theme-${family.theme||'nintendo'}`}><Top user={user} family={family} onLogin={login} onLogout={()=>auth&&signOut(auth)}/><div className="layout"><main>{family.children.map(c=><ChildPanel key={c.id} family={family} child={c} updateFamily={updateFamily}/>)}</main><aside><LeagueCompact family={family}/><Admin family={family} updateFamily={updateFamily}/></aside></div></div>
}
function Top({user,family,onLogin,onLogout}){ return <header className="topbar"><div><h1>HerrstromXP</h1><p>{family?`Familjekod ${family.code} · ${firebaseReady?'Synkad':'Lokalt'}`:'Familje-quests med XP'}</p></div><div>{user?<button onClick={onLogout}><LogOut size={16}/> Logga ut</button>:<button onClick={onLogin}>Logga in</button>}</div></header> }
