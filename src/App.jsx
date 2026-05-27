import { useEffect, useMemo, useState } from 'react'
import { Bell, BarChart3, CheckCircle2, Clock, Flame, Gift, Lock, Plus, Save, Settings, ShieldCheck, Sparkles, Star, Trash2, Trophy, UserRoundPlus, Wifi, WifiOff, X } from 'lucide-react'
import { createStore, requestPushPermission, todayKey } from './lib/store.js'

const dayMap = ['sun','mon','tue','wed','thu','fri','sat']
const dayNames = { mon:'Mån', tue:'Tis', wed:'Ons', thu:'Tor', fri:'Fre', sat:'Lör', sun:'Sön' }
const allDays = ['mon','tue','wed','thu','fri','sat','sun']
const today = () => dayMap[new Date().getDay()]
const isWeekend = () => ['sat','sun'].includes(today())
const uid = () => Math.random().toString(36).slice(2, 10)
const clone = (obj) => (typeof structuredClone === 'function' ? structuredClone(obj) : JSON.parse(JSON.stringify(obj)))
const blankTask = (childIds=[]) => ({ id: `task-${uid()}`, title: '', xp: 10, days: [...allDays], childIds, requiresApproval: true, requiredBeforeRewards: false, category: 'Hem' })
const blankReward = (childIds=[]) => ({ id: `reward-${uid()}`, title: '', cost: 100, emoji: '🎁', days: ['fri','sat','sun'], childIds, requiresParentConfirm: false })
const blankChild = () => ({ id: `barn-${uid()}`, name: '', emoji: '🙂', color: '#22c55e', levelEmoji: '✨' })

