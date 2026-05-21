## Diagnóstico

Hoje o importador trata "linhas de resumo" (qualquer tarefa com filhos) e "folhas" (tarefas sem filhos) como igualmente selecionáveis, com checkbox em ambas e propagação pai→filhos. Isso permite cenários inválidos:

- marcar pai **e** filho → soma >100% (banner amarelo de aviso).
- marcar só um pai → importa um item "agregado" cujo custo/dias já está distribuído nos filhos do Project, distorcendo a medição futura.

O modelo correto do MS Project é: **apenas as folhas têm custo/duração próprios**; os níveis superiores são roll-ups. Portanto a importação deve considerar **somente as folhas** (a tarefa mais profunda de cada ramo), independentemente do `outlineLevel`. Uma tarefa em nível 2 que não tem filhos é tão "folha" quanto uma em nível 5.

## Plano

Mudanças **apenas em `src/routes/_app.importar.tsx`** (UI + lógica de seleção/persistência). Sem alteração de schema, sem mexer em outras telas.

### 1. Conceito de "folha" como única unidade importável
- `isLeaf = !hasChildren` continua valendo para qualquer nível.
- Soma de custo / dias / % previsto passa a usar **somente folhas selecionadas**:
  - `totalCusto = Σ custo das folhas selecionadas`
  - `totalDias  = Σ dias das folhas selecionadas`
  - `pctOf(t)` só é calculado para folhas; resumos exibem `—`.
- Marcos de 0 dias permanecem importáveis (continuam sendo folhas com custo/dias 0 e % = 0).

### 2. UI da árvore
- **Resumos (com filhos)**: sem checkbox. Mostram só o `▾`/`▸` para expandir/recolher, em `bg-muted/40` e negrito, como contexto estrutural. Coluna Custo exibe o roll-up calculado (`Σ` dos descendentes folha), em `text-muted-foreground`, apenas como referência visual — não entra na soma total.
- **Folhas**: checkbox normal, contribuem para custo/dias/%.
- Remover o banner amarelo de sobreposição pai/filho (deixa de existir o caso).
- Botões de seleção rápida passam a ser:
  - "Todas as folhas" (padrão atual)
  - "Folhas c/ duração > 0"
  - "Limpar"
  
  (Remover "Todos os níveis" e a propagação pai→filhos, que agora não fazem sentido.)

### 3. Persistência em `cronograma_itens`
- Inserir **apenas folhas selecionadas**.
- `descricao`: `"{wbs} {nome}"` da folha, **prefixada com a cadeia de pais** entre colchetes para preservar contexto do Project, ex.:
  `"2.2.1 Fornecimento - Armadura  ·  [2 SUPERESTRUTURA › 2.2 INFRA-ESTRUTURA - BLOCOS B1, B2]"`
  Isso mantém a hierarquia legível na tela da obra sem precisar de tabela nova.
- `ordem`: índice original do XML.
- `custo`, `data_inicio`, `data_fim`, `percentual_previsto`: vindos da própria folha.

### 4. Validação
Reimportar a 209 com "Substituir":
- soma de custo das folhas selecionadas deve bater com o valor do contrato (já estava batendo após o ajuste anterior);
- soma de % previsto fecha em ~100%;
- resumos aparecem na árvore como contexto, mas não geram linha em `cronograma_itens`.

## Fora de escopo
- Schema do banco, `_app.obras.$id.tsx`, `fluxo.tsx`, RLS.
- Lógica de medição/percentual concluído (será tratada depois, como você indicou).
