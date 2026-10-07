export type AltivSkill = {
  id: string
  label: string
  keywords: RegExp
  guidance: string
}

export const ALTIV_SKILLS: AltivSkill[] = [
  {
    id: 'premium-design',
    label: 'Design profissional',
    keywords: /site|página|landing|design|visual|premium|modern|layout/i,
    guidance: 'Planeje hierarquia editorial, sistemas de espaçamento, tipografia, diferenciação visual das seções, contraste e componentes reutilizáveis. Não confunda premium com fundo preto em tudo.',
  },
  {
    id: 'responsive',
    label: 'Responsividade',
    keywords: /site|layout|responsiv|celular|mobile|tablet|desktop|menu/i,
    guidance: 'Valide conteúdo e navegação em 390px, 768px, 1024px e 1440px. Evite overflow horizontal, elementos cortados e alvos de toque pequenos.',
  },
  {
    id: 'accessibility',
    label: 'Acessibilidade',
    keywords: /site|página|interface|formulário|acessib|contraste|botão/i,
    guidance: 'Use marcação semântica, títulos lógicos, labels, estados de foco visíveis, contraste adequado e ações operáveis pelo teclado.',
  },
  {
    id: 'seo',
    label: 'SEO técnico',
    keywords: /site|landing|seo|google|busca|divulg|empresa/i,
    guidance: 'Crie título descritivo, meta description coerente, H1 único, estrutura semântica e conteúdo específico, sem alegar resultados de SEO não medidos.',
  },
  {
    id: 'conversion',
    label: 'Conversão comercial',
    keywords: /site|loja|serviço|venda|agend|lead|contato|whatsapp|chamada/i,
    guidance: 'Priorize proposta de valor clara, prova social não inventada, CTA funcional, jornada do visitante e dados de negócio explícitos em vez de contatos fictícios.',
  },
  {
    id: 'debug',
    label: 'Correção precisa',
    keywords: /erro|bug|corrig|quebr|falha|consert|não funciona|problema/i,
    guidance: 'Localize a causa raiz, altere apenas o necessário, preserve o comportamento existente e não reporte testes que não foram executados.',
  },
  {
    id: 'safe-edit',
    label: 'Edição segura',
    keywords: /editar|alterar|trocar|adicionar|melhorar|corrig|refatorar/i,
    guidance: 'Preserve conteúdo, marca, rotas e funcionalidades não afetadas. Não reescreva integralmente quando uma edição pontual bastar.',
  },
]

export function selectAltivSkills(request: string, maxSkills = 5): AltivSkill[] {
  const matched = ALTIV_SKILLS.filter((skill) => skill.keywords.test(request))
  return matched.slice(0, maxSkills)
}

export function buildSkillInstructions(request: string): string {
  const selected = selectAltivSkills(request)
  if (!selected.length) return ''
  return selected.map((skill) => skill.label + ': ' + skill.guidance).join('\n')
}
