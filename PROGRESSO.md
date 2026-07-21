# 3core — Progresso do Projeto

Histórico de funcionalidades implementadas no dashboard e na API.

---

## Stack

- **API**: NestJS 11 + TypeORM + PostgreSQL (Supabase)
- **Dashboard**: Nuxt 4 + Nuxt UI + TypeScript
- **Storage**: Supabase Storage (bucket privado via `@supabase/storage-js`)
- **Auth**: JWT com permissões embutidas no payload; guards globais (fail-closed)

---

## Funcionalidades implementadas

### Autenticação e RBAC

- Login com JWT; token armazenado em cookie `auth_token`
- Payload JWT com array `permissions[]` achatado (autorização sem hit no banco)
- `GET /auth/me` relê do banco (reflete trocas de papel após re-login)
- Guards globais via `APP_GUARD`: `JwtAuthGuard` + `PermissionsGuard`
- `@Public()` para rotas abertas; `@RequirePermissions('key')` para controle fino
- `@CurrentUser()` injeta o usuário autenticado nos handlers
- Catálogo de permissões em `src/auth/permissions.catalog.ts` (fonte única)
- Papéis de sistema imutáveis: `super_admin` (todas as perms) e `tecnico`
- UI de gerenciamento de papéis (`/settings/roles`) com `useConfirm` para exclusão

### Modelo de Cidades (IBGE)

- Tabela `cities` com 5.571 municípios brasileiros (código IBGE 7 dígitos, lat/lng, UF, região, capital)
- Migração carrega `src/migrations/data/cities.json` em lotes de 500 rows
- Colunas `cidade`/`estado` (texto livre) removidas de `clients` e `tech_profiles`; substituídas por FK `cityCode`
- Backfill de dados existentes via `translate()` para normalização de acentos (sem extensão `unaccent` no Supabase)
- `GET /cities/search` — autocomplete público por nome/UF
- `GET /cities/ufs` — lista de UFs disponíveis
- `CityAutocomplete.vue` — componente reutilizável com v-model no código IBGE

### Clientes

- Tabela `clients`: PJ/PF, CPF/CNPJ (partial-unique index), `cityCode` FK
- CRUD completo: criar, listar (search/tipo/UF/cidade), visualizar, editar, excluir
- Permissões: `clientes.ver`, `clientes.criar`, `clientes.editar`, `clientes.excluir`
- `ClientForm.vue` com toggle PJ/PF e `CityAutocomplete`
- Rotas: `/clientes`, `/clientes/novo`, `/clientes/:id`, `/clientes/:id/editar`

### Técnicos

- Perfil completo: dados pessoais, endereço (ViaCEP), financeiro (valor/hora, custo/km), empresa, ferramental, áreas de atuação
- Cidades atendidas com `custoKm` individual por cidade (tabela `tech_service_areas`)
- `parseBrMoney()` idempotente em `src/common/br-money.ts` — evita multiplicação por 100 no round-trip de edição
- Permissões: `tecnicos.ver` (listar/visualizar) e `tecnicos.gerenciar` (CRUD completo)
- API paginada `GET /technicians` com filtros server-side: busca, UF (multi), status ativo/inativo, cidade atendida
- Violações únicas (email/CPF duplicado) traduzidas de erro Postgres `23505` para HTTP `409` amigável
- `DELETE /technicians/:id` bloqueia com `409` se houver chamados vinculados (transaction com `SELECT ... FOR UPDATE`)
- `TechnicianForm.vue` — formulário completo com todos os campos
- Rotas: `/technicians`, `/technicians/novo`, `/technicians/:id`, `/technicians/:id/editar`
- Ações com `useConfirm`: ativar/desativar, excluir

### Chamados (Atendimentos)

Ciclo de vida completo de chamados de serviço:

**Statuses**: `aberto → atribuido → a_caminho → em_atendimento → finalizado → fechado` (ou `cancelado`)

**Entidades**:
- `chamados` — cabeçalho com snapshot de rates do técnico (`snapValorHora`, `snapCustoPorKm`, `snapCustoKmCidade`), totais congelados no fechamento (`valoresCongeladosEm`), `@VersionColumn` para concorrência
- `chamado_line_items` — itens de receita/custo
- `chamado_events` — log de auditoria imutável
- `chamado_rats` — arquivos RAT anexados

