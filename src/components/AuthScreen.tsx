import type { SupabaseClient } from '@supabase/supabase-js'
import { useState, type FormEvent } from 'react'
import { Logo } from './controls'

type Mode = 'in' | 'up' | 'forgot' | 'recover'

const COPY: Record<Mode, { eyebrow?: string; title: string; blurb: string; cta: string }> = {
  in: { title: 'Welcome back', blurb: 'Sign in to your library.', cta: 'Sign In' },
  up: { eyebrow: 'New account', title: 'Create your library', blurb: 'Save your repertoire and sync it across devices.', cta: 'Create Account' },
  forgot: { title: 'Reset your password', blurb: "Enter your email and we'll send you a reset link.", cta: 'Send Reset Link' },
  recover: { title: 'Choose a new password', blurb: 'Pick a new password for your account.', cta: 'Update Password' },
}

export function AuthScreen({ client, recovering = false, onRecovered }: { client: SupabaseClient; recovering?: boolean; onRecovered?: () => void }) {
  const [mode, setMode] = useState<Mode>(recovering ? 'recover' : 'in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'info'; text: string } | null>(null)

  const copy = COPY[mode]
  const isUp = mode === 'up'

  function go(next: Mode) {
    setMode(next)
    setMessage(null)
  }

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setMessage(null)
    if (mode === 'in') {
      const { error } = await client.auth.signInWithPassword({ email, password })
      if (error) setMessage({ kind: 'error', text: error.message })
    } else if (mode === 'up') {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      })
      if (error) setMessage({ kind: 'error', text: error.message })
      else if (!data.session) {
        setMode('in')
        setMessage({ kind: 'info', text: 'Check your email to confirm your account, then sign in.' })
      }
    } else if (mode === 'forgot') {
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
      if (error) setMessage({ kind: 'error', text: error.message })
      else setMessage({ kind: 'info', text: 'If an account exists for that email, a reset link is on its way.' })
    } else {
      const { error } = await client.auth.updateUser({ password })
      if (error) setMessage({ kind: 'error', text: error.message })
      else onRecovered?.()
    }
    setBusy(false)
  }

  const showTabs = mode === 'in' || mode === 'up'

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <h1 className="flex items-center gap-3 font-display text-6xl leading-none">
        <Logo className="h-12 w-auto" />
        Reprise
      </h1>

      {showTabs && (
        <div role="tablist" aria-label="Account" className="mt-6 grid grid-cols-2 gap-1 rounded-[var(--radius)] bg-surface p-1">
          {(['in', 'up'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => go(m)}
              className={`min-h-11 rounded-md text-sm font-medium transition-colors ${
                mode === m ? 'bg-card shadow-card text-ink' : 'text-ink-2 hover:text-ink'
              }`}
            >
              {m === 'in' ? 'Sign in' : 'Create account'}
            </button>
          ))}
        </div>
      )}

      <section
        className={`mt-4 rounded-[var(--radius)] border p-5 shadow-card transition-colors ${
          isUp ? 'border-accent bg-accent-soft' : 'border-line bg-card'
        }`}
      >
        {copy.eyebrow && (
          <span className="mb-2 inline-block rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold tracking-wide text-accent-ink uppercase">
            {copy.eyebrow}
          </span>
        )}
        <h2 className="font-display text-3xl leading-tight">{copy.title}</h2>
        <p className="mt-1 text-ink-2">{copy.blurb}</p>

        <form onSubmit={submit} className="mt-5 flex flex-col gap-4">
          {mode !== 'recover' && (
            <label className="flex flex-col gap-1 text-sm font-medium">
              Email
              <input className="field" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
          )}
          {mode !== 'forgot' && (
            <label className="flex flex-col gap-1 text-sm font-medium">
              {mode === 'recover' ? 'New password' : 'Password'}
              <input
                className="field"
                type="password"
                autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
                minLength={mode === 'in' ? undefined : 8}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              {isUp && <span className="text-xs font-normal text-ink-2">At least 8 characters.</span>}
            </label>
          )}
          {mode === 'in' && (
            <button type="button" className="-mt-2 min-h-11 self-start text-sm text-accent underline" onClick={() => go('forgot')}>
              Forgot password?
            </button>
          )}
          {message && (
            <p role={message.kind === 'error' ? 'alert' : 'status'} className={message.kind === 'error' ? 'text-sm text-danger' : 'text-sm'}>
              {message.text}
            </p>
          )}
          <button
            className={`btn ${isUp ? 'bg-accent text-accent-ink' : 'btn-primary'}`}
            disabled={busy}
          >
            {copy.cta}
          </button>
        </form>
      </section>

      {mode === 'forgot' && (
        <button type="button" className="mt-4 min-h-11 self-start text-sm text-accent underline" onClick={() => go('in')}>
          Back to sign in
        </button>
      )}
    </main>
  )
}
