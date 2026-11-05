'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ActivateApkAccountPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const supabase = createClient()
    const check = async () => {
      try {
        const { data, error } = await supabase.auth.getUser()
        if (!mounted) return
        if (error || !data.user) {
          setError('Convite vencido ou inválido. Solicite novo convite ao administrador ALTIV.')
        } else {
          setReady(true)
        }
      } catch {
        if (mounted) setError('Não foi possível validar seu convite. Tente novamente.')
      }
    }
    void check()
    return () => { mounted = false }
  }, [])

  async function activate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return
    if (password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) ||
      !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      setError('Use no mínimo 12 caracteres, com maiúscula, minúscula, número e símbolo.')
      return
    }
    if (password !== confirmation) {
      setError('As senhas digitadas são diferentes.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      // Credentials are now known only to the invited customer. On the APK,
      // they sign in with their e-mail/password and retrieve their entitlement.
      await supabase.auth.signOut()
      setPassword('')
      setConfirmation('')
      router.replace('/login?message=' + encodeURIComponent('Senha criada. Entre no aplicativo ALTIV DEV AI com seu e-mail e senha.'))
    } catch {
      setError('Não foi possível definir a senha. Verifique o convite e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return <main className="authPage">
    <section className="authCard">
      <div className="authBrand"><div className="authLogo">A</div>
        <div><strong>ALTIV DEV AI</strong><span>Ativação de acesso ao aplicativo</span></div>
      </div>
      <h1>Criar sua senha</h1>
      <p>Seu administrador enviou um convite para acessar os serviços ALTIV pelo APK Android.</p>
      {error && <div className="authAlert error" role="alert">{error}</div>}
      {!ready && !error && <p>Validando convite...</p>}
      {ready && <form onSubmit={activate}>
        <label htmlFor="new-apk-password">Nova senha</label>
        <input id="new-apk-password" name="password" type="password" autoComplete="new-password"
          value={password} onChange={e => setPassword(e.target.value)} required minLength={12} />
        <label htmlFor="confirm-apk-password">Confirme sua senha</label>
        <input id="confirm-apk-password" type="password" autoComplete="new-password"
          value={confirmation} onChange={e => setConfirmation(e.target.value)} required minLength={12} />
        <small>Use pelo menos 12 caracteres, incluindo letras maiúsculas e minúsculas, número e símbolo.</small>
        <div className="authActions"><button type="submit" disabled={loading} className="authPrimary">
          {loading ? 'Ativando...' : 'Criar senha'}
        </button></div>
      </form>}
      <p>Depois, abra o ALTIV DEV AI e faça login com seu e-mail e a senha criada. Seu acesso aos serviços comerciais depende da validade da assinatura.</p>
    </section>
  </main>
}
