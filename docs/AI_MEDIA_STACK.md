# ALTIV AI Stack — referências e integrações

Este documento lista projetos públicos úteis para o ALTIV. O ALTIV não redistribui código/modelos de terceiros automaticamente.
Cada componente mantém sua própria licença; pesos de modelos podem ter termos diferentes do código-fonte.

## Agentes e apps
- OpenMinis — https://github.com/OpenMinis/OpenMinis
- AnythingLLM — https://github.com/Mintplex-Labs/anything-llm
- AnythingLLM Mobile — https://github.com/Mintplex-Labs/anythingllm-mobile
- LLM Hub — https://github.com/timmyy123/LLM-Hub
- Aider — https://github.com/Aider-AI/aider
- Continue — https://github.com/continuedev/continue
- OpenHands — https://github.com/All-Hands-AI/OpenHands
- Cline — https://github.com/cline/cline
- Roo Code — https://github.com/RooCodeInc/Roo-Code
- Open WebUI — https://github.com/open-webui/open-webui

## Imagem, vídeo e workflows
- ComfyUI — https://github.com/Comfy-Org/ComfyUI
- ComfyUI Agent Toolkit — https://github.com/Zambav/ComfyUI-Agent-Toolkit
- ComfyUI Agent Kit — https://github.com/SlavaSexton/ComfyUI-Agent-Kit
- comfy-agent — https://github.com/shinshin86/comfy-agent
- comfy-agent-tools — https://github.com/quinteroac/comfy-agent-tools
- Wan2.1 — https://github.com/Wan-Video/Wan2.1
- WanVideoWrapper — https://github.com/kijai/ComfyUI-WanVideoWrapper
- Frame Interpolation — https://github.com/Fannovel16/ComfyUI-Frame-Interpolation
- AnimateDiff Evolved — https://github.com/Kosinkadink/ComfyUI-AnimateDiff-Evolved
- IOPaint — https://github.com/Sanster/IOPaint
- Real-ESRGAN — https://github.com/xinntao/Real-ESRGAN
- GFPGAN — https://github.com/TencentARC/GFPGAN
- rembg — https://github.com/danielgatis/rembg
- Diffusers — https://github.com/huggingface/diffusers
- InvokeAI — https://github.com/invoke-ai/InvokeAI
- Fooocus — https://github.com/lllyasviel/Fooocus

## Voz e áudio
- whisper.cpp — https://github.com/ggml-org/whisper.cpp
- OpenVoice — https://github.com/myshell-ai/OpenVoice
- AudioCraft / MusicGen — https://github.com/facebookresearch/audiocraft

## 3D
- TRELLIS — https://github.com/microsoft/TRELLIS
- InstantMesh — https://github.com/TencentARC/InstantMesh

## Estratégia de integração ALTIV
Integrações nativas entram pelo ALTIV Media Worker, atrás do endpoint único `/v1/media/run`.
O frontend chama somente `/api/media/run`, evitando acoplar o app a CLIs Python/CUDA e mantendo a Vercel leve.

Operações já previstas:
- image-generate
- image-edit
- remove-background
- inpaint
- upscale
- face-restore
- video-generate
- video-interpolate
- transcribe
- tts
- music-generate
- generate-3d

## Regra de licenciamento
Antes de distribuir comercialmente um componente, confirmar:
1. licença do código;
2. licença dos pesos/modelos;
3. licença de datasets derivados, quando aplicável;
4. obrigação de atribuição;
5. compatibilidade com distribuição em APK/PWA/SaaS.

Não incorporar diretamente ao APK projetos com licença não comercial sem autorização específica.
