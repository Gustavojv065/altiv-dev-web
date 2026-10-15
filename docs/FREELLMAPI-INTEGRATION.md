# FreeLLMAPI no ALTIV DEV

Referência: https://github.com/Enamulitc/free-llm-apis (MIT). Integração via protocolo HTTP, sem copiar o servidor nem banco SQLite para o Next.js.

## Configuração opcional no servidor
- `FREELLMAPI_BASE_URL=https://gateway.seu-dominio/v1`
- `FREELLMAPI_API_KEY=chave-unificada-do-gateway`

O gateway deve ser hospedado separadamente em serviço persistente (Node/Docker); não depende de Cloudflare. Não configure URL localhost em Vercel. Nunca exponha a chave como `NEXT_PUBLIC_*`.

## Comportamento
- O provedor `freellmapi` usa `model: auto` e participa do fallback existente somente quando URL e chave estão configuradas.
- Requisições têm timeout; erros retornam ao roteador para tentar outro provedor.
- O FreeLLMAPI é single-user, não oferece faturamento multi-tenant. Use uma instância privada administrada pelo ALTIV, não permita que clientes acessem o painel do gateway.
- Cotas gratuitas variam por provedor; não prometer disponibilidade nem capacidade agregada.
- Não há instalação automática, chaves cadastradas ou teste de conexão real neste commit.
