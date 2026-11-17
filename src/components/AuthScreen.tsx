import type { SupabaseClient } from '@supabase/supabase-js'
import { useState, type FormEvent } from 'react'
import { Logo } from './controls'

export function AuthScreen({ client }: { client: SupabaseClient }) {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    if (mode === 'in') {
      const { error } = await client.auth.signInWithPassword({ email, password })
      if (error) setMessage({ kind: 'error', text: error.message })
    } else {
      const { data, error } = await client.auth.signUp({ email, password })
      if (error) setMessage({ kind: 'error', text: error.message })
      else if (!data.session) {
        setMode('in')
        setMessage({ kind: 'info', text: 'Check your email to confirm your account, then sign in.' })
      }
    }
    setBusy(false)
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <h1 className="flex items-center gap-3 font-display text-6xl leading-none">
        <Logo className="h-12 w-auto" />
        Reprise
      </h1>
      <p className="mt-3 text-ink-2">{mode === 'in' ? 'Sign in to your library.' : 'Create an account for your library.'}</p>
      <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm font-medium">
          Email
          <input className="field" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium">
          Password
          <input
            className="field"
            type="password"
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            minLength={mode === 'up' ? 8 : undefined}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {message && (
          <p role={message.kind === 'error' ? 'alert' : 'status'} className={message.kind === 'error' ? 'text-sm text-danger' : 'text-sm'}>
            {message.text}
          </p>
        )}
        <button className="btn btn-primary" disabled={busy}>
          {mode === 'in' ? 'Sign In' : 'Create Account'}
        </button>
      </form>
      <button
        className="mt-4 min-h-11 self-start text-sm text-accent underline"
        onClick={() => {
          setMode(mode === 'in' ? 'up' : 'in')
          setMessage(null)
        }}
      >
        {mode === 'in' ? 'Create an account instead' : 'I already have an account'}
      </button>
    </main>
  )
}
