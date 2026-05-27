import { useEffect, useMemo, useState } from 'react'
import { Bell, CheckCircle2, Clock, Gift, Lock, Plus, Save, Settings, ShieldCheck, Star, Trash2, Trophy, UserRoundPlus, Wifi, WifiOff, X } from 'lucide-react'
import { createStore, requestPushPermission, todayKey } from './lib/store.js'

const dayMap = ['sun','mon','tue','wed','thu','fri','sat']
const dayNames = { mon:'Mån', tue:'Tis', wed:'Ons', thu:'Tor', fri:'Fre', sat:'Lör', sun:'Sön' }
const allDays = ['mon','tue','wed','thu','fri','sat','sun']
const today = () => dayMap[new Date().getDay()]
const uid = () => Math.random().toString(36).slice(2, 10)
const clone = (obj) => (typeof structuredClone === 'function' ? structuredClone(obj) : JSON.parse(JSON.stringify(obj)))
const blankTask = (childIds=[]) => ({ id: `task-${uid()}`, title: '', xp: 10, days: [...allDays], childIds, requiresApproval: true })
const blankReward = (childIds=[]) => ({ id: `reward-${uid()}`, title: '', cost: 100, emoji: '🎁', days: ['fri','sat','sun'], childIds })
const blankChild = () => ({ id: `barn-${uid()}`, name: '', emoji: '🙂', color: '#22c55e' })

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
  const todaysTasks = useMemo(() => {
    if (!data || !selectedChild) return []
    return data.family.tasks.filter(t => t.days.includes(today()) && t.childIds.includes(selectedChild))
  }, [data, selectedChild])
  const todaysRewards = useMemo(() => {
    if (!data || !selectedChild) return []
    return data.family.rewards.filter(r => r.days.includes(today()) && r.childIds.includes(selectedChild))
  }, [data, selectedChild])

  if (!data) return <Splash />

  const taskState = (taskId, childId = selectedChild) => {
    const key = `${childId}:${taskId}`
    if (data.progress.completed[key]) return 'done'
    if (data.progress.pending[key]) return 'pending'
    return 'open'
  }

  const completeTask = async (task) => {
    const key = `${selectedChild}:${task.id}`
    if (taskState(task.id) !== 'open') return
    const next = clone(data)
    if (task.requiresApproval && !admin) {
      next.progress.pending[key] = { childId: selectedChild, taskId: task.id, at: new Date().toISOString(), notified: false }
      next.progress.history.unshift({ id: uid(), date: todayKey(), childId: selectedChild, type: 'pending', title: task.title })
      setMessage('Skickad för föräldragodkännande ✅')
      store?.notifyParent?.({ childName: child?.name, taskTitle: task.title })
    } else {
      next.progress.completed[key] = { childId: selectedChild, taskId: task.id, xp: task.xp, at: new Date().toISOString() }
      next.progress.xpBank[selectedChild] = (next.progress.xpBank[selectedChild] || 0) + Number(task.xp || 0)
      next.progress.history.unshift({ id: uid(), date: todayKey(), childId: selectedChild, type: 'task', title: task.title, xp: task.xp })
      setMessage(`+${task.xp} XP! ⭐`)
    }
    await save(next)
  }

  const approveTask = async (key) => {
    const p = data.progress.pending[key]
    const task = data.family.tasks.find(t => t.id === p?.taskId)
    if (!p || !task) return
    const next = clone(data)
    delete next.progress.pending[key]
    next.progress.completed[key] = { childId: p.childId, taskId: p.taskId, xp: task.xp, at: new Date().toISOString(), approved: true }
    next.progress.xpBank[p.childId] = (next.progress.xpBank[p.childId] || 0) + Number(task.xp || 0)
    next.progress.history.unshift({ id: uid(), date: todayKey(), childId: p.childId, type: 'approved', title: task.title, xp: task.xp })
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
    if (xp < Number(reward.cost || 0)) { setMessage('Inte tillräckligt med XP ännu 🙂'); return }
    const next = clone(data)
    next.progress.xpBank[selectedChild] = xp - Number(reward.cost || 0)
    next.progress.purchased[key] = { childId: selectedChild, rewardId: reward.id, cost: reward.cost, at: new Date().toISOString() }
    next.progress.history.unshift({ id: uid(), date: todayKey(), childId: selectedChild, type: 'reward', title: reward.title, cost: reward.cost })
    setMessage(`${reward.title} köpt! 🎁`)
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
          <div className="eyebrow">HerrstromXP · {new Date().toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <h1>Barnens uppdrag</h1>
          <p>Gör uppdrag, samla XP och köp belöningar. Köpta belöningar nollställs automatiskt varje ny dag.</p>
        </div>
        <div className="topBadges">
          {saving && <span className="syncBadge"><Clock size={18}/> Sparar</span>}
          <span className="syncBadge">{store?.mode === 'firebase' ? <Wifi size={18}/> : <WifiOff size={18}/>} {store?.mode === 'firebase' ? 'Synkat' : 'Lokalt läge'}</span>
        </div>
      </header>

      {message && <div className="toast" onClick={() => setMessage('')}>{message}</div>}

      <section className="children">
        {data.family.children.map(c => (
          <button key={c.id} className={`childCard ${selectedChild===c.id?'active':''}`} onClick={() => setSelectedChild(c.id)} style={{'--accent': c.color}}>
            <span className="avatar">{c.emoji}</span>
            <span><b>{c.name}</b><small>{data.progress.xpBank[c.id] || 0} XP i banken</small></span>
          </button>
        ))}
      </section>

      <main className="grid">
        <section className="panel mainPanel">
          <div className="tabs">
            <button className={tab==='tasks'?'on':''} onClick={()=>setTab('tasks')}><CheckCircle2 size={18}/> Uppdrag</button>
            <button className={tab==='rewards'?'on':''} onClick={()=>setTab('rewards')}><Gift size={18}/> Belöningar</button>
          </div>

          <div className="childHeader" style={{'--accent': child?.color}}>
            <div className="bigAvatar">{child?.emoji}</div>
            <div><h2>{child?.name}</h2><p><Star size={16}/> {xp} XP tillgängligt</p></div>
          </div>

          {tab === 'tasks' ? <div className="cards">
            {todaysTasks.length === 0 && <Empty text="Inga uppdrag för idag." />}
            {todaysTasks.map(task => {
              const state = taskState(task.id)
              return <button key={task.id} className={`task ${state}`} onClick={() => completeTask(task)}>
                <div><h3>{task.title}</h3><p>{task.days.map(d=>dayNames[d]).join(', ')} {task.requiresApproval && <span> · kräver godkännande</span>}</p></div>
                <strong>{state==='done'?'Klart':state==='pending'?'Väntar':`+${task.xp} XP`}</strong>
              </button>
            })}
          </div> : <div className="cards">
            {todaysRewards.length === 0 && <Empty text="Inga belöningar för idag." />}
            {todaysRewards.map(reward => {
              const key = `${selectedChild}:${reward.id}`
              const bought = data.progress.purchased[key]
              const locked = xp < Number(reward.cost || 0) && !bought
              return <button key={reward.id} className={`reward ${bought?'bought':''}`} onClick={() => buyReward(reward)}>
                <span className="rewardEmoji">{reward.emoji}</span>
                <div><h3>{reward.title}</h3><p>{reward.days.map(d=>dayNames[d]).join(', ')}</p></div>
                <strong>{bought?'Köpt idag':locked?<><Lock size={15}/> {reward.cost} XP</>:`Köp ${reward.cost} XP`}</strong>
              </button>
            })}
          </div>}
        </section>

        <aside className="panel sidePanel">
          <h2><Trophy size={22}/> Dagens status</h2>
          <Stat label="Uppdrag idag" value={`${todaysTasks.filter(t=>taskState(t.id)==='done').length}/${todaysTasks.length}`} />
          <Stat label="Väntar godkännande" value={pendingItems.length} />
          <Stat label="Datum" value={data.progress.date} />

          <div className="adminBox">
            <h3><Settings size={18}/> Föräldraläge</h3>
            {!admin ? <div className="pinRow"><input placeholder="PIN" value={pin} onChange={e=>setPin(e.target.value)} type="password"/><button onClick={login}>Lås upp</button></div> : <>
              <p className="ok"><ShieldCheck size={16}/> Aktivt</p>
              <button className="secondary" onClick={()=>setAdmin(false)}>Lås</button>
            </>}
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

  useEffect(() => {
    setDraftTask(t => ({ ...t, childIds: t.childIds.length ? t.childIds : children.map(c=>c.id) }))
    setDraftReward(r => ({ ...r, childIds: r.childIds.length ? r.childIds : children.map(c=>c.id) }))
  }, [children.length])

  const savePush = async () => {
    const res = await requestPushPermission(store, data)
    setMessage(res.ok ? 'Pushnotiser aktiverade på denna enhet 🔔' : res.message)
  }

  return <section className="panel adminPanel">
    <div className="adminHeader">
      <div><h2>Föräldra-admin</h2><p>Redigera allt med formulär istället för JSON.</p></div>
      <button className="secondary" onClick={savePush}><Bell size={17}/> Aktivera push på denna enhet</button>
    </div>

    <div className="tabs adminTabs">
      <button className={adminTab==='approve'?'on':''} onClick={()=>setAdminTab('approve')}>Godkänn</button>
      <button className={adminTab==='tasks'?'on':''} onClick={()=>setAdminTab('tasks')}>Uppdrag</button>
      <button className={adminTab==='rewards'?'on':''} onClick={()=>setAdminTab('rewards')}>Belöningar</button>
      <button className={adminTab==='children'?'on':''} onClick={()=>setAdminTab('children')}>Barn</button>
      <button className={adminTab==='settings'?'on':''} onClick={()=>setAdminTab('settings')}>Inställningar</button>
    </div>

    {adminTab === 'approve' && <div className="adminGridOne">
      <h3>Väntar på godkännande</h3>
      {pendingItems.length === 0 && <Empty text="Inget väntar på godkännande." />}
      {pendingItems.map(([key,p]) => {
        const c = data.family.children.find(x=>x.id===p.childId)
        const t = data.family.tasks.find(x=>x.id===p.taskId)
        return <div className="pending wide" key={key}><span><b>{c?.name}</b> vill få godkänt: {t?.title}</span><div><button onClick={()=>approveTask(key)}>Godkänn</button><button className="danger" onClick={()=>rejectTask(key)}>Neka</button></div></div>
      })}
    </div>}

    {adminTab === 'tasks' && <div className="adminGrid">
      <EditorCard title="Lägg till uppdrag" icon={<Plus/>}>
        <Text label="Titel" value={draftTask.title} onChange={v=>setDraftTask({...draftTask,title:v})}/>
        <NumberField label="XP" value={draftTask.xp} onChange={v=>setDraftTask({...draftTask,xp:v})}/>
        <Toggle label="Kräver godkännande" checked={draftTask.requiresApproval} onChange={v=>setDraftTask({...draftTask,requiresApproval:v})}/>
        <DayPicker value={draftTask.days} onChange={days=>setDraftTask({...draftTask,days})}/>
        <ChildPicker children={children} value={draftTask.childIds} onChange={childIds=>setDraftTask({...draftTask,childIds})}/>
        <button onClick={()=>{
          if(!draftTask.title.trim()) return
          updateFamily(f=>{ f.tasks.push({...draftTask, title: draftTask.title.trim(), xp:Number(draftTask.xp)||0}); }, 'Uppdrag tillagt ✅')
          setDraftTask(blankTask(children.map(c=>c.id)))
        }}><Save size={17}/> Lägg till</button>
      </EditorCard>
      <ListCard title="Befintliga uppdrag">
        {data.family.tasks.map(task => <TaskRow key={task.id} task={task} children={children} onSave={(updated)=>updateFamily(f=>{ const i=f.tasks.findIndex(x=>x.id===task.id); f.tasks[i]=updated }, 'Uppdrag uppdaterat ✅')} onDelete={()=>updateFamily((f)=>{f.tasks=f.tasks.filter(x=>x.id!==task.id)}, 'Uppdrag raderat')}/>) }
      </ListCard>
    </div>}

    {adminTab === 'rewards' && <div className="adminGrid">
      <EditorCard title="Lägg till belöning" icon={<Gift/>}>
        <Text label="Titel" value={draftReward.title} onChange={v=>setDraftReward({...draftReward,title:v})}/>
        <Text label="Emoji" value={draftReward.emoji} onChange={v=>setDraftReward({...draftReward,emoji:v})}/>
        <NumberField label="Kostar XP" value={draftReward.cost} onChange={v=>setDraftReward({...draftReward,cost:v})}/>
        <DayPicker value={draftReward.days} onChange={days=>setDraftReward({...draftReward,days})}/>
        <ChildPicker children={children} value={draftReward.childIds} onChange={childIds=>setDraftReward({...draftReward,childIds})}/>
        <button onClick={()=>{
          if(!draftReward.title.trim()) return
          updateFamily(f=>{ f.rewards.push({...draftReward, title: draftReward.title.trim(), cost:Number(draftReward.cost)||0}); }, 'Belöning tillagd ✅')
          setDraftReward(blankReward(children.map(c=>c.id)))
        }}><Save size={17}/> Lägg till</button>
      </EditorCard>
      <ListCard title="Befintliga belöningar">
        {data.family.rewards.map(reward => <RewardRow key={reward.id} reward={reward} children={children} onSave={(updated)=>updateFamily(f=>{ const i=f.rewards.findIndex(x=>x.id===reward.id); f.rewards[i]=updated }, 'Belöning uppdaterad ✅')} onDelete={()=>updateFamily(f=>{f.rewards=f.rewards.filter(x=>x.id!==reward.id)}, 'Belöning raderad')}/>) }
      </ListCard>
    </div>}

    {adminTab === 'children' && <div className="adminGrid">
      <EditorCard title="Lägg till barn" icon={<UserRoundPlus/>}>
        <Text label="Namn" value={draftChild.name} onChange={v=>setDraftChild({...draftChild,name:v})}/>
        <Text label="Emoji/avatar" value={draftChild.emoji} onChange={v=>setDraftChild({...draftChild,emoji:v})}/>
        <Text label="Färg" value={draftChild.color} onChange={v=>setDraftChild({...draftChild,color:v})}/>
        <button onClick={()=>{
          if(!draftChild.name.trim()) return
          updateFamily((f,p)=>{ f.children.push({...draftChild, name:draftChild.name.trim()}); p.xpBank[draftChild.id]=0 }, 'Barn tillagt ✅')
          setDraftChild(blankChild())
        }}><Save size={17}/> Lägg till</button>
      </EditorCard>
      <ListCard title="Barn och XP-bank">
        {data.family.children.map(c => <ChildRow key={c.id} child={c} xp={data.progress.xpBank[c.id]||0} onSave={(updated, xp)=>updateFamily((f,p)=>{ const i=f.children.findIndex(x=>x.id===c.id); f.children[i]=updated; p.xpBank[c.id]=Number(xp)||0 }, 'Barn uppdaterat ✅')} onDelete={()=>updateFamily((f,p)=>{ f.children=f.children.filter(x=>x.id!==c.id); delete p.xpBank[c.id] }, 'Barn raderat')}/>) }
      </ListCard>
    </div>}

    {adminTab === 'settings' && <SettingsPanel data={data} updateFamily={updateFamily} store={store} setMessage={setMessage}/>}    
  </section>
}

function SettingsPanel({ data, updateFamily, store }) {
  const [familyName, setFamilyName] = useState(data.family.familyName || 'HerrstromXP')
  const [pin, setPin] = useState(data.family.parentPin || '')
  return <div className="adminGrid">
    <EditorCard title="Familjeinställningar" icon={<Settings/>}>
      <Text label="Namn på app/familj" value={familyName} onChange={setFamilyName}/>
      <Text label="Föräldra-PIN" value={pin} onChange={setPin}/>
      <button onClick={()=>updateFamily(f=>{f.familyName=familyName; f.parentPin=pin}, 'Inställningar sparade ✅')}><Save size={17}/> Spara</button>
    </EditorCard>
    <EditorCard title="Pushnotiser" icon={<Bell/>}>
      <p className="muted">Push kräver Firebase Cloud Messaging + en liten Cloud Function. Appen sparar push-token i Firestore, men själva utskicket från barnets knapp behöver serverfunktion. Mall finns i mappen <b>firebase-functions</b>.</p>
      <Stat label="Läge" value={store?.mode === 'firebase' ? 'Firebase aktivt' : 'Lokalt läge'} />
      <Stat label="Familj ID" value={data.family.familyId} />
    </EditorCard>
    <EditorCard title="Daglig nollställning" icon={<Clock/>}>
      <p className="muted">Appen nollställer dagens klara uppdrag och köpta belöningar automatiskt första gången den öppnas varje ny dag. XP-banken sparas.</p>
    </EditorCard>
  </div>
}

function TaskRow({ task, children, onSave, onDelete }) {
  const [open, setOpen] = useState(false)
  const [d, setD] = useState(task)
  useEffect(()=>setD(task), [task.id])
  return <div className="editRow">
    <div className="rowTop"><b>{task.title}</b><span>{task.xp} XP · {task.days.map(x=>dayNames[x]).join(', ')}</span><button className="mini" onClick={()=>setOpen(!open)}>{open?'Stäng':'Ändra'}</button></div>
    {open && <div className="rowEdit">
      <Text label="Titel" value={d.title} onChange={v=>setD({...d,title:v})}/>
      <NumberField label="XP" value={d.xp} onChange={v=>setD({...d,xp:v})}/>
      <Toggle label="Kräver godkännande" checked={d.requiresApproval} onChange={v=>setD({...d,requiresApproval:v})}/>
      <DayPicker value={d.days} onChange={days=>setD({...d,days})}/>
      <ChildPicker children={children} value={d.childIds} onChange={childIds=>setD({...d,childIds})}/>
      <div className="actions"><button onClick={()=>{onSave({...d, xp:Number(d.xp)||0}); setOpen(false)}}><Save size={16}/> Spara</button><button className="danger" onClick={onDelete}><Trash2 size={16}/> Radera</button></div>
    </div>}
  </div>
}
function RewardRow({ reward, children, onSave, onDelete }) {
  const [open, setOpen] = useState(false)
  const [d, setD] = useState(reward)
  useEffect(()=>setD(reward), [reward.id])
  return <div className="editRow">
    <div className="rowTop"><b>{reward.emoji} {reward.title}</b><span>{reward.cost} XP · {reward.days.map(x=>dayNames[x]).join(', ')}</span><button className="mini" onClick={()=>setOpen(!open)}>{open?'Stäng':'Ändra'}</button></div>
    {open && <div className="rowEdit">
      <Text label="Titel" value={d.title} onChange={v=>setD({...d,title:v})}/>
      <Text label="Emoji" value={d.emoji} onChange={v=>setD({...d,emoji:v})}/>
      <NumberField label="Kostar XP" value={d.cost} onChange={v=>setD({...d,cost:v})}/>
      <DayPicker value={d.days} onChange={days=>setD({...d,days})}/>
      <ChildPicker children={children} value={d.childIds} onChange={childIds=>setD({...d,childIds})}/>
      <div className="actions"><button onClick={()=>{onSave({...d, cost:Number(d.cost)||0}); setOpen(false)}}><Save size={16}/> Spara</button><button className="danger" onClick={onDelete}><Trash2 size={16}/> Radera</button></div>
    </div>}
  </div>
}
function ChildRow({ child, xp, onSave, onDelete }) {
  const [d, setD] = useState(child)
  const [bank, setBank] = useState(xp)
  return <div className="editRow always">
    <div className="rowEdit compact">
      <Text label="Namn" value={d.name} onChange={v=>setD({...d,name:v})}/>
      <Text label="Emoji" value={d.emoji} onChange={v=>setD({...d,emoji:v})}/>
      <Text label="Färg" value={d.color} onChange={v=>setD({...d,color:v})}/>
      <NumberField label="XP-bank" value={bank} onChange={setBank}/>
      <div className="actions"><button onClick={()=>onSave(d, bank)}><Save size={16}/> Spara</button><button className="danger" onClick={onDelete}><Trash2 size={16}/> Radera</button></div>
    </div>
  </div>
}

function EditorCard({ title, icon, children }) { return <div className="editorCard"><h3>{icon}{title}</h3>{children}</div> }
function ListCard({ title, children }) { return <div className="listCard"><h3>{title}</h3>{children}</div> }
function Text({ label, value, onChange }) { return <label className="field"><span>{label}</span><input value={value ?? ''} onChange={e=>onChange(e.target.value)}/></label> }
function NumberField({ label, value, onChange }) { return <label className="field"><span>{label}</span><input type="number" value={value ?? 0} onChange={e=>onChange(Number(e.target.value))}/></label> }
function Toggle({ label, checked, onChange }) { return <label className="toggle"><input type="checkbox" checked={!!checked} onChange={e=>onChange(e.target.checked)}/><span>{label}</span></label> }
function DayPicker({ value, onChange }) {
  const toggle = d => onChange(value.includes(d) ? value.filter(x=>x!==d) : [...value,d])
  return <div className="picker"><span>Dagar</span><div>{allDays.map(d=><button type="button" key={d} className={value.includes(d)?'pick on':'pick'} onClick={()=>toggle(d)}>{dayNames[d]}</button>)}</div></div>
}
function ChildPicker({ children, value, onChange }) {
  const toggle = id => onChange(value.includes(id) ? value.filter(x=>x!==id) : [...value,id])
  return <div className="picker"><span>Barn</span><div>{children.map(c=><button type="button" key={c.id} className={value.includes(c.id)?'pick on':'pick'} onClick={()=>toggle(c.id)}>{c.emoji} {c.name}</button>)}</div></div>
}
function Empty({text}){ return <div className="empty"><X size={18}/>{text}</div> }
function Splash(){ return <div className="splash"><h1>HerrstromXP</h1><p>Laddar...</p></div> }
function Stat({label,value}){ return <div className="stat"><span>{label}</span><strong>{value}</strong></div> }
