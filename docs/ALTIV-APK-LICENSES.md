# ALTIV DEV AI — licenças pelo Painel Master ALTIV DEV Web

## Decisão de produto
O site ALTIV DEV Web continua sendo **o único Painel Master**, com a seção
`/admin/apk-licenses`. Os clientes usam apenas o APK ALTIV DEV AI com
e-mail + senha e uma assinatura de 30 dias. **Não criar outro painel**.
A licença do APK não muda os planos Free/Starter/Pro/Business do site.

## Compatibilidade (já implementada no APK, PR #12)
O APK usa a API Supabase Auth Password, a tabela
`public.altiv_service_subscriptions` e a função RPC
`public.altiv_my_subscription()`. Por isso o APK e o painel devem apontar
para **o mesmo projeto Supabase Auth**.

Configurações do ALTIV DEV Web (Vercel, servidor):
- `NEXT_PUBLIC_SUPABASE_URL` — URL do Supabase do painel.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — chave pública do cliente.
- `SUPABASE_SERVICE_ROLE_KEY` — SOMENTE no servidor do painel.
- `ALTIV_SUPER_ADMIN_IDS` e/ou `ALTIV_SUPER_ADMIN_EMAILS` —
  lista de administradores confiáveis que podem gerenciar licenças.
- `NEXT_PUBLIC_SITE_URL` — endereço HTTPS real do site (ex.: URL do Vercel).

Configurações de build do ALTIV DEV AI Android (segredos do repositório GitHub):
- `ALTIV_COMMERCIAL_URL` = mesma URL pública de Supabase do painel.
- `ALTIV_COMMERCIAL_PUBLISHABLE_KEY` = mesma chave publicável do painel.

**Nunca** usar `SUPABASE_SERVICE_ROLE_KEY` ou qualquer chave secreta de banco
no Android; BuildConfig e APK são publicamente inspecionáveis.

## Migração
A migração `supabase/migrations/20261105010000_altiv_apk_licenses.sql`
cria tabela e função RPC independentes das tabelas SaaS.
1. Inspecionar ambiente, backups e migrações já aplicadas.
2. Aplicar **primeiro em staging**, testar e validar advisors.
3. Confirmar RLS: cliente A só lê sua licença, não altera status/vencimento,
   não vê auditoria e não obtém dados de B.
4. Aprovar explicitamente projeto/ambiente antes da aplicação em produção.

## Fluxos
1. Admin em `/admin/apk-licenses` convida e-mail novo. O Supabase envia
   link de convite com redirecionamento permitido para `https://SEU_SITE/ativar`.
2. Cliente abre o convite e define uma senha (12+ caracteres com tipos
   obrigatórios). O convite deve criar sessão Supabase válida. Ao final,
   o cliente usa o APK com o e-mail/senha; não recebe uma senha por WhatsApp.
3. O painel cria a licença de 30 dias a contar da emissão do convite.
4. O APK chama `altiv_my_subscription`, que usa `now()` do servidor.
   Após 30 dias, o acesso **aos serviços comerciais hospedados** expira.
   Projetos, conversas e funcionalidades locais do APK GPL permanecem.
5. O administrador pode renovar mais 30 dias ou suspender diretamente
   da mesma seção. Uma conta já cadastrada pode ser vinculada por UUID
   (Supabase Auth > Users).
6. A emissão e alterações geram evento interno de auditoria.

## Cuidados importantes
- Supabase Auth deve permitir a URL `/ativar` em **Authentication > URL Configuration**.
- Verificar template **Invite user** e o fluxo de redirecionamento.
  Convites expiram. Pode ser necessário SMTP próprio para entrega confiável.
- Se um e-mail já possui conta, use Vincular por UUID; enviar convite para
  usuário confirmado pode retornar erro.
- Se falhar a gravação da licença após o convite, **não reenvie convites
  repetidamente**. Localize o usuário e vincule a licença no formulário.
- No APK, cada funcionalidade premium hospedada precisa validar a assinatura
  no backend por requisição. A UI sozinha **não** protege serviços remotos.
- Sem as variáveis de build, o APK mostra o aviso de integração não configurada
  e mantém suas ferramentas locais disponíveis.

## Homologação obrigatória (sem dados reais)
- Aplicar em staging e convidar cliente fictício A por e-mail.
- Confirmar senha e login no APK, RPC retorna `is_active=true`.
- Usuário B não enxerga A; JWT de B não obtém dados de A.
- Tentar UPDATE/INSERT de assinatura como usuário A; negar.
- Suspender A no Painel Master, atualizar APK, acesso remoto é negado.
- Renovar 30 dias e confirmar vencimento; relógio Android alterado não ajuda.
- Testar offline, logout, 401/429 e ausência de vazamento de segredos.
- Verificar compatibilidade de assinatura e versão Android e ausência de tela preta.
- Depois que CI estiver verde, só fazer merge com aprovação.

## Nota jurídica
O APK deriva de OpenMinis (GPL-3.0). O painel administra a assinatura dos
serviços comerciais ALTIV; não controla propriedade do código-fonte GPL nem
deve impedir o cliente de manter seus arquivos locais.
