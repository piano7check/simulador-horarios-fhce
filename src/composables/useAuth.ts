import { ref } from 'vue'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

// Singleton: estado compartido entre todos los componentes
const user = ref<User | null>(null)

supabase.auth.getSession().then(({ data }) => {
  user.value = data.session?.user ?? null
})

supabase.auth.onAuthStateChange((_event, session) => {
  user.value = session?.user ?? null
})

export function useAuth() {
  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  async function signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) throw error
    return data
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function signInWithGoogle() {
    // Redirección estándar de página completa (sin popup): es el flujo nativo
    // de Supabase/Google, sin depender de que el navegador permita cerrar
    // ventanas, ni de trucos con window.name/opener/sessionStorage clonada.
    // redirectTo apunta a la URL actual (misma ruta y query) para volver
    // exactamente a donde estaba el usuario; PlanificadorView.vue ya restaura
    // el borrador pendiente desde sessionStorage en su onMounted.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.href,
      },
    })
    if (error) throw error
  }

  return { user, signIn, signUp, signOut, signInWithGoogle }
}
