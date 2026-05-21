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
import { brl } from "@/lib/billing";
import { Upload, FileSpreadsheet, CheckCircle2, CalendarClock } from "lucide-react";

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
        setTitulo(titulo ?? "");
        setTasks(tasks);
        // pré-seleciona folhas (incluindo marcos de 0 dias — preserva ART etc.)
        const initSel: Record<string, boolean> = {};
        tasks.forEach((t) => { if (!t.hasChildren) initSel[t.uid] = true; });
        setSelected(initSel);
        setCollapsed(new Set());
        toast.success(`${tasks.length} tarefas detectadas`);
      } catch (err: any) {
        toast.error(`Erro ao ler XML: ${err.message}`);
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
          percentual_previsto: Number(pctOf(t).toFixed(6)),
        };
      });
      const { error } = await supabase.from("cronograma_itens").insert(rows);
      if (error) throw error;
      setDone(rows.length);
      toast.success(`${rows.length} itens de cronograma importados`);

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
              <Button onClick={importar} disabled={importing || !obraId}>
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


