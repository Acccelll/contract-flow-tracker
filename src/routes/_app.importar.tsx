import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { brl, calcularVencimento } from "@/lib/billing";
import { Badge } from "@/components/ui/badge";
import { recalcularPrevisaoNF } from "./_app.obras.$id";
import { parseISO } from "date-fns";
import { Upload, FileSpreadsheet, CheckCircle2, CalendarClock, FileText } from "lucide-react";

export const Route = createFileRoute("/_app/importar")({
  component: Importar,
  ssr: false,
});

type Row = {
  codigo: string;
  nome: string;
  cliente: string;
  valor_contrato: number;
  data_inicio?: string;
  data_fim?: string;
  local?: string;
  pedido_contrato?: string;
  percentual_antecipacao?: number;
  prazo_pagamento_dias?: number;
  prazo_emitir_nf_dias?: number;
  dia_fixo_pagamento?: number;
};

function num(v: any): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  const s = String(v).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  return Number(s) || 0;
}

function dateStr(v: any, XLSX: any): string | undefined {
  if (!v) return undefined;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return undefined;
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  const m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  return s;
}

function pick(row: any, keys: string[]): any {
  for (const k of keys) {
    for (const key of Object.keys(row)) {
      if (key.toLowerCase().trim().includes(k)) return row[key];
    }
  }
  return undefined;
}

