import React, { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { format } from 'date-fns'

function useAuth() {
  const [user, setUser] = useState(null)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUser(data.session?.user ?? null))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])
  return user
}

function Auth() {
  const [email, setEmail] = useState('')
  async function signIn() {
    const { error } = await supabase.auth.signInWithOtp({ email })
    if (error) alert(error.message)
    else alert('Check your email for a login link.')
  }
  return (
    <div className="auth">
      <h2>Sign in</h2>
      <input placeholder="your email" value={email} onChange={e=>setEmail(e.target.value)} />
      <button onClick={signIn}>Sign in (magic link)</button>
    </div>
  )
}

function CaseRow({ c, onEdit }) {
  return (
    <div className="case-row small">
      <div><strong>{c.case_number}</strong> — {c.court_details}</div>
      <div>{c.our_party} | Next: {c.next_date}</div>
      <div><button onClick={()=>onEdit(c)}>Edit</button></div>
    </div>
  )
}

function CaseForm({ initial, onSaved, onCancel }) {
  const [form, setForm] = useState(initial)
  function update(k, v) { setForm(prev => ({...prev, [k]: v})) }
  async function save() {
    const payload = {...form, active: !!form.active}
    if (form.id) await supabase.from('cases').update(payload).eq('id', form.id)
    else await supabase.from('cases').insert(payload)
    onSaved()
  }
  return (
    <div className="form">
      <label>Active:
        <select value={form.active ? 'true' : 'false'} onChange={e=>update('active', e.target.value === 'true')}>
          <option value="true">Y</option><option value="false">N</option>
        </select>
      </label>
      <label>Previous Date: <input type="date" value={form.previous_date||''} onChange={e=>update('previous_date', e.target.value)} /></label>
      <label>Case No: <input value={form.case_number||''} onChange={e=>update('case_number', e.target.value)} /></label>
      <label>Court Details: <input value={form.court_details||''} onChange={e=>update('court_details', e.target.value)} /></label>
      <label>Court Type: <input value={form.court_type||''} onChange={e=>update('court_type', e.target.value)} /></label>
      <label>Our Party: <input value={form.our_party||''} onChange={e=>update('our_party', e.target.value)} /></label>
      <label>Purpose: <input value={form.purpose||''} onChange={e=>update('purpose', e.target.value)} /></label>
      <label>Next Date: <input type="date" value={form.next_date||''} onChange={e=>update('next_date', e.target.value)} /></label>
      <label>Notes: <input value={form.notes||''} onChange={e=>update('notes', e.target.value)} /></label>
      <div className="form-actions">
        <button onClick={save}>Save</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

export default function App() {
  const user = useAuth()
  const [cases, setCases] = useState([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState(null)
  const [query, setQuery] = useState('')

  async function fetchCases() {
    setLoading(true)
    const { data, error } = await supabase.from('cases').select('*').order('next_date', { ascending: true }).limit(1000)
    setLoading(false)
    if (error) return alert(error.message)
    const normalized = data.map(r => ({
      ...r,
      previous_date: r.previous_date ? r.previous_date.slice(0,10) : null,
      next_date: r.next_date ? r.next_date.slice(0,10) : null
    }))
    setCases(normalized)
  }

  useEffect(()=> { if (user) fetchCases() }, [user])

  async function signOut() { await supabase.auth.signOut(); setCases([]) }

  function startNew() {
    setEditing({
      active: true,
      previous_date: format(new Date(), 'yyyy-MM-dd'),
      case_number: '',
      court_details: '',
      court_type: '',
      our_party: '',
      purpose: '',
      next_date: '',
      notes: ''
    })
  }

  const filtered = cases.filter(c =>
    (c.case_number||'').toLowerCase().includes(query.toLowerCase()) ||
    (c.court_details||'').toLowerCase().includes(query.toLowerCase()) ||
    (c.our_party||'').toLowerCase().includes(query.toLowerCase())
  )

  if (!user) return <div className="container"><Auth /></div>

  return (
    <div className="container">
      <header>
        <h1>Case Tracker</h1>
        <div><button onClick={fetchCases}>Refresh</button><button onClick={signOut}>Sign out</button></div>
      </header>
      <main>
        <div className="left">
          <h3>All cases</h3>
          <div><input placeholder="Search by case/court/party..." value={query} onChange={e=>setQuery(e.target.value)} /></div>
          {loading && <div>Loading...</div>}
          {filtered.map(c => <CaseRow key={c.id} c={c} onEdit={setEditing} />)}
          <button onClick={startNew}>Add new case</button>
        </div>
        <aside className="right">
          {editing ? <CaseForm initial={editing} onSaved={()=>{setEditing(null);fetchCases();}} onCancel={()=>setEditing(null)} /> :
            <div><h3>Details</h3><p>Click a case to edit or add new.</p></div>}
        </aside>
      </main>
    </div>
  )
}