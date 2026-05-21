## Diagnóstico

O XML da 209 tem **928 tarefas**, das quais **350 são marcos** (`<Milestone>1`) e **180 são resumos**. O parser atual em `src/routes/_app.importar.tsx` faz:

```ts
.filter((t) => t.outlineLevel > 0 && t.name && !t.isMilestone)
```

Ou seja, **descarta todos os marcos** — e é exatamente por isso que "1.1 Responsabilidade Técnica com emissão de ART" (0 dias, marcada como Milestone no Project) some, junto com ~349 outras. Além disso a UI atual mostra só indentação por padding e um "▸", o que não se parece com a árvore EDT do Project.

## Plano

### 1. Parser (`parseMppXml`)
- **Não filtrar mais marcos.** Manter apenas o filtro de nome vazio e `outlineLevel > 0`.
- Ler também `<OutlineNumber>` (a "EDT" — ex.: `1.1`, `2.2.10`) e expor como `wbs` em `MppTask`.
- Manter o cálculo já existente de `parentUid` / `hasChildren` por stack de `outlineLevel`.
- Adicionar flag `isLeaf = !hasChildren` (substitui o uso atual de `!t.hasChildren`).
- Para marcos / 0 dias: `dias()` retorna 0 (remover o `Math.max(1, …)`); a tarefa entra na lista e na seleção, com `% previsto = 0`.

### 2. UI — visual estilo Project
Cada linha da tabela:

```
[ ] 1.2.5     ├─ │  ▾ 2.2 INFRA-ESTRUTURA - BLOCOS B1, B2
[ ] 1.2.5.1   │  ├─    2.2.1 Fornecimento - Armadura
[✓] 1.2.5.2   │  └─    2.2.2 Execução - Armadura
```

- Nova coluna **EDT** (mono, pequena) com `wbs`.
- Indentação por `outlineLevel`: usar guias verticais (`border-l` por nível) em vez de `padding-left` puro. Implementação: renderizar `outlineLevel - 1` divs de 16 px com `border-l border-border` e o último com um conector `├─` / `└─`.
- Linhas de resumo (`hasChildren || isSummary`): negrito, fundo `bg-muted/40`, ícone `▾`/`▸` clicável para **expandir/recolher** filhos (estado local `collapsed: Set<uid>`); ao recolher, esconde recursivamente os descendentes.
- Marcos (`isMilestone`): ícone `◆` na frente do nome, em `text-muted-foreground`.
- Tarefas folha: texto normal.

### 3. Seleção
- Pré-seleção padrão continua sendo **folhas** (`!hasChildren`), mas agora isso inclui os marcos de 0 dias (ART etc.) — eles entram no cronograma com 0% previsto, preservando a estrutura visível do Project.
- Botão extra **"Folhas com duração > 0"** para quem quiser só itens que somam %.
- Checkbox em linha de resumo **propaga** marcação/desmarcação para todos os descendentes (comportamento esperado em árvore).

### 4. Cálculo de %
Mantém-se: `pct = dias / totalDias * 100`. Com `dias=0` para marcos, eles ficam com 0% e não inflam o total. Continua válido o aviso de sobreposição pai/filho.

### 5. Persistência em `cronograma_itens`
- `descricao`: passa a usar o `wbs` real do Project como prefixo, ex.: `"1.1 Responsabilidade Técnica com emissão de ART"` — assim a tela da obra mostra a hierarquia natural do Project sem depender de `—` artificiais.
- `ordem`: índice do XML (preserva a ordem original do Project).
- Para marcos, `data_fim` = `data_inicio` (XML já entrega assim); `percentual_previsto = 0`.
- "Substituir cronograma existente" e o restante do fluxo de insert ficam iguais.

### 6. Fora de escopo
Sem mudanças em schema, em `_app.obras.$id.tsx`, em `fluxo.tsx` ou na aba "Planilha de contratos". Sem alterar RLS.

## Resultado esperado
Reimportando a 209 com "Substituir" marcado, a obra passa a ter as 928 tarefas com EDT, marcos como ART aparecem na lista, a árvore pode ser recolhida/expandida como no Project, e o total de % previsto continua fechando em ~100% (somente folhas com duração contribuem).
