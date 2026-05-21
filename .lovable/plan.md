
## Visão geral

Hoje a planilha "CONTRATOS 2026.xlsx" faz três coisas em abas separadas: cadastro de obras (`Contratos`), lançamento de medições/NFs/pagamentos (`Previsão`) e consolidação dinâmica (`Dinâmica`/`tabFaturamento`). A ideia do app é transformar isso em um sistema único onde cada obra tem **contrato → cronograma → medições → faturamento (NF) → pagamento**, gerando previsão **inicial** (do cronograma) e **dinâmica** (redistribuindo o saldo após cada medição real) e um fluxo de caixa projetado confiável.

## Conceitos centrais (modelo de dados)

- **Obra/Contrato**: COD, nome, cliente, CNPJ, local, valor total, % antecipação, início, fim previsto, regra de medição (ex.: "Dia 15", "Dias 15 e 30", "Mensal"), prazo para emitir NF após medição aprovada (ex.: 20 dias), prazo de pagamento (ex.: 30DDL, 45DDL, 90DDL) e dia fixo de pagamento do cliente (ex.: "só paga dia 15").
- **Cronograma**: lista de etapas/períodos com `data_inicio`, `data_fim`, `% previsto no período`. A soma dá 100% do valor do contrato. Cada linha vira "previsão inicial" de faturamento daquela janela.
- **Medição (BMS)**: número da medição, data de corte, % acumulado por item, valor da medição, status (rascunho / enviada / aprovada pelo cliente / rejeitada).
- **Faturamento (NF)**: nº NF, data emissão, valor, vinculada a uma medição aprovada, vencimento calculado (regra prazo + dia fixo do cliente).
- **Pagamento**: data prevista de recebimento, data real, valor recebido, status (a receber / antecipado / pago / atrasado).

## Motor de previsão

1. **Previsão inicial (estática)**: gerada na criação da obra a partir do cronograma. Para cada janela do cronograma → 1 medição prevista → 1 NF prevista (data = data medição + prazo emissão) → 1 recebimento previsto (aplicando DDL + dia fixo do cliente, ex.: "30DDL pagando só dia 15" → próximo dia 15 após emissão+30d).
2. **Previsão dinâmica (recalculada)**: a cada medição real lançada, o sistema calcula o **delta** = previsto da janela − realizado, e **redistribui proporcionalmente** o saldo entre as janelas/medições restantes do cronograma, mantendo o valor total do contrato. Mesma regra serve quando o realizado é maior (a diferença vira "antecipação" e reduz as próximas).
3. **Reprojeção de caixa**: cada alteração regenera as datas previstas de NF e de recebimento das próximas parcelas. O usuário pode também "congelar" uma linha (ex.: NF já emitida) para que ela não seja mais redistribuída.

## Telas do app

1. **Dashboard geral** — KPIs (valor em carteira, faturado no mês, a receber 30/60/90), gráfico de fluxo de caixa previsto vs realizado, lista de obras com barra de progresso (previsto × realizado).
2. **Lista de obras** — tabela igual à aba `Contratos`, com filtros por cliente/status; botão "Nova obra".
3. **Detalhe da obra** com abas:
   - *Resumo*: dados do contrato, % executado, saldo, próxima medição, próximo recebimento.
   - *Cronograma*: timeline com as janelas, % previsto, valor previsto, valor realizado, % de aderência.
   - *Medições*: lista das BMS, status, valor, data; cadastro/edição.
   - *Faturamento*: NFs emitidas vinculadas, valores, datas e vencimentos calculados.
   - *Recebimentos*: parcelas previstas e recebidas; marcar como pago.
   - *Previsão*: tabela "previsão inicial vs dinâmica vs realizado" por janela (igual à aba `Previsão`, mas viva).
4. **Fluxo de caixa consolidado** — visão mensal de todas as obras (substitui a aba `Dinâmica`), com colunas previsto/realizado por mês e totalizadores.
5. **Importação** — upload do XLSX `CONTRATOS 2026.xlsx` e dos BMS para popular o sistema inicial.

## Regras de negócio importantes a confirmar

- **Antecipação**: algumas obras têm % de antecipação (ex.: Marfrig 10%). Tratar como medição "0ª" com valor = antecipação × valor contrato, emitida no início.
- **Dia fixo do cliente**: armazenar como campo opcional ("paga só dia X"); se vazio, vencimento = emissão + DDL puro.
- **Quando recalcular dinamicamente**: a cada medição aprovada (não na emissão da NF). Confirmar.
- **Cronograma .mpp**: arquivos do MS Project não são lidos diretamente no navegador. Importação inicial será por **CSV/XLSX exportado do Project** (ou cadastro manual das janelas com % e datas). Posso suportar também colar percentuais por quinzena.

## Stack técnica

- Frontend: React + TanStack Start (já configurado), shadcn/ui, Recharts para gráficos, date-fns para cálculo de vencimentos (DDL + dia fixo).
- Backend: Lovable Cloud (Postgres + Auth + Storage), com tabelas `obras`, `cronograma_itens`, `medicoes`, `notas_fiscais`, `recebimentos`, `clientes`. RLS por usuário/empresa.
- Importação inicial: parsing dos XLSX no servidor via server function.

## Entregas em fases

1. **Fase 1 — Cadastro e visualização**: Cloud + tabelas, CRUD de obras/clientes, cronograma manual, dashboard básico, importação do `CONTRATOS 2026.xlsx`.
2. **Fase 2 — Motor de previsão**: geração da previsão inicial, lançamento de medições, recálculo dinâmico, tela de previsão por obra.
3. **Fase 3 — Faturamento e fluxo de caixa**: NFs vinculadas, cálculo de vencimento com regra de prazo + dia fixo, tela consolidada de recebimentos e fluxo de caixa mensal.
4. **Fase 4 — Polimento**: alertas (medição atrasada, NF a emitir, recebimento previsto na semana), exportação para Excel, anexo do PDF da NF.

## Antes de codar, preciso confirmar

1. **Multiusuário?** Vai ser só você ou várias pessoas da empresa (com login)? Se vários, precisa de papéis (admin/financeiro/obra)?
2. **Cronograma**: tudo bem começar com cadastro manual das janelas (data início, data fim, % previsto) e/ou importar de XLSX exportado do MS Project? Ler `.mpp` direto exige biblioteca pesada.
3. **Recálculo dinâmico**: a redistribuição do saldo deve acontecer (a) quando a medição é **aprovada**, (b) quando a **NF é emitida**, ou (c) manualmente por botão "recalcular"?
4. **Granularidade da previsão**: quero gerar a linha de previsão por **janela do cronograma** (ex.: quinzena) ou por **data de medição contratada** (ex.: "Dia 15 e Dia 30")? Pelos seus exemplos parece ser a segunda — confirmar.

Posso seguir com a Fase 1 assim que tivermos essas respostas.
