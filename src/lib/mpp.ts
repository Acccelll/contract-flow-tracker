// Parser compartilhado do XML do MS Project.
// Usado pelo importador inicial (/importar) e pelo import semanal de revisões.

export type MppTask = {
  uid: string;
  name: string;
  wbs: string;
  outlineLevel: number;
  start?: string;
  finish?: string;
  isSummary: boolean;
  isMilestone: boolean;
  parentUid?: string;
  hasChildren: boolean;
  custo: number;
  percentComplete: number; // 0..100
};

export function parseMppXml(xmlText: string): { titulo?: string; tasks: MppTask[] } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("XML inválido");

  const titulo =
    doc.querySelector("Project > Title")?.textContent?.trim() ||
    doc.querySelector("Project > Name")?.textContent?.trim();

  const taskNodes = Array.from(doc.querySelectorAll("Project > Tasks > Task"));
  const raw: MppTask[] = taskNodes
    .map((t) => {
      const get = (tag: string) => t.querySelector(`:scope > ${tag}`)?.textContent?.trim();
      const start = get("Start");
      const finish = get("Finish");
      const rawCost = Number(get("Cost") ?? "0");
      const fixedCost = Number(get("FixedCost") ?? "0");
      const custo = (rawCost || fixedCost) / 100;
      const pc = Number(get("PercentComplete") ?? "0");
      return {
        uid: get("UID") ?? "",
        name: get("Name") ?? "(sem nome)",
        wbs: get("OutlineNumber") ?? "",
        outlineLevel: Number(get("OutlineLevel") ?? "0"),
        start: start ? start.slice(0, 10) : undefined,
        finish: finish ? finish.slice(0, 10) : undefined,
        isSummary: get("Summary") === "1",
        isMilestone: get("Milestone") === "1",
        hasChildren: false,
        custo: isFinite(custo) ? custo : 0,
        percentComplete: isFinite(pc) ? Math.max(0, Math.min(100, pc)) : 0,
      };
    })
    .filter((t) => t.outlineLevel > 0 && t.name);

  const stack: MppTask[] = [];
  for (const t of raw) {
    while (stack.length && stack[stack.length - 1].outlineLevel >= t.outlineLevel) stack.pop();
    t.parentUid = stack[stack.length - 1]?.uid;
    stack.push(t);
  }
  const childCount = new Map<string, number>();
  for (const t of raw) if (t.parentUid) childCount.set(t.parentUid, (childCount.get(t.parentUid) ?? 0) + 1);
  for (const t of raw) t.hasChildren = (childCount.get(t.uid) ?? 0) > 0;

  return { titulo, tasks: raw };
}

export function dias(start: string, finish: string): number {
  const a = new Date(start).getTime();
  const b = new Date(finish).getTime();
  return Math.max(1, Math.round((b - a) / 86400000));
}

export function parentChain(t: MppTask, byUid: Map<string, MppTask>): MppTask[] {
  const chain: MppTask[] = [];
  let p = t.parentUid;
  while (p) {
    const pt = byUid.get(p);
    if (!pt) break;
    chain.push(pt);
    p = pt.parentUid;
  }
  return chain.reverse();
}
