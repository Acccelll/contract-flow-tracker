# Reverter revisão importada

Adicionar a possibilidade de desfazer uma revisão de cronograma que foi importada por engano, reaproveitando os snapshots já gravados em `cronograma_item_revisoes` (que armazenam `_anterior` e `_novo` para cada mudança).

## Escopo

Apenas a **última revisão** poderá ser revertida (stack LIFO). Reverter revisões intermediárias geraria inconsistência (uma mudança posterior pode ter sobrescrito o mesmo item). A regra é: para reverter a #2, primeiro reverta a #3.

Se o usuário quiser apagar tudo, já existe o botão "Limpar importados" (atualmente no topo da página). Vamos manter o comportamento atual e apenas acrescentar o "Reverter" granular.

## UX

**Onde:** dentro da linha do "Histórico de revisões" (mesmo lugar do screenshot anexado).

- Coluna nova "Ações" (à direita de "Importada em") com um botão `Reverter` (ícone `Undo2`).
- O botão fica **habilitado apenas na revisão de maior `numero`**. Nas demais, fica desabilitado com tooltip: *"Reverta primeiro a revisão #N para liberar esta."*
- Clique abre `AlertDialog` de confirmação mostrando:
  - número, data de corte e arquivo
  - resumo dos `totais` (novos, datas, %, custo, removidos/restaurados)
  - aviso explícito: *"Esta ação desfaz as mudanças aplicadas por esta revisão. Itens criados serão removidos do cronograma. Datas, % e custos voltam aos valores anteriores. Não é reversível."*
  - botão `Reverter revisão`.
- O botão na expansão da revisão (já existe `RevisaoDetalhes`) também passa a ter um `Reverter` no topo, ao lado dos filtros, com o mesmo comportamento.

## Lógica do "Reverter"

Função `reverterRevisao(revisaoId)` em `RevisoesTab`:

1. Carregar `cronograma_item_revisoes` da revisão (`tipo_mudanca`, `cronograma_item_id`, valores `_anterior` e `_novo`).
2. Para cada snapshot, agir conforme `tipo_mudanca`:
   - **novo** → `DELETE cronograma_dependencias WHERE item_id = X` e `DELETE cronograma_itens WHERE id = X` (item foi criado pela revisão; remover por completo).
     - Verificar se há `itens_medicao` apontando para esse item; se houver, **abortar** a reversão com mensagem clara ("Item X já possui medição lançada; remova a medição antes de reverter").
   - **removido** → `UPDATE cronograma_itens SET ativo = true WHERE id = X`.
   - **restaurado** → `UPDATE cronograma_itens SET ativo = false WHERE id = X`.
   - **data** → `UPDATE SET data_inicio = data_inicio_anterior, data_fim = data_fim_anterior`.
   - **pct** → `UPDATE SET percentual_realizado = percentual_realizado_anterior`.
   - **custo** → `UPDATE SET custo = custo_anterior` (branch quase morto hoje, mas mantém simetria).
3. Recalcular `percentual_previsto` proporcional ao `custo_baseline` entre itens ativos (mesma lógica usada em `confirmar()`).
4. `DELETE cronograma_item_revisoes WHERE revisao_id = X` e `DELETE cronograma_revisoes WHERE id = X`.
5. `onChange()` para invalidar queries (`crono`, `revisoes`, `receb`).
6. `toast.success("Revisão #N revertida")`.

## Validações / proteções

- Só permite reverter a revisão com maior `numero` (validação no client + cheque no handler).
- Bloqueia quando algum item "novo" desta revisão já tem `itens_medicao` associado, com toast explicando o motivo e oferecendo "Limpar importados" como saída radical.
- Loading state no botão durante a operação.

## Arquivos a alterar

- `src/routes/_app.obras.$id.tsx`
  - `RevisoesTab`: adicionar coluna/ação na tabela do "Histórico de revisões", `AlertDialog` de confirmação, função `reverterRevisao`, e botão equivalente dentro de `RevisaoDetalhes` (passando `revisaoId` + flag `podeReverter`).
  - Importar `Undo2` do `lucide-react` e `AlertDialog*` (já estão sendo usados em outros pontos do arquivo, então só consumo).

## Fora de escopo

- Reverter revisões intermediárias (exige merge complexo de mudanças posteriores).
- Restaurar `cronograma_dependencias` apagadas ao reverter um "novo" (são recriadas se o XML for reimportado).
- Mudanças em RLS/schema: a tabela `cronograma_item_revisoes` já carrega tudo que precisamos.
