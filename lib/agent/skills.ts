export type SkillCategory =
  | 'core'
  | 'web'
  | 'mobile'
  | 'backend'
  | 'git'
  | 'quality'
  | 'agent'
  | 'deploy'

export type AltivSkill = {
  id: string
  label: string
  category: SkillCategory
  keywords: RegExp
  guidance: string
  priority?: number
  alwaysOn?: boolean
}

export const ALTIV_SKILLS: AltivSkill[] = [
  {
    id: 'safe-edit',
    label: 'Edição segura',
    category: 'core',
    alwaysOn: true,
    priority: 100,
    keywords: /./i,
    guidance: 'Preserve conteúdo, marca, rotas e funcionalidades não afetadas. Prefira mudanças cirúrgicas quando o pedido for pontual e só faça redesign amplo quando isso for pedido.',
  },
  {
    id: 'repository-analysis',
    label: 'Análise do repositório',
    category: 'core',
    alwaysOn: true,
    priority: 95,
    keywords: /./i,
    guidance: 'Antes de editar, identifique stack, rotas, arquivos centrais, convenções, scripts de build e integrações. Não assuma uma arquitetura sem verificar os arquivos.',
  },
  {
    id: 'premium-design',
    label: 'Design profissional',
    category: 'web',
    priority: 80,
    keywords: /site|página|landing|design|visual|premium|modern|layout|redesign|interface/i,
    guidance: 'Planeje hierarquia editorial, spacing, tipografia, contraste, estados e componentes reutilizáveis. Premium não significa fundo preto em todas as seções.',
  },
  {
    id: 'responsive',
    label: 'Responsividade',
    category: 'web',
    priority: 78,
    keywords: /site|layout|responsiv|celular|mobile|tablet|desktop|menu|pwa/i,
    guidance: 'Valide 390px, 768px, 1024px e 1440px. Evite overflow horizontal, controles cortados, fontes ilegíveis e alvos de toque pequenos.',
  },
  {
    id: 'accessibility',
    label: 'Acessibilidade',
    category: 'quality',
    priority: 65,
    keywords: /site|página|interface|formulário|acessib|contraste|botão|menu/i,
    guidance: 'Use HTML semântico, labels, foco visível, navegação por teclado, aria somente quando necessário e contraste adequado.',
  },
  {
    id: 'seo',
    label: 'SEO técnico',
    category: 'web',
    priority: 60,
    keywords: /site|landing|seo|google|busca|divulg|empresa|marketing/i,
    guidance: 'Inclua title, meta description, um único H1, estrutura semântica e conteúdo específico. Não invente resultados de SEO.',
  },
  {
    id: 'conversion',
    label: 'Conversão comercial',
    category: 'web',
    priority: 62,
    keywords: /site|loja|serviço|venda|agend|lead|contato|whatsapp|chamada|conversão/i,
    guidance: 'Priorize proposta de valor clara, CTAs funcionais, jornada do visitante e prova social real. Nunca invente telefone, avaliações ou depoimentos.',
  },
  {
    id: 'react-next',
    label: 'React + Next.js',
    category: 'web',
    priority: 85,
    keywords: /react|next|nextjs|tsx|jsx|componente|app router|server component/i,
    guidance: 'Respeite a fronteira server/client, minimize estado duplicado, mantenha componentes pequenos e preserve compatibilidade com a versão instalada.',
  },
  {
    id: 'typescript',
    label: 'TypeScript seguro',
    category: 'quality',
    priority: 72,
    keywords: /typescript|tsx|tipo|typecheck|tipagem|interface/i,
    guidance: 'Evite any desnecessário, valide dados de entrada e mantenha contratos entre API, UI e banco coerentes.',
  },
  {
    id: 'tailwind-css',
    label: 'CSS e Tailwind',
    category: 'web',
    priority: 55,
    keywords: /tailwind|css|estilo|layout|design|responsiv|tema/i,
    guidance: 'Preserve o sistema visual existente, use tokens e classes consistentes e evite duplicação de estilos ou overrides frágeis.',
  },
  {
    id: 'supabase',
    label: 'Supabase',
    category: 'backend',
    priority: 82,
    keywords: /supabase|postgres|sql|banco|auth|rls|storage|database/i,
    guidance: 'Use RLS, escopo por usuário/tenant, migrations idempotentes e nunca exponha service role no cliente.',
  },
  {
    id: 'api-security',
    label: 'Segurança de APIs',
    category: 'backend',
    priority: 88,
    keywords: /api|token|chave|secret|oauth|webhook|provider|github|openrouter|openai|gemini/i,
    guidance: 'Segredos ficam somente no servidor. Valide entrada, normalize URLs, aplique timeouts, trate rate limits e nunca registre chaves completas.',
  },
  {
    id: 'git-github',
    label: 'Git + GitHub',
    category: 'git',
    priority: 90,
    keywords: /git|github|repo|repositório|branch|commit|push|pull request|merge/i,
    guidance: 'Leia o estado atual, faça diff mínimo, preserve histórico, prefira branch/PR para mudanças amplas e confirme build antes do push.',
  },
  {
    id: 'vercel-deploy',
    label: 'Vercel e deploy',
    category: 'deploy',
    priority: 76,
    keywords: /vercel|deploy|publicar|produção|preview|domínio|hosting/i,
    guidance: 'Valide build, variáveis de ambiente e framework antes do deploy. Não exponha secrets e mantenha preview separado de produção quando possível.',
  },
  {
    id: 'pwa',
    label: 'PWA',
    category: 'mobile',
    priority: 58,
    keywords: /pwa|offline|manifest|service worker|instalar|android|iphone/i,
    guidance: 'Garanta manifest válido, estratégia offline previsível, atualização segura do service worker e UX instalável em mobile e desktop.',
  },
  {
    id: 'expo-router',
    label: 'Expo Router',
    category: 'mobile',
    priority: 54,
    keywords: /expo router|expo-router|react native|rota mobile/i,
    guidance: 'Use file-based routing, layouts, deep links e separação adequada entre rotas e componentes.',
  },
  {
    id: 'expo-native-client',
    label: 'Expo Native Client',
    category: 'mobile',
    priority: 52,
    keywords: /expo|react native|native client|apk|android|ios/i,
    guidance: 'Evite APIs incompatíveis com Expo Go quando o projeto não usa development build e mantenha permissões explícitas.',
  },
  {
    id: 'brainstorming',
    label: 'Brainstorming',
    category: 'agent',
    priority: 42,
    keywords: /ideia|brainstorm|opções|alternativas|conceito|criar do zero/i,
    guidance: 'Gere poucas opções distintas, compare trade-offs e escolha uma direção antes de implementar.',
  },
  {
    id: 'writing-plans',
    label: 'Planejamento de execução',
    category: 'agent',
    priority: 70,
    keywords: /planej|arquitet|estrutura|grande|complex|migr|refator/i,
    guidance: 'Divida a tarefa em etapas verificáveis, defina arquivos-alvo, riscos e critérios de conclusão antes de editar.',
  },
  {
    id: 'systematic-debugging',
    label: 'Debug sistemático',
    category: 'quality',
    priority: 92,
    keywords: /erro|bug|corrig|quebr|falh|crash|trav|não funciona|problema/i,
    guidance: 'Reproduza ou inferira evidências, isole a causa raiz, corrija o mínimo necessário e valide regressões relacionadas.',
  },
  {
    id: 'test-driven-development',
    label: 'Testes orientados à mudança',
    category: 'quality',
    priority: 68,
    keywords: /teste|test|regress|bug|refator|lógica|api/i,
    guidance: 'Quando houver infraestrutura de testes, escreva ou atualize testes focados no comportamento alterado antes de declarar conclusão.',
  },
  {
    id: 'verification-before-completion',
    label: 'Verificação antes de concluir',
    category: 'quality',
    alwaysOn: true,
    priority: 99,
    keywords: /./i,
    guidance: 'Antes de concluir, execute as verificações disponíveis: typecheck, testes, lint e build. Se algo não puder ser executado, diga claramente.',
  },
  {
    id: 'code-review',
    label: 'Revisão de código',
    category: 'quality',
    priority: 64,
    keywords: /review|revis|auditor|qualidade|segurança|pr/i,
    guidance: 'Revise regressões, segurança, tipos, acessibilidade, performance e complexidade antes de aprovar a mudança.',
  },
  {
    id: 'parallel-agents',
    label: 'Subagentes paralelos',
    category: 'agent',
    priority: 45,
    keywords: /grande|complex|múltipl|varredura|auditoria|projeto inteiro/i,
    guidance: 'Separe apenas tarefas independentes. Consolide resultados e evite que subagentes editem o mesmo arquivo simultaneamente.',
  },
  {
    id: 'skill-creator',
    label: 'Criação de Skills',
    category: 'agent',
    priority: 35,
    keywords: /skill|habilidade|especialista|nova capacidade/i,
    guidance: 'Crie skills pequenas, específicas, testáveis e acionadas por intenção. Evite duplicar instruções já cobertas por outra skill.',
  },
]

function scoreSkill(skill: AltivSkill, request: string) {
  let score = skill.priority ?? 0
  if (skill.alwaysOn) score += 1000
  if (skill.keywords.test(request)) score += 250
  return score
}

export function selectAltivSkills(request: string, maxSkills = 8): AltivSkill[] {
  const selected = ALTIV_SKILLS
    .filter((skill) => skill.alwaysOn || skill.keywords.test(request))
    .map((skill) => ({ skill, score: scoreSkill(skill, request) }))
    .sort((a, b) => b.score - a.score)
    .map(({ skill }) => skill)

  const deduped = Array.from(new Map(selected.map((skill) => [skill.id, skill])).values())
  return deduped.slice(0, Math.max(3, maxSkills))
}

export function buildSkillInstructions(request: string): string {
  const selected = selectAltivSkills(request)
  if (!selected.length) return ''
  return selected
    .map((skill) => '[' + skill.category.toUpperCase() + '] ' + skill.label + ': ' + skill.guidance)
    .join('\n')
}
