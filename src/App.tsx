import type { Session } from '@supabase/supabase-js'
import { useEffect, useMemo, useState } from 'react'
import { AuthScreen } from './components/AuthScreen'
import { Library } from './components/Library'
import { localStore, supabaseStore } from './lib/store'
import { supabase } from './lib/supabase'

export default function App() {
  // undefined while the saved session is being read.
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null)

  // True after the user follows a password-reset email link.
  const [recovering, setRecovering] = useState(false)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
      setSession(s)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id
  const store = useMemo(() => (supabase && userId ? supabaseStore(supabase) : localStore), [userId])

  if (!supabase) return <Library store={store} />
  if (session === undefined) return null
  if (!session || recovering) return <AuthScreen client={supabase} recovering={recovering} onRecovered={() => setRecovering(false)} />
  return <Library key={userId} store={store} onSignOut={() => supabase!.auth.signOut()} />
}
