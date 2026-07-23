# Plano de refatoracao Clean Architecture

Este documento registra o caminho incremental para separar regra de negocio,
infraestrutura, HTTP e UI sem reescrever o sistema de uma vez.

## Estado atual

- O projeto ja possui nucleos em `src/domain`, `src/application` e `src/infrastructure`.
- Parte dos fluxos ja passa por use cases, principalmente vendas, produtos, financeiro, trocas e alguns pontos de live.
- Muitos Route Handlers ainda acessam Supabase e servicos externos diretamente.
- As paginas do dashboard concentram UI, estado, fluxo e chamadas HTTP no mesmo arquivo.
- O modulo `live` e o melhor piloto porque concentra o maior arquivo de UI e muitas regras de negocio.

## Arquitetura alvo

```text
src/
  domain/              entidades, value objects, regras puras e erros
  application/         use cases, DTOs e ports
  infrastructure/      adapters Supabase, Z-API, Melhor Envio, Google, OpenAI e PDF
  presentation/
    http/              presenters, validadores e helpers de controller
    frontend/          view-models, hooks e componentes de feature
  app/                 rotas Next.js e composicao de paginas
```

## Fase 0 - estabilizacao

- Corrigir testes quebrados.
- Rodar `npm test -- --run`, `npm run lint` e `npm run build`.
- Registrar os fluxos criticos: live, vendas, clientes, etiquetas, financeiro.
- Padronizar resposta HTTP para sucesso, erro e paginacao.

## Fase 1 - backend por casos de uso

- Tornar Route Handlers finos: autenticar, ler request, chamar use case, apresentar resposta.
- Mover queries Supabase para repositories/readers.
- Mover Z-API, Melhor Envio, Google e OpenAI para gateways.
- Prioridade: `live`, `clientes`, `etiquetas`, `vendas/trocas`, `financeiro/configuracoes/cron`.

## Fase 2 - dominio e aplicacao

- Consolidar regras puras em entidades e value objects.
- Mover calculos de total, credito, estoque, status de compra e parcelamento para dominio/application.
- Remover compatibilidade de schema antigo das rotas HTTP; quando necessaria, manter temporariamente nos adapters.

## Fase 3 - frontend por features

- Quebrar paginas grandes em componentes, hooks e view-models por modulo.
- Exemplo para live:

```text
src/features/live/
  components/
  hooks/
  services/
  view-models/
  types.ts
```

- Deixar `src/app/(dashboard)/*/page.tsx` como composicao de tela, nao como deposito de fluxo.

## Fase 4 - contratos e seguranca

- Adicionar schemas de entrada/saida nas bordas HTTP.
- Impedir imports indevidos entre camadas.
- Revisar rotas admin, cron e webhook.
- Garantir que chaves sensiveis so sejam usadas no servidor.

## Fase 5 - validacao final

- Ampliar testes unitarios de dominio/use cases.
- Adicionar testes de contrato dos Route Handlers principais.
- Validar smoke E2E dos fluxos criticos antes de deploy.

## Piloto iniciado

O primeiro corte foi no endpoint `GET/POST /api/live`:

- `ListarLivesUseCase`
- `CriarLiveUseCase`
- `ILiveRepository`
- `LiveRepositorySupabase`

A rota continua com o mesmo contrato externo, mas a regra de entrada e persistencia saiu do controller.
