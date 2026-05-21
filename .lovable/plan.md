## Problema

Hoje o importador de XML do MS Project só permite escolher **um nível de Outline** (1, 2, 3…) e só importa as tarefas daquele nível. Isso obriga o usuário a escolher entre "ver só as fases" ou "ver só os pacotes detalhados", e nunca uma mistura — o que não reflete cronogramas reais, onde algumas fases têm subdivisão e outras não.

## Objetivo

Permitir importar tarefas de **qualquer combinação de níveis**, com uma visualização em árvore (hierárquica) coerente, mantendo a soma de `percentual_previsto` consistente (próxima de 100%).

## Mudanças propostas em `src/routes/_app.importar.tsx` (`CronogramaImporter`)

### 1. Parser — manter a hierarquia
- `parseMppXml` continua ignorando milestones, mas **deixa de filtrar por `outlineLevel`/`isSummary`**. Retorna todas as tarefas com `outlineLevel`, `isSummary` e a ordem original do XML.
- Calcula, para cada tarefa, o `parentUid` (último ancestral com `outlineLevel = current - 1` percorrendo a lista) para podermos detectar pai/filho.

### 2. UI — substituir o seletor de nível por uma árvore
- Remover o `<Select>` "Nível de detalhe".
- Tabela passa a mostrar **todas as tarefas** com indentação proporcional ao `outlineLevel` (ex.: `paddingLeft: level * 16px`) e um ícone diferente para tarefa-resumo (Summary).
- Cada linha tem seu checkbox individual. Linhas Summary aparecem em itálico/`text-muted-foreground` para sinalizar que normalmente não devem ser somadas com seus filhos.

### 3. Botões de seleção rápida
Substituir "Selecionar tudo / Limpar" por um grupo coerente:
- **Folhas** (padrão recomendado, pré-selecionado ao abrir o XML): marca apenas tarefas sem filhos — soma natural ≈ 100%.
- **Apenas nível 1 / 2 / 3** (botões dinâmicos conforme níveis presentes no XML).
- **Tudo** e **Limpar**.

### 4. Aviso de sobreposição
Calcular um aviso visual (badge amarelo no topo da tabela) quando o usuário seleciona simultaneamente uma tarefa e qualquer descendente dela — explicando que isso fará a soma passar de 100%. Não bloqueia, apenas informa.

### 5. Cálculo de `percentual_previsto`
Mantém a regra atual (proporcional à duração das tarefas **selecionadas**), agora aplicada à seleção mista. Se houver sobreposição pai/filho, o aviso da etapa 4 deixa claro o efeito.

### 6. Inserção em `cronograma_itens`
- `descricao` ganha prefixo com indentação leve para preservar a hierarquia visual no detalhe da obra (ex.: `"— — Concretagem laje 3"` para nível 3). Isso evita mudança de schema.
- `ordem` segue a ordem original do XML (não mais re-enumerada por filtro de nível), preservando a leitura cronológica/hierárquica.
- Comportamento de "Substituir cronograma existente" permanece igual.

## Fora de escopo
- Não altera o schema do banco (`cronograma_itens` continua plano).
- Não toca em `_app.obras.$id.tsx` nem no fluxo de recebimentos — a tela de cronograma da obra continua lendo a lista plana já existente.
- Não muda a aba "Planilha de contratos".

## Resultado esperado
O usuário abre o XML da obra 209, vê todas as tarefas em árvore, mantém a pré-seleção de folhas (soma ≈ 100%) ou marca manualmente um mix de fases e subtarefas conforme o caso, com aviso claro quando a soma passar de 100%.