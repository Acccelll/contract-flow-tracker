
## Problema

Na importação do XML do MS Project, cada item do cronograma é gravado com `percentual_previsto` arredondado a 2 casas decimais (`toFixed(2)`). Com 748 linhas (obra 209 - MARFRIG), o viés acumulado do arredondamento gera **100,59%** na tela da obra mesmo quando a soma de `custo` bate exatamente com o `valor_contrato` (R$ 8.755.000,00).

A tela de importação calcula o total a partir do `custo` em R$ direto, por isso mostra "100,00%". A tela da obra soma os percentuais persistidos, por isso mostra 100,59%.

## Correção

### 1. Importação — gravar percentual com precisão suficiente
`src/routes/_app.importar.tsx`, função `importar()` (linha ~484):

- Trocar `Number(pctOf(t).toFixed(2))` por `Number(pctOf(t).toFixed(6))`.
- Manter `custo: Number((t.custo || 0).toFixed(2))` (cents são exatos).

Isso reduz o drift máximo de ±0,5 p.p. por item para ±0,0000005 p.p., eliminando o problema mesmo em obras com milhares de linhas.

### 2. Tela da obra — exibir percentual com formatação amigável
`src/routes/_app.obras.$id.tsx`:

- Os locais que **exibem** percentual (`pct.toFixed(2)%`, aviso "soma do cronograma é X%") continuam mostrando 2 casas — só o valor armazenado ganha precisão.
- O aviso "Atenção: soma é X%" (linha 207-208) passa a ser respeitado com a tolerância atual (`Math.abs(total - 100) > 0.01`), que agora será atendida.

### 3. Backfill da obra atual
Após o ajuste, reimportar a obra 209 (já existem 748 itens) usando o checkbox "Substituir cronograma existente" da própria tela, para que os percentuais recalculados sejam gravados com a nova precisão. Não é necessária migração de dados — a coluna `percentual_previsto` já é `numeric` sem escala fixa.

## Detalhes técnicos

- `pctOf(t)` retorna `(custo / totalCusto) * 100`. Quando `totalCusto === valor_contrato`, equivale a `(custo / valor_contrato) * 100`. O somatório teórico é exatamente 100 — o desvio é puramente numérico do arredondamento.
- `numeric` no Postgres armazena bem 6 casas; nenhum índice/constraint depende da escala atual.
- Nenhuma alteração de schema ou lógica de cálculo de medição/recebimento é necessária.

## Fora de escopo

- Mudar a unidade de armazenamento (ex.: guardar custo em vez de %) — manteria a arquitetura atual; só ajustamos precisão.
- Backfill automático de outras obras já importadas — o usuário pode reimportar conforme necessário.
