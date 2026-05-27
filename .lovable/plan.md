## Objetivo

A aba **Revisões** mostra hoje, ao mesmo tempo: 3 cards de KPI, histórico completo, tabela longa de tarefas com mudança de data, e — quando o usuário clica "Nova revisão" — um Sheet enorme com arquivo, data, observações, switch de %, e 6 grupos de diffs já expandidos. É muita coisa de uma vez. O plano abaixo organiza isso em etapas claras.

## Mudanças na tela principal (`RevisoesTab`)

1. **Cabeçalho enxuto em uma linha**
   - Trocar os 3 cards grandes por uma faixa compacta: `Atraso máx · Revisões · Última importação` + botão **Nova revisão** à direita.
   - Card "Importar revisão" deixa de existir como cartão separado — vira só o botão.

2. **Histórico de revisões em formato resumido**
   - Mostrar as 3 últimas por padrão, com "Ver todas (N)" para expandir.
   - Colunas Novos/Datas/%/Removidos viram um único chip resumo (`+12 ✱ 3 datas · 5%`) para reduzir ruído; números detalhados em tooltip.

3. **"Tarefas com mudança de data" colapsada por padrão**
   - Envolver em `<Collapsible>` (já existe em `components/ui/collapsible`), fechada por padrão com badge mostrando a contagem.
   - Quando aberta, adicionar filtro por texto e um Select de "Δ ≥ X dias" para o usuário não rolar 100+ linhas.
   - Limitar render inicial a 50 linhas com "Mostrar mais".

## Mudanças no sheet "Nova revisão" (wizard de 3 passos)

Hoje o Sheet mistura entrada do arquivo, prévia de diffs e ações de confirmação no mesmo scroll. Convertê-lo em wizard com `Tabs` controladas (ou indicador 1·2·3 no topo):

**Passo 1 — Arquivo**
- Dropzone grande (drag-and-drop) com o input `.xml,.mpp`, hint "Tem .mpp?" e o link de conversão existente.
- Campo Data de corte (pré-preenchido com hoje).
- Botão **Analisar** habilita ao escolher arquivo. Avança automaticamente ao parse OK.

**Passo 2 — Revisar mudanças**
- Topo: resumo em chips coloridos clicáveis (Novos 4 · Datas 12 · % 7 · Custo 0 · Removidos 2 · Restaurados 0). Clicar filtra os grupos exibidos.
- Cada grupo vira um `<Collapsible>` fechado por padrão, com header já mostrando contagem e ações "marcar/desmarcar todos".
- Estado vazio claro quando `diffs.length === 0` ("Cronograma idêntico ao banco, nada a aplicar").
- Busca por descrição no topo.

**Passo 3 — Confirmar**
- Card final com: contagem de mudanças que serão aplicadas (apenas as `apply: true`), switch "Atualizar % realizado", campo Observações.
- Botões **Voltar** e **Confirmar revisão**.

Navegação: stepper persistente no `SheetHeader`, com "Voltar" sempre disponível. O fluxo atual de parse/confirmação (`onFile`, `confirmar`, `toggleRow`, `toggleAll`) permanece — apenas reorganizado em passos.

## Detalhes técnicos

- Toda mudança fica em `src/routes/_app.obras.$id.tsx` no componente `RevisoesTab` (linhas ~1253-1806). Sem alterações de schema, lógica de parse, RLS ou queries.
- Componentes novos auxiliares (`StepIndicator`, `DiffSummaryChips`, `DropzoneFile`) podem ficar inline no mesmo arquivo para evitar churn.
- Reuso de `Collapsible`, `Tabs`, `Badge`, `Sheet` já existentes.
- Sem mudanças no `CompararRevisoesTab` nem no `MppNotSupportedDialog`.

## Critérios de aceite

- Ao abrir a aba Revisões, o usuário vê no máximo 1 viewport de informação antes de rolar.
- Lista de "Tarefas com mudança de data" começa fechada com contagem visível.
- Sheet "Nova revisão" abre no Passo 1 com só dropzone + data. Diffs só aparecem após o parse, no Passo 2.
- Confirmação acontece num passo dedicado com resumo do que será aplicado.
- Nenhuma regressão na lógica: parse de XML, toggles individuais/em massa, switch de %, e gravação da revisão funcionam como antes.

## Fora de escopo

- Suporte direto a `.mpp` (continua via instrução de conversão).
- Refatorar a aba Comparar.
- Mudanças no modelo de dados.
