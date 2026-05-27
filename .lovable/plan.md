# Importar .mpp (MS Project binário)

## Contexto

Hoje `/importar` aceita só `.xml` (Save As XML do MS Project). O parser `src/lib/mpp.ts` usa `DOMParser` direto no XML. O formato `.mpp` é binário proprietário — não há parser puro-JS confiável, e o Cloudflare Worker (runtime do TanStack Start neste projeto) **não roda binários nativos, child_process nem MPXJ/LibreOffice**. Isso elimina a opção de converter dentro do próprio backend Lovable.

## Opções avaliadas

| Opção | Viável aqui? | Custo | UX |
|---|---|---|---|
| A. Parser .mpp puro-JS | ❌ não existe maduro | — | — |
| B. MPXJ/LibreOffice no Worker | ❌ Worker não suporta nativos | — | — |
| C. Microservice externo (MPXJ em container) chamado via HTTP | ✅ | Hospedagem extra (Render/Fly/Railway) | Upload transparente |
| D. Instrução para o usuário converter no MS Project (Save As XML) | ✅ | Zero | Usuário faz 1 passo manual |
| E. Conversão client-side via [mpxj-wasm](https://github.com/joniles/mpxj) ou similar | ⚠️ existe build WASM do MPXJ, ~10MB, roda no browser | Bundle grande, carregar sob demanda | Funciona offline, sem servidor extra |

## Decisão recomendada: **D agora + E como evolução**

Não vale criar/manter microservice (C) só para isso. Opção **D** é entrega imediata sem custo. Opção **E** (MPXJ-WASM lazy-loaded) é o caminho técnico correto e cabe em uma onda futura quando a dor justificar o bundle.

## Escopo desta onda (Opção D + preparação para E)

### 1. Aceitar `.mpp` no input, com fluxo guiado
- `src/routes/_app.importar.tsx`, aba "Cronograma MPP XML":
  - Trocar `accept=".xml"` por `accept=".xml,.mpp"`.
  - Ao detectar extensão `.mpp` no `onFile`, **não tentar parsear**. Em vez disso, abrir um Dialog explicando:
    1. "Arquivos `.mpp` precisam ser exportados como XML antes da importação."
    2. Passo a passo no MS Project: `Arquivo → Salvar como → Tipo: XML (*.xml)`.
    3. Botão "Entendi" que limpa o input.
  - Mesmo tratamento no fluxo de import de revisão semanal (aba Cronograma na obra) — extrair o aviso para um componente compartilhado `MppNotSupportedDialog`.

### 2. Detecção robusta
- Verificar pela extensão **e** pelo magic number (primeiros bytes `D0 CF 11 E0` = OLE Compound Document, formato do .mpp). Se um `.xml` vier com bytes binários, mostrar o mesmo aviso.
- Helper `isMppBinary(file: File): Promise<boolean>` em `src/lib/mpp.ts`.

### 3. Texto e affordances
- Atualizar o label do uploader: "Arquivo XML do MS Project (.xml). Tem `.mpp`? Veja como converter."
- Link "Veja como converter" abre o mesmo Dialog (sem precisar selecionar arquivo).
- Adicionar nota curta no Card de import: "Suporte direto a `.mpp` está no roadmap (requer biblioteca WASM de ~10MB, carregada sob demanda)."

### 4. Telemetria leve (opcional, sem nova tabela)
- Quando o usuário seleciona um `.mpp`, registrar `console.info("mpp_upload_attempt")` — serve para futuramente decidir se vale priorizar Opção E.

## Fora desta onda

- **Opção C** (microservice MPXJ): só se múltiplos usuários reclamarem do passo manual. Exigiria: container Java + MPXJ, endpoint `/convert`, segredo de auth, hospedagem, monitoramento.
- **Opção E** (MPXJ-WASM no browser): vale como onda dedicada — precisa avaliar bundle real, suporte a versões de `.mpp` (2003/2007/2010+), e fluxo de progresso na UI.
- Conversão automática server-side dentro do Worker — bloqueada pelo runtime.

## Arquivos afetados

- `src/lib/mpp.ts`: adicionar `isMppBinary()`.
- `src/components/import/MppNotSupportedDialog.tsx` (novo): Dialog reutilizável com instruções.
- `src/routes/_app.importar.tsx`: aceitar `.mpp`, integrar dialog, ajustar textos.
- `src/routes/_app.obras.$id.tsx`: mesmo tratamento no import de revisão.
- `.lovable/plan.md`: atualizar seção "Fora desta onda" registrando que D foi entregue e E continua como roadmap.

## Critério de aceite

- Selecionar `.mpp` no `/importar` mostra dialog claro, não dispara erro de parser.
- Selecionar `.xml` continua funcionando exatamente como hoje.
- Mesmo comportamento na aba de revisão dentro da obra.
- Renomear `.mpp` para `.xml` ainda é detectado pelo magic number e mostra o dialog.
