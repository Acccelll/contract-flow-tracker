# Plano de evolução — Previsão CS

Atacar 4 frentes em ondas, cada uma fechando antes da próxima. Tudo respeita RLS por `owner_id` e usa transações SQL onde houver risco de concorrência.

## Onda 1 — Riscos críticos (governança financeira)

### 1.1 Validação de percentuais
- CHECK `0 <= percentual_realizado <= 100` em `cronograma_itens` e `itens_medicao.percentual_atual`.
- Trigger em `itens_medicao` validando, por `cronograma_item_id`:
  - `SUM(percentual_atual) <= 100` considerando todas as medições aprovadas + a corrente.
  - `SUM(valor_atual) <= custo_baseline_vigente`.
- Trigger em `medicoes` validando soma total ≤ `valor_contrato + Σ aditivos` (ver Onda 3).

### 1.2 Versionamento de baseline (opção A)
- Nova tabela `cronograma_baselines` (snapshot por obra):
  - `obra_id`, `versao` (int sequencial), `motivo` (`import_inicial` | `aditivo` | `ajuste_manual`), `created_at`, `created_by`.
- Nova tabela `cronograma_item_baseline` (linhas do snapshot):
  - `baseline_id`, `cronograma_item_id`, `uid_mpp`, `custo`, `data_inicio`, `data_fim`, `percentual_previsto`.
- `medicoes` ganha `baseline_id` (FK) — cada medição fica congelada na versão vigente no momento da aprovação.
- `cronograma_itens.custo_baseline` deixa de ser fonte única; passa a ser cache do snapshot vigente.
- Nova baseline só pode ser criada por evento explícito (aditivo aprovado, ajuste manual autorizado). Importação de XML **nunca** cria baseline nova.

### 1.3 XML não altera custo
- No fluxo de importação (`src/lib/mpp.ts` + `_app.importar.tsx` + `_app.obras.$id.tsx`):
  - Itens existentes: atualizar apenas `data_inicio`, `data_fim`, `percentual_realizado`, `descricao`, `ordem`, `ativo`.
  - **Nunca** sobrescrever `custo` nem `custo_baseline`.
  - Itens novos (UID inexistente): inserir com `custo = custo_baseline` da baseline vigente apenas se houver; caso contrário, custo = 0 e sinalizar como "fora de baseline" para revisão.
- Diff de revisão (`cronograma_item_revisoes`) deixa de gravar `custo_anterior`/`custo_novo` para itens existentes (passa a registrar apenas se houver criação de item).

### 1.4 Auditoria genérica
- Nova tabela `audit_logs`:
  - `id`, `obra_id` (nullable), `entidade` (text), `entidade_id` (uuid), `acao` (`insert`|`update`|`delete`|`approve`|`cancel`), `before` (jsonb), `after` (jsonb), `user_id`, `created_at`.
- Triggers `AFTER INSERT/UPDATE/DELETE` em: `medicoes`, `itens_medicao`, `notas_fiscais`, `recebimentos`, `cronograma_baselines`, `aditivos_contrato` (Onda 3).
- RLS: leitura restrita ao `owner_id` da obra.
- UI mínima: aba "Histórico" na obra lista entradas com filtro por entidade.

### 1.5 Concorrência
- Adicionar coluna `versao_otimista` (int, default 1) em `medicoes`, `notas_fiscais`, `recebimentos`, `cronograma_itens`.
- Trigger `BEFORE UPDATE` incrementa `versao_otimista`; mutações via `createServerFn` recebem `versao_otimista` esperada e fazem `UPDATE ... WHERE id = $1 AND versao_otimista = $2` — 0 linhas afetadas → erro `409 Conflict` tratado no UI.
- Todas as operações de medição/revisão envolvendo múltiplas tabelas migram para server functions com `BEGIN ... COMMIT` explícito.
- Importação de XML usa lock advisory por `obra_id` (`pg_advisory_xact_lock(hashtext(obra_id::text))`) durante a transação para evitar dois imports simultâneos.

## Onda 2 — Workflows e status

### 2.1 Estados
- `medicoes.status` (enum existente) expandir para: `draft`, `em_revisao`, `aprovada`, `faturada`, `cancelada`.
- `notas_fiscais.status` (novo): `draft`, `emitida`, `enviada`, `aprovada_cliente`, `recebida`, `cancelada`.
- `recebimentos.status` (existente) expandir: `previsto`, `parcial`, `recebido`, `inadimplente`, `cancelado`.
- Transições válidas codificadas em função `public.pode_transicionar(entidade, de, para)` + trigger.