**Endereço**: `cityCode` obrigatório + endereço completo opcional (CEP/logradouro/número/bairro/complemento/`pontoReferencia`)

**Segurança**:
- IDOR fix: técnico só edita chamados atribuídos a ele (não-gerentes)
- Metadata financeira de eventos ocultada para quem não tem `financeiro.ver`

**Filtros server-side** (chamados/index):
- Busca por código/título/cliente
- Multi-select: status, prioridade, técnicos
- DateRangePicker para criado/agendado/finalizado (com timezone `America/Sao_Paulo`)
- Paginação: padrão 50, opções 50/100/200; `pageSize` muda reset para página 1

**Upload de RATs**:
- `StorageClient` do `@supabase/storage-js` (não o `supabase-js` completo — evita crash no Node 20 por WebSocket eager-init)
- Upload via URL assinada (cliente faz PUT direto no Supabase, sem passar pelo servidor)
- Download via signed URL de 5 minutos
- Delete remove o arquivo do bucket e o registro

### Módulo Financeiro

- `GET /chamados/payout/:periodo` (admin) — totais por técnico no período `YYYY-MM`
- `GET /chamados/meus-ganhos` (técnico) — visão própria
- `paymentStatus`: `pendente → pago`; `pagoEm` registrado/limpo nos fluxos de estorno
- `paymentPeriodo` calculado em `America/Sao_Paulo` (evita bucketing UTC)
- Permissões: `financeiro.ver`, `financeiro.gerenciar`, `financeiro.ver_proprio`
- Rotas dashboard: `/financeiro` (admin) e `/meus-ganhos` (técnico)

---

## Componentes reutilizáveis

| Componente | Descrição |
|---|---|
| `CityAutocomplete.vue` | v-model = código IBGE; busca debounced em `/cities/search` |
| `DateRangePicker.vue` | v-model = `{de, ate}` YYYY-MM-DD; presets (Hoje/7d/30d/Mês); prop `color` |
| `ConfirmDialog.vue` | Modal de confirmação com título, mensagem e cor do botão — montado no layout |
| `useConfirm()` | Composable Promise-based para acionar o `ConfirmDialog` de qualquer página |
| `TechnicianForm.vue` | Formulário completo de técnico (criar e editar) |
| `ClientForm.vue` | Formulário de cliente PJ/PF com `CityAutocomplete` |

---

## Padrões estabelecidos

### Paginação server-side
```
useAsyncData observa [page]
watch(pageSize) → reset page para 1 ou refresh direto
botão "Filtrar" → applied.value = buildParams() → page=1 ou refresh
```

### Enum multi-select com USelect
Usar valores sentinela (`'todos'`, `'todas'`, `'ativo'`) em vez de string vazia — Reka UI reserva `''` para "limpar" e crasha.

### Roteamento Nuxt 4 (list + detail)
Usar `foo/index.vue` + `foo/[id].vue` — **não** `foo.vue` + `foo/[id].vue` (o segundo torna `foo.vue` um layout pai que exige `<NuxtPage/>`).

---

## Bugs corrigidos (notáveis)

| Bug | Causa | Fix |
|---|---|---|
| `parseCustoKm` multiplicava por 100 a cada edição | `.replace('.','')` em string `"1.50"` retornada do banco | Substituído por `parseBrMoney` (idempotente) |
| Crash no boot — Supabase WebSocket | `@supabase/supabase-js` inicia Realtime eagerly no Node 20 | Trocado para `@supabase/storage-js` `StorageClient` |
| `FOR UPDATE` em `COUNT(*)` — SQL inválido | Agregado não é lockável no Postgres | `SELECT id ... FOR UPDATE` + `.length` |
| Datas deslocadas 3h nos filtros | `T00:00:00` sem timezone; sessão Postgres usa UTC | `(col AT TIME ZONE 'America/Sao_Paulo')::date BETWEEN :de AND :ate` |
| IDOR em chamados | Técnico podia PATCH qualquer chamado por ID | Checar `chamado.tecnicoUserId !== user.userId` para não-gerentes |
| `.map is not a function` nas telas de chamados | `/technicians` virou envelope paginado; páginas esperavam array | Unwrap: `.then(r => r.items)` com `pageSize: 200` |
| `USelect` com `value: ''` crasha | Reka UI reserva string vazia para "clear" | Sentinelas: `'todos'`, `'todas'`, `'ativo'`/`'inativo'` |
