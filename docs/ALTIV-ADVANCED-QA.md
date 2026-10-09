# ALTIV DEV — QA avançado e execução segura

## Estado de integração
- Memória: contexto limitado de conversas do projeto; persistência continua no Supabase existente. Não é banco vetorial.
- Auditoria estática: detector conservador de padrões suspeitos. Não substitui SAST/Opengrep.
- Browser QA: executar em CI isolado, nunca dentro do servidor Next.js de produção.
- Sandbox: não executar código gerado pelo usuário no processo da API. Um SandboxProvider externo exige credenciais, quotas e isolamento de rede.
- Deploy: somente após aprovação do PR e testes.

## Proteções
Segredos exclusivamente no servidor, logs redigidos, acesso por owner_id e RLS, timeout e limites de recursos.
Playwright deve testar apenas URL local da aplicação de teste. Nunca navegar URLs arbitrárias fornecidas por usuários no runner.
