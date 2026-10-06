import { login, signup } from './actions'

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; message?: string }> }) {
  const params = await searchParams
  return (
    <main className="authPage">
      <section className="authCard">
        <div className="authBrand"><div className="authLogo">A</div><div><strong>ALTIV DEV</strong><span>Entre para continuar criando.</span></div></div>
        {params.error && <div className="authAlert error">{params.error}</div>}
        {params.message && <div className="authAlert">{params.message}</div>}
        <form>
          <label>Nome</label><input name="display_name" placeholder="Seu nome" />
          <label>E-mail</label><input name="email" type="email" required placeholder="voce@email.com" />
          <label>Senha</label><input name="password" type="password" minLength={6} required placeholder="••••••••" />
          <div className="authActions"><button formAction={login} className="authPrimary">Entrar</button><button formAction={signup} className="authSecondary">Criar conta</button></div>
        </form>
      </section>
    </main>
  )
}
