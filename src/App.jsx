import React, { useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, Cloud, CloudOff, Download, Gift, RotateCcw, Settings, Star, Trophy, Upload, WalletCards } from 'lucide-react'
import { defaultData, defaultState } from './data/defaultData.js'
import { ensureRemoteDocument, saveRemote, subscribeRemote, syncMode } from './lib/syncStore.js'

const DAY_KEYS = ['sun','mon','tue','wed','thu','fri','sat']
const DAY_LABELS = { mon: 'Mån', tue: 'Tis', wed: 'Ons', thu: 'Tor', fri: 'Fre', sat: 'Lör', sun: 'Sön' }
const todayKey = () => DAY_KEYS[new Date().getDay()]
const todayId = () => new Date().toLocaleDateString('sv-SE')
const emptyDoc = () => ({ data: defaultData, state: defaultState })

function loadLocalDoc() {
  try { return JSON.parse(localStorage.getItem('barnens-uppdrag-v2')) || emptyDoc() }
  catch { return emptyDoc() }
}

function saveLocalDoc(doc) {
  localStorage.setItem('barnens-uppdrag-v2', JSON.stringify(doc))
}

function childTasksForDay(data, childId, dayKey) {
  return data.tasks.filter(t => t.childIds.includes(childId) && t.days.includes(dayKey))
}

function earnedXpForChild(data, state, childId) {
  let total = 0
  Object.entries(state.completions || {}).forEach(([date, byChild]) => {
    const day = DAY_KEYS[new Date(date).getDay()]
    const completions = byChild?.[childId] || {}
    const tasks = childTasksForDay(data, childId, day)
    const done = tasks.filter(t => completions[t.id])
    total += done.reduce((sum, t) => sum + Number(t.points || 0), 0)
    if (tasks.length > 0 && done.length === tasks.length) total += Number(data.settings?.dailyBonusXp || 0)
  })
  return total
}

function spentXpForChild(state, childId) {
  let total = 0
  Object.values(state.purchases || {}).forEach(byChild => {
    Object.values(byChild?.[childId] || {}).forEach(purchase => {
      total += Number(purchase.cost || 0)
    })
  })
  return total
}

function levelFromXp(xp, size) {
  return Math.floor(xp / size) + 1
}

