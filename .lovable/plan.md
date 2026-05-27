# Onda 5 — Finanças, Import XML e Cronograma

Escopo aprovado: **G1 (riscos financeiros)**, **G2 (import XML robusto)** e **G4 (caminho crítico + comparar revisões)**. Roles (G3) e UX/saídas (G5) ficam para depois.

---

## G1 — Riscos financeiros remanescentes

### G1.1 Dia fixo de pagamento com fim de mês
**Decisão**: se o dia configurado não existe no mês, **cair para o último dia do mês**.

- `src/lib/billing.ts` → `calcularVencimento()`: trocar `d.setDate(diaFixo)` por uma função `clampDiaDoMes(d, diaFixo)` que usa `lastDayOfMonth(d)` (já em `date-fns`) e aplica `Math.min(diaFixo, lastDay)`.
- Adicionar teste mental com casos: dia 31 + fev (→ 28/29), dia 31 + abr (→ 30), dia 15 + qualquer mês (sem mudança).
- Reaplicar a clamp em ambos os ramos (mês atual e próximo mês).

### G1.2 Precisão decimal padronizada
- Migration: `ALTER COLUMN ... TYPE NUMERIC(14,2)` nas colunas financeiras que hoje são `numeric` sem escala explícita:
  - `obras.valor_contrato`, `aditivos_contrato.valor_financeiro`
  - `cronograma_itens.custo`, `cronograma_itens.custo_baseline`, `cronograma_item_baseline.custo`
  - `medicoes.valor`, `itens_medicao.valor_atual`, `itens_medicao.valor_anterior`
  - `notas_fiscais.valor`, `valor_liquido`, `valor_servicos`, `inss_retido`, `iss_retido`, `outras_retencoes`
  - `recebimentos.valor_previsto`, `valor_recebido`, `valor_previsto_inicial`
