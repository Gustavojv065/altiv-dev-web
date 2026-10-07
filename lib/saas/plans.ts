export type PlanCode = 'free' | 'starter' | 'pro' | 'business'

export type PlanDefinition = {
  code: PlanCode
  label: string
  projects: number
  monthlyAgentRuns: number
  members: number
  customDomain: boolean
  privateRepositories: boolean
  priorityModels: boolean
}

export const SAAS_PLANS: Record<PlanCode, PlanDefinition> = {
  free: {
    code: 'free',
    label: 'Free',
    projects: 2,
    monthlyAgentRuns: 30,
    members: 1,
    customDomain: false,
    privateRepositories: false,
    priorityModels: false,
  },
  starter: {
    code: 'starter',
    label: 'Starter',
    projects: 10,
    monthlyAgentRuns: 300,
    members: 2,
    customDomain: true,
    privateRepositories: true,
    priorityModels: false,
  },
  pro: {
    code: 'pro',
    label: 'Pro',
    projects: 50,
    monthlyAgentRuns: 2000,
    members: 5,
    customDomain: true,
    privateRepositories: true,
    priorityModels: true,
  },
  business: {
    code: 'business',
    label: 'Business',
    projects: 250,
    monthlyAgentRuns: 10000,
    members: 25,
    customDomain: true,
    privateRepositories: true,
    priorityModels: true,
  },
}
