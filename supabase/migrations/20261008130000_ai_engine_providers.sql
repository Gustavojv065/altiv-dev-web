-- ALTIV AI Engine Manager v1.4
-- Expand encrypted BYOK provider kinds while keeping GitHub support.

alter table if exists public.user_credentials
  drop constraint if exists user_credentials_kind_check;

alter table if exists public.user_credentials
  add constraint user_credentials_kind_check
  check (kind in (
    'openrouter',
    'opencode-zen',
    'openai',
    'gemini',
    'nvidia',
    'groq',
    'cerebras',
    'deepseek',
    'mistral',
    'together',
    'fireworks',
    'xai',
    'anthropic',
    'github'
  ));