- Percentuais: `NUMERIC(7,4)` em `cronograma_itens.percentual_previsto/realizado`, `itens_medicao.percentual_*`, `medicoes.percentual`.
- Helper `src/lib/money.ts`: `round2(n)` (banker's rounding via `Math.round(n*100)/100`) e `sumMoney(items, fn)` que arredonda no final. Usar em todos os `reduce` de valores no frontend.

### G1.3 Gate (aviso) ao editar custo_baseline
**Decisão**: **só avisar e auditar** (sem bloquear, sem exigir aditivo formal).

- No componente que edita `custo_baseline` na aba Cronograma: ao salvar mudança, mostrar `toast.warning` com texto:
  > "Alterar custo de baseline é uma mudança contratual. Considere registrar um aditivo na aba Aditivos. Mudança registrada no histórico."
- Audit log já captura via trigger `fn_audit_row`, sem trabalho adicional aqui.

### G1.4 Timezone e datas
- Auditar colunas `date` vs `timestamptz`. Padronizar:
  - **Datas de negócio** (`data_corte`, `data_emissao`, `data_vencimento`, `data_prevista`, `data_recebimento`, `data_aprovacao`, baseline) → `date` puro (sem TZ).
  - **Carimbos de evento** (`created_at`, `updated_at`) → `timestamptz`.
- Documentar no `README` rápido: "Datas de negócio são dia-calendário do Brasil; carimbos de evento são UTC e renderizados no fuso do navegador."
- Frontend: usar `parseISO(d)` para datas de negócio (não `new Date(d)` que aplica TZ local).

---

## G2 — Import XML robusto

### G2.1 Validação de schema antes de gravar
- Em `src/lib/mpp.ts`, adicionar `validateMppDoc(doc)` que checa:
  - elemento raiz `Project` existe
  - existe `Project > Tasks > Task` (ao menos 1)
  - cada Task tem `UID`, `OutlineLevel`, `Name`
- Retornar objeto `{ ok, errors[], warnings[], stats: { tarefasLidas, folhas, custoTotal, percentualMedio } }` em vez de só lançar.

### G2.2 Heurística "Cost remanescente"
- Após parse, se `Σ custo folhas < 0.9 × valor_contrato` **e** `percentualMedio > 5%`:
  - emitir warning: "Possível custo remanescente (MS Project exporta `<Cost>` como remanescente quando há avanço). Importar mesmo assim?"
- UI: dialog em `/_app/importar` exibindo `stats` e lista de warnings antes de confirmar.

### G2.3 Feedback explícito no import
- Tela mostra: tarefas lidas / folhas / custo total / % médio / warnings.
- Bloquear botão "Confirmar import" quando: 0 folhas, custo total = 0, ou erros de schema.
- Após confirmar, exibir resumo: X inseridos / Y atualizados / Z marcados fora de baseline.

### G2.4 Parsing pesado em server function
- Criar `src/lib/mpp.functions.ts` com `parseAndValidateMppXml` (`createServerFn`, `requireSupabaseAuth`):
  - Recebe `{ xmlText: string }` (limite 5 MB).
  - Roda parser (usar `linkedom` ou `fast-xml-parser` — ambos rodam em Worker; preferir `fast-xml-parser` por ser puro JS sem deps nativas).
  - Retorna `{ titulo, tasks, stats, warnings, errors }`.
- Frontend chama via `useServerFn`. Mantém `parseMppXml` (DOMParser) como fallback client-side para arquivos pequenos (<500 KB) — opcional, podemos remover depois.
- Não muda fluxo de gravação (continua client-side, ver Onda 1.5 sobre advisory lock).

> **Fora desta onda**: conversão `.mpp` binário → XML. Requer LibreOffice/MPXJ, não roda no Worker, exige sandbox externo. Fica como roadmap.

---

## G4 — Cronograma: caminho crítico + comparar revisões

### G4.1 Caminho crítico (CPM básico)
- Estender parser para capturar dependências:
  - `Project > Tasks > Task > PredecessorLink > PredecessorUID` (+ `Type`, `LinkLag` quando existirem).
- Nova tabela `cronograma_dependencias`:
  ```
  id, obra_id, item_id, predecessor_uid_mpp, tipo (FS/SS/FF/SF), lag_dias
  ```
  + RLS por dono da obra + grants + índices `(obra_id)`, `(item_id)`.
- Atualizar fluxo de importação para popular essa tabela (apenas folhas).
- Helper `src/lib/cpm.ts`:
  - Forward pass (early start/finish) + backward pass (late start/finish) sobre folhas.
  - Folga = `LS - ES`. Caminho crítico = folga ≤ 0.
- Atraso da obra = `max(finish atual − finish baseline)` **apenas entre itens críticos**, não em todas as tarefas.
- UI Cronograma: badge "crítica" nas linhas com folga ≤ 0; tooltip explicando.

### G4.2 Comparar revisões arbitrárias
- Já existe `cronograma_revisoes` + `cronograma_item_revisoes`. Hoje a UI compara "revisão N vs estado atual".
- Nova UI em `/_app/obras/$id` aba **Revisões**:
  - Dois selects "De" e "Para" (qualquer revisão ou "baseline v1" ou "atual").
  - Tabela diff: descrição, data início (antes/depois), data fim (antes/depois), Δ dias, % previsto (antes/depois), Δ %.
  - Filtros: só itens com mudança, só atrasados, só críticos.
- Query: snapshot é reconstruído a partir de `cronograma_item_revisoes` (já tem `data_*_anterior/novo`). Para "baseline vN" reconstruir de `cronograma_item_baseline`.

---

## Ordem de execução

1. **G1.1 + G1.2 + G1.3** (frontend + migration NUMERIC) — pequeno, alto valor.
2. **G1.4** (auditoria de tipos de coluna, sem grandes mudanças).
3. **G2.1 + G2.2 + G2.3** (validação + heurística + feedback no /importar).
4. **G2.4** (server function de parse, instalar `fast-xml-parser`).
5. **G4.1** (tabela `cronograma_dependencias` + parser + CPM + badge).
6. **G4.2** (UI de comparação de revisões arbitrárias).

Cada item entrega isoladamente — paro entre eles para você validar.

---

## Detalhes técnicos

- Migrations seguem padrão atual (`GRANT` antes de `ENABLE RLS`, RLS por `EXISTS` em `obras`).
- `NUMERIC(14,2)` cabe até R$ 999.999.999.999,99 — folga grande para obras grandes.
- `fast-xml-parser` é compatível com Cloudflare Workers (puro JS, sem nativos). Adicionar via `bun add fast-xml-parser`.
- CPM ignora tarefas-resumo (`isSummary`) — só folhas têm dependências relevantes.
- Toast warning do G1.3 é puramente UI; auditoria continua sendo registrada pelo trigger.

## Fora desta onda
- Roles (G3) — exige tela de membros e refator de RLS extenso.
- Exportação Excel/PDF, notificações in-app, backup/portabilidade (G5).
- Conversão `.mpp` → XML server-side.
- Boletim semanal automático.
