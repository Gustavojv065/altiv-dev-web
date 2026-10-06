export const capabilities = {
  github: {
    importRepo: true,
    createRepo: 'via GitHub App/API when token has repo creation permission',
    commit: true,
    branch: true,
    pullRequest: true,
  },
  vercel: {
    previewDeploy: true,
    productionDeploy: true,
    sandbox: true,
    logs: true,
  },
  supabase: {
    auth: true,
    database: true,
    storage: true,
    vectors: true,
    realtime: true,
  },
  browser: {
    chromeDevtoolsMcp: 'planned',
    browserUse: 'planned',
    screenshotReview: 'planned',
  },
} as const
