import { isAuthRetryableFetchError, type Session } from '@supabase/supabase-js'
import { useEffect, useMemo, useState } from 'react'
import { AuthScreen } from './components/AuthScreen'
import { Library } from './components/Library'
import { offlineCache, readLastUser, writeLastUser } from './lib/offline'
import { localStore, supabaseStore } from './lib/store'
import { supabase } from './lib/supabase'

/** The account last signed in here, if this device has a copy of its library to open. */
function lastUserWithCopy() {
  const id = readLastUser()
  return id && offlineCache(id).readSnapshot() ? id : null
}

export default function App() {
  // undefined while the saved session is being read.
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null)

  // True after the user follows a password-reset email link.
  const [recovering, setRecovering] = useState(false)

  // True when the saved sign-in couldn't be renewed for lack of a connection. It isn't
  // signed out: Supabase keeps it and renews it once the connection is back.
  const [authUnreachable, setAuthUnreachable] = useState(false)
  const [offlineUser] = useState(() => (supabase ? lastUserWithCopy() : null))

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data, error }) => {
      setAuthUnreachable(!data.session && !!error && isAuthRetryableFetchError(error))
      setSession(data.session)
    })
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      if (s) {
        setAuthUnreachable(false)
        writeLastUser(s.user.id)
      }
      if (event === 'SIGNED_OUT') {
        // Don't leave this account's songs readable on a shared device. Unsent plays stay
        // (they're per account) and go up the next time this account signs in.
        const last = readLastUser()
        if (last) offlineCache(last).clearSnapshot()
        writeLastUser(null)
        setAuthUnreachable(false)
      }
      setSession(s)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  // Until the sign-in is confirmed, or while it can't be, open this device's copy of the last account's library.
  const fallbackUser = session === undefined || (session === null && authUnreachable) ? offlineUser : null
  const userId = session?.user.id ?? fallbackUser ?? undefined
  const store = useMemo(() => (supabase && userId ? supabaseStore(supabase) : localStore), [userId])
  const cache = useMemo(() => (supabase && userId ? offlineCache(userId) : undefined), [userId])

  if (!supabase) return <Library store={store} />
  if (userId && !recovering) {
    return <Library key={userId} store={store} cache={cache} canSync={Boolean(session)} onSignOut={() => supabase!.auth.signOut()} />
  }
  if (session === undefined) return null
  return <AuthScreen client={supabase} recovering={recovering} onRecovered={() => setRecovering(false)} />
}
