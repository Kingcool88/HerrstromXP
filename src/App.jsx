import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Clock, Gift, Lock, Settings, Star, Trophy, Wifi, WifiOff } from 'lucide-react'
import { createStore, todayKey } from './lib/store.js'

const dayMap = ['sun','mon','tue','wed','thu','fri','sat']
const dayNames = { mon:'Mån', tue:'Tis', wed:'Ons', thu:'Tor', fri:'Fre', sat:'Lör', sun:'Sön' }
const today = () => dayMap[new Date().getDay()]
const uid = () => Math.random().toString(36).slice(2, 9)

export default function App() {
  const [data, setData] = useState(null)
  const [store, setStore] = useState(null)
  const [selectedChild, setSelectedChild] = useState(null)
  const [admin, setAdmin] = useState(false)
  const [pin, setPin] = useState('')
  const [tab, setTab] = useState('tasks')
  const [editor, setEditor] = useState(false)
  const [draft, setDraft] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let cleanup = () => {}
    createStore((next) => {
      setData(next)
      setSelectedChild(prev => prev || next.family.children[0]?.id)
    }).then(s => { setStore(s); cleanup = s.unsubscribe })
    return () => cleanup()
  }, [])

  const save = async (next) => {
    setData(next)
    await store?.save(next)
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

  const taskState = (taskId) => {
    const key = `${selectedChild}:${taskId}`
    if (data.progress.completed[key]) return 'done'
    if (data.progress.pending[key]) return 'pending'
    return 'open'
  }

  const completeTask = async (task) => {
    const key = `${selectedChild}:${task.id}`
    if (taskState(task.id) !== 'open') return
    const next = structuredClone(data)
    if (task.requiresApproval && !admin) {
      next.progress.pending[key] = { childId: selectedChild, taskId: task.id, at: new Date().toISOString() }
      setMessage('Skickad för godkännande ✅')
    } else {
      next.progress.completed[key] = { childId: selectedChild, taskId: task.id, xp: task.xp, at: new Date().toISOString() }
      next.progress.xpBank[selectedChild] = (next.progress.xpBank[selectedChild] || 0) + task.xp
      setMessage(`+${task.xp} XP! ⭐`)
    }
    await save(next)
  }

  const approveTask = async (key) => {
    const p = data.progress.pending[key]
    const task = data.family.tasks.find(t => t.id === p.taskId)
    if (!p || !task) return
    const next = structuredClone(data)
    delete next.progress.pending[key]
    next.progress.completed[key] = { childId: p.childId, taskId: p.taskId, xp: task.xp, at: new Date().toISOString(), approved: true }
    next.progress.xpBank[p.childId] = (next.progress.xpBank[p.childId] || 0) + task.xp
    await save(next)
  }

  const buyReward = async (reward) => {
    const key = `${selectedChild}:${reward.id}`
    if (data.progress.purchased[key]) return
    if (xp < reward.cost) { setMessage('Inte tillräckligt med XP ännu 🙂'); return }
    const next = structuredClone(data)
    next.progress.xpBank[selectedChild] = xp - reward.cost
    next.progress.purchased[key] = { childId: selectedChild, rewardId: reward.id, cost: reward.cost, at: new Date().toISOString() }
    next.progress.history.unshift({ id: uid(), date: todayKey(), childId: selectedChild, type: 'reward', title: reward.title, cost: reward.cost })
    setMessage(`${reward.title} köpt! 🎁`)
    await save(next)
  }

  const login = () => {
    if (pin === data.family.parentPin) { setAdmin(true); setPin(''); setMessage('Föräldraläge aktivt 🔐') }
    else setMessage('Fel PIN')
  }

  const saveJson = async () => {
    try {
      const parsed = JSON.parse(draft)
      await save(parsed)
      setEditor(false)
      setMessage('Sparat ✅')
    } catch (e) { setMessage('JSON innehåller fel') }
  }

  const pendingItems = Object.entries(data.progress.pending || {})

  return (
    <div className="app">
      <header className="hero">
        <div>
          <div className="eyebrow">HerrstromXP · {new Date().toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' })}</div>
          <h1>Barnens uppdrag</h1>
          <p>Gör uppdrag, samla XP och köp belöningar. Dagens köpta belöningar nollställs automatiskt imorgon.</p>
        </div>
        <div className="syncBadge">{store?.mode === 'firebase' ? <Wifi size={18}/> : <WifiOff size={18}/>} {store?.mode === 'firebase' ? 'Synkat' : 'Lokalt läge'}</div>
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
            {todaysTasks.map(task => {
              const state = taskState(task.id)
              return <button key={task.id} className={`task ${state}`} onClick={() => completeTask(task)}>
                <div><h3>{task.title}</h3><p>{task.days.map(d=>dayNames[d]).join(', ')} {task.requiresApproval && <span> · kräver godkännande</span>}</p></div>
                <strong>{state==='done'?'Klart':state==='pending'?'Väntar':`+${task.xp} XP`}</strong>
              </button>
            })}
          </div> : <div className="cards">
            {todaysRewards.map(reward => {
              const key = `${selectedChild}:${reward.id}`
              const bought = data.progress.purchased[key]
              const locked = xp < reward.cost && !bought
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
              <p className="ok">Aktivt</p>
              {pendingItems.map(([key,p]) => {
                const c = data.family.children.find(x=>x.id===p.childId)
                const t = data.family.tasks.find(x=>x.id===p.taskId)
                return <div className="pending" key={key}><span>{c?.name}: {t?.title}</span><button onClick={()=>approveTask(key)}>Godkänn</button></div>
              })}
              <button className="secondary" onClick={()=>{setDraft(JSON.stringify(data,null,2));setEditor(true)}}>Redigera JSON</button>
              <button className="secondary" onClick={()=>setAdmin(false)}>Lås</button>
            </>}
          </div>
        </aside>
      </main>

      {editor && <div className="modal"><div className="modalCard"><h2>Redigera hela databasen</h2><textarea value={draft} onChange={e=>setDraft(e.target.value)} /><div><button onClick={saveJson}>Spara</button><button className="secondary" onClick={()=>setEditor(false)}>Avbryt</button></div></div></div>}
    </div>
  )
}

function Splash(){ return <div className="splash"><h1>HerrstromXP</h1><p>Laddar...</p></div> }
function Stat({label,value}){ return <div className="stat"><span>{label}</span><strong>{value}</strong></div> }
