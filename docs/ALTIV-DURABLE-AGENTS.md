# ALTIV DEV — fila durável (implantação em etapas)

## Estado
A migração SQL e o contrato de mensagens foram adicionados ao PR, **não implantados**. O endpoint atual `/api/agent` continua síncrono e sujeito a `maxDuration=300`. Não ativar o modo assíncrono sem worker e testes de recuperação.

## Implantação segura
1. Revisar a migração `20261012000000_altiv_durable_agent_queue.sql`, confirmar que `pgmq` está disponível no projeto Supabase definitivo e aplicá-la no ambiente de staging.
2. Construir worker Node.js persistente no servidor Oracle (ARM64), usando credencial de serviço **somente no servidor**. Consumir com visibility timeout e heartbeat/renovação; jamais expor serviço ao navegador.
3. Refatorar a execução em `/api/agent` para uma função reutilizável pelo worker, sem depender de cookies ou `NextRequest`. Verificar proprietário/projeto em cada operação. O endpoint web deve apenas validar autenticação, cotas e enfileirar.
4. Usar idempotency key por pedido, lock por projeto, checagem de revisão e operações de escrita idempotentes. Só arquivar mensagem depois de confirmar persistência; em falhas, repetir com backoff e limite de tentativas. Proteger contra workers concorrentes.
5. A UI deve consultar `agent_runs` por owner/project e exibir progresso, inclusive após reabrir o navegador. Nunca declarar concluído antes de `status=completed`.
6. Testes obrigatórios: worker reiniciado durante execução, mensagens duplicadas, perda de rede, timeout, troca de usuário/projeto, segredos, quota e rollback. Habilitar por feature flag só depois de passar.

## Segurança e compatibilidade
- Não habilitar execução automática de comandos arbitrários enviados pelo usuário.
- PGMQ é uma fila de mensagens, não sandbox nem executor.
- Não expor `service_role` no frontend, logs ou Vercel client.
- O preview existente e o fluxo GitHub/Vercel ficam inalterados nesta etapa.
- Supabase Queues: https://supabase.com/docs/guides/queues
- PGMQ: https://github.com/pgmq/pgmq