### 2.2 Recebimentos parciais (N por NF)
- Manter `recebimentos.nota_fiscal_id`; permitir N registros por NF.
- `notas_fiscais` ganha view `vw_nf_saldo` com `valor_liquido - SUM(recebimentos.valor_recebido)`.
- UI: cada NF lista seus recebimentos; ao registrar pagamento parcial, status da NF vira `recebida` somente quando saldo = 0.

### 2.3 UI
- Botões de transição respeitam estado atual.
- Itens em `aprovada`/`faturada` ficam read-only (sem editar % nem valor).

## Onda 3 — Aditivos e separação contrato/baseline

### 3.1 Modelo
- Nova tabela `aditivos_contrato`:
  - `obra_id`, `numero`, `tipo` (`acrescimo`|`supressao`|`reajuste`|`prazo`), `valor_financeiro` (numeric, pode ser negativo), `dias_prazo` (int), `data_aprovacao`, `documento_url`, `observacoes`, `status` (`rascunho`|`aprovado`|`cancelado`).
- Aprovar aditivo financeiro com itens novos → cria nova `cronograma_baselines` (versão N+1) contendo os itens originais + novos.

### 3.2 Campos derivados de obra
- `obras.valor_contrato` permanece (valor original).
- View `vw_obra_valores`:
  - `valor_contrato_atual = valor_contrato + Σ aditivos aprovados`.
  - `valor_planejado_baseline = Σ custo da baseline vigente`.
  - `valor_executado = Σ itens_medicao.valor_atual em medições aprovadas`.
- `% planejado` da obra usa `valor_planejado_baseline` como denominador (não mais `valor_contrato` cru).

## Onda 4 — Performance e UX

### 4.1 Banco
- Índices: `cronograma_itens(obra_id, ativo)`, `cronograma_itens(uid_mpp)`, `cronograma_itens(data_fim)`, `itens_medicao(cronograma_item_id)`, `itens_medicao(medicao_id)`, `recebimentos(obra_id, data_prevista)`, `audit_logs(entidade, entidade_id)`.
- Materialized view `mv_obra_kpis` com agregações (avanço físico, financeiro, atraso médio) — refresh em trigger por mutação relevante ou a cada 5min.

### 4.2 UI da obra
- Tabs reorganizadas: **Resumo · Cronograma · Revisões · Medições · Faturamento · Recebimentos · Aditivos · Histórico**.
- Cronograma:
  - Virtualização (`@tanstack/react-virtual`) — preparar para 5k+ linhas.
  - Colapso de árvore por nível (usar `outline_number`/`ordem`).
  - Filtros: atrasados, em andamento, concluídos, fora de baseline.
  - Destaque visual: linha vermelha quando `data_fim > data_fim_baseline`.

### 4.3 Dashboard executivo (mínimo viável)
- Curva S (planejado x executado por mês).
- Aging de recebimentos.
- Ranking de obras por SPI = avanço real / avanço planejado.

---

## Ordem de execução sugerida

1. **Onda 1.4 (auditoria)** primeiro — começa a registrar tudo antes das próximas mudanças.
2. **Onda 1.1 + 1.3 + 1.5** — validações, XML defensivo, concorrência otimista.
3. **Onda 1.2 (baseline versionado)** — migração de dados existentes: cria baseline v1 a partir do `custo_baseline` atual e amarra medições existentes à v1.
4. **Onda 2** — workflows e recebimentos parciais.
5. **Onda 3** — aditivos + views de valores.
6. **Onda 4** — índices, virtualização, tabs, dashboard.

## Detalhes técnicos relevantes

- Todas as mutações multi-tabela migram para `createServerFn` em `src/lib/*.functions.ts` com `requireSupabaseAuth`; transações SQL via `BEGIN/COMMIT` dentro do handler.
- `audit_logs.user_id` preenchido por `auth.uid()` na trigger (`SECURITY DEFINER` + `SET search_path = public`).
- Migração de dados (passo 3) é destrutiva-ish — backup antes via `pg_dump` lógico das tabelas afetadas (instrução manual ao usuário, fora do escopo de código).
- Todos os novos enums em PostgreSQL (`CREATE TYPE`).
- Cada tabela nova: `GRANT SELECT, INSERT, UPDATE, DELETE ... TO authenticated` + `GRANT ALL ... TO service_role` + RLS por `owner_id` da obra (via EXISTS join, padrão atual do projeto).

## Fora deste plano (registrar como roadmap futuro)
- OCR de NF, antivírus em uploads, hash SHA256 (Onda de segurança dedicada).
- Centro de custos / categorias / fornecedores (refatoração de domínio).
- BI completo (SPI/CPI por item, previsão de caixa probabilística).
- SAML/SSO, multi-tenant por organização.

---

Quer que eu execute as 4 ondas em sequência (gerando migrations + código onda por onda, com pausa para você validar antes de cada uma) ou prefere fechar apenas a Onda 1 primeiro e reavaliar?
