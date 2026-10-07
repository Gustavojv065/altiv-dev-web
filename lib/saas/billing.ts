export type BillingProvider = 'manual' | 'mercado_pago' | 'stripe'

export type BillingReference = {
  provider: BillingProvider
  customerId?: string | null
  subscriptionId?: string | null
}

export function billingProviderEnabled(provider:BillingProvider) {
  if (provider === 'manual') return true
  if (provider === 'mercado_pago') return Boolean(process.env.MERCADO_PAGO_ACCESS_TOKEN)
  if (provider === 'stripe') return Boolean(process.env.STRIPE_SECRET_KEY)
  return false
}

export function billingReadiness() {
  return {
    manual:true,
    mercadoPago:billingProviderEnabled('mercado_pago'),
    stripe:billingProviderEnabled('stripe'),
  }
}