export default function App() {
  const [data, setData] = useState(null)
  const [store, setStore] = useState(null)
  const [selectedChild, setSelectedChild] = useState(null)
  const [admin, setAdmin] = useState(false)
  const [pin, setPin] = useState('')
  const [tab, setTab] = useState('tasks')
  const [adminTab, setAdminTab] = useState('approve')
  const [message, setMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [showSync, setShowSync] = useState(false)

  useEffect(() => {
    let cleanup = () => {}
    createStore((next) => {
      setData(next)
      setSelectedChild(prev => prev || next.family.children[0]?.id)
    }).then(s => { setStore(s); cleanup = s.unsubscribe })
    return () => cleanup()
  }, [])

  const save = async (next) => {
    setSaving(true)
    setData(next)
    try { await store?.save(next) }
    finally { setSaving(false) }
  }

  const child = data?.family.children.find(c => c.id === selectedChild)
  const xp = data?.progress.xpBank?.[selectedChild] || 0
  const todaysTasks = useMemo(() => !data || !selectedChild ? [] : data.family.tasks.filter(t => t.days.includes(today()) && t.childIds.includes(selectedChild)), [data, selectedChild])
  const todaysRewards = useMemo(() => !data || !selectedChild ? [] : data.family.rewards.filter(r => r.days.includes(today()) && r.childIds.includes(selectedChild)), [data, selectedChild])
  const stats = useMemo(() => data ? makeStats(data, selectedChild) : null, [data, selectedChild])

  if (!data) return <Splash />

  const rules = data.family.rules || {}
  const taskState = (taskId, childId = selectedChild) => {
    const key = `${childId}:${taskId}`
    if (data.progress.completed[key]) return 'done'
    if (data.progress.pending[key]) return 'pending'
    return 'open'
  }

  const xpForTask = (task) => Math.round(Number(task.xp || 0) * (rules.weekendBonus && isWeekend() ? 1 + Number(rules.weekendBonusPercent || 0) / 100 : 1))
  const requiredDone = todaysTasks.filter(t => t.requiredBeforeRewards).every(t => taskState(t.id) === 'done')
  const completedCount = todaysTasks.filter(t => taskState(t.id) === 'done').length
  const rewardsBlocked = (rules.blockRewardsUntilRequiredDone && !requiredDone) || completedCount < Number(rules.minimumTasksBeforeRewards || 0)

  const awardAchievements = (next, childId) => {
    const s = makeStats(next, childId)
    for (const a of next.family.achievements || []) {
      const key = `${childId}:${a.id}`
      if (next.progress.achievements[key]) continue
      const value = a.rule === 'tasksCompleted' ? s.tasksTotal : a.rule === 'rewardsBought' ? s.rewardsTotal : a.rule === 'streak' ? s.streak : 0
      if (value >= Number(a.target || 0)) {
        next.progress.achievements[key] = { childId, achievementId: a.id, at: new Date().toISOString(), bonusXp: a.bonusXp || 0 }
        next.progress.xpBank[childId] = (next.progress.xpBank[childId] || 0) + Number(a.bonusXp || 0)
        next.progress.history.unshift({ id: uid(), date: todayKey(), childId, type: 'achievement', title: `${a.emoji} ${a.title}`, xp: a.bonusXp || 0 })
      }
    }
  }

  const maybeFullDayBonus = (next, childId) => {
    if (!rules.bonusAllDailyTasks) return
    const all = next.family.tasks.filter(t => t.days.includes(today()) && t.childIds.includes(childId))
    if (!all.length) return
    const allDone = all.every(t => next.progress.completed[`${childId}:${t.id}`])
    const bonusKey = `${childId}:daily-bonus:${todayKey()}`
    if (allDone && !next.progress.completed[bonusKey]) {
      next.progress.completed[bonusKey] = { childId, bonus: true, at: new Date().toISOString() }
      next.progress.xpBank[childId] = (next.progress.xpBank[childId] || 0) + Number(rules.allDailyTasksBonusXp || 0)
      next.progress.streaks[childId] = { count: (next.progress.streaks[childId]?.count || 0) + 1, lastFullDay: todayKey() }
      next.progress.history.unshift({ id: uid(), date: todayKey(), childId, type: 'daily-bonus', title: 'Alla dagens uppdrag klara', xp: rules.allDailyTasksBonusXp || 0 })
      const streak = next.progress.streaks[childId]?.count || 0
      if (rules.streaksEnabled && rules.streakBonusEveryDays && streak > 0 && streak % Number(rules.streakBonusEveryDays) === 0) {
        next.progress.xpBank[childId] += Number(rules.streakBonusXp || 0)
        next.progress.history.unshift({ id: uid(), date: todayKey(), childId, type: 'streak-bonus', title: `${streak} dagars streak`, xp: rules.streakBonusXp || 0 })
      }
    }
  }

  const completeTask = async (task) => {
    const key = `${selectedChild}:${task.id}`
    if (taskState(task.id) !== 'open') return
    const next = clone(data)
    const needsApproval = rules.requireParentApproval && task.requiresApproval && !admin
    if (needsApproval) {
      next.progress.pending[key] = { childId: selectedChild, taskId: task.id, at: new Date().toISOString(), notified: false }
      next.progress.history.unshift({ id: uid(), date: todayKey(), childId: selectedChild, type: 'pending', title: task.title })
      setMessage('Skickad för föräldragodkännande ✅')
      store?.notifyEvent?.({ type: 'task_pending', title: 'Uppdrag väntar', body: `${child?.name} vill få godkänt: ${task.title}`, childId: selectedChild, taskId: task.id })
    } else {
      const points = xpForTask(task)
      next.progress.completed[key] = { childId: selectedChild, taskId: task.id, xp: points, at: new Date().toISOString() }
      next.progress.xpBank[selectedChild] = (next.progress.xpBank[selectedChild] || 0) + points
      next.progress.history.unshift({ id: uid(), date: todayKey(), childId: selectedChild, type: 'task', title: task.title, xp: points })
      maybeFullDayBonus(next, selectedChild)
      awardAchievements(next, selectedChild)
      setMessage(`+${points} XP! ⭐`)
    }
    await save(next)
  }

  const approveTask = async (key) => {
    const p = data.progress.pending[key]
    const task = data.family.tasks.find(t => t.id === p?.taskId)
    if (!p || !task) return
    const next = clone(data)
    delete next.progress.pending[key]
    const points = xpForTask(task)
    next.progress.completed[key] = { childId: p.childId, taskId: p.taskId, xp: points, at: new Date().toISOString(), approved: true }
    next.progress.xpBank[p.childId] = (next.progress.xpBank[p.childId] || 0) + points
    next.progress.history.unshift({ id: uid(), date: todayKey(), childId: p.childId, type: 'approved', title: task.title, xp: points })
    maybeFullDayBonus(next, p.childId)
    awardAchievements(next, p.childId)
    setMessage('Godkänt och XP utdelat ⭐')
    await save(next)
  }

  const rejectTask = async (key) => {
    const p = data.progress.pending[key]
    const task = data.family.tasks.find(t => t.id === p?.taskId)
    const next = clone(data)
    delete next.progress.pending[key]
    next.progress.history.unshift({ id: uid(), date: todayKey(), childId: p?.childId, type: 'rejected', title: task?.title || 'Uppdrag' })
    setMessage('Nekat. Barnet kan försöka igen.')
    await save(next)
  }

  const buyReward = async (reward) => {
    const key = `${selectedChild}:${reward.id}`
    if (data.progress.purchased[key]) return
    if (rewardsBlocked) { setMessage('Belöningar är låsta tills dagens regler är uppfyllda 🔒'); return }
    if (xp < Number(reward.cost || 0)) { setMessage('Inte tillräckligt med XP ännu 🙂'); return }
    const next = clone(data)
    next.progress.xpBank[selectedChild] = xp - Number(reward.cost || 0)
    next.progress.purchased[key] = { childId: selectedChild, rewardId: reward.id, cost: reward.cost, at: new Date().toISOString(), needsParentConfirm: !!reward.requiresParentConfirm, confirmed: false }
    next.progress.history.unshift({ id: uid(), date: todayKey(), childId: selectedChild, type: 'reward', title: reward.title, cost: reward.cost })
    awardAchievements(next, selectedChild)
    setMessage(`${reward.title} köpt! 🎁`)
    store?.notifyEvent?.({ type: 'reward_bought', title: 'Belöning köpt', body: `${child?.name} köpte: ${reward.title} för ${reward.cost} XP`, childId: selectedChild, rewardId: reward.id })
    await save(next)
  }

  const login = () => {
    if (pin === data.family.parentPin) { setAdmin(true); setPin(''); setMessage('Föräldraläge aktivt 🔐') }
    else setMessage('Fel PIN')
  }

  const updateFamily = async (updater, success = 'Sparat ✅') => {
    const next = clone(data)
    updater(next.family, next.progress)
    await save(next)
    setMessage(success)
  }

  const pendingItems = Object.entries(data.progress.pending || {})

  return (
    <div className="app">
      <header className="hero">
        <div>
          <div className="eyebrow">{data.family.familyName} · {new Date().toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <h1>Barnens uppdrag</h1>
          <p>Samla XP, lås upp achievements och köp belöningar. XP sparas mellan dagar.</p>
        </div>
        <div className="topBadges">
          {saving && <span className="syncBadge"><Clock size={18}/> Sparar</span>}
          <button className={`syncBadge ${store?.mode === 'firebase' ? 'good' : 'warn'}`} onClick={() => setShowSync(!showSync)}>{store?.mode === 'firebase' ? <Wifi size={18}/> : <WifiOff size={18}/>} {store?.statusText || 'Startar'}</button>
        </div>
      </header>

      {showSync && <div className="infoBox"><b>Synkstatus:</b> {store?.diagnostics} {store?.mode === 'local' && <span> Lägg in Firebase-secrets och kör ny GitHub Actions-build för att få synk.</span>}</div>}
      {message && <div className="toast" onClick={() => setMessage('')}>{message}</div>}

      <section className="children">
        {data.family.children.map(c => <button key={c.id} className={`childCard ${selectedChild===c.id?'active':''}`} onClick={() => setSelectedChild(c.id)} style={{'--accent': c.color}}>
          <span className="avatar">{c.emoji}</span><span><b>{c.name}</b><small>{data.progress.xpBank[c.id] || 0} XP · nivå {level(data.progress.xpBank[c.id] || 0)}</small></span>
        </button>)}
      </section>

      <main className="grid">
        <section className="panel mainPanel">
          <div className="tabs">
            <button className={tab==='tasks'?'on':''} onClick={()=>setTab('tasks')}><CheckCircle2 size={18}/> Uppdrag</button>
            <button className={tab==='rewards'?'on':''} onClick={()=>setTab('rewards')}><Gift size={18}/> Belöningar</button>
            <button className={tab==='stats'?'on':''} onClick={()=>setTab('stats')}><BarChart3 size={18}/> Statistik</button>
          </div>

          <div className="childHeader" style={{'--accent': child?.color}}>
            <div className="bigAvatar">{child?.emoji}</div>
            <div><h2>{child?.name}</h2><p><Star size={16}/> {xp} XP · nivå {level(xp)} · <Flame size={16}/> {stats?.streak || 0} streak</p></div>
          </div>

          {tab === 'tasks' && <div className="cards">
            {todaysTasks.length === 0 && <Empty text="Inga uppdrag för idag." />}
            {todaysTasks.map(task => {
              const state = taskState(task.id)
              const points = xpForTask(task)
              return <button key={task.id} className={`task ${state}`} onClick={() => completeTask(task)}>
                <div><h3>{task.title}</h3><p>{task.category || 'Uppdrag'} · {task.days.map(d=>dayNames[d]).join(', ')} {task.requiresApproval && <span> · godkännande</span>} {task.requiredBeforeRewards && <span> · krävs före belöning</span>}</p></div>
                <strong>{state==='done'?'Klart':state==='pending'?'Väntar':`+${points} XP`}</strong>
              </button>
            })}
          </div>}

          {tab === 'rewards' && <div className="cards">
            {rewardsBlocked && <div className="lockBox"><Lock size={18}/> Belöningar är låsta tills dagens valbara regler är uppfyllda.</div>}
            {todaysRewards.length === 0 && <Empty text="Inga belöningar för idag." />}
            {todaysRewards.map(reward => {
              const key = `${selectedChild}:${reward.id}`
              const bought = data.progress.purchased[key]
              const locked = xp < Number(reward.cost || 0) || rewardsBlocked
              return <button key={reward.id} className={`reward ${bought?'bought':''} ${locked&&!bought?'locked':''}`} onClick={() => buyReward(reward)}>
                <span className="rewardEmoji">{reward.emoji}</span>
                <div><h3>{reward.title}</h3><p>{reward.days.map(d=>dayNames[d]).join(', ')} {reward.requiresParentConfirm && ' · säg till vuxen'}</p></div>
                <strong>{bought?'Köpt idag':locked?<><Lock size={15}/> {reward.cost} XP</>:`Köp ${reward.cost} XP`}</strong>
              </button>
            })}
          </div>}

          {tab === 'stats' && <StatsPanel data={data} selectedChild={selectedChild} />}
        </section>

        <aside className="panel sidePanel">
          <h2><Trophy size={22}/> Dagens status</h2>
          <Stat label="Uppdrag idag" value={`${completedCount}/${todaysTasks.length}`} />
          <Stat label="Väntar godkännande" value={pendingItems.length} />
          <Stat label="Belöningar köpta idag" value={Object.keys(data.progress.purchased || {}).filter(k=>k.startsWith(`${selectedChild}:`)).length} />
          <Stat label="Senaste reset" value={data.progress.lastResetFrom ? `${data.progress.lastResetFrom} → ${data.progress.date}` : data.progress.date} />

          <div className="adminBox">
            <h3><Settings size={18}/> Föräldraläge</h3>
            {!admin ? <div className="pinRow"><input placeholder="PIN" value={pin} onChange={e=>setPin(e.target.value)} type="password"/><button onClick={login}>Lås upp</button></div> : <><p className="ok"><ShieldCheck size={16}/> Aktivt</p><button className="secondary" onClick={()=>setAdmin(false)}>Lås</button></>}
          </div>
        </aside>
      </main>

      {admin && <AdminPanel data={data} updateFamily={updateFamily} approveTask={approveTask} rejectTask={rejectTask} pendingItems={pendingItems} adminTab={adminTab} setAdminTab={setAdminTab} store={store} setMessage={setMessage} />}
    </div>
  )
}

function AdminPanel({ data, updateFamily, approveTask, rejectTask, pendingItems, adminTab, setAdminTab, store, setMessage }) {
  const children = data.family.children
  const [draftChild, setDraftChild] = useState(blankChild())
  const [draftTask, setDraftTask] = useState(blankTask(children.map(c=>c.id)))
  const [draftReward, setDraftReward] = useState(blankReward(children.map(c=>c.id)))
  const savePush = async () => { const res = await requestPushPermission(store, data); setMessage(res.ok ? 'Pushnotiser aktiverade på denna enhet 🔔' : res.message) }
  return <section className="panel adminPanel">
    <div className="adminHeader"><div><h2>Föräldra-admin</h2><p>GUI för barn, uppdrag, belöningar, smarta regler och statistik.</p></div><button className="secondary" onClick={savePush}><Bell size={17}/> Aktivera push</button></div>
    <div className="tabs adminTabs">
      {['approve','tasks','rewards','children','rules','stats','settings'].map(t => <button key={t} className={adminTab===t?'on':''} onClick={()=>setAdminTab(t)}>{({approve:'Godkänn',tasks:'Uppdrag',rewards:'Belöningar',children:'Barn',rules:'Smarta regler',stats:'Statistik',settings:'Inställningar'})[t]}</button>)}
    </div>
    {adminTab === 'approve' && <ApproveTab data={data} pendingItems={pendingItems} approveTask={approveTask} rejectTask={rejectTask}/>}    
    {adminTab === 'tasks' && <TasksAdmin data={data} children={children} draftTask={draftTask} setDraftTask={setDraftTask} updateFamily={updateFamily}/>}    
    {adminTab === 'rewards' && <RewardsAdmin data={data} children={children} draftReward={draftReward} setDraftReward={setDraftReward} updateFamily={updateFamily}/>}    
    {adminTab === 'children' && <ChildrenAdmin data={data} draftChild={draftChild} setDraftChild={setDraftChild} updateFamily={updateFamily}/>}    
    {adminTab === 'rules' && <RulesAdmin data={data} updateFamily={updateFamily}/>}    
    {adminTab === 'stats' && <StatsPanel data={data} admin />}    
    {adminTab === 'settings' && <SettingsPanel data={data} updateFamily={updateFamily} store={store}/>}    
  </section>
}

function ApproveTab({ data, pendingItems, approveTask, rejectTask }) { return <div className="adminGridOne"><h3>Väntar på godkännande</h3>{pendingItems.length === 0 && <Empty text="Inget väntar på godkännande." />}{pendingItems.map(([key,p]) => { const c = data.family.children.find(x=>x.id===p.childId); const t = data.family.tasks.find(x=>x.id===p.taskId); return <div className="pending wide" key={key}><span><b>{c?.emoji} {c?.name}</b> vill få godkänt: {t?.title}</span><div><button onClick={()=>approveTask(key)}>Godkänn</button><button className="danger" onClick={()=>rejectTask(key)}>Neka</button></div></div> })}</div> }

function TasksAdmin({ data, children, draftTask, setDraftTask, updateFamily }) { return <div className="adminGrid"><EditorCard title="Lägg till uppdrag" icon={<Plus/>}><Text label="Titel" value={draftTask.title} onChange={v=>setDraftTask({...draftTask,title:v})}/><Text label="Kategori" value={draftTask.category} onChange={v=>setDraftTask({...draftTask,category:v})}/><NumberField label="XP" value={draftTask.xp} onChange={v=>setDraftTask({...draftTask,xp:v})}/><Toggle label="Kräver godkännande" checked={draftTask.requiresApproval} onChange={v=>setDraftTask({...draftTask,requiresApproval:v})}/><Toggle label="Krävs innan belöningar" checked={draftTask.requiredBeforeRewards} onChange={v=>setDraftTask({...draftTask,requiredBeforeRewards:v})}/><DayPicker value={draftTask.days} onChange={days=>setDraftTask({...draftTask,days})}/><ChildPicker children={children} value={draftTask.childIds} onChange={childIds=>setDraftTask({...draftTask,childIds})}/><button onClick={()=>{ if(!draftTask.title.trim()) return; updateFamily(f=>{ f.tasks.push({...draftTask, title: draftTask.title.trim(), xp:Number(draftTask.xp)||0})}, 'Uppdrag tillagt ✅'); setDraftTask(blankTask(children.map(c=>c.id))) }}><Save size={17}/> Lägg till</button></EditorCard><ListCard title="Befintliga uppdrag">{data.family.tasks.map(task => <TaskRow key={task.id} task={task} children={children} onSave={(updated)=>updateFamily(f=>{ const i=f.tasks.findIndex(x=>x.id===task.id); f.tasks[i]=updated }, 'Uppdrag uppdaterat ✅')} onDelete={()=>updateFamily(f=>{f.tasks=f.tasks.filter(x=>x.id!==task.id)}, 'Uppdrag raderat')}/>)}</ListCard></div> }

function RewardsAdmin({ data, children, draftReward, setDraftReward, updateFamily }) { return <div className="adminGrid"><EditorCard title="Lägg till belöning" icon={<Gift/>}><Text label="Titel" value={draftReward.title} onChange={v=>setDraftReward({...draftReward,title:v})}/><Text label="Emoji" value={draftReward.emoji} onChange={v=>setDraftReward({...draftReward,emoji:v})}/><NumberField label="Kostar XP" value={draftReward.cost} onChange={v=>setDraftReward({...draftReward,cost:v})}/><Toggle label="Föräldern behöver bekräfta efter köp" checked={draftReward.requiresParentConfirm} onChange={v=>setDraftReward({...draftReward,requiresParentConfirm:v})}/><DayPicker value={draftReward.days} onChange={days=>setDraftReward({...draftReward,days})}/><ChildPicker children={children} value={draftReward.childIds} onChange={childIds=>setDraftReward({...draftReward,childIds})}/><button onClick={()=>{ if(!draftReward.title.trim()) return; updateFamily(f=>{ f.rewards.push({...draftReward, title: draftReward.title.trim(), cost:Number(draftReward.cost)||0})}, 'Belöning tillagd ✅'); setDraftReward(blankReward(children.map(c=>c.id))) }}><Save size={17}/> Lägg till</button></EditorCard><ListCard title="Befintliga belöningar">{data.family.rewards.map(reward => <RewardRow key={reward.id} reward={reward} children={children} onSave={(updated)=>updateFamily(f=>{ const i=f.rewards.findIndex(x=>x.id===reward.id); f.rewards[i]=updated }, 'Belöning uppdaterad ✅')} onDelete={()=>updateFamily(f=>{f.rewards=f.rewards.filter(x=>x.id!==reward.id)}, 'Belöning raderad')}/>)}</ListCard></div> }

function ChildrenAdmin({ data, draftChild, setDraftChild, updateFamily }) { return <div className="adminGrid"><EditorCard title="Lägg till barn" icon={<UserRoundPlus/>}><Text label="Namn" value={draftChild.name} onChange={v=>setDraftChild({...draftChild,name:v})}/><Text label="Emoji/avatar" value={draftChild.emoji} onChange={v=>setDraftChild({...draftChild,emoji:v})}/><Text label="Nivå-emoji" value={draftChild.levelEmoji} onChange={v=>setDraftChild({...draftChild,levelEmoji:v})}/><Text label="Färg" value={draftChild.color} onChange={v=>setDraftChild({...draftChild,color:v})}/><button onClick={()=>{ if(!draftChild.name.trim()) return; updateFamily((f,p)=>{ f.children.push({...draftChild, name:draftChild.name.trim()}); p.xpBank[draftChild.id]=0 }, 'Barn tillagt ✅'); setDraftChild(blankChild()) }}><Save size={17}/> Lägg till</button></EditorCard><ListCard title="Barn och XP-bank">{data.family.children.map(c => <ChildRow key={c.id} child={c} xp={data.progress.xpBank[c.id]||0} onSave={(updated, xp)=>updateFamily((f,p)=>{ const i=f.children.findIndex(x=>x.id===c.id); f.children[i]=updated; p.xpBank[c.id]=Number(xp)||0 }, 'Barn uppdaterat ✅')} onDelete={()=>updateFamily((f,p)=>{ f.children=f.children.filter(x=>x.id!==c.id); delete p.xpBank[c.id] }, 'Barn raderat')}/>)}</ListCard></div> }

function RulesAdmin({ data, updateFamily }) {
  const [r, setR] = useState(data.family.rules)
  useEffect(()=>setR(data.family.rules), [data.family.rules])
  const set = (k,v) => setR(prev => ({...prev, [k]: v}))
  return <div className="adminGrid"><EditorCard title="Valbara smarta regler" icon={<Sparkles/>}>
    <Toggle label="Kräv föräldragodkännande för uppdrag som är markerade så" checked={r.requireParentApproval} onChange={v=>set('requireParentApproval',v)}/>
    <Toggle label="Lås belöningar tills obligatoriska uppdrag är klara" checked={r.blockRewardsUntilRequiredDone} onChange={v=>set('blockRewardsUntilRequiredDone',v)}/>
    <NumberField label="Minsta antal uppdrag före belöningar" value={r.minimumTasksBeforeRewards} onChange={v=>set('minimumTasksBeforeRewards',v)}/>
    <Toggle label="Bonus när alla dagens uppdrag är klara" checked={r.bonusAllDailyTasks} onChange={v=>set('bonusAllDailyTasks',v)}/>
    <NumberField label="Bonus-XP för alla uppdrag" value={r.allDailyTasksBonusXp} onChange={v=>set('allDailyTasksBonusXp',v)}/>
    <Toggle label="Streaks aktiverade" checked={r.streaksEnabled} onChange={v=>set('streaksEnabled',v)}/>
    <NumberField label="Streakbonus var X:e fulla dag" value={r.streakBonusEveryDays} onChange={v=>set('streakBonusEveryDays',v)}/>
    <NumberField label="Streakbonus XP" value={r.streakBonusXp} onChange={v=>set('streakBonusXp',v)}/>
    <Toggle label="Helgbonus aktiverad" checked={r.weekendBonus} onChange={v=>set('weekendBonus',v)}/>
    <NumberField label="Helgbonus procent" value={r.weekendBonusPercent} onChange={v=>set('weekendBonusPercent',v)}/>
    <Toggle label="Tillåt minus-XP" checked={r.allowNegativeXp} onChange={v=>set('allowNegativeXp',v)}/>
    <button onClick={()=>updateFamily(f=>{f.rules=r}, 'Smarta regler sparade ✅')}><Save size={17}/> Spara regler</button>
  </EditorCard><EditorCard title="Vad betyder midnatt-reset?" icon={<Clock/>}><p className="muted">Nuvarande reset sker när appen öppnas efter datumbyte: dagens klara uppdrag och köpta belöningar rensas, men XP-bank, achievements, historik och streaks sparas. Serverstyrd reset betyder att Firebase Cloud Function kör reset även om ingen öppnar appen vid midnatt.</p></EditorCard></div>
}

function SettingsPanel({ data, updateFamily, store }) { const [familyName, setFamilyName] = useState(data.family.familyName || 'HerrstromXP'); const [pin, setPin] = useState(data.family.parentPin || ''); return <div className="adminGrid"><EditorCard title="Familjeinställningar" icon={<Settings/>}><Text label="Namn på app/familj" value={familyName} onChange={setFamilyName}/><Text label="Föräldra-PIN" value={pin} onChange={setPin}/><button onClick={()=>updateFamily(f=>{f.familyName=familyName; f.parentPin=pin}, 'Inställningar sparade ✅')}><Save size={17}/> Spara</button></EditorCard><EditorCard title="Synkning och push" icon={<Bell/>}><p className="muted">Synkstatus: <b>{store?.statusText}</b>. {store?.diagnostics}</p><Stat label="Läge" value={store?.mode === 'firebase' ? 'Firebase aktivt' : 'Lokalt läge'} /><Stat label="Familj ID" value={data.family.familyId} /></EditorCard></div> }

function StatsPanel({ data, selectedChild, admin=false }) {
  const children = admin ? data.family.children : data.family.children.filter(c=>c.id===selectedChild)
  return <div className="statsGrid">{children.map(c => { const s = makeStats(data, c.id); return <div className="statCard" key={c.id} style={{'--accent': c.color}}><div className="statHero"><span>{c.emoji}</span><div><h3>{c.name}</h3><p>Nivå {level(data.progress.xpBank[c.id] || 0)}</p></div></div><Stat label="XP-bank" value={data.progress.xpBank[c.id] || 0}/><Stat label="Uppdrag totalt" value={s.tasksTotal}/><Stat label="Belöningar köpta" value={s.rewardsTotal}/><Stat label="Achievements" value={s.achievements}/><Stat label="Streak" value={`${s.streak} dagar`}/><div className="miniHistory">{data.progress.history.filter(h=>h.childId===c.id).slice(0,6).map(h=><div key={h.id}><span>{h.type}</span><b>{h.title}</b><em>{h.xp ? `+${h.xp} XP` : h.cost ? `-${h.cost} XP` : ''}</em></div>)}</div></div> })}</div>
}

function TaskRow({ task, children, onSave, onDelete }) { const [open, setOpen] = useState(false); const [d, setD] = useState(task); useEffect(()=>setD(task), [task.id]); return <div className="editRow"><div className="rowTop"><b>{task.title}</b><span>{task.xp} XP · {task.days.map(x=>dayNames[x]).join(', ')}</span><button className="mini" onClick={()=>setOpen(!open)}>{open?'Stäng':'Ändra'}</button></div>{open && <div className="rowEdit"><Text label="Titel" value={d.title} onChange={v=>setD({...d,title:v})}/><Text label="Kategori" value={d.category} onChange={v=>setD({...d,category:v})}/><NumberField label="XP" value={d.xp} onChange={v=>setD({...d,xp:v})}/><Toggle label="Kräver godkännande" checked={d.requiresApproval} onChange={v=>setD({...d,requiresApproval:v})}/><Toggle label="Krävs innan belöningar" checked={d.requiredBeforeRewards} onChange={v=>setD({...d,requiredBeforeRewards:v})}/><DayPicker value={d.days} onChange={days=>setD({...d,days})}/><ChildPicker children={children} value={d.childIds} onChange={childIds=>setD({...d,childIds})}/><div className="actions"><button onClick={()=>{onSave({...d, xp:Number(d.xp)||0}); setOpen(false)}}><Save size={16}/> Spara</button><button className="danger" onClick={onDelete}><Trash2 size={16}/> Radera</button></div></div>}</div> }
function RewardRow({ reward, children, onSave, onDelete }) { const [open, setOpen] = useState(false); const [d, setD] = useState(reward); useEffect(()=>setD(reward), [reward.id]); return <div className="editRow"><div className="rowTop"><b>{reward.emoji} {reward.title}</b><span>{reward.cost} XP · {reward.days.map(x=>dayNames[x]).join(', ')}</span><button className="mini" onClick={()=>setOpen(!open)}>{open?'Stäng':'Ändra'}</button></div>{open && <div className="rowEdit"><Text label="Titel" value={d.title} onChange={v=>setD({...d,title:v})}/><Text label="Emoji" value={d.emoji} onChange={v=>setD({...d,emoji:v})}/><NumberField label="Kostar XP" value={d.cost} onChange={v=>setD({...d,cost:v})}/><Toggle label="Förälder bekräftar köp" checked={d.requiresParentConfirm} onChange={v=>setD({...d,requiresParentConfirm:v})}/><DayPicker value={d.days} onChange={days=>setD({...d,days})}/><ChildPicker children={children} value={d.childIds} onChange={childIds=>setD({...d,childIds})}/><div className="actions"><button onClick={()=>{onSave({...d, cost:Number(d.cost)||0}); setOpen(false)}}><Save size={16}/> Spara</button><button className="danger" onClick={onDelete}><Trash2 size={16}/> Radera</button></div></div>}</div> }
function ChildRow({ child, xp, onSave, onDelete }) { const [d, setD] = useState(child); const [bank, setBank] = useState(xp); return <div className="editRow always"><div className="rowEdit compact"><Text label="Namn" value={d.name} onChange={v=>setD({...d,name:v})}/><Text label="Emoji" value={d.emoji} onChange={v=>setD({...d,emoji:v})}/><Text label="Nivå-emoji" value={d.levelEmoji} onChange={v=>setD({...d,levelEmoji:v})}/><Text label="Färg" value={d.color} onChange={v=>setD({...d,color:v})}/><NumberField label="XP-bank" value={bank} onChange={setBank}/><div className="actions"><button onClick={()=>onSave(d, bank)}><Save size={16}/> Spara</button><button className="danger" onClick={onDelete}><Trash2 size={16}/> Radera</button></div></div></div> }
function makeStats(data, childId) { const history = data.progress.history || []; return { tasksTotal: history.filter(h=>h.childId===childId && ['task','approved'].includes(h.type)).length, rewardsTotal: history.filter(h=>h.childId===childId && h.type==='reward').length, achievements: Object.keys(data.progress.achievements || {}).filter(k=>k.startsWith(`${childId}:`)).length, streak: data.progress.streaks?.[childId]?.count || 0 } }
function level(xp) { return Math.max(1, Math.floor(Number(xp || 0) / 100) + 1) }
function EditorCard({ title, icon, children }) { return <div className="editorCard"><h3>{icon}{title}</h3>{children}</div> }
function ListCard({ title, children }) { return <div className="listCard"><h3>{title}</h3>{children}</div> }
function Text({ label, value, onChange }) { return <label className="field"><span>{label}</span><input value={value ?? ''} onChange={e=>onChange(e.target.value)}/></label> }
function NumberField({ label, value, onChange }) { return <label className="field"><span>{label}</span><input type="number" value={value ?? 0} onChange={e=>onChange(Number(e.target.value))}/></label> }
function Toggle({ label, checked, onChange }) { return <label className="toggle"><input type="checkbox" checked={!!checked} onChange={e=>onChange(e.target.checked)}/><span>{label}</span></label> }
function DayPicker({ value=[], onChange }) { const toggle = d => onChange(value.includes(d) ? value.filter(x=>x!==d) : [...value,d]); return <div className="picker"><span>Dagar</span><div>{allDays.map(d=><button type="button" key={d} className={value.includes(d)?'pick on':'pick'} onClick={()=>toggle(d)}>{dayNames[d]}</button>)}</div></div> }
function ChildPicker({ children, value=[], onChange }) { const toggle = id => onChange(value.includes(id) ? value.filter(x=>x!==id) : [...value,id]); return <div className="picker"><span>Barn</span><div>{children.map(c=><button type="button" key={c.id} className={value.includes(c.id)?'pick on':'pick'} onClick={()=>toggle(c.id)}>{c.emoji} {c.name}</button>)}</div></div> }
function Empty({text}){ return <div className="empty"><X size={18}/>{text}</div> }
function Splash(){ return <div className="splash"><h1>HerrstromXP</h1><p>Laddar...</p></div> }
function Stat({label,value}){ return <div className="stat"><span>{label}</span><strong>{value}</strong></div> }
