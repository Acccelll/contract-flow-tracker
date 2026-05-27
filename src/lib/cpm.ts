// Caminho crítico (CPM básico) sobre itens do cronograma + dependências.
// Forward pass (ES/EF) usando datas do calendário e lag em dias.
// Backward pass (LS/LF) considerando o término mais tardio da rede.
// Folga (slack) = LS - ES (em dias). Crítico se folga <= 0.

export type CpmItem = {
  id: string;
  uid_mpp: string | null;
  data_inicio: string; // ISO date
  data_fim: string;    // ISO date
};

export type CpmDep = {
  item_id: string;
  predecessor_uid_mpp: string;
  tipo: "FS" | "SS" | "FF" | "SF";
  lag_dias: number;
};

export type CpmResult = {
  id: string;
  folga_dias: number;
  critico: boolean;
};

const DAY = 86400000;
const toMs = (d: string) => new Date(d).getTime();
const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

export function computeCpm(itens: CpmItem[], deps: CpmDep[]): CpmResult[] {
  if (itens.length === 0) return [];
  const byId = new Map(itens.map((i) => [i.id, i]));
  const byUid = new Map(itens.filter((i) => i.uid_mpp).map((i) => [String(i.uid_mpp), i]));

  // Constrói arestas item -> sucessores
  const successors = new Map<string, { id: string; tipo: CpmDep["tipo"]; lag: number }[]>();
  const predecessors = new Map<string, { id: string; tipo: CpmDep["tipo"]; lag: number }[]>();
  for (const d of deps) {
    const pred = byUid.get(String(d.predecessor_uid_mpp));
    const succ = byId.get(d.item_id);
    if (!pred || !succ) continue;
    successors.set(pred.id, [...(successors.get(pred.id) ?? []), { id: succ.id, tipo: d.tipo, lag: d.lag_dias }]);
    predecessors.set(succ.id, [...(predecessors.get(succ.id) ?? []), { id: pred.id, tipo: d.tipo, lag: d.lag_dias }]);
  }

  // Forward pass — calcula ES/EF mínimos exigidos pelos predecessores
  const es = new Map<string, number>();
  const ef = new Map<string, number>();
  // Ordem topológica via Kahn
  const indeg = new Map<string, number>();
  for (const i of itens) indeg.set(i.id, (predecessors.get(i.id) ?? []).length);
  const queue: string[] = [...indeg.entries()].filter(([, n]) => n === 0).map(([id]) => id);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const s of successors.get(id) ?? []) {
      indeg.set(s.id, (indeg.get(s.id) ?? 0) - 1);
      if (indeg.get(s.id) === 0) queue.push(s.id);
    }
  }
  // Se houver ciclo, processa o resto na ordem natural (degrada graciosamente)
  if (order.length < itens.length) for (const i of itens) if (!order.includes(i.id)) order.push(i.id);

  for (const id of order) {
    const it = byId.get(id)!;
    const dur = Math.max(1, Math.round((toMs(it.data_fim) - toMs(it.data_inicio)) / DAY) + 1);
    let startMin = toMs(it.data_inicio);
    for (const p of predecessors.get(id) ?? []) {
      const pIt = byId.get(p.id);
      if (!pIt) continue;
      const pEs = es.get(p.id) ?? toMs(pIt.data_inicio);
      const pEf = ef.get(p.id) ?? toMs(pIt.data_fim);
      const lagMs = p.lag * DAY;
      let req = startMin;
      switch (p.tipo) {
        case "FS": req = pEf + DAY + lagMs; break; // sucessor começa após término
        case "SS": req = pEs + lagMs; break;
        case "FF": req = pEf - (dur - 1) * DAY + lagMs; break;
        case "SF": req = pEs - (dur - 1) * DAY + lagMs; break;
      }
      if (req > startMin) startMin = req;
    }
    es.set(id, startMin);
    ef.set(id, startMin + (dur - 1) * DAY);
  }

  // Backward pass — LF começa pelo maior EF da rede
  const projectFinish = Math.max(...[...ef.values()]);
  const lf = new Map<string, number>();
  const ls = new Map<string, number>();
  for (const id of [...order].reverse()) {
    const it = byId.get(id)!;
    const dur = Math.max(1, Math.round((toMs(it.data_fim) - toMs(it.data_inicio)) / DAY) + 1);
    const succs = successors.get(id) ?? [];
    let finishMax = succs.length === 0 ? projectFinish : Number.POSITIVE_INFINITY;
    for (const s of succs) {
      const sIt = byId.get(s.id);
      if (!sIt) continue;
      const sLs = ls.get(s.id) ?? toMs(sIt.data_inicio);
      const sLf = lf.get(s.id) ?? toMs(sIt.data_fim);
      const lagMs = s.lag * DAY;
      let allowed = finishMax;
      switch (s.tipo) {
        case "FS": allowed = sLs - DAY - lagMs; break;
        case "SS": allowed = sLs + (dur - 1) * DAY - lagMs; break;
        case "FF": allowed = sLf - lagMs; break;
        case "SF": allowed = sLf + (dur - 1) * DAY - lagMs; break;
      }
      if (allowed < finishMax) finishMax = allowed;
    }
    lf.set(id, finishMax);
    ls.set(id, finishMax - (dur - 1) * DAY);
  }

  return itens.map((i) => {
    const slackMs = (ls.get(i.id) ?? toMs(i.data_inicio)) - (es.get(i.id) ?? toMs(i.data_inicio));
    const folga = Math.round(slackMs / DAY);
    return { id: i.id, folga_dias: folga, critico: folga <= 0 };
  });
}

export function diasAtraso(itens: { data_fim: string; data_fim_baseline: string | null }[]): number {
  let max = 0;
  for (const i of itens) {
    if (!i.data_fim_baseline) continue;
    const d = Math.round((toMs(i.data_fim) - toMs(i.data_fim_baseline)) / DAY);
    if (d > max) max = d;
  }
  return max;
}

export { toIso };
