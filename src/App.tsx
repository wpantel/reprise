import type { Session } from '@supabase/supabase-js'
import { useEffect, useMemo, useState } from 'react'
import { AuthScreen } from './components/AuthScreen'
import { Library } from './components/Library'
import { localStore, supabaseStore } from './lib/store'
import { supabase } from './lib/supabase'

export default function App() {
  // undefined while the saved session is being read.
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id
  const store = useMemo(() => (supabase && userId ? supabaseStore(supabase) : localStore), [userId])

  if (!supabase) return <Library store={store} />
  if (session === undefined) return null
  if (!session) return <AuthScreen client={supabase} />
  return <Library key={userId} store={store} onSignOut={() => supabase!.auth.signOut()} />
}
