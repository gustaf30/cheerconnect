# ADR 001: Monólito modular com Next.js e Prisma

## Status

Aceito.

## Contexto

O projeto precisa manter feed, mensagens, equipes, eventos, privacidade e operações em uma única implantação de baixo custo, sem perder separação de responsabilidades.

## Decisão

Usar Next.js App Router como frontend e API, Prisma como porta de acesso e PostgreSQL como fonte relacional. Organizar regras por domínio em `src/lib` e por rota em `src/app/api`, mantendo políticas de autorização em helpers compartilhados.

## Consequências

- Deploy e desenvolvimento local são simples.
- A aplicação permanece fácil de escalar horizontalmente quando as filas e o event bus forem adicionados.
- Regras críticas precisam de testes de API e de integração para evitar acoplamento acidental.