function Importar() {
  const [rows, setRows] = useState<Row[]>([]);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState<{ obras: number; clientes: number } | null>(null);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setDone(null);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(ev.target?.result, { type: "binary", cellDates: true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
        const parsed: Row[] = json
          .map((r) => ({
            codigo: String(pick(r, ["codigo", "código", "cod"]) ?? "").trim(),
            nome: String(pick(r, ["obra", "nome"]) ?? "").trim(),
            cliente: String(pick(r, ["cliente"]) ?? "").trim(),
            valor_contrato: num(pick(r, ["valor contrato", "valor do contrato", "contrato", "valor"])),
            data_inicio: dateStr(pick(r, ["início", "inicio", "data inicio"]), XLSX),
            data_fim: dateStr(pick(r, ["fim", "término", "termino", "data fim"]), XLSX),
            local: String(pick(r, ["local", "endereço", "endereco"]) ?? "").trim() || undefined,
            pedido_contrato: String(pick(r, ["pedido", "contrato nº", "contrato n"]) ?? "").trim() || undefined,
            percentual_antecipacao: num(pick(r, ["antecipa"])),
            prazo_pagamento_dias: num(pick(r, ["prazo pagamento", "pagamento ddl", "ddl"])),
            prazo_emitir_nf_dias: num(pick(r, ["prazo nf", "emitir nf", "prazo emissao"])),
            dia_fixo_pagamento: num(pick(r, ["dia fixo", "dia pagamento"])),
          }))
          .filter((r) => r.codigo || r.nome);
        setRows(parsed);
        toast.success(`${parsed.length} linhas detectadas`);
      } catch (err: any) {
        toast.error(`Erro ao ler planilha: ${err.message}`);
      }
    };
    reader.readAsBinaryString(file);
  }

  async function importar() {
    setImporting(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) throw new Error("Não autenticado");

      // 1) clientes únicos
      const nomesClientes = Array.from(new Set(rows.map((r) => r.cliente).filter(Boolean)));
      const { data: existentes } = await supabase.from("clientes").select("id, nome");
      const mapaCli = new Map<string, string>();
      existentes?.forEach((c) => mapaCli.set(c.nome.toLowerCase(), c.id));

      let novosClientes = 0;
      for (const nome of nomesClientes) {
        if (mapaCli.has(nome.toLowerCase())) continue;
        const { data, error } = await supabase
          .from("clientes")
          .insert({ nome, owner_id: uid })
          .select("id")
          .single();
        if (error) throw error;
        if (data) {
          mapaCli.set(nome.toLowerCase(), data.id);
          novosClientes++;
        }
      }

      // 2) obras
      let novasObras = 0;
      for (const r of rows) {
        if (!r.codigo && !r.nome) continue;
        const cliente_id = r.cliente ? mapaCli.get(r.cliente.toLowerCase()) : null;
        const { error } = await supabase.from("obras").insert({
          owner_id: uid,
          codigo: r.codigo || r.nome.slice(0, 12),
          nome: r.nome || r.codigo,
          cliente_id,
          valor_contrato: r.valor_contrato,
          data_inicio: r.data_inicio,
          data_fim: r.data_fim,
          local: r.local,
          pedido_contrato: r.pedido_contrato,
          percentual_antecipacao: r.percentual_antecipacao || null,
          prazo_pagamento_dias: r.prazo_pagamento_dias || null,
          prazo_emitir_nf_dias: r.prazo_emitir_nf_dias || null,
          dia_fixo_pagamento: r.dia_fixo_pagamento || null,
        });
        if (error) {
          console.warn(`Obra ${r.codigo} pulada: ${error.message}`);
          continue;
        }
        novasObras++;
      }

      setDone({ obras: novasObras, clientes: novosClientes });
      toast.success(`Importação concluída: ${novasObras} obras, ${novosClientes} clientes`);
      setRows([]);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Importar dados</h1>
        <p className="text-sm text-muted-foreground">
          Importe obras/clientes via planilha ou um cronograma do MS Project (XML) para uma obra existente.
        </p>
      </header>

      <Tabs defaultValue="planilha">
        <TabsList>
          <TabsTrigger value="planilha"><FileSpreadsheet className="h-4 w-4 mr-2" />Planilha de contratos</TabsTrigger>
          <TabsTrigger value="cronograma"><CalendarClock className="h-4 w-4 mr-2" />Cronograma (MS Project XML)</TabsTrigger>
          <TabsTrigger value="nfse"><FileText className="h-4 w-4 mr-2" />NFS-e (Excel)</TabsTrigger>
        </TabsList>

        <TabsContent value="planilha" className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><FileSpreadsheet className="h-4 w-4" /> Arquivo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>Planilha (.xlsx, .xls, .csv)</Label>
                <Input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} />
              </div>
              <p className="text-xs text-muted-foreground">
                Colunas reconhecidas (qualquer ordem): <code>código, obra/nome, cliente, valor contrato, início, fim, local, pedido, antecipação, prazo pagamento, prazo NF, dia fixo</code>.
              </p>
            </CardContent>
          </Card>

          {rows.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Pré-visualização ({rows.length})</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">Total: {brl(rows.reduce((a, r) => a + r.valor_contrato, 0))}</p>
                </div>
                <Button onClick={importar} disabled={importing}>
                  <Upload className="h-4 w-4 mr-2" />{importing ? "Importando…" : "Importar agora"}
                </Button>
              </CardHeader>
              <CardContent className="overflow-auto">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Código</TableHead><TableHead>Obra</TableHead><TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Valor</TableHead><TableHead>Início</TableHead><TableHead>Fim</TableHead>
                    <TableHead className="text-right">DDL</TableHead><TableHead className="text-right">Dia fixo</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {rows.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs">{r.codigo}</TableCell>
                        <TableCell>{r.nome}</TableCell>
                        <TableCell>{r.cliente}</TableCell>
                        <TableCell className="text-right">{brl(r.valor_contrato)}</TableCell>
                        <TableCell>{r.data_inicio ?? "—"}</TableCell>
                        <TableCell>{r.data_fim ?? "—"}</TableCell>
                        <TableCell className="text-right">{r.prazo_pagamento_dias || "—"}</TableCell>
                        <TableCell className="text-right">{r.dia_fixo_pagamento || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {done && (
            <Card>
              <CardContent className="pt-6 flex items-center gap-2 text-green-700 dark:text-green-300">
                <CheckCircle2 className="h-4 w-4" />
                Importado: {done.obras} obras e {done.clientes} novos clientes.
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="cronograma" className="mt-4">
          <CronogramaImporter />
        </TabsContent>

        <TabsContent value="nfse" className="mt-4">
          <NfseImporter />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============== Cronograma (MS Project XML) ==============

type MppTask = {
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
  percentComplete?: number;
};

function parseMppXml(xmlText: string): { titulo?: string; tasks: MppTask[] } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("XML inválido");

  const titulo = doc.querySelector("Project > Title")?.textContent?.trim()
    || doc.querySelector("Project > Name")?.textContent?.trim();

  const taskNodes = Array.from(doc.querySelectorAll("Project > Tasks > Task"));
  const raw: MppTask[] = taskNodes.map((t) => {
    const get = (tag: string) => t.querySelector(`:scope > ${tag}`)?.textContent?.trim();
    const start = get("Start");
    const finish = get("Finish");
    // Cost no XML do MS Project vem em centavos (ex.: 875500000 → R$ 8.755.000,00)
    const rawCost = Number(get("Cost") ?? "0");
    const fixedCost = Number(get("FixedCost") ?? "0");
    const custo = (rawCost || fixedCost) / 100;
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
      percentComplete: Number(get("PercentComplete") ?? "0") || 0,
    };
  }).filter((t) => t.outlineLevel > 0 && t.name);


  // parentUid via stack pela ordem do XML
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

type MppReport = {
  ok: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    tarefasLidas: number;
    folhas: number;
    custoTotal: number;
    percentualMedio: number;
  };
};

function validateMpp(tasks: MppTask[], valorContrato?: number | null): MppReport {
  const errors: string[] = [];
  const warnings: string[] = [];
  const folhas = tasks.filter((t) => !t.hasChildren);
  const folhasComData = folhas.filter((t) => t.start && t.finish);
  const custoTotal = folhas.reduce((a, t) => a + (t.custo || 0), 0);
  const pctMedio = folhas.length
    ? folhas.reduce((a, t) => a + ((t as any).percentComplete || 0), 0) / folhas.length
    : 0;

  if (tasks.length === 0) errors.push("Nenhuma tarefa encontrada no XML.");
  if (folhas.length === 0) errors.push("Nenhuma tarefa-folha (executável) detectada.");
  if (folhas.length > 0 && custoTotal === 0)
    warnings.push("Custo total das folhas é zero — verifique se o XML traz <Cost> ou <FixedCost>.");
  if (folhasComData.length < folhas.length)
    warnings.push(`${folhas.length - folhasComData.length} folha(s) sem datas serão ignoradas.`);
  const semUid = tasks.filter((t) => !t.uid).length;
  if (semUid > 0) errors.push(`${semUid} tarefa(s) sem UID — XML inconsistente.`);

  // Heurística "Cost remanescente": se há avanço médio significativo e custo total é baixo
  // relativo ao contrato, MS Project pode estar exportando custo remanescente, não total.
  if (valorContrato && valorContrato > 0 && pctMedio > 5 && custoTotal < 0.9 * Number(valorContrato)) {
    warnings.push(
      `Custo total (${custoTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}) é menor que 90% do contrato e há avanço médio de ${pctMedio.toFixed(1)}%. ` +
      "Possível custo remanescente — MS Project exporta <Cost> como remanescente quando há % concluído. Confirme antes de importar.",
    );
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    stats: {
      tarefasLidas: tasks.length,
      folhas: folhas.length,
      custoTotal,
      percentualMedio: pctMedio,
    },
  };
}


function CronogramaImporter() {
  const [tasks, setTasks] = useState<MppTask[]>([]);
  const [titulo, setTitulo] = useState<string>("");
  const [obraId, setObraId] = useState<string>("");
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [substituir, setSubstituir] = useState<boolean>(true);
  const [ponderacao, setPonderacao] = useState<"custo" | "dias">("custo");
  const [done, setDone] = useState<number | null>(null);
  const [report, setReport] = useState<MppReport | null>(null);


  const { data: obras } = useQuery({
    queryKey: ["obras-lista"],
    queryFn: async () => (await supabase.from("obras").select("id, codigo, nome, valor_contrato").order("codigo")).data ?? [],
  });
  const obraSelecionada = obras?.find((o) => o.id === obraId);
  const valorContrato = Number(obraSelecionada?.valor_contrato ?? 0);


  // index helpers
  const byUid = new Map(tasks.map((t) => [t.uid, t]));
  const childrenOf = new Map<string, MppTask[]>();
  for (const t of tasks) {
    if (!t.parentUid) continue;
    const arr = childrenOf.get(t.parentUid) ?? [];
    arr.push(t);
    childrenOf.set(t.parentUid, arr);
  }

  function descendants(uid: string): MppTask[] {
    const out: MppTask[] = [];
    const stack = [...(childrenOf.get(uid) ?? [])];
    while (stack.length) {
      const x = stack.pop()!;
      out.push(x);
      for (const c of childrenOf.get(x.uid) ?? []) stack.push(c);
    }
    return out;
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setDone(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = String(ev.target?.result ?? "");
        const { titulo, tasks } = parseMppXml(text);
        const rep = validateMpp(tasks, valorContrato);
        setReport(rep);
        setTitulo(titulo ?? "");
        setTasks(tasks);
        // pré-seleciona folhas (incluindo marcos de 0 dias — preserva ART etc.)
        const initSel: Record<string, boolean> = {};
        tasks.forEach((t) => { if (!t.hasChildren) initSel[t.uid] = true; });
        setSelected(initSel);
        setCollapsed(new Set());
        if (rep.errors.length) toast.error(`XML com ${rep.errors.length} erro(s) — veja painel`);
        else if (rep.warnings.length) toast.warning(`${tasks.length} tarefas, ${rep.warnings.length} aviso(s)`);
        else toast.success(`${tasks.length} tarefas detectadas (${rep.stats.folhas} folhas)`);
      } catch (err: any) {
        toast.error(`Erro ao ler XML: ${err.message}`);
        setReport({ ok: false, errors: [String(err.message)], warnings: [], stats: { tarefasLidas: 0, folhas: 0, custoTotal: 0, percentualMedio: 0 } });
      }
    };
    reader.readAsText(file);
  }

  // Somente folhas (tarefas mais profundas de cada ramo) entram nos totais e
  // na importação. Resumos são apenas contexto visual / hierarquia do Project.
  const escolhidas = tasks.filter((t) => !t.hasChildren && selected[t.uid] && t.start && t.finish);
  const totalDias = escolhidas.reduce((acc, t) => acc + dias(t.start!, t.finish!), 0) || 1;
  const totalCusto = escolhidas.reduce((acc, t) => acc + (t.custo || 0), 0);
  // se a opção for "custo" mas a seleção não tiver nenhum valor, cai para "dias"
  const modoEfetivo: "custo" | "dias" = ponderacao === "custo" && totalCusto > 0 ? "custo" : "dias";

  function pctOf(t: MppTask): number {
    if (t.hasChildren) return 0;
    if (!t.start || !t.finish) return 0;
    if (modoEfetivo === "custo") return totalCusto > 0 ? ((t.custo || 0) / totalCusto) * 100 : 0;
    return (dias(t.start, t.finish) / totalDias) * 100;
  }

  // Roll-up de custo apenas para exibição em linhas de resumo (não entra no total).
  const rollupCusto = new Map<string, number>();
  for (const t of tasks) {
    if (t.hasChildren) {
      const desc = descendants(t.uid).filter((d) => !d.hasChildren);
      rollupCusto.set(t.uid, desc.reduce((acc, d) => acc + (d.custo || 0), 0));
    }
  }

  // Cadeia de pais (do mais próximo ao mais distante) para preservar contexto na descrição.
  function parentChain(t: MppTask): MppTask[] {
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

  function setAll(predicate: (t: MppTask) => boolean) {
    const next: Record<string, boolean> = {};
    tasks.forEach((t) => { if (!t.hasChildren && predicate(t)) next[t.uid] = true; });
    setSelected(next);
  }

  function toggleSelect(t: MppTask, value: boolean) {
    // Resumos não são selecionáveis — apenas folhas contribuem.
    if (t.hasChildren) return;
    setSelected((s) => ({ ...s, [t.uid]: value }));
  }

  function toggleCollapse(uid: string) {
    setCollapsed((s) => {
      const n = new Set(s);
      if (n.has(uid)) n.delete(uid); else n.add(uid);
      return n;
    });
  }

  // visíveis: oculta descendentes de nós colapsados
  const visibleTasks: MppTask[] = [];
  {
    const hiddenAncestors = new Set<string>();
    for (const t of tasks) {
      let hidden = false;
      let p = t.parentUid;
      while (p) {
        if (collapsed.has(p) || hiddenAncestors.has(p)) { hidden = true; break; }
        p = byUid.get(p)?.parentUid;
      }
      if (!hidden) visibleTasks.push(t);
      else hiddenAncestors.add(t.uid);
    }
  }

  async function importar() {
    if (!obraId) return toast.error("Selecione a obra de destino");
    if (escolhidas.length === 0) return toast.error("Nenhuma tarefa selecionada com datas válidas");
    setImporting(true);
    try {
      if (substituir) {
        const { error: delErr } = await supabase.from("cronograma_itens").delete().eq("obra_id", obraId);
        if (delErr) throw delErr;
      }
      const rows = escolhidas.map((t, i) => {
        const wbs = t.wbs ? `${t.wbs} ` : "";
        const chain = parentChain(t)
          .map((p) => (p.wbs ? `${p.wbs} ${p.name}` : p.name))
          .join(" › ");
        const contexto = chain ? `  ·  [${chain}]` : "";
        return {
          obra_id: obraId,
          descricao: wbs + t.name + contexto,
          data_inicio: t.start!,
          data_fim: t.finish!,
          ordem: i,
          custo: Number((t.custo || 0).toFixed(2)),
          custo_baseline: Number((t.custo || 0).toFixed(2)),
          percentual_previsto: Number(pctOf(t).toFixed(6)),
          uid_mpp: t.uid || null,
          data_inicio_baseline: t.start!,
          data_fim_baseline: t.finish!,
          ativo: true,
        };
      });
      const { error } = await supabase.from("cronograma_itens").insert(rows);
      if (error) throw error;

      // Onda 1.2: criar baseline v1 (ou próxima versão) congelada com os itens recém-importados
      const { data: itensSalvos, error: selErr } = await supabase
        .from("cronograma_itens")
        .select("id, uid_mpp, descricao, custo_baseline, custo, data_inicio_baseline, data_inicio, data_fim_baseline, data_fim, percentual_previsto")
        .eq("obra_id", obraId)
        .eq("ativo", true);
      if (selErr) throw selErr;

      const { data: ultimaBl } = await supabase
        .from("cronograma_baselines")
        .select("versao")
        .eq("obra_id", obraId)
        .order("versao", { ascending: false })
        .limit(1)
        .maybeSingle();
      const proximaVersao = (ultimaBl?.versao ?? 0) + 1;

      const { data: novaBl, error: blErr } = await supabase
        .from("cronograma_baselines")
        .insert({ obra_id: obraId, versao: proximaVersao, motivo: "import_inicial" })
        .select("id")
        .single();
      if (blErr) throw blErr;

      if (itensSalvos && itensSalvos.length) {
        const linhas = itensSalvos.map((ci: any) => ({
          baseline_id: novaBl.id,
          cronograma_item_id: ci.id,
          uid_mpp: ci.uid_mpp,
          descricao: ci.descricao,
          custo: Number(ci.custo_baseline ?? ci.custo ?? 0),
          data_inicio: ci.data_inicio_baseline ?? ci.data_inicio,
          data_fim: ci.data_fim_baseline ?? ci.data_fim,
          percentual_previsto: Number(ci.percentual_previsto ?? 0),
        }));
        const { error: liErr } = await supabase.from("cronograma_item_baseline").insert(linhas);
        if (liErr) throw liErr;
      }

      setDone(rows.length);
      toast.success(`${rows.length} itens importados — baseline v${proximaVersao} criada`);

    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><CalendarClock className="h-4 w-4" /> Cronograma (XML do MS Project)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Arquivo .xml</Label>
              <Input type="file" accept=".xml" onChange={onFile} />
            </div>
            <div className="space-y-1.5">
              <Label>Obra de destino</Label>
              <Select value={obraId} onValueChange={setObraId}>
                <SelectTrigger><SelectValue placeholder="Selecione a obra" /></SelectTrigger>
                <SelectContent>
                  {(obras ?? []).map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.codigo} — {o.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {titulo && <p className="text-xs text-muted-foreground">Projeto: <strong>{titulo}</strong> · {tasks.length} tarefas · {tasks.filter((t) => !t.hasChildren).length} folhas</p>}
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={substituir} onCheckedChange={(v) => setSubstituir(!!v)} />
            Substituir cronograma existente da obra (recomendado — evita duplicar itens em reimportações)
          </label>
          <div className="space-y-1.5">
            <Label>Ponderação do % previsto</Label>
            <Select value={ponderacao} onValueChange={(v) => setPonderacao(v as "custo" | "dias")}>
              <SelectTrigger className="md:w-[280px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="custo">Por custo (R$) — recomendado</SelectItem>
                <SelectItem value="dias">Por duração (dias)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">
            A árvore espelha a EDT do MS Project. Marcos (0 dias, ex.: ART) são preservados com 0% previsto. O % previsto é proporcional ao <strong>custo</strong> (R$) de cada tarefa dentro da seleção — caso o XML não traga custos, cai automaticamente para duração em dias.
          </p>

        </CardContent>
      </Card>

      {report && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground uppercase">Tarefas lidas</div>
                <div className="font-semibold">{report.stats.tarefasLidas}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase">Folhas</div>
                <div className="font-semibold">{report.stats.folhas}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase">Custo total</div>
                <div className="font-semibold">{brl(report.stats.custoTotal)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground uppercase">% médio</div>
                <div className="font-semibold">{report.stats.percentualMedio.toFixed(1)}%</div>
              </div>
            </div>
            {report.errors.length > 0 && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-1">
                <div className="text-sm font-medium text-destructive">Erros bloqueantes</div>
                <ul className="text-xs list-disc pl-5 text-destructive">
                  {report.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              </div>
            )}
            {report.warnings.length > 0 && (
              <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 space-y-1">
                <div className="text-sm font-medium text-amber-700 dark:text-amber-400">Avisos</div>
                <ul className="text-xs list-disc pl-5 text-amber-700 dark:text-amber-400">
                  {report.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tasks.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle>Tarefas do cronograma ({tasks.length})</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {escolhidas.length} folhas · {brl(totalCusto)} · {totalDias} dias · ponderação por <strong>{modoEfetivo === "custo" ? "custo" : "duração"}</strong>
              </p>
              {obraId && (
                <p className="text-xs mt-1">
                  Contrato: <strong>{brl(valorContrato)}</strong> ·{" "}
                  {valorContrato > 0 ? (
                    <>
                      Selecionado cobre{" "}
                      <strong className={
                        totalCusto > valorContrato * 1.001
                          ? "text-destructive"
                          : totalCusto >= valorContrato * 0.999
                            ? "text-green-600 dark:text-green-400"
                            : "text-amber-600 dark:text-amber-400"
                      }>
                        {((totalCusto / valorContrato) * 100).toFixed(2)}%
                      </strong>{" "}
                      do contrato · diferença {brl(totalCusto - valorContrato)}
                    </>
                  ) : (
                    <span className="text-muted-foreground">obra sem valor de contrato</span>
                  )}
                </p>
              )}


            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => setAll(() => true)}>Todas as folhas</Button>
              <Button variant="outline" size="sm" onClick={() => setAll((t) => !!t.start && !!t.finish && dias(t.start, t.finish) > 0)}>Folhas c/ duração</Button>
              <Button variant="outline" size="sm" onClick={() => setSelected({})}>Limpar</Button>
              <Button variant="outline" size="sm" onClick={() => setCollapsed(new Set(tasks.filter((t) => t.hasChildren).map((t) => t.uid)))}>Recolher tudo</Button>
              <Button variant="outline" size="sm" onClick={() => setCollapsed(new Set())}>Expandir tudo</Button>
              <Button onClick={importar} disabled={importing || !obraId || (report ? !report.ok : false)}>
                <Upload className="h-4 w-4 mr-2" />{importing ? "Importando…" : "Importar cronograma"}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="overflow-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead className="w-20">EDT</TableHead>
                <TableHead>Tarefa</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Fim</TableHead>
                <TableHead className="text-right">Dias</TableHead>
                <TableHead className="text-right">Custo</TableHead>
                <TableHead className="text-right">% previsto</TableHead>
              </TableRow></TableHeader>

              <TableBody>
                {visibleTasks.map((t) => {
                  const d = t.start && t.finish ? dias(t.start, t.finish) : 0;
                  const pct = selected[t.uid] ? pctOf(t) : 0;
                  const isSummary = t.hasChildren || t.isSummary;
                  const isCollapsed = collapsed.has(t.uid);

                  return (
                    <TableRow key={t.uid} className={isSummary ? "bg-muted/40" : ""}>
                      <TableCell>
                        {isSummary ? (
                          <span className="inline-block w-4" />
                        ) : (
                          <Checkbox
                            checked={!!selected[t.uid]}
                            onCheckedChange={(v) => toggleSelect(t, !!v)}
                          />
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{t.wbs}</TableCell>
                      <TableCell>
                        <div className="flex items-center" style={{ paddingLeft: `${(t.outlineLevel - 1) * 18}px` }}>
                          {t.hasChildren ? (
                            <button
                              type="button"
                              onClick={() => toggleCollapse(t.uid)}
                              className="mr-1 inline-flex h-4 w-4 items-center justify-center text-xs text-muted-foreground hover:text-foreground"
                              aria-label={isCollapsed ? "Expandir" : "Recolher"}
                            >
                              {isCollapsed ? "▸" : "▾"}
                            </button>
                          ) : (
                            <span className="mr-1 inline-block w-4 text-center text-xs text-muted-foreground">
                              {t.isMilestone ? "◆" : "·"}
                            </span>
                          )}
                          <span className={isSummary ? "font-semibold" : t.isMilestone ? "text-muted-foreground" : ""}>
                            {t.name}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{t.start ?? "—"}</TableCell>
                      <TableCell className="whitespace-nowrap">{t.finish ?? "—"}</TableCell>
                      <TableCell className="text-right">{isSummary ? "—" : (d || (t.isMilestone ? "0" : "—"))}</TableCell>
                      <TableCell className={`text-right whitespace-nowrap ${isSummary ? "text-muted-foreground italic" : ""}`}>
                        {isSummary
                          ? (rollupCusto.get(t.uid) ? brl(rollupCusto.get(t.uid)!) : "—")
                          : (t.custo ? brl(t.custo) : "—")}
                      </TableCell>
                      <TableCell className="text-right">{!isSummary && pct ? pct.toFixed(1) + "%" : "—"}</TableCell>

                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {done != null && (
        <Card>
          <CardContent className="pt-6 flex items-center gap-2 text-green-700 dark:text-green-300">
            <CheckCircle2 className="h-4 w-4" /> {done} itens importados para a obra selecionada.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function dias(start: string, end: string): number {
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  return Math.max(0, Math.round((b - a) / (1000 * 60 * 60 * 24)));
}

// ============== NFS-e (Excel) ==============

type NfseRow = {
  numero: string;
  codigo_obra: string;
  data_emissao?: string;
  competencia?: string;
  valor_servicos: number;
  inss_retido: number;
  iss_retido: number;
  outras_retencoes: number;
  valor_liquido: number;
  tomador_nome?: string;
  tomador_cnpj?: string;
  codigo_verificacao?: string;
  // resolvidos durante preview:
  obra_id?: string;
  obra_label?: string;
  status: "ok" | "obra_nao_encontrada" | "duplicada" | "sem_chave";
  motivo?: string;
};

function NfseImporter() {
  const [rows, setRows] = useState<NfseRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState<{ inseridas: number; ignoradas: number } | null>(null);
  const [filtro, setFiltro] = useState<"todas" | "ok" | "ignoradas">("todas");

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setDone(null);
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(ev.target?.result, { type: "binary", cellDates: true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        // mapa de obras por código
        const { data: obras } = await supabase.from("obras").select("id, codigo, nome");
        const mapaObras = new Map<string, { id: string; nome: string; codigo: string }>();
        obras?.forEach((o) => mapaObras.set(String(o.codigo).trim().toLowerCase(), o));

        // chaves de NFs já existentes (numero + obra_id)
        const { data: existentes } = await supabase.from("notas_fiscais").select("numero, obra_id");
        const chaves = new Set<string>();
        existentes?.forEach((n) => { if (n.numero) chaves.add(`${n.obra_id}::${String(n.numero).trim()}`); });

        const parsed: NfseRow[] = json.map((r) => {
          const numero = String(pick(r, ["numero nfs-e", "número nfs-e", "numero nfse", "número nfse", "numero da nfs", "numero nf"]) ?? "").trim();
          const codigo_obra = String(pick(r, ["cod. obra (interno)", "cod obra (interno)", "código obra (interno)", "cod obra interno", "cod. obra"]) ?? "").trim();
          const data_emissao = dateStr(pick(r, ["data emiss", "emissao", "emissão"]), XLSX);
          const competencia = dateStr(pick(r, ["compet"]), XLSX);
          const valor_servicos = num(pick(r, ["valor dos serv", "valor servic", "valor do serv"]));
          const inss_retido = num(pick(r, ["inss"]));
          const iss_retido = num(pick(r, ["iss retido", "iss"]));
          const outras_retencoes = num(pick(r, ["outras reten", "retenc"]));
          let valor_liquido = num(pick(r, ["valor liquido", "valor líquido", "líquido", "liquido"]));
          if (!valor_liquido && valor_servicos) {
            valor_liquido = Math.max(0, valor_servicos - inss_retido - iss_retido - outras_retencoes);
          }
          const tomador_nome = String(pick(r, ["tomador nome", "razao social tomador", "razão social tomador", "tomador"]) ?? "").trim() || undefined;
          const tomador_cnpj = String(pick(r, ["tomador cnpj", "cnpj tomador", "cnpj/cpf tomador"]) ?? "").trim() || undefined;
          const codigo_verificacao = String(pick(r, ["codigo de verif", "código de verif", "cod. verif", "cod verif"]) ?? "").trim() || undefined;

          const base: NfseRow = {
            numero, codigo_obra, data_emissao, competencia,
            valor_servicos, inss_retido, iss_retido, outras_retencoes, valor_liquido,
            tomador_nome, tomador_cnpj, codigo_verificacao,
            status: "ok",
          };

          if (!numero || !codigo_obra) { base.status = "sem_chave"; base.motivo = "Sem nº NFS-e ou código da obra"; return base; }
          const obra = mapaObras.get(codigo_obra.toLowerCase());
          if (!obra) { base.status = "obra_nao_encontrada"; base.motivo = `Obra ${codigo_obra} não cadastrada`; return base; }
          base.obra_id = obra.id;
          base.obra_label = `${obra.codigo} — ${obra.nome}`;
          if (chaves.has(`${obra.id}::${numero}`)) { base.status = "duplicada"; base.motivo = "NF já importada"; return base; }
          return base;
        }).filter((r) => r.numero || r.codigo_obra || r.valor_servicos);

        setRows(parsed);
        const okCount = parsed.filter((r) => r.status === "ok").length;
        toast.success(`${parsed.length} linhas lidas · ${okCount} prontas para importar`);
      } catch (err: any) {
        toast.error(`Erro ao ler planilha: ${err.message}`);
      }
    };
    reader.readAsBinaryString(file);
  }

  async function importar() {
    const aImportar = rows.filter((r) => r.status === "ok");
    if (aImportar.length === 0) return toast.error("Nenhuma linha pronta para importar");
    setImporting(true);
    try {
      let inseridas = 0;
      const obrasAfetadas = new Set<string>();
      for (const r of aImportar) {
        if (!r.obra_id) continue;
        const { error } = await supabase.from("notas_fiscais").insert({
          obra_id: r.obra_id,
          numero: r.numero,
          data_emissao: r.data_emissao ?? null,
          competencia: r.competencia ?? null,
          valor: r.valor_servicos,
          valor_servicos: r.valor_servicos,
          inss_retido: r.inss_retido,
          iss_retido: r.iss_retido,
          outras_retencoes: r.outras_retencoes,
          valor_liquido: r.valor_liquido,
          tomador_nome: r.tomador_nome ?? null,
          tomador_cnpj: r.tomador_cnpj ?? null,
          codigo_verificacao: r.codigo_verificacao ?? null,
        });
        if (error) { console.warn(`NF ${r.numero} pulada: ${error.message}`); continue; }
        inseridas++;
        obrasAfetadas.add(r.obra_id);
      }

      // Recalcula previsão de recebimentos das obras afetadas
      const { data: obrasInfo } = await supabase
        .from("obras")
        .select("id, valor_contrato")
        .in("id", Array.from(obrasAfetadas));
      for (const o of obrasInfo ?? []) {
        try { await recalcularPrevisaoNF(o.id, Number(o.valor_contrato || 0)); } catch (err) { console.warn(err); }
      }

      const ignoradas = rows.length - inseridas;
      setDone({ inseridas, ignoradas });
      toast.success(`${inseridas} NFs importadas (${ignoradas} ignoradas)`);
      setRows([]);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setImporting(false);
    }
  }

  const okRows = rows.filter((r) => r.status === "ok");
  const skipRows = rows.filter((r) => r.status !== "ok");
  const visible = filtro === "ok" ? okRows : filtro === "ignoradas" ? skipRows : rows;
  const totalServicos = okRows.reduce((a, r) => a + r.valor_servicos, 0);
  const totalLiquido = okRows.reduce((a, r) => a + r.valor_liquido, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><FileText className="h-4 w-4" /> Importar NFS-e (Excel)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Planilha (.xlsx, .xls, .csv)</Label>
            <Input type="file" accept=".xlsx,.xls,.csv" onChange={onFile} />
          </div>
          <p className="text-xs text-muted-foreground">
            Colunas reconhecidas: <code>Numero NFS-e, Cod. Obra (INTERNO), Data Emissão, Competência, Valor dos Serviços, INSS, ISS Retido, Outras Retenções, Valor Líquido, Tomador (Nome/CNPJ), Código de Verificação</code>.
            Linhas sem nº NFS-e ou código da obra, obras não cadastradas e NFs duplicadas (mesmo número na mesma obra) são ignoradas silenciosamente. Registros existentes nunca são atualizados.
          </p>
        </CardContent>
      </Card>

      {rows.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3 flex-wrap">
            <div>
              <CardTitle>Pré-visualização ({rows.length})</CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {okRows.length} prontas · {skipRows.length} ignoradas · Total serviços (a importar): <strong>{brl(totalServicos)}</strong> · Líquido: <strong>{brl(totalLiquido)}</strong>
              </p>
            </div>
            <div className="flex gap-2 flex-wrap items-center">
              <Select value={filtro} onValueChange={(v) => setFiltro(v as any)}>
                <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas</SelectItem>
                  <SelectItem value="ok">Somente prontas</SelectItem>
                  <SelectItem value="ignoradas">Somente ignoradas</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={importar} disabled={importing || okRows.length === 0}>
                <Upload className="h-4 w-4 mr-2" />{importing ? "Importando…" : `Importar ${okRows.length} NFs`}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="overflow-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Nº NFS-e</TableHead>
                <TableHead>Obra</TableHead>
                <TableHead>Emissão</TableHead>
                <TableHead className="text-right">Serviços</TableHead>
                <TableHead className="text-right">INSS</TableHead>
                <TableHead className="text-right">ISS</TableHead>
                <TableHead className="text-right">Outras</TableHead>
                <TableHead className="text-right">Líquido</TableHead>
                <TableHead>Tomador</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {visible.map((r, i) => (
                  <TableRow key={i} className={r.status !== "ok" ? "opacity-60" : ""}>
                    <TableCell>
                      {r.status === "ok" ? (
                        <Badge variant="secondary" className="text-green-700 dark:text-green-300">OK</Badge>
                      ) : (
                        <Badge variant="outline" title={r.motivo}>
                          {r.status === "duplicada" ? "Duplicada" : r.status === "obra_nao_encontrada" ? "Sem obra" : "Sem chave"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">{r.numero || "—"}</TableCell>
                    <TableCell className="text-xs">{r.obra_label ?? r.codigo_obra ?? "—"}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs">
                      {r.data_emissao ? (() => { try { return parseISO(r.data_emissao).toLocaleDateString("pt-BR"); } catch { return r.data_emissao; } })() : "—"}
                    </TableCell>
                    <TableCell className="text-right">{brl(r.valor_servicos)}</TableCell>
                    <TableCell className="text-right">{r.inss_retido ? brl(r.inss_retido) : "—"}</TableCell>
                    <TableCell className="text-right">{r.iss_retido ? brl(r.iss_retido) : "—"}</TableCell>
                    <TableCell className="text-right">{r.outras_retencoes ? brl(r.outras_retencoes) : "—"}</TableCell>
                    <TableCell className="text-right font-medium">{brl(r.valor_liquido)}</TableCell>
                    <TableCell className="text-xs">{r.tomador_nome ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {done && (
        <Card>
          <CardContent className="pt-6 flex items-center gap-2 text-green-700 dark:text-green-300">
            <CheckCircle2 className="h-4 w-4" />
            {done.inseridas} NFs importadas · {done.ignoradas} ignoradas.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Suprime warning de import não usado em builds onde calcularVencimento ainda não é usado neste arquivo
void calcularVencimento;



