import { getExtensionSession } from './session'
import { activateExtension, exitExtension } from './actions'
export const dynamic = 'force-dynamic'

export default async function ExtensionAccessPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const session = await getExtensionSession()
  const { erro } = await searchParams
  return (
    <main className="authPage">
      <section className="authCard">
        <div className="authBrand"><div className="authLogo">A</div><div>
          <strong>ALTIVE DEV Extension</strong><span>Seu acesso à IA e projetos, direto no navegador.</span>
        </div></div>
        {session ? (<>
          <div className="authAlert">Licença ativa para {session.accountName}.</div>
          <p>Válida até {new Date(session.expiresAt).toLocaleDateString('pt-BR')}.</p>
          <p>Acesso validado. Você pode enviar pedidos para seus projetos autorizados sem instalar aplicativos.</p>
          <p><a className="authPrimary" style={{ display: 'inline-block', padding: '12px 18px' }} href="/extension/workspace">Abrir painel de projetos</a></p>
          <form action={exitExtension}><button className="authSecondary">Sair deste dispositivo</button></form>
        </>) : (<>
          {erro && <div className="authAlert error">Código inválido, expirado ou já utilizado. Solicite outro ao administrador.</div>}
          <form action={activateExtension}>
            <label htmlFor="codigo">Código de acesso ALTIVE</label>
            <input id="codigo" name="codigo" required autoComplete="off" maxLength={55} placeholder="ALT-XXXX-XXXX-XXXX-..." />
            <div className="authActions"><button className="authPrimary">Ativar meu acesso</button></div>
          </form>
          <p>Não precisa instalar Termux nem informar sua senha do ChatGPT, Google ou GitHub.</p>
          <small>O código ativa um dispositivo e só pode ser usado uma vez.</small>
        </>)}
      </section>
    </main>
  )
}
