'use client'

import { useState } from 'react'

type Plan = {
  code:string
  name:string
  price_monthly_brl:number|null
  limits:Record<string,unknown>
  features:Record<string,unknown>
}

export default function BillingPlansClient({plans,currentPlan}:{plans:Plan[];currentPlan:string}) {
  const [busy,setBusy] = useState<string|null>(null)
  const [message,setMessage] = useState('')

  async function subscribe(planCode:string) {
    setBusy(planCode); setMessage('')
    try {
      const response = await fetch('/api/billing/mercado-pago/subscribe', {
        method:'POST',
        headers:{'content-type':'application/json'},
        body:JSON.stringify({planCode}),
      })
      const data = await response.json()
      if (!data.ok) return setMessage(data.error || 'Não foi possível iniciar o pagamento.')
      window.location.href = data.checkoutUrl
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      {message && <div className="authAlert error">{message}</div>}
      <div className="billingPlanGrid">
        {plans.map((plan) => (
          <article className={'billingPlanCard ' + (plan.code === currentPlan ? 'current' : '')} key={plan.code}>
            <span>{plan.name}</span>
            <strong>{plan.code === 'free' ? 'R$ 0' : plan.price_monthly_brl ? 'R$ ' + Number(plan.price_monthly_brl).toFixed(2).replace('.',',') + '/mês' : 'Preço a definir'}</strong>
            <small>{plan.code === currentPlan ? 'Plano atual' : 'Disponível'}</small>
            {plan.code !== 'free' && (
              <button disabled={!plan.price_monthly_brl || busy !== null} onClick={() => subscribe(plan.code)}>
                {busy === plan.code ? 'Abrindo Mercado Pago…' : 'Assinar com Mercado Pago'}
              </button>
            )}
          </article>
        ))}
      </div>
    </>
  )
}
