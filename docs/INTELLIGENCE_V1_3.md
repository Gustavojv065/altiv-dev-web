# ALTIV Intelligence v1.3

Este pacote consolida a próxima camada de inteligência do ALTIV DEV em um único PR.

## Objetivo

Transformar o ALTIV de um gerador que responde a prompts em um ambiente coordenado de trabalho:

pedido → orquestrador → skills → arquivos → execução → verificação → preview → aprovação → GitHub.

## Implementado neste PR

- Orquestrador central com intenção, agentes, skills, mídia, paleta e checkpoints.
- Seleção de arquivos para HTML/CSS/JS e stacks React/Next/Vite/Vue/Svelte/Astro.
- Edição cirúrgica de caminhos reais do repositório, não apenas index.html/styles.css/script.js.
- Verificação para impedir falsa conclusão quando a IA não altera de fato os arquivos.
- Pedidos de tema/paleta passam a considerar CSS e componentes com estilos inline.
- Skills de verificação visual, direção de mídia, preview/runtime e snapshots.
- Media API protegida por login + ownership do projeto.
- Full Agent passa a coordenar Media Agent quando o pedido exige imagem/vídeo.
- Importação GitHub cria snapshot inicial antes das alterações.
- Preview estático suporta múltiplos arquivos HTML e seletor de página.
- Detecção da stack importada e indicação de runtime no Studio.
- Barra superior com Site, Código, Arquivos, Versões, dispositivos, reload manual e auto refresh após edição.
- Confirmação explícita antes de branch/commit/PR no GitHub.

## Ideias incorporadas de builders/agentes web

Usamos padrões arquiteturais, respeitando licenças dos projetos estudados:

1. Preview real e edição iterativa no navegador.
2. Workspace reversível com snapshots.
3. Agente que valida a própria alteração antes de concluir.
4. Separação entre orquestração, skills, execução e QA.

Também preservamos os aprendizados de OpenMinis, AnythingLLM, LLM Hub, Continue e dos builders web analisados. Código com licença incompatível não é copiado para o produto comercial.

## Mídia

A integração de imagem/vídeo está preparada para o ALTIV Media Worker. Quando o worker retorna um asset imediato, o agente recebe a URL no contexto de construção.

Variáveis:

- ALTIV_MEDIA_WORKER_URL
- ALTIV_MEDIA_API_KEY
- COMFYUI_BASE_URL

Sem worker configurado, o agente não deve inventar URLs de mídia.

## Próximo estágio do preview

HTML estático já pode ser renderizado diretamente no Studio.

Projetos Next.js, React/Vite, Vue, Svelte e Astro são detectados, porém um preview fiel requer um runtime/sandbox externo que instale dependências e execute o projeto isoladamente. A detecção e a UX já estão preparadas para esse próximo estágio.

## Critério para merge

Antes do merge:

- Vercel build verde.
- Testar criação e edição de site.
- Testar mudança de paleta azul/branco.
- Testar importação GitHub + snapshot.
- Testar reload automático/manual do preview.
- Testar branch/commit/PR com confirmação.
- Testar Media Studio com e sem worker configurado.