export default function App() {
  const [doc, setDoc] = useState(loadLocalDoc)
  const [selectedChildId, setSelectedChildId] = useState(doc.data.children[0]?.id)
  const [showSettings, setShowSettings] = useState(false)
  const [draftJson, setDraftJson] = useState(JSON.stringify(doc.data, null, 2))
  const [status, setStatus] = useState(syncMode() === 'firebase' ? 'Kopplar upp...' : 'Lokal sparning')
  const skipNextSave = useRef(false)

  const data = doc.data
  const state = doc.state
  const date = todayId()
  const day = todayKey()
  const child = data.children.find(c => c.id === selectedChildId) || data.children[0]

  useEffect(() => {
    if (syncMode() !== 'firebase') return
    ensureRemoteDocument(loadLocalDoc())
      .then(() => setStatus('Synkad'))
      .catch(() => setStatus('Synkfel'))
    return subscribeRemote(remoteDoc => {
      skipNextSave.current = true
      const clean = { data: remoteDoc.data || defaultData, state: remoteDoc.state || defaultState }
      setDoc(clean)
      setDraftJson(JSON.stringify(clean.data, null, 2))
      setStatus('Synkad')
    }, () => setStatus('Synkfel'))
  }, [])

  function persist(nextDoc) {
    setDoc(nextDoc)
    saveLocalDoc(nextDoc)
    if (syncMode() === 'firebase') {
      setStatus('Sparar...')
      saveRemote(nextDoc).then(() => setStatus('Synkad')).catch(() => setStatus('Synkfel'))
    }
  }

  function updateDoc(mutator) {
    const next = structuredClone(doc)
    mutator(next)
    persist(next)
  }

  const childTasks = useMemo(() => childTasksForDay(data, child.id, day), [data, child, day])
  const todayCompletions = state.completions?.[date]?.[child.id] || {}
  const todayPurchases = state.purchases?.[date]?.[child.id] || {}
  const availableRewards = data.rewards.filter(r => r.childIds.includes(child.id) && r.days.includes(day))

  const stats = useMemo(() => {
    const doneTasks = childTasks.filter(t => todayCompletions[t.id])
    const dailyTaskXp = doneTasks.reduce((sum, t) => sum + Number(t.points || 0), 0)
    const dailyBonus = childTasks.length > 0 && doneTasks.length === childTasks.length ? Number(data.settings?.dailyBonusXp || 0) : 0
    const earned = earnedXpForChild(data, state, child.id)
    const spent = spentXpForChild(state, child.id)
    return { done: doneTasks.length, total: childTasks.length, todayXp: dailyTaskXp + dailyBonus, dailyBonus, earned, spent, balance: earned - spent }
  }, [childTasks, todayCompletions, data, state, child.id])

  function toggleTask(taskId) {
    updateDoc(next => {
      next.state.completions ||= {}
      next.state.completions[date] ||= {}
      next.state.completions[date][child.id] ||= {}
      next.state.completions[date][child.id][taskId] = !next.state.completions[date][child.id][taskId]
    })
  }

  function buyReward(reward) {
    if (todayPurchases[reward.id]) return
    if (stats.balance < reward.cost) return
    updateDoc(next => {
      next.state.purchases ||= {}
      next.state.purchases[date] ||= {}
      next.state.purchases[date][child.id] ||= {}
      next.state.purchases[date][child.id][reward.id] = {
        title: reward.title,
        cost: reward.cost,
        boughtAt: new Date().toISOString()
      }
    })
  }

  function undoReward(rewardId) {
    updateDoc(next => {
      delete next.state.purchases?.[date]?.[child.id]?.[rewardId]
    })
  }

  function resetToday() {
    updateDoc(next => {
      next.state.completions ||= {}
      next.state.completions[date] ||= {}
      next.state.completions[date][child.id] = {}
      next.state.purchases ||= {}
      next.state.purchases[date] ||= {}
      next.state.purchases[date][child.id] = {}
    })
  }

  function saveDataFromJson() {
    const parsed = JSON.parse(draftJson)
    persist({ ...doc, data: parsed })
    setSelectedChildId(parsed.children[0]?.id)
    setShowSettings(false)
  }

  function resetAllData() {
    const clean = emptyDoc()
    setDraftJson(JSON.stringify(clean.data, null, 2))
    persist(clean)
  }

  function exportBackup() {
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `barnens-uppdrag-backup-${date}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function importBackup(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const backup = JSON.parse(String(reader.result))
      setDraftJson(JSON.stringify(backup.data, null, 2))
      persist(backup)
    }
    reader.readAsText(file)
  }

  const levelSize = Number(data.settings?.levelSizeXp || 500)
  const levelPct = Math.min(100, ((stats.earned % levelSize) / levelSize) * 100)

  return <main className="app" style={{ '--kid': child.color }}>
    <section className="hero">
      <div>
        <p className="eyebrow">Barnens uppdrag · {DAY_LABELS[day]} · {date}</p>
        <h1>{child.avatar} Heja {child.name}!</h1>
        <p className="sub">Gör uppdrag, samla XP och köp dagens mål. Köpta mål visas bara för dagens datum.</p>
      </div>
      <div className="top-actions">
        <span className="sync">{syncMode() === 'firebase' ? <Cloud size={16}/> : <CloudOff size={16}/>} {status}</span>
        <button className="ghost" onClick={() => setShowSettings(!showSettings)}><Settings size={18}/> Inställningar</button>
      </div>
    </section>

    <nav className="kids">
      {data.children.map(kid => <button key={kid.id} onClick={() => setSelectedChildId(kid.id)} className={kid.id === child.id ? 'active' : ''} style={{ '--kidBtn': kid.color }}>
        <span>{kid.avatar}</span>{kid.name}
      </button>)}
    </nav>

    <section className="dashboard">
      <article className="card big">
        <div className="card-title"><WalletCards/> XP-bank</div>
        <div className="score">{stats.balance}</div>
        <p>Tjänat {stats.earned} XP · använt {stats.spent} XP</p>
      </article>
      <article className="card">
        <div className="card-title"><Trophy/> Dagens uppdrag</div>
        <div className="score small">{stats.done}/{stats.total}</div>
        <div className="progress"><span style={{ width: `${stats.total ? (stats.done / stats.total) * 100 : 0}%` }} /></div>
      </article>
      <article className="card">
        <div className="card-title"><Star/> Level {levelFromXp(stats.earned, levelSize)}</div>
        <div className="score small">+{stats.todayXp}</div>
        <p>{stats.dailyBonus ? `Dagsbonus +${stats.dailyBonus} XP 🎉` : 'Klara allt för dagsbonus.'}</p>
        <div className="progress thin"><span style={{ width: `${levelPct}%` }} /></div>
      </article>
    </section>

    <section className="tasks">
      <div className="section-head"><h2>Dagens uppdrag</h2><button className="ghost" onClick={resetToday}><RotateCcw size={16}/> Nollställ idag</button></div>
      {childTasks.length === 0 && <div className="empty">Inga uppdrag idag.</div>}
      {childTasks.map(task => {
        const done = !!todayCompletions[task.id]
        return <button key={task.id} className={`task ${done ? 'done' : ''}`} onClick={() => toggleTask(task.id)}>
          <span className="task-icon">{task.icon}</span>
          <span className="task-text"><b>{task.title}</b><small>{task.category} · {task.points} XP</small></span>
          <CheckCircle2 className="check" />
        </button>
      })}
    </section>

    <section className="rewards">
      <h2>Dagens mål att köpa</h2>
      <div className="reward-grid">
        {availableRewards.map(reward => {
          const bought = !!todayPurchases[reward.id]
          const locked = stats.balance < reward.cost && !bought
          return <article className={`reward ${bought ? 'bought' : ''}`} key={reward.id}>
            <span>{reward.icon}</span><b>{reward.title}</b><small>{reward.cost} XP · {reward.days.map(d => DAY_LABELS[d]).join(', ')}</small>
            {bought
              ? <button className="ghost" onClick={() => undoReward(reward.id)}>Ångra köp</button>
              : <button disabled={locked} onClick={() => buyReward(reward)}>{locked ? 'För lite XP' : 'Köp mål'}</button>}
          </article>
        })}
      </div>
    </section>

    {showSettings && <section className="settings">
      <h2>Inställningar</h2>
      <p>Ändra barn, uppgifter, dagar, poäng och mål. Fältet <b>days</b> styr veckodagar och <b>cost</b> är vad målet kostar i XP.</p>
      <textarea value={draftJson} onChange={e => setDraftJson(e.target.value)} spellCheck="false" />
      <div className="actions">
        <button onClick={saveDataFromJson}>Spara ändringar</button>
        <button className="ghost" onClick={exportBackup}><Download size={16}/> Exportera backup</button>
        <label className="ghost file"><Upload size={16}/> Importera backup<input type="file" accept="application/json" onChange={importBackup}/></label>
        <button className="danger" onClick={resetAllData}>Återställ allt</button>
      </div>
    </section>}
  </main>
}
