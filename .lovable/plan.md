## Problema

A tela da obra está exibindo os valores em R$ recalculados a partir de `percentual_previsto * valor_contrato`, mas o `percentual_previsto` foi gravado com poucas casas decimais (4 casas no banco hoje, mesmo após o ajuste de código). Isso introduz desvio de centavos/reais em todas as linhas:

| EDT | Project (correto) | Sistema (exibido) |
|-----|------------------:|------------------:|
| 1.1 | R$ 10.000,00 | R$ 9.998,21 |
| 1.2 | R$ 110.000,00 | R$ 109.997,82 |
| 1.3 | R$ 20.000,00 | R$ 19.996,42 |
| 1   | R$ 845.000,00 | R$ 844.997,58 |

Confirmado em banco (obra 209): `custo` está exato (R$ 10.000,00, R$ 110.000,00…), mas `percentual_previsto` aparece como 0.1142, 1.2564 etc. Como a UI faz `pct/100 * 8.755.000`, a exibição arredonda para baixo/cima e nunca bate com o Project.

## Correção

A fonte da verdade do valor financeiro de cada tarefa do Project é o **custo importado** (já armazenado em `cronograma_itens.custo` com 2 casas). Vamos parar de reconstruir o valor a partir do percentual e exibir o `custo` diretamente, calculando o percentual a partir dele.

### 1. `src/routes/_app.obras.$id.tsx` — hierarquia do cronograma

Em `CronogramaHierarquia` / `aggregate`:

- Para **folhas**: `valor = Number(item.custo || 0)`.
- Para **resumos**: `valor = soma do custo das folhas descendentes`.
- `pct = valorContrato > 0 ? (valor / valorContrato) * 100 : 0`.
- Manter exibição `pct.toFixed(2) + "%"` e `brl(valor)`.

O aviso "soma do cronograma é X%" passa a comparar `soma(custo)` com `valor_contrato` (tolerância em centavos), eliminando o falso 100,59%.

### 2. "Aderência por janela do cronograma" (mesmo arquivo, ~linha 762)

Trocar `previsto = (percentual_previsto/100) * valorContrato` por `previsto = Number(c.custo || 0)`. Para itens antigos sem `custo`, manter o cálculo atual como fallback (`custo > 0 ? custo : pct/100 * valorContrato`).

### 3. Geração de previsão de recebimento

Hoje (linha 163) calcula `valor = (percentual_previsto/100) * baseDist`. Trocar para usar `custo` quando presente, com o mesmo fallback do item 2. Isso garante que a previsão de NFs também bata centavo a centavo com o Project.

### 4. Importação (`src/routes/_app.importar.tsx`)

Sem alteração funcional adicional — o `custo` já é importado corretamente do XML (`Cost/100`). O `percentual_previsto` continua sendo gravado (para compatibilidade com itens lançados manualmente, que não têm `custo`), mas deixa de ser a fonte primária para a exibição.

## Fora de escopo

- Backfill/migração de dados: nenhuma necessária. A correção lê `custo` que já está no banco.
- Esconder a coluna "% previsto": fica como está, só passa a ser derivada de `custo`.
- Mudanças em medições/notas fiscais.

## Resultado esperado

Após o deploy, sem reimportar nada, a obra 209 passa a mostrar exatamente:
- 1.1 → R$ 10.000,00 / 0,11%
- 1.2 → R$ 110.000,00 / 1,26%
- 1 (resumo) → R$ 845.000,00 / 9,66%
- Total = R$ 8.755.000,00 / 100,00% (bate com contrato).