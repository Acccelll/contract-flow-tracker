## Objetivo

Permitir, dentro da página da obra, subir o XML do MS Project toda semana para:
1. Atualizar **datas** das tarefas existentes (e detectar atrasos).
2. Atualizar **% realizado** a partir do `PercentComplete` do Project (sem perder o lançamento manual via medições).
3. **Registrar histórico** de cada revisão (snapshot completo) para auditoria e relatório de atraso.
4. Detectar tarefas **novas** (incluídas no Project) e tarefas **removidas/inativas**.

## Decisão de formato

Mantemos **somente XML do MS Project**. `.mpp` é binário e exige bibliotecas Java (mpxj) que não rodam no runtime do Worker. A tela vai instruir explicitamente: *"No Project → Salvar como → XML"*. O importador semanal aceita só `.xml`.

## Identificação de tarefas

Casamento por **UID do MS Project**. Vamos adicionar `uid_mpp` em `cronograma_itens` e, no primeiro import semanal de uma obra cujo cronograma já existe, fazemos um **backfill por WBS+nome** (one-shot) para preencher os UIDs das tarefas existentes. A partir daí, todo casamento é por UID.

## Mudanças de banco (migration)

```sql
-- Casamento estável com o Project
ALTER TABLE public.cronograma_itens
  ADD COLUMN uid_mpp TEXT,
  ADD COLUMN data_inicio_baseline DATE,  -- congelado no 1º import
  ADD COLUMN data_fim_baseline DATE,
  ADD COLUMN ativo BOOLEAN NOT NULL DEFAULT true;  -- false quando some do Project
CREATE INDEX idx_cronograma_itens_obra_uid ON public.cronograma_itens(obra_id, uid_mpp);

-- Cabeçalho de cada revisão semanal
CREATE TABLE public.cronograma_revisoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL,
  numero INTEGER NOT NULL,              -- sequencial por obra (1,2,3…)
  data_corte DATE NOT NULL,              -- escolhida pelo usuário no upload
  arquivo_nome TEXT,
  observacoes TEXT,
  totais JSONB NOT NULL,                 -- {itens_total, novos, alterados_data, alterados_pct, removidos, custo_total}
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (obra_id, numero)
);

-- Snapshot por item, só para itens que mudaram (ou todos no primeiro import)
CREATE TABLE public.cronograma_item_revisoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  revisao_id UUID NOT NULL REFERENCES public.cronograma_revisoes(id) ON DELETE CASCADE,
  cronograma_item_id UUID NOT NULL,
  data_inicio_anterior DATE, data_inicio_novo DATE,
  data_fim_anterior DATE,    data_fim_novo DATE,
  percentual_realizado_anterior NUMERIC(7,4),
  percentual_realizado_novo NUMERIC(7,4),
  custo_anterior NUMERIC(14,2), custo_novo NUMERIC(14,2),
  tipo_mudanca TEXT NOT NULL  -- 'novo' | 'data' | 'pct' | 'custo' | 'removido' | 'restaurado'
);
```

GRANTs + RLS (`authenticated` via join na `obras`/`cronograma_itens` por `owner_id`).

## UX dentro da obra

Nova aba **"Revisões"** em `_app.obras.$id.tsx` (ao lado de Cronograma/Medições/NFs):

1. Botão **"Importar revisão semanal"** abre um `Sheet` com:
   - Upload do `.xml`.
   - Campo **Data de corte** (default: hoje).
   - Preview da diff: tabela com colunas *Tarefa · Mudança · Antes → Depois*, agrupada por tipo (Novos, Datas alteradas, % alterado, Removidos). Cada linha tem checkbox para opt-out.
   - Toggle **"Atualizar % realizado pelo PercentComplete"** (ligado por padrão — confirma a opção "Ambos" sem forçar).
   - Botão **Confirmar revisão**.

2. Lista de revisões anteriores (número, data de corte, totais resumidos). Clicar abre o detalhe da revisão (mesma diff em modo somente leitura). Permite **gerar PDF/CSV** simples de atraso.

3. Na aba Cronograma já existente, adicionar coluna **"Δ dias fim"** (data_fim atual − baseline) com badge vermelho quando > 0, para visualizar atraso direto na hierarquia.

## Lógica do import (server function `importarRevisaoCronograma`)

