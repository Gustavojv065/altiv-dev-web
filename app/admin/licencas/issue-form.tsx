'use client'
import { useActionState } from 'react'
import { issueExtensionLicense, type IssueState } from './actions'
type Account = { id: string; name: string }
const initial: IssueState = { error: '', code: '' }

export default function IssueForm({ accounts }: { accounts: Account[] }) {
  const [state, action, pending] = useActionState(issueExtensionLicense, initial)
  return (
    <section className="adminPanel">
      <h2>Emitir código de acesso — 30 dias</h2>
      <form action={action}>
        <label htmlFor="account_id">Conta do cliente</label>
        <select id="account_id" name="account_id" required defaultValue="">
          <option value="" disabled>Selecione uma conta</option>
          {accounts.map((a) => <option value={a.id} key={a.id}>{a.name}</option>)}
        </select>
        <button disabled={pending || accounts.length === 0}>{pending ? 'Emitindo...' : 'Gerar código'}</button>
      </form>
      {state.error && <p role="alert" className="authAlert error">{state.error}</p>}
      {state.code && <div className="authAlert" role="status">
        <p><strong>Copie agora — este código só será exibido uma vez:</strong></p>
        <code style={{ overflowWrap: 'anywhere', userSelect: 'all' }}>{state.code}</code>
      </div>}
    </section>
  )
}