Roda como server fn autenticada (`requireSupabaseAuth`) — o parsing do XML é feito no cliente (mesmo `parseMppXml` atual) e enviado já normalizado em JSON ao servidor para a transação ser atômica.

Passos:
1. Carrega `cronograma_itens` ativos da obra. Se algum não tem `uid_mpp`, executa backfill por `wbs+nome` contra as tarefas do XML.
2. Compara tarefa a tarefa (somente folhas, mesma regra do importador atual):
   - **Novo**: existe no XML, não tem item correspondente → `INSERT` em `cronograma_itens` com `uid_mpp`, datas, custo, `percentual_previsto`, `data_inicio_baseline = data_inicio`, `data_fim_baseline = data_fim`.
   - **Removido**: existe no banco, sumiu do XML → `UPDATE ativo = false` (não apaga; preserva medições e NFs já vinculadas).
   - **Restaurado**: tarefa inativa voltou a aparecer → `ativo = true`.
   - **Alterado**: comparar `data_inicio`, `data_fim`, `custo`, `PercentComplete`. Onde mudou, gravar `cronograma_item_revisoes` com antes/depois e aplicar update.
3. Quando `data_inicio_baseline` ainda é NULL (itens importados antes desta feature), preencher com o valor atual no primeiro import — isso vira o baseline para cálculo de atraso.
4. Atualizar `percentual_realizado` somente se o toggle estiver ligado **e** o valor do XML for ≥ ao valor atual (evita sobrescrever um lançamento manual maior que o Project ainda não enxergou). Quando há divergência, registrar como `tipo_mudanca = 'pct'`.
5. Recalcular `percentual_previsto` proporcional ao custo (mesma fórmula do importador atual) sobre o conjunto ativo.
6. `INSERT` em `cronograma_revisoes` com `numero = max+1` e os totais.
7. Disparar `recalcularPrevisaoNF(obraId)` (já existe) para atualizar previsão de recebimentos.

Tudo em uma transação lógica (sequência de calls; em caso de erro, abortar e mostrar toast — não rollback automático, então a ordem é: criar `cronograma_revisoes` por último, depois das mutações dos itens, para que um cabeçalho só exista se as alterações foram aplicadas).

## Atrasos & relatório

- **Atraso por item** = `data_fim_atual − data_fim_baseline` (em dias úteis seria ideal, mas dias corridos basta para v1).
- **Atraso do projeto** = max(data_fim) atual − max(data_fim_baseline).
- Card na aba Revisões: "Atraso acumulado: X dias · Y tarefas atrasadas".
- CSV exportável da última revisão (Tarefa, Início baseline, Início atual, Fim baseline, Fim atual, Δ dias, % previsto, % real).

## Compatibilidade

- O importador **inicial** (página `/importar`) continua igual — é o ponto de entrada quando ainda não há cronograma. A primeira importação ali já preenche `uid_mpp` e `data_*_baseline`.
- Reimportar pela tela `/importar` com "Substituir cronograma" continua funcionando, mas a aba Revisões na obra passa a ser a via recomendada para updates semanais (preserva histórico, medições e NFs).
- Medições continuam sendo a fonte oficial de faturamento; o `percentual_realizado` atualizado pelo XML é informativo/auxiliar — a barra de progresso já existente passa a refletir o mais recente.

## Fora de escopo (v1)

- Conversão `.mpp → xml` no servidor.
- Edição manual de tarefas pela tela Revisões (apenas diff readonly).
- Notificações por e-mail de atraso.
- Comparar duas revisões arbitrárias (a v1 sempre compara a nova com o estado atual; o histórico fica navegável mas não é "diff entre revisão 3 e 5").

## Arquivos afetados

- `supabase/migrations/<novo>.sql` — schema acima.
- `src/lib/cronograma-revisao.functions.ts` — server fn `importarRevisaoCronograma`.
- `src/routes/_app.obras.$id.tsx` — nova aba Revisões + coluna Δ no cronograma.
- `src/lib/mpp.ts` (novo) — extrair `parseMppXml` do importador para reuso (também usado pela tela da obra).
- `src/routes/_app.importar.tsx` — passa a importar o `parseMppXml` do módulo compartilhado e a gravar `uid_mpp` + baseline no primeiro import.
