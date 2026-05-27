import { Fragment, useMemo, useState } from "react";
import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Plus, CheckCircle2, FileText, Banknote, AlertCircle, ChevronDown, ChevronRight, CalendarClock, Upload, History, Trash2, Undo2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from "@/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { brl, calcularVencimento } from "@/lib/billing";
import { addDays, format, parseISO, differenceInCalendarDays } from "date-fns";
import { parseMppXml, parentChain as mppParentChain, isMppBinary, type MppTask } from "@/lib/mpp";
import { MppNotSupportedDialog } from "@/components/import/MppNotSupportedDialog";
import { Switch } from "@/components/ui/switch";
import { AditivosTab } from "@/components/obra/AditivosTab";
import { HistoricoTab } from "@/components/obra/HistoricoTab";
import { CompararRevisoesTab } from "@/components/obra/CompararRevisoesTab";

export const Route = createFileRoute("/_app/obras/$id")({ component: ObraDetail });

function ObraDetail() {
  const { id } = useParams({ from: "/_app/obras/$id" });
  const qc = useQueryClient();

  const { data: obra } = useQuery({
    queryKey: ["obra", id],
    queryFn: async () => (await supabase.from("obras").select("*, clientes(nome, cnpj)").eq("id", id).single()).data,
  });
  const { data: crono } = useQuery({
    queryKey: ["crono", id],
    queryFn: async () => (await supabase.from("cronograma_itens").select("*").eq("obra_id", id).order("data_inicio")).data ?? [],
  });
  const { data: medicoes } = useQuery({
    queryKey: ["medicoes", id],
    queryFn: async () => (await supabase.from("medicoes").select("*").eq("obra_id", id).order("data_corte")).data ?? [],
  });
  const { data: itensMedicao } = useQuery({
    queryKey: ["itens_medicao", id],
    queryFn: async () => {
      if (!medicoes?.length) return [];
      return (
        await supabase
          .from("itens_medicao")
          .select("*, cronograma_itens(id, descricao, custo, percentual_previsto, ordem)")
          .in("medicao_id", medicoes.map((m) => m.id))
      ).data ?? [];
    },
    enabled: !!medicoes?.length,
  });
  const { data: nfs } = useQuery({
    queryKey: ["nfs", id],
    queryFn: async () => (await supabase.from("notas_fiscais").select("*").eq("obra_id", id).order("data_emissao", { ascending: true, nullsFirst: false })).data ?? [],
  });
  const { data: receb } = useQuery({
    queryKey: ["receb", id],
    queryFn: async () => (await supabase.from("recebimentos").select("*").eq("obra_id", id).order("data_prevista")).data ?? [],
  });
  const { data: revisoes } = useQuery({
    queryKey: ["revisoes", id],
    queryFn: async () => (await supabase.from("cronograma_revisoes").select("*").eq("obra_id", id).order("numero", { ascending: false })).data ?? [],
  });
  const { data: valores } = useQuery({
    queryKey: ["obra_valores", id],
    queryFn: async () => (await (supabase as any).from("vw_obra_valores").select("*").eq("obra_id", id).maybeSingle()).data,
  });

  if (!obra) return <div className="p-8 text-muted-foreground">Carregando…</div>;

  const totalFaturado = (nfs ?? []).reduce((a, n) => a + Number(n.valor || 0), 0);
  const totalRecebido = (receb ?? []).filter((r) => r.data_recebimento).reduce((a, r) => a + Number(r.valor_recebido || r.valor_previsto || 0), 0);
  const totalPrevisto = (receb ?? []).reduce((a, r) => a + Number(r.valor_previsto || 0), 0);
  const pctFat = obra.valor_contrato ? (totalFaturado / Number(obra.valor_contrato)) * 100 : 0;

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <Link to="/obras" className="text-sm text-muted-foreground inline-flex items-center gap-1 hover:text-foreground"><ArrowLeft className="h-3 w-3" /> Voltar</Link>
      <header className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{obra.nome}</h1>
          <p className="text-sm text-muted-foreground">Cód. {obra.codigo} · {obra.clientes?.nome ?? "—"}</p>
        </div>
        <div className="flex items-start gap-4">
          <LimparImportadosButton
            obraId={id}
            temMedicoes={(medicoes ?? []).length > 0}
            temNfs={(nfs ?? []).length > 0}
            temRecebimentos={(receb ?? []).some((r: any) => r.data_recebimento)}
            onDone={() => {
              qc.invalidateQueries({ queryKey: ["crono", id] });
              qc.invalidateQueries({ queryKey: ["revisoes", id] });
              qc.invalidateQueries({ queryKey: ["receb", id] });
              qc.invalidateQueries({ queryKey: ["nfs", id] });
              qc.invalidateQueries({ queryKey: ["medicoes", id] });
              qc.invalidateQueries({ queryKey: ["itens_medicao", id] });
              qc.invalidateQueries({ queryKey: ["obra_valores", id] });
            }}
          />
          <div className="text-right">
            <div className="text-2xl font-semibold">{brl(valores?.valor_contrato_atual ?? obra.valor_contrato)}</div>
            <div className="text-xs text-muted-foreground">
              Contrato atual
              {valores && Number(valores.valor_contrato_atual) !== Number(valores.valor_contrato_original) && (
                <span className="ml-1">
                  (original {brl(valores.valor_contrato_original)} {Number(valores.valor_contrato_atual) > Number(valores.valor_contrato_original) ? "+" : ""}
                  {brl(Number(valores.valor_contrato_atual) - Number(valores.valor_contrato_original))} aditivos)
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="pt-6">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Faturado</div>
          <div className="text-xl font-semibold mt-1">{brl(totalFaturado)}</div>
          <Progress value={pctFat} className="mt-3" />
          <div className="text-xs text-muted-foreground mt-1">{pctFat.toFixed(1)}% do contrato</div>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Recebido</div>
          <div className="text-xl font-semibold mt-1">{brl(totalRecebido)}</div>
          <div className="text-xs text-muted-foreground mt-1">A receber: {brl(totalPrevisto - totalRecebido)}</div>
        </CardContent></Card>
        <Card><CardContent className="pt-6">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Prazos</div>
          <div className="text-sm mt-2">NF: {obra.prazo_emitir_nf_dias ?? "—"}d · Pagto: {obra.prazo_pagamento_dias ?? "—"} DDL{obra.dia_fixo_pagamento ? ` · dia ${obra.dia_fixo_pagamento}` : ""}</div>
          <div className="text-xs text-muted-foreground mt-1">{obra.regra_medicao ?? "Regra de medição não definida"}</div>
        </CardContent></Card>
      </div>

      <Tabs defaultValue="previsao">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="previsao">Previsão</TabsTrigger>
          <TabsTrigger value="cronograma">Cronograma</TabsTrigger>
          <TabsTrigger value="medicoes">Medições</TabsTrigger>
          <TabsTrigger value="nfs">Faturamento</TabsTrigger>
          <TabsTrigger value="recebimentos">Recebimentos</TabsTrigger>
          <TabsTrigger value="aditivos">Aditivos</TabsTrigger>
          <TabsTrigger value="revisoes">Revisões</TabsTrigger>
          <TabsTrigger value="comparar">Comparar</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="previsao"><PrevisaoTab obra={obra} crono={crono ?? []} receb={receb ?? []} nfs={nfs ?? []} onChange={() => qc.invalidateQueries({ queryKey: ["receb", id] })} /></TabsContent>
        <TabsContent value="cronograma"><CronogramaTab obra={obra} itens={crono ?? []} onChange={() => { qc.invalidateQueries({ queryKey: ["crono", id] }); qc.invalidateQueries({ queryKey: ["receb", id] }); }} /></TabsContent>
        <TabsContent value="medicoes">
          <MedicoesTab
            obra={obra}
            crono={crono ?? []}
            medicoes={medicoes ?? []}
            itensMedicao={itensMedicao ?? []}
            onChange={() => {
              qc.invalidateQueries({ queryKey: ["medicoes", id] });
              qc.invalidateQueries({ queryKey: ["itens_medicao", id] });
              qc.invalidateQueries({ queryKey: ["crono", id] });
              qc.invalidateQueries({ queryKey: ["receb", id] });
            }}
          />
        </TabsContent>
        <TabsContent value="nfs"><NfsTab obra={obra} nfs={nfs ?? []} medicoes={medicoes ?? []} onChange={() => { qc.invalidateQueries({ queryKey: ["nfs", id] }); qc.invalidateQueries({ queryKey: ["receb", id] }); }} /></TabsContent>
        <TabsContent value="recebimentos"><RecebTab receb={receb ?? []} onChange={() => qc.invalidateQueries({ queryKey: ["receb", id] })} /></TabsContent>
        <TabsContent value="aditivos"><AditivosTab obraId={id} /></TabsContent>
        <TabsContent value="revisoes">
          <RevisoesTab
            obra={obra}
            crono={crono ?? []}
            revisoes={revisoes ?? []}
            onChange={() => {
              qc.invalidateQueries({ queryKey: ["crono", id] });
              qc.invalidateQueries({ queryKey: ["revisoes", id] });
              qc.invalidateQueries({ queryKey: ["receb", id] });
            }}
          />
        </TabsContent>
        <TabsContent value="comparar"><CompararRevisoesTab obraId={id} /></TabsContent>
        <TabsContent value="historico"><HistoricoTab obraId={id} /></TabsContent>
      </Tabs>

    </div>
  );
}

function CronogramaTab({ obra, itens, onChange }: { obra: any; itens: any[]; onChange: () => void }) {
  const obraId = obra.id;
  const valorContrato = Number(obra.valor_contrato);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<any>({});
  // Custo "orçado" = custo_baseline (congelado na 1ª importação) com fallback no custo atual.
  const custoItem = (i: any) => Number(i.custo_baseline ?? i.custo ?? 0);
  const somaCusto = itens.reduce((a, i) => a + custoItem(i), 0);
  const total = valorContrato > 0 && somaCusto > 0
    ? (somaCusto / valorContrato) * 100
    : itens.reduce((a, i) => a + Number(i.percentual_previsto || 0), 0);
  const totalDiffReais = valorContrato - somaCusto;

  // % realizado global: soma(custoBaseline * pctReal) / valorContrato (denominador fixo).
  const somaExec = itens.reduce((a, i) => {
    const custo = custoItem(i);
    const base = custo > 0 ? custo : (Number(i.percentual_previsto || 0) / 100) * valorContrato;
    const pctReal = Number(i.percentual_realizado || 0);
    return a + (base * pctReal) / 100;
  }, 0);
  // Total exibido é sempre o valor do contrato — é o universo fixo da obra.
  const baseTotal = valorContrato;
  const pctRealizadoTotal = baseTotal > 0 ? (somaExec / baseTotal) * 100 : 0;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("cronograma_itens").insert({
      obra_id: obraId,
      descricao: f.descricao || null,
      data_inicio: f.data_inicio,
      data_fim: f.data_fim,
      percentual_previsto: Number(f.percentual_previsto || 0),
      ordem: itens.length,
    });
    if (error) return toast.error(error.message);
    toast.success("Janela adicionada");
    setOpen(false); setF({});
    onChange();
  }
  async function remove(id: string) {
    await supabase.from("cronograma_itens").delete().eq("id", id);
    onChange();
  }

  async function gerarPrevisao() {
    if (itens.length === 0) return toast.error("Cadastre o cronograma primeiro");
    const { data: receb } = await supabase.from("recebimentos").select("id, nota_fiscal_id, data_recebimento, congelado").eq("obra_id", obraId);
    const apagar = (receb ?? []).filter((r: any) => !r.nota_fiscal_id && !r.data_recebimento && !r.congelado).map((r: any) => r.id);
    if (apagar.length) await supabase.from("recebimentos").delete().in("id", apagar);

    const prazoNF = Number(obra.prazo_emitir_nf_dias || 0);
    const pctAntec = Number(obra.percentual_antecipacao || 0);
    const linhas: any[] = [];

    if (pctAntec > 0 && obra.data_inicio) {
      const valorAntec = (pctAntec / 100) * valorContrato;
      const venc = calcularVencimento(parseISO(obra.data_inicio), Number(obra.prazo_pagamento_dias || 0), obra.dia_fixo_pagamento);
      linhas.push({
        obra_id: obraId,
        data_prevista: venc.toISOString().slice(0, 10),
        valor_previsto: valorAntec,
        valor_previsto_inicial: valorAntec,
        status: "previsto",
        origem: "antecipacao",
        observacoes: `Antecipação ${pctAntec.toFixed(2)}%`,
      });
    }

    const baseDist = valorContrato * (1 - pctAntec / 100);
    for (const i of itens) {
      const custo = Number(i.custo || 0);
      const valor = custo > 0
        ? custo * (1 - pctAntec / 100)
        : (Number(i.percentual_previsto) / 100) * baseDist;
      const pctItem = valorContrato > 0 && custo > 0
        ? (custo / valorContrato) * 100
        : Number(i.percentual_previsto || 0);
      const dataEmissao = addDays(parseISO(i.data_fim), prazoNF);
      const venc = calcularVencimento(dataEmissao, Number(obra.prazo_pagamento_dias || 0), obra.dia_fixo_pagamento);
      linhas.push({
        obra_id: obraId,
        cronograma_item_id: i.id,
        data_prevista: venc.toISOString().slice(0, 10),
        valor_previsto: valor,
        valor_previsto_inicial: valor,
        status: "previsto",
        origem: "cronograma",
        observacoes: `Janela ${format(parseISO(i.data_inicio), "dd/MM/yy")}–${format(parseISO(i.data_fim), "dd/MM/yy")} · ${pctItem.toFixed(2)}%`,
      });
    }
    const { error } = await supabase.from("recebimentos").insert(linhas);
    if (error) return toast.error(error.message);
    toast.success(`${linhas.length} parcelas previstas geradas`);
    onChange();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <div className="flex-1 min-w-[260px]">
          <CardTitle>
            Cronograma · {total.toFixed(2)}% planejado · {pctRealizadoTotal.toFixed(2)}% realizado
          </CardTitle>
          <div className="relative mt-2 h-2 w-full rounded bg-muted overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-muted-foreground/30"
              style={{ width: `${Math.min(100, total)}%` }}
            />
            <div
              className="absolute inset-y-0 left-0 bg-green-500"
              style={{ width: `${Math.min(100, pctRealizadoTotal)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Executado: {brl(somaExec)} de {brl(baseTotal)}
            {Math.abs(totalDiffReais) > Math.max(1, valorContrato * 0.005) && (
              <span className="ml-2 text-amber-600">
                · Cronograma cobre {total.toFixed(1)}% do contrato ({brl(totalDiffReais)} {totalDiffReais > 0 ? "não orçados" : "acima do contrato"})
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={gerarPrevisao}><FileText className="h-4 w-4 mr-2" />Gerar previsão</Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-2" />Janela</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nova janela do cronograma</DialogTitle></DialogHeader>
              <form onSubmit={save} className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5"><Label>Descrição</Label><Input value={f.descricao ?? ""} onChange={(e) => setF({ ...f, descricao: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Início</Label><Input type="date" required value={f.data_inicio ?? ""} onChange={(e) => setF({ ...f, data_inicio: e.target.value })} /></div>
                <div className="space-y-1.5"><Label>Fim</Label><Input type="date" required value={f.data_fim ?? ""} onChange={(e) => setF({ ...f, data_fim: e.target.value })} /></div>
                <div className="col-span-2 space-y-1.5"><Label>% previsto no período</Label><Input type="number" step="0.0001" required value={f.percentual_previsto ?? ""} onChange={(e) => setF({ ...f, percentual_previsto: e.target.value })} /></div>
                <DialogFooter className="col-span-2"><Button type="submit">Adicionar</Button></DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <CronogramaHierarquia itens={itens} valorContrato={valorContrato} onRemove={remove} />
        {somaCusto > 0 && Math.abs(totalDiffReais) > 0.01 && (
          <p className="text-xs text-amber-600 mt-3">Atenção: soma do cronograma é {brl(somaCusto)} ({total.toFixed(2)}%) — diferença de {brl(totalDiffReais)} em relação ao contrato.</p>
        )}
        {somaCusto === 0 && total > 0 && Math.abs(total - 100) > 0.01 && (
          <p className="text-xs text-amber-600 mt-3">Atenção: soma do cronograma é {total.toFixed(2)}% (ideal 100%).</p>
        )}
      </CardContent>
    </Card>
  );
}

// ====== Hierarquia estilo MS Project ======
type CronoNode = {
  wbs: string;
  name: string;
  depth: number;
  item?: any;
  children: CronoNode[];
};

function wbsParts(w: string): number[] {
  return w.split(".").map((p) => Number(p) || 0);
}

function wbsCompare(a: string, b: string): number {
  const pa = wbsParts(a);
  const pb = wbsParts(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

function parseDescricao(desc: string): { wbs: string; name: string; chain: { wbs: string; name: string }[] } {
  const s = (desc || "").trim();
  const ctxMatch = s.match(/\s+·\s+\[(.+)\]\s*$/);
  const head = ctxMatch ? s.slice(0, ctxMatch.index).trim() : s;
  const chainStr = ctxMatch?.[1] ?? "";

  const splitWbs = (txt: string): { wbs: string; name: string } => {
    const m = txt.match(/^(\d+(?:\.\d+)*)\s+(.*)$/);
    return m ? { wbs: m[1], name: m[2].trim() } : { wbs: "", name: txt };
  };

  const leaf = splitWbs(head);
  const chain = chainStr ? chainStr.split(" › ").map(splitWbs) : [];
  return { ...leaf, chain };
}

function buildTree(itens: any[]): CronoNode[] {
  const byWbs = new Map<string, CronoNode>();
  const ensure = (wbs: string, name: string): CronoNode => {
    let n = byWbs.get(wbs);
    if (!n) {
      n = { wbs, name, depth: wbs ? wbs.split(".").length : 1, children: [] };
      byWbs.set(wbs, n);
    } else if (!n.name) {
      n.name = name;
    }
    return n;
  };

  for (const it of itens) {
    const { wbs, name, chain } = parseDescricao(String(it.descricao ?? ""));
    for (const p of chain) ensure(p.wbs, p.name);
    const leaf = ensure(wbs || `__${it.id}`, name || "(sem nome)");
    leaf.item = it;
  }

  const roots: CronoNode[] = [];
  const nodes = Array.from(byWbs.values()).sort((a, b) => wbsCompare(a.wbs, b.wbs));
  for (const n of nodes) {
    const parts = n.wbs.split(".");
    if (parts.length > 1) {
      const parentWbs = parts.slice(0, -1).join(".");
      const parent = byWbs.get(parentWbs);
      if (parent) {
        parent.children.push(n);
        continue;
      }
    }
    roots.push(n);
  }
  const sortRec = (n: CronoNode) => {
    n.children.sort((a, b) => wbsCompare(a.wbs, b.wbs));
    n.children.forEach(sortRec);
  };
  roots.sort((a, b) => wbsCompare(a.wbs, b.wbs));
  roots.forEach(sortRec);
  return roots;
}

function aggregate(n: CronoNode, valorContrato: number): { custo: number; pct: number; executado: number; base: number; inicio?: string; fim?: string } {
  const leafCompute = (item: any) => {
    const custo = Number(item.custo_baseline ?? item.custo ?? 0);
    const pct = Number(item.percentual_previsto || 0);
    const base = custo > 0 ? custo : (pct / 100) * valorContrato;
    const pctReal = Number(item.percentual_realizado || 0);
    return { custo, pct, base, executado: (base * pctReal) / 100, inicio: item.data_inicio, fim: item.data_fim };
  };

  if (n.item && n.children.length === 0) {
    return leafCompute(n.item);
  }
  let custo = 0, pct = 0, base = 0, executado = 0;
  let inicio: string | undefined;
  let fim: string | undefined;
  for (const c of n.children) {
    const a = aggregate(c, valorContrato);
    custo += a.custo;
    pct += a.pct;
    base += a.base;
    executado += a.executado;
    if (a.inicio && (!inicio || a.inicio < inicio)) inicio = a.inicio;
    if (a.fim && (!fim || a.fim > fim)) fim = a.fim;
  }
  if (n.item) {
    const l = leafCompute(n.item);
    custo += l.custo;
    pct += l.pct;
    base += l.base;
    executado += l.executado;
    if (l.inicio && (!inicio || l.inicio < inicio)) inicio = l.inicio;
    if (l.fim && (!fim || l.fim > fim)) fim = l.fim;
  }
  return { custo, pct, base, executado, inicio, fim };
}

function CronogramaHierarquia({ itens, valorContrato, onRemove }: { itens: any[]; valorContrato: number; onRemove: (id: string) => void }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const roots = buildTree(itens);

  function toggle(key: string) {
    setCollapsed((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
  }

  const rows: { node: CronoNode; depth: number }[] = [];
  const walk = (n: CronoNode, depth: number) => {
    rows.push({ node: n, depth });
    if (collapsed.has(n.wbs)) return;
    for (const c of n.children) walk(c, depth + 1);
  };
  roots.forEach((r) => walk(r, 0));

  if (rows.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-8 text-sm">Cadastre as janelas do cronograma</p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-24">EDT</TableHead>
          <TableHead>Descrição</TableHead>
          <TableHead className="whitespace-nowrap">Período</TableHead>
          <TableHead className="text-right">% previsto</TableHead>
          <TableHead className="text-right">Valor</TableHead>
          <TableHead className="text-right">% Real.</TableHead>
          <TableHead className="text-right">Executado</TableHead>
          <TableHead className="text-right">Saldo físico</TableHead>
          <TableHead></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map(({ node, depth }) => {
          const isLeaf = node.children.length === 0;
          const isCollapsed = collapsed.has(node.wbs);
          const agg = aggregate(node, valorContrato);
          const valor = agg.base;
          const pctExibir = valorContrato > 0 && agg.base > 0
            ? (agg.base / valorContrato) * 100
            : agg.pct;
          const pctReal = agg.base > 0 ? (agg.executado / agg.base) * 100 : 0;
          const saldo = valor - agg.executado;

          return (
            <TableRow key={node.wbs || node.item?.id} className={!isLeaf ? "bg-muted/40" : ""}>
              <TableCell className="font-mono text-xs text-muted-foreground">{node.wbs}</TableCell>
              <TableCell>
                <div className="flex items-center" style={{ paddingLeft: `${depth * 18}px` }}>
                  {!isLeaf ? (
                    <button
                      type="button"
                      onClick={() => toggle(node.wbs)}
                      className="mr-1 inline-flex h-4 w-4 items-center justify-center text-xs text-muted-foreground hover:text-foreground"
                      aria-label={isCollapsed ? "Expandir" : "Recolher"}
                    >
                      {isCollapsed ? "▸" : "▾"}
                    </button>
                  ) : (
                    <span className="mr-1 inline-block w-4 text-center text-xs text-muted-foreground">·</span>
                  )}
                  <span className={!isLeaf ? "font-semibold" : ""}>{node.name}</span>
                </div>
              </TableCell>
              <TableCell className="whitespace-nowrap text-xs">
                {agg.inicio && agg.fim
                  ? `${format(parseISO(agg.inicio), "dd/MM/yy")} – ${format(parseISO(agg.fim), "dd/MM/yy")}`
                  : "—"}
              </TableCell>
              <TableCell className={`text-right ${!isLeaf ? "text-muted-foreground" : ""}`}>
                {pctExibir ? pctExibir.toFixed(2) + "%" : "—"}
              </TableCell>
              <TableCell className={`text-right whitespace-nowrap ${!isLeaf ? "text-muted-foreground italic" : ""}`}>
                {valor ? brl(valor) : "—"}
              </TableCell>
              <TableCell className={`text-right ${pctReal > 0 ? "text-green-600 dark:text-green-400 font-medium" : "text-muted-foreground"}`}>
                {pctReal > 0 ? pctReal.toFixed(2) + "%" : "—"}
              </TableCell>
              <TableCell className="text-right whitespace-nowrap">
                {agg.executado > 0 ? brl(agg.executado) : "—"}
              </TableCell>
              <TableCell className="text-right whitespace-nowrap text-muted-foreground">
                {valor > 0 ? brl(saldo) : "—"}
              </TableCell>
              <TableCell className="text-right">
                {isLeaf && node.item && (
                  <Button variant="ghost" size="sm" onClick={() => onRemove(node.item.id)}>Remover</Button>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

// ============== Medições por item ==============

type LeafRow = {
  item: any;
  pctAnterior: number;
  pctAtual: number;
  base: number;
};

function MedicoesTab({
  obra, crono, medicoes, itensMedicao, onChange,
}: {
  obra: any;
  crono: any[];
  medicoes: any[];
  itensMedicao: any[];
  onChange: () => void;
}) {
  const valorContrato = Number(obra.valor_contrato || 0);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ numero: string; data_inicio: string; data_corte: string; observacoes: string }>({
    numero: "", data_inicio: "", data_corte: "", observacoes: "",
  });

  // Folhas do cronograma (sem filhos)
  const leaves = useMemo(() => {
    const roots = buildTree(crono);
    const out: any[] = [];
    const walk = (n: CronoNode) => {
      if (n.children.length === 0 && n.item) out.push(n.item);
      else for (const c of n.children) walk(c);
    };
    roots.forEach(walk);
    return out.length > 0 ? out : crono.filter((c) => c); // fallback se não conseguir parsear
  }, [crono]);

  const [linhas, setLinhas] = useState<LeafRow[]>([]);

  function abrirNova() {
    const rows: LeafRow[] = leaves.map((item) => {
      const custo = Number(item.custo || 0);
      const base = custo > 0 ? custo : (Number(item.percentual_previsto || 0) / 100) * valorContrato;
      const pctAnterior = Number(item.percentual_realizado || 0);
      return { item, pctAnterior, pctAtual: pctAnterior, base };
    });
    setLinhas(rows);
    setForm({ numero: "", data_inicio: "", data_corte: "", observacoes: "" });
    setOpen(true);
  }

  function setPctAtual(idx: number, v: number) {
    setLinhas((ls) => ls.map((l, i) => i === idx ? { ...l, pctAtual: v } : l));
  }

  const totalPeriodo = linhas.reduce((acc, l) => acc + (l.base * (l.pctAtual - l.pctAnterior)) / 100, 0);
  const acumAnterior = linhas.reduce((acc, l) => acc + (l.base * l.pctAnterior) / 100, 0);
  const acumApos = linhas.reduce((acc, l) => acc + (l.base * l.pctAtual) / 100, 0);
  const temErro = linhas.some((l) => l.pctAtual < l.pctAnterior);

  async function salvar() {
    if (!form.numero) return toast.error("Informe o número da medição");
    if (!form.data_corte) return toast.error("Informe a data de corte");
    if (temErro) return toast.error("Há itens com % atual menor que % anterior");

    const valorTotal = totalPeriodo;

    // Onda 1.2: amarrar a medição à baseline vigente (maior versão da obra)
    const { data: blVigente } = await supabase
      .from("cronograma_baselines")
      .select("id, versao")
      .eq("obra_id", obra.id)
      .order("versao", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: med, error: medErr } = await supabase
      .from("medicoes")
      .insert({
        obra_id: obra.id,
        numero: form.numero,
        data_inicio: form.data_inicio || null,
        data_corte: form.data_corte,
        valor: valorTotal,
        status: "rascunho",
        observacoes: form.observacoes || null,
        baseline_id: blVigente?.id ?? null,
      })
      .select()
      .single();

    if (medErr || !med) return toast.error(medErr?.message ?? "Erro ao criar medição");

    const comExecucao = linhas.filter((l) => l.pctAtual > l.pctAnterior);

    if (comExecucao.length > 0) {
      const itensMed = comExecucao.map((l) => ({
        medicao_id: med.id,
        cronograma_item_id: l.item.id,
        percentual_anterior: l.pctAnterior,
        percentual_atual: l.pctAtual,
        valor_anterior: (l.base * l.pctAnterior) / 100,
        valor_atual: (l.base * l.pctAtual) / 100,
      }));

      const { error: itmErr } = await supabase.from("itens_medicao").insert(itensMed);
      if (itmErr) {
        await supabase.from("medicoes").delete().eq("id", med.id);
        return toast.error(`Erro ao salvar itens: ${itmErr.message}`);
      }

      await Promise.all(
        comExecucao.map((l) =>
          supabase
            .from("cronograma_itens")
            .update({ percentual_realizado: l.pctAtual })
            .eq("id", l.item.id),
        ),
      );
    }

    toast.success(`Medição ${form.numero} criada · ${brl(valorTotal)}`);
    setOpen(false);
    onChange();
  }

  async function aprovar(m: any) {
    const dataAprov = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from("medicoes").update({ status: "aprovada", data_aprovacao: dataAprov }).eq("id", m.id);
    if (error) return toast.error(error.message);
    toast.success("Medição aprovada");
    onChange();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Medições</CardTitle>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button size="sm" onClick={abrirNova}><Plus className="h-4 w-4 mr-2" />Medição</Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Nova medição</SheetTitle>
            </SheetHeader>

            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Número *</Label>
                  <Input value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} placeholder="BMS 11" />
                </div>
                <div className="space-y-1.5">
                  <Label>Data início *</Label>
                  <Input type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label>Data corte/fim *</Label>
                  <Input type="date" value={form.data_corte} onChange={(e) => setForm({ ...form, data_corte: e.target.value })} />
                </div>
                <div className="space-y-1.5 col-span-3">
                  <Label>Observações</Label>
                  <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={2} />
                </div>
              </div>

              {linhas.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Importe um cronograma para a obra antes de medir.
                </p>
              ) : (
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-20">EDT</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead className="text-right">Base (R$)</TableHead>
                        <TableHead className="text-right">% Anterior</TableHead>
                        <TableHead className="text-right w-32">% Atual</TableHead>
                        <TableHead className="text-right">% Período</TableHead>
                        <TableHead className="text-right">Valor Período</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {linhas.map((l, idx) => {
                        const pctPeriodo = l.pctAtual - l.pctAnterior;
                        const valorPeriodo = (l.base * pctPeriodo) / 100;
                        const erro = l.pctAtual < l.pctAnterior;
                        const exec = l.pctAtual > l.pctAnterior;
                        const parsed = parseDescricao(String(l.item.descricao ?? ""));
                        return (
                          <TableRow key={l.item.id}>
                            <TableCell className="font-mono text-xs text-muted-foreground">{parsed.wbs || "—"}</TableCell>
                            <TableCell className="text-sm">{parsed.name || l.item.descricao}</TableCell>
                            <TableCell className="text-right whitespace-nowrap text-xs">{brl(l.base)}</TableCell>
                            <TableCell className="text-right text-xs text-muted-foreground">{l.pctAnterior.toFixed(2)}%</TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center gap-1 justify-end">
                                <Input
                                  type="number"
                                  step="0.001"
                                  min={l.pctAnterior}
                                  max={100}
                                  value={l.pctAtual}
                                  onChange={(e) => setPctAtual(idx, Number(e.target.value))}
                                  className={`h-8 w-24 text-right ${exec ? "border-green-500 bg-green-50 dark:bg-green-950/20" : ""} ${erro ? "border-destructive" : ""}`}
                                />
                                {erro && <AlertCircle className="h-3 w-3 text-destructive" />}
                              </div>
                            </TableCell>
                            <TableCell className={`text-right text-xs ${exec ? "text-green-600 dark:text-green-400 font-medium" : "text-muted-foreground"}`}>
                              {pctPeriodo > 0 ? `+${pctPeriodo.toFixed(2)}%` : pctPeriodo === 0 ? "—" : `${pctPeriodo.toFixed(2)}%`}
                            </TableCell>
                            <TableCell className={`text-right whitespace-nowrap text-xs ${exec ? "text-green-600 dark:text-green-400 font-medium" : "text-muted-foreground"}`}>
                              {valorPeriodo !== 0 ? brl(valorPeriodo) : "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  <div className="border-t bg-muted/30 px-4 py-3 space-y-1 sticky bottom-0">
                    <div className="flex justify-between items-center font-semibold">
                      <span>Total desta medição:</span>
                      <span className={totalPeriodo > 0 ? "text-green-600 dark:text-green-400" : ""}>{brl(totalPeriodo)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Acumulado anterior:</span>
                      <span>{brl(acumAnterior)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Acumulado após:</span>
                      <span>{brl(acumApos)}</span>
                    </div>
                  </div>
                </div>
              )}

              {totalPeriodo === 0 && linhas.length > 0 && (
                <p className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Nenhum serviço foi executado neste período.
                </p>
              )}
              {temErro && (
                <p className="text-sm text-destructive flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Há itens com % atual menor que % anterior — corrija antes de salvar.
                </p>
              )}
            </div>

            <SheetFooter className="mt-6">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={salvar} disabled={temErro || !form.numero || !form.data_corte}>Salvar medição</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nº</TableHead>
              <TableHead>Período</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {medicoes.map((m) => (
              <MedicaoRow
                key={m.id}
                m={m}
                itens={itensMedicao.filter((im) => im.medicao_id === m.id)}
                valorContrato={valorContrato}
                onAprovar={() => aprovar(m)}
              />
            ))}
            {medicoes.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sem medições</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function MedicaoRow({ m, itens, valorContrato, onAprovar }: { m: any; itens: any[]; valorContrato: number; onAprovar: () => void }) {
  const [open, setOpen] = useState(false);
  const periodo = m.data_inicio
    ? `${format(parseISO(m.data_inicio), "dd/MM/yy")} – ${format(parseISO(m.data_corte), "dd/MM/yy")}`
    : format(parseISO(m.data_corte), "dd/MM/yy");

  return (
    <>
      <TableRow>
        <TableCell className="font-medium">{m.numero}</TableCell>
        <TableCell className="text-xs">{periodo}</TableCell>
        <TableCell className="text-right whitespace-nowrap">{brl(m.valor)}</TableCell>
        <TableCell><StatusBadge status={m.status} /></TableCell>
        <TableCell className="text-right whitespace-nowrap">
          <Collapsible open={open} onOpenChange={setOpen}>
            <CollapsibleTrigger asChild>
              <Button size="sm" variant="ghost">
                {open ? <ChevronDown className="h-3 w-3 mr-1" /> : <ChevronRight className="h-3 w-3 mr-1" />}
                Ver itens ({itens.length})
              </Button>
            </CollapsibleTrigger>
          </Collapsible>
          {m.status !== "aprovada" && <Button size="sm" variant="outline" onClick={onAprovar}><CheckCircle2 className="h-3 w-3 mr-1" />Aprovar</Button>}
        </TableCell>
      </TableRow>
      {open && (
        <TableRow>
          <TableCell colSpan={5} className="bg-muted/30 p-0">
            <div className="px-4 py-3">
              {itens.length === 0 ? (
                <p className="text-xs text-muted-foreground">Esta medição não possui itens detalhados.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-20">EDT</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">% Anterior</TableHead>
                      <TableHead className="text-right">% Atual</TableHead>
                      <TableHead className="text-right">% Período</TableHead>
                      <TableHead className="text-right">Valor Período</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {itens.map((im) => {
                      const ci = im.cronograma_itens;
                      const custo = Number(ci?.custo || 0);
                      const base = custo > 0 ? custo : (Number(ci?.percentual_previsto || 0) / 100) * valorContrato;
                      const pctPer = Number(im.percentual_atual) - Number(im.percentual_anterior);
                      const valorPeriodo = (base * pctPer) / 100;
                      const parsed = ci ? parseDescricao(String(ci.descricao ?? "")) : { wbs: "", name: "—" };
                      return (
                        <TableRow key={im.id}>
                          <TableCell className="font-mono text-xs text-muted-foreground">{parsed.wbs || "—"}</TableCell>
                          <TableCell className="text-sm">{parsed.name}</TableCell>
                          <TableCell className="text-right text-xs">{Number(im.percentual_anterior).toFixed(2)}%</TableCell>
                          <TableCell className="text-right text-xs">{Number(im.percentual_atual).toFixed(2)}%</TableCell>
                          <TableCell className="text-right text-xs text-green-600 dark:text-green-400">+{pctPer.toFixed(2)}%</TableCell>
                          <TableCell className="text-right text-xs whitespace-nowrap">{brl(valorPeriodo)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function NfsTab({ obra, nfs, medicoes, onChange }: { obra: any; nfs: any[]; medicoes: any[]; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<any>({});

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const dataEmissao = f.data_emissao ? parseISO(f.data_emissao) : new Date();
    const venc = calcularVencimento(dataEmissao, Number(obra.prazo_pagamento_dias || 0), obra.dia_fixo_pagamento);
    const valor = Number(f.valor || 0);

    let pdf_url: string | null = null;
    if (f.pdf instanceof File) {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (uid) {
        const path = `${uid}/${obra.id}/${Date.now()}-${f.pdf.name}`;
        const { error: upErr } = await supabase.storage.from("nfs").upload(path, f.pdf, { upsert: false });
        if (upErr) return toast.error(`Upload PDF: ${upErr.message}`);
        pdf_url = path;
      }
    }

    const { data: nf, error } = await supabase.from("notas_fiscais").insert({
      obra_id: obra.id,
      medicao_id: f.medicao_id || null,
      numero: f.numero || null,
      data_emissao: f.data_emissao || null,
      valor,
      data_vencimento: venc.toISOString().slice(0, 10),
      pdf_url,
    }).select().single();
    if (error || !nf) return toast.error(error?.message ?? "Erro");
    await supabase.from("recebimentos").insert({
      obra_id: obra.id,
      nota_fiscal_id: nf.id,
      data_prevista: venc.toISOString().slice(0, 10),
      valor_previsto: valor,
      valor_previsto_inicial: valor,
      status: "a_receber",
      origem: "nf",
      congelado: true,
    });

    await recalcularPrevisaoNF(obra.id, Number(obra.valor_contrato));
    toast.success(`NF salva · vencimento ${format(venc, "dd/MM/yyyy")} · previsão recalculada`);
    setOpen(false); setF({});
    onChange();
  }

  async function abrirPdf(path: string) {
    const { data, error } = await supabase.storage.from("nfs").createSignedUrl(path, 60);
    if (error || !data) return toast.error("Erro ao gerar link");
    window.open(data.signedUrl, "_blank");
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Notas Fiscais</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-2" />NF</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova NF</DialogTitle></DialogHeader>
            <form onSubmit={save} className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Número</Label><Input value={f.numero ?? ""} onChange={(e) => setF({ ...f, numero: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Data emissão *</Label><Input type="date" required value={f.data_emissao ?? ""} onChange={(e) => setF({ ...f, data_emissao: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Valor (R$) *</Label><Input type="number" step="0.01" required value={f.valor ?? ""} onChange={(e) => setF({ ...f, valor: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Medição</Label>
                <Select value={f.medicao_id ?? ""} onValueChange={(v) => setF({ ...f, medicao_id: v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    {medicoes.filter((m) => m.status === "aprovada").map((m) => <SelectItem key={m.id} value={m.id}>{m.numero} · {brl(m.valor)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 col-span-2"><Label>PDF da NF</Label><Input type="file" accept="application/pdf" onChange={(e) => setF({ ...f, pdf: e.target.files?.[0] ?? null })} /></div>
              <DialogFooter className="col-span-2"><Button type="submit">Salvar</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nº</TableHead>
              <TableHead>Emissão</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="text-right">Líquido</TableHead>
              <TableHead>Vencimento</TableHead>
              <TableHead>PDF</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {nfs.map((n) => (
              <TableRow key={n.id}>
                <TableCell>{n.numero ?? "—"}</TableCell>
                <TableCell>{n.data_emissao ? format(parseISO(n.data_emissao), "dd/MM/yy") : "—"}</TableCell>
                <TableCell className="text-right whitespace-nowrap">{brl(n.valor)}</TableCell>
                <TableCell className="text-right whitespace-nowrap">{brl(n.valor_liquido ?? n.valor)}</TableCell>
                <TableCell>{n.data_vencimento ? format(parseISO(n.data_vencimento), "dd/MM/yy") : "—"}</TableCell>
                <TableCell>{n.pdf_url ? <Button size="sm" variant="ghost" onClick={() => abrirPdf(n.pdf_url!)}>Ver</Button> : "—"}</TableCell>
              </TableRow>
            ))}
            {nfs.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sem NFs</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function RecebTab({ receb, onChange }: { receb: any[]; onChange: () => void }) {
  async function marcarPago(r: any) {
    const hoje = new Date().toISOString().slice(0, 10);
    const { error } = await supabase.from("recebimentos").update({
      data_recebimento: hoje,
      valor_recebido: r.valor_previsto,
      status: "pago",
    }).eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Recebimento confirmado");
    onChange();
  }

  return (
    <Card>
      <CardHeader><CardTitle>Recebimentos</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Previsto</TableHead><TableHead>Valor previsto</TableHead><TableHead>Recebido</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {receb.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{format(parseISO(r.data_prevista), "dd/MM/yy")}</TableCell>
                <TableCell>{brl(r.valor_previsto)}</TableCell>
                <TableCell>{r.data_recebimento ? `${format(parseISO(r.data_recebimento), "dd/MM/yy")} · ${brl(r.valor_recebido)}` : "—"}</TableCell>
                <TableCell><StatusBadge status={r.status} /></TableCell>
                <TableCell className="text-right">
                  {!r.data_recebimento && <Button size="sm" variant="outline" onClick={() => marcarPago(r)}><Banknote className="h-3 w-3 mr-1" />Pago</Button>}
                </TableCell>
              </TableRow>
            ))}
            {receb.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Sem recebimentos</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const m: Record<string, string> = {
    rascunho: "bg-muted text-muted-foreground",
    enviada: "bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-200",
    aprovada: "bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-200",
    rejeitada: "bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-200",
    previsto: "bg-muted text-muted-foreground",
    a_receber: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
    pago: "bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-200",
    atrasado: "bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-200",
    antecipado: "bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-200",
  };
  return <Badge variant="secondary" className={m[status] ?? ""}>{status}</Badge>;
}

export async function recalcularPrevisaoNF(obraId: string, valorContrato: number) {
  const [{ data: nfs }, { data: receb }] = await Promise.all([
    supabase.from("notas_fiscais").select("valor").eq("obra_id", obraId),
    supabase.from("recebimentos").select("*").eq("obra_id", obraId),
  ]);
  const faturado = (nfs ?? []).reduce((a, n) => a + Number(n.valor || 0), 0);
  const futuras = (receb ?? []).filter((r: any) => !r.data_recebimento && !r.nota_fiscal_id && !r.congelado);
  const totalFuturo = futuras.reduce((a: number, r: any) => a + Number(r.valor_previsto), 0);
  const saldo = Math.max(0, valorContrato - faturado);
  if (futuras.length === 0) return;
  if (totalFuturo === 0) {
    const v = saldo / futuras.length;
    await Promise.all(futuras.map((r: any) => supabase.from("recebimentos").update({ valor_previsto: v }).eq("id", r.id)));
    return;
  }
  await Promise.all(futuras.map((r: any) => {
    const prop = Number(r.valor_previsto) / totalFuturo;
    return supabase.from("recebimentos").update({ valor_previsto: saldo * prop }).eq("id", r.id);
  }));
}

function PrevisaoTab({ obra, crono, receb, nfs, onChange }: { obra: any; crono: any[]; receb: any[]; nfs: any[]; onChange: () => void }) {
  const valorContrato = Number(obra.valor_contrato);
  const faturado = nfs.reduce((a, n) => a + Number(n.valor || 0), 0);
  const recebido = receb.filter((r) => r.data_recebimento).reduce((a, r) => a + Number(r.valor_recebido || 0), 0);
  const previstoTotal = receb.reduce((a, r) => a + Number(r.valor_previsto || 0), 0);
  const previstoInicialTotal = receb.reduce((a, r) => a + Number(r.valor_previsto_inicial ?? r.valor_previsto ?? 0), 0);
  const saldo = valorContrato - faturado;

  async function recalcular() {
    await recalcularPrevisaoNF(obra.id, valorContrato);
    toast.success("Previsão recalculada");
    onChange();
  }
  async function toggleCongelar(r: any) {
    await supabase.from("recebimentos").update({ congelado: !r.congelado }).eq("id", r.id);
    onChange();
  }
  async function remover(r: any) {
    if (r.nota_fiscal_id) return toast.error("Parcela vinculada a NF — apague a NF primeiro");
    await supabase.from("recebimentos").delete().eq("id", r.id);
    onChange();
  }

  const ordenado = [...receb].sort((a, b) => a.data_prevista.localeCompare(b.data_prevista));
  const diff = valorContrato - previstoTotal - recebido;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-4">
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Contrato</div><div className="text-lg font-semibold">{brl(valorContrato)}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Faturado (NFs)</div><div className="text-lg font-semibold">{brl(faturado)}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Recebido</div><div className="text-lg font-semibold">{brl(recebido)}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Saldo a faturar</div><div className="text-lg font-semibold">{brl(saldo)}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <div>
            <CardTitle>Previsão de recebimento</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Inicial: {brl(previstoInicialTotal)} · Atual: {brl(previstoTotal)} · {Math.abs(diff) < 1 ? "✓ bate com contrato" : `diferença ${brl(diff)}`}
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={recalcular}>Recalcular saldo</Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Data prevista</TableHead>
              <TableHead>Origem</TableHead>
              <TableHead className="text-right">Previsto inicial</TableHead>
              <TableHead className="text-right">Previsto atual</TableHead>
              <TableHead className="text-right">Realizado</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {ordenado.map((r) => (
                <TableRow key={r.id} className={r.congelado ? "bg-muted/40" : undefined}>
                  <TableCell>{format(parseISO(r.data_prevista), "dd/MM/yy")}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.origem ?? "manual"}{r.observacoes ? ` · ${r.observacoes}` : ""}</TableCell>
                  <TableCell className="text-right">{brl(r.valor_previsto_inicial ?? r.valor_previsto)}</TableCell>
                  <TableCell className="text-right font-medium">{brl(r.valor_previsto)}</TableCell>
                  <TableCell className="text-right">{r.valor_recebido ? brl(r.valor_recebido) : "—"}</TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => toggleCongelar(r)}>{r.congelado ? "Descongelar" : "Congelar"}</Button>
                    <Button size="sm" variant="ghost" onClick={() => remover(r)}>Remover</Button>
                  </TableCell>
                </TableRow>
              ))}
              {ordenado.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Gere a previsão na aba Cronograma</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {crono.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Aderência por janela do cronograma</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow>
                <TableHead>Período</TableHead>
                <TableHead className="text-right">Previsto</TableHead>
                <TableHead className="text-right">Faturado (NFs)</TableHead>
                <TableHead className="text-right">Aderência</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {crono.map((c) => {
                  const custoItem = Number(c.custo || 0);
                  const previsto = custoItem > 0 ? custoItem : (Number(c.percentual_previsto) / 100) * valorContrato;
                  const fatNoPer = nfs.filter((n) => n.data_emissao && n.data_emissao >= c.data_inicio && n.data_emissao <= c.data_fim)
                    .reduce((a, n) => a + Number(n.valor || 0), 0);
                  const ader = previsto > 0 ? (fatNoPer / previsto) * 100 : 0;
                  return (
                    <TableRow key={c.id}>
                      <TableCell>{format(parseISO(c.data_inicio), "dd/MM/yy")} – {format(parseISO(c.data_fim), "dd/MM/yy")}</TableCell>
                      <TableCell className="text-right">{brl(previsto)}</TableCell>
                      <TableCell className="text-right">{brl(fatNoPer)}</TableCell>
                      <TableCell className="text-right">{ader.toFixed(1)}%</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// =================== Revisões semanais do cronograma (MS Project XML) ===================

type DiffRow = {
  tipo: "novo" | "data" | "pct" | "custo" | "removido" | "restaurado";
  itemId?: string;
  uid: string;
  descricao: string;
  inicio_antes?: string | null;
  inicio_novo?: string | null;
  fim_antes?: string | null;
  fim_novo?: string | null;
  pct_antes?: number | null;
  pct_novo?: number | null;
  custo_antes?: number | null;
  custo_novo?: number | null;
  task?: MppTask;
  apply: boolean;
};

type Lote = {
  id: string;
  arquivoNome: string;
  tasksXml: MppTask[];
  diffs: DiffRow[];
  dataCorte: string;
};



function RevisoesTab({ obra, crono, revisoes, onChange }: { obra: any; crono: any[]; revisoes: any[]; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [loteAtivoId, setLoteAtivoId] = useState<string | null>(null);
  const [obs, setObs] = useState<string>("");
  const [atualizarPct, setAtualizarPct] = useState<boolean>(true);
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ atual: number; total: number; nome: string } | null>(null);
  const [mppDialogOpen, setMppDialogOpen] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [filtroDiff, setFiltroDiff] = useState("");
  const [tiposVisiveis, setTiposVisiveis] = useState<Set<DiffRow["tipo"]> | null>(null);
  const [verTodasRev, setVerTodasRev] = useState(false);
  const [revExpandida, setRevExpandida] = useState<string | null>(null);
  const [atrasosAbertos, setAtrasosAbertos] = useState(false);
  const [atrasosLimite, setAtrasosLimite] = useState(50);
  const [atrasosFiltro, setAtrasosFiltro] = useState("");
  const [revertendoId, setRevertendoId] = useState<string | null>(null);
  const [confirmReverter, setConfirmReverter] = useState<any | null>(null);


  function resetSheet() {
    setStep(1);
    setLotes([]);
    setLoteAtivoId(null);
    setObs("");
    setFiltroDiff("");
    setTiposVisiveis(null);
    setImportProgress(null);
  }

  const obraId = obra.id;
  const valorContrato = Number(obra.valor_contrato || 0);

  // Atraso por item: data_fim atual - data_fim_baseline
  const atrasos = (crono ?? [])
    .filter((c) => c.ativo !== false && c.data_fim_baseline && c.data_fim)
    .map((c) => ({
      id: c.id,
      descricao: c.descricao,
      baseline: c.data_fim_baseline as string,
      atual: c.data_fim as string,
      delta: differenceInCalendarDays(parseISO(c.data_fim), parseISO(c.data_fim_baseline)),
    }))
    .filter((a) => a.delta !== 0);
  const atrasados = atrasos.filter((a) => a.delta > 0);
  const atrasoMax = atrasos.reduce((m, a) => Math.max(m, a.delta), 0);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    e.target.value = "";

    const novosLotes: Lote[] = [];
    let primeiroBinario = false;
    for (const file of files) {
      const isBin = await isMppBinary(file);
      if (isBin) {
        console.info("mpp_upload_attempt");
        primeiroBinario = true;
        continue;
      }
      try {
        const text = await file.text();
        const { tasks } = parseMppXml(text);
        const leaves = tasks.filter((t) => !t.hasChildren && t.start && t.finish);
        const d = computeDiff(leaves, tasks, crono ?? []);
        novosLotes.push({
          id: (typeof crypto !== "undefined" && (crypto as any).randomUUID) ? (crypto as any).randomUUID() : Math.random().toString(36).slice(2),
          arquivoNome: file.name,
          tasksXml: tasks,
          diffs: d,
          dataCorte: format(new Date(), "yyyy-MM-dd"),
        });
      } catch (err: any) {
        toast.error(`Erro ao ler ${file.name}: ${err.message}`);
      }
    }
    if (primeiroBinario) setMppDialogOpen(true);
    if (novosLotes.length) {
      setLotes((prev) => {
        const combined = [...prev, ...novosLotes];
        if (!loteAtivoId) setLoteAtivoId(combined[0].id);
        return combined;
      });
      const totalMud = novosLotes.reduce((a, l) => a + l.diffs.length, 0);
      toast.success(`${novosLotes.length} arquivo(s) preparado(s) · ${totalMud} mudanças detectadas`);
      setStep(2);
    }
  }

  function removerLote(id: string) {
    setLotes((prev) => {
      const novo = prev.filter((l) => l.id !== id);
      if (loteAtivoId === id) setLoteAtivoId(novo[0]?.id ?? null);
      return novo;
    });
  }

  function atualizarDataLote(id: string, dataCorte: string) {
    setLotes((prev) => prev.map((l) => (l.id === id ? { ...l, dataCorte } : l)));
  }


  // Diff: casa por uid_mpp, com fallback (wbs+nome) — usado para itens importados antes desta feature.
  function computeDiff(leaves: MppTask[], allTasks: MppTask[], itens: any[]): DiffRow[] {
    const byUid = new Map(allTasks.map((t) => [t.uid, t]));
    const itensAtivos = itens.filter((i) => i.ativo !== false);
    const itensInativos = itens.filter((i) => i.ativo === false);

    const byItemUid = new Map<string, any>();
    for (const i of itensAtivos) if (i.uid_mpp) byItemUid.set(String(i.uid_mpp), i);

    // fallback por wbs+nome (one-shot backfill)
    function findFallback(t: MppTask) {
      const chain = mppParentChain(t, byUid)
        .map((p) => (p.wbs ? `${p.wbs} ${p.name}` : p.name))
        .join(" › ");
      const wbsPrefix = t.wbs ? `${t.wbs} ` : "";
      const target = (wbsPrefix + t.name + (chain ? `  ·  [${chain}]` : "")).trim();
      return itensAtivos.find((i) => !i.uid_mpp && String(i.descricao ?? "").trim() === target);
    }

    const result: DiffRow[] = [];
    const matched = new Set<string>();

    for (const t of leaves) {
      let item = byItemUid.get(t.uid);
      if (!item) item = findFallback(t);
      if (!item) {
        // verifica se é uma tarefa que estava inativa
        const restaurado = itensInativos.find((i) => i.uid_mpp === t.uid);
        if (restaurado) {
          result.push({
            tipo: "restaurado",
            itemId: restaurado.id,
            uid: t.uid,
            descricao: descricaoTarefa(t, byUid),
            task: t,
            apply: true,
          });
          matched.add(restaurado.id);
          continue;
        }
        result.push({
          tipo: "novo",
          uid: t.uid,
          descricao: descricaoTarefa(t, byUid),
          inicio_novo: t.start,
          fim_novo: t.finish,
          pct_novo: t.percentComplete,
          custo_novo: t.custo,
          task: t,
          apply: true,
        });
        continue;
      }
      matched.add(item.id);

      const inicioMudou = String(item.data_inicio) !== String(t.start);
      const fimMudou = String(item.data_fim) !== String(t.finish);
      const pctMudou = Math.abs(Number(item.percentual_realizado || 0) - t.percentComplete) > 0.01;
      // Onda 1.3: XML nunca altera custo de itens existentes (custo é congelado pela baseline).

      if (inicioMudou || fimMudou) {
        result.push({
          tipo: "data",
          itemId: item.id,
          uid: t.uid,
          descricao: item.descricao,
          inicio_antes: item.data_inicio,
          inicio_novo: t.start,
          fim_antes: item.data_fim,
          fim_novo: t.finish,
          task: t,
          apply: true,
        });
      }
      if (pctMudou) {
        result.push({
          tipo: "pct",
          itemId: item.id,
          uid: t.uid,
          descricao: item.descricao,
          pct_antes: Number(item.percentual_realizado || 0),
          pct_novo: t.percentComplete,
          task: t,
          apply: true,
        });
      }
      // Bloco de detecção de mudança de custo removido (Onda 1.3).

    }

    // Removidos: itens ativos que não bateram com nenhuma tarefa
    for (const i of itensAtivos) {
      if (matched.has(i.id)) continue;
      result.push({
        tipo: "removido",
        itemId: i.id,
        uid: i.uid_mpp ?? "",
        descricao: i.descricao,
        apply: true,
      });
    }

    return result;
  }

  function descricaoTarefa(t: MppTask, byUid: Map<string, MppTask>): string {
    const chain = mppParentChain(t, byUid)
      .map((p) => (p.wbs ? `${p.wbs} ${p.name}` : p.name))
      .join(" › ");
    const wbsPrefix = t.wbs ? `${t.wbs} ` : "";
    return wbsPrefix + t.name + (chain ? `  ·  [${chain}]` : "");
  }

  function toggleRow(loteId: string, idx: number, value: boolean) {
    setLotes((prev) => prev.map((l) => l.id === loteId
      ? { ...l, diffs: l.diffs.map((r, i) => (i === idx ? { ...r, apply: value } : r)) }
      : l));
  }
  function toggleAll(loteId: string, tipo: DiffRow["tipo"], value: boolean) {
    setLotes((prev) => prev.map((l) => l.id === loteId
      ? { ...l, diffs: l.diffs.map((r) => (r.tipo === tipo ? { ...r, apply: value } : r)) }
      : l));
  }

  // Aplica um lote. cronoAtual reflete o estado do banco antes deste lote
  // (refetched a cada iteração para encadear corretamente). Retorna o novo número.
  async function aplicarLote(lote: Lote, ultimoNumero: number, cronoAtual: any[]): Promise<number> {
    const aplicar = lote.diffs.filter((d) => d.apply);
    const itensRevisao: any[] = [];
    const itensAtivos = cronoAtual.filter((i) => i.ativo !== false);
    const ordemBase = itensAtivos.length;
    let ordemNext = ordemBase;

    // 1) Novos itens — pula duplicatas por uid_mpp se já existem (cascata entre lotes)
    const uidsExistentes = new Set(cronoAtual.map((i) => i.uid_mpp).filter(Boolean).map(String));
    const novos = aplicar.filter((d) => d.tipo === "novo" && !(d.uid && uidsExistentes.has(d.uid)));
    if (novos.length) {
      const rows = novos.map((d) => ({
        obra_id: obraId,
        descricao: d.descricao,
        data_inicio: d.inicio_novo!,
        data_fim: d.fim_novo!,
        ordem: ordemNext++,
        custo: Number((d.custo_novo || 0).toFixed(2)),
        custo_baseline: Number((d.custo_novo || 0).toFixed(2)),
        percentual_previsto: 0,
        percentual_realizado: atualizarPct ? Number((d.pct_novo || 0).toFixed(4)) : 0,
        uid_mpp: d.uid || null,
        data_inicio_baseline: d.inicio_novo!,
        data_fim_baseline: d.fim_novo!,
        ativo: true,
      }));
      const { data: ins, error } = await supabase
        .from("cronograma_itens")
        .insert(rows)
        .select("id, descricao, data_inicio, data_fim, custo, percentual_realizado");
      if (error) throw error;
      ins?.forEach((row: any) => {
        itensRevisao.push({
          cronograma_item_id: row.id,
          descricao_item: row.descricao,
          tipo_mudanca: "novo",
          data_inicio_anterior: null, data_inicio_novo: row.data_inicio,
          data_fim_anterior: null, data_fim_novo: row.data_fim,
          custo_anterior: null, custo_novo: row.custo,
          percentual_realizado_anterior: null,
          percentual_realizado_novo: row.percentual_realizado,
        });
      });
    }

    // G4.1: persistir dependências (predecessors) dos novos itens
    if (novos.length) {
      const { data: novosSalvos } = await supabase
        .from("cronograma_itens")
        .select("id, uid_mpp")
        .eq("obra_id", obraId)
        .in("uid_mpp", novos.map((d) => d.uid).filter(Boolean));
      const byUid = new Map((novosSalvos ?? []).filter((i: any) => i.uid_mpp).map((i: any) => [String(i.uid_mpp), i.id]));
      const deps: any[] = [];
      for (const d of novos) {
        const itemId = byUid.get(String(d.uid));
        if (!itemId || !d.task) continue;
        for (const p of d.task.predecessors ?? []) {
          deps.push({
            obra_id: obraId,
            item_id: itemId,
            predecessor_uid_mpp: p.predecessorUid,
            tipo: p.tipo,
            lag_dias: p.lagDias,
          });
        }
      }
      if (deps.length) await supabase.from("cronograma_dependencias").insert(deps);
    }

    // 2) Updates por item existente
    for (const d of aplicar) {
      if (!d.itemId) continue;
      if (d.tipo === "novo") continue;

      const item = cronoAtual.find((i) => i.id === d.itemId);
      if (!item) continue;
      const update: any = {};
      const log: any = {
        cronograma_item_id: d.itemId,
        descricao_item: item?.descricao ?? d.descricao,
        tipo_mudanca: d.tipo,
      };

      if (d.tipo === "data") {
        update.data_inicio = d.inicio_novo;
        update.data_fim = d.fim_novo;
        log.data_inicio_anterior = d.inicio_antes;
        log.data_inicio_novo = d.inicio_novo;
        log.data_fim_anterior = d.fim_antes;
        log.data_fim_novo = d.fim_novo;
        if (item && !item.data_inicio_baseline) update.data_inicio_baseline = d.inicio_antes;
        if (item && !item.data_fim_baseline) update.data_fim_baseline = d.fim_antes;
      } else if (d.tipo === "pct") {
        if (atualizarPct) {
          const novo = Number(d.pct_novo || 0);
          const atual = Number(d.pct_antes || 0);
          if (novo >= atual) update.percentual_realizado = novo;
        }
        log.percentual_realizado_anterior = d.pct_antes;
        log.percentual_realizado_novo = d.pct_novo;
      } else if (d.tipo === "custo") {
        // Onda 1.3: XML não altera custo de itens existentes.
      } else if (d.tipo === "removido") {
        update.ativo = false;
      } else if (d.tipo === "restaurado") {
        update.ativo = true;
        if (d.task) {
          update.data_inicio = d.task.start;
          update.data_fim = d.task.finish;
        }
      }

      if (Object.keys(update).length) {
        const { error } = await supabase.from("cronograma_itens").update(update).eq("id", d.itemId);
        if (error) throw error;
      }
      itensRevisao.push(log);
    }

    // 3) Recalcular percentual_previsto proporcional ao custo_baseline
    const { data: vivos } = await supabase
      .from("cronograma_itens")
      .select("id, custo, custo_baseline, percentual_previsto")
      .eq("obra_id", obraId)
      .eq("ativo", true);
    const baseRef = (i: any) => Number(i.custo_baseline ?? i.custo ?? 0);
    const totalCusto = (vivos ?? []).reduce((a, i) => a + baseRef(i), 0);
    if (totalCusto > 0) {
      await Promise.all(
        (vivos ?? []).map((i) =>
          supabase
            .from("cronograma_itens")
            .update({ percentual_previsto: Number(((baseRef(i) / totalCusto) * 100).toFixed(6)) })
            .eq("id", i.id),
        ),
      );
    }

    // 4) Cabeçalho da revisão
    const numero = ultimoNumero + 1;
    const totais = {
      itens_total: lote.tasksXml.filter((t) => !t.hasChildren).length,
      novos: novos.length,
      alterados_data: aplicar.filter((d) => d.tipo === "data").length,
      alterados_pct: aplicar.filter((d) => d.tipo === "pct").length,
      alterados_custo: aplicar.filter((d) => d.tipo === "custo").length,
      removidos: aplicar.filter((d) => d.tipo === "removido").length,
      restaurados: aplicar.filter((d) => d.tipo === "restaurado").length,
      custo_total: lote.tasksXml.filter((t) => !t.hasChildren).reduce((a, t) => a + (t.custo || 0), 0),
    };
    const { data: rev, error: revErr } = await supabase
      .from("cronograma_revisoes")
      .insert({
        obra_id: obraId,
        numero,
        data_corte: lote.dataCorte,
        arquivo_nome: lote.arquivoNome || null,
        observacoes: obs || null,
        totais,
      })
      .select("id")
      .single();
    if (revErr) throw revErr;

    // 5) Snapshots
    if (itensRevisao.length) {
      const rows = itensRevisao.map((r) => ({ ...r, revisao_id: rev!.id }));
      const { error } = await supabase.from("cronograma_item_revisoes").insert(rows);
      if (error) throw error;
    }

    return numero;
  }

  async function confirmar() {
    if (!lotes.length) {
      toast.error("Nenhum arquivo carregado");
      return;
    }
    const totalDiffs = lotes.reduce((a, l) => a + l.diffs.filter((d) => d.apply).length, 0);
    if (totalDiffs === 0) {
      toast.error("Nenhuma mudança marcada para aplicar");
      return;
    }
    setImporting(true);
    let totalNovos = 0;
    try {
      let ultimoNumero = revisoes.reduce((m, r) => Math.max(m, Number(r.numero || 0)), 0);
      let cronoAtual: any[] = crono ?? [];
      for (let idx = 0; idx < lotes.length; idx++) {
        const lote = lotes[idx];
        setImportProgress({ atual: idx + 1, total: lotes.length, nome: lote.arquivoNome });
        ultimoNumero = await aplicarLote(lote, ultimoNumero, cronoAtual);
        totalNovos += lote.diffs.filter((d) => d.apply && d.tipo === "novo").length;
        // refetch crono para o próximo lote
        if (idx < lotes.length - 1) {
          const { data: fresh } = await supabase
            .from("cronograma_itens")
            .select("*")
            .eq("obra_id", obraId);
          cronoAtual = fresh ?? [];
        }
      }

      toast.success(`${lotes.length} revisão(ões) registrada(s)`);
      if (totalNovos > 0) {
        toast.warning(
          `${totalNovos} item(ns) novo(s) adicionado(s) à baseline. Mudanças contratuais devem ser registradas como aditivo (aba Aditivos). Alteração registrada no histórico.`,
          { duration: 8000 },
        );
      }
      setOpen(false);
      resetSheet();
      onChange();
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao aplicar revisão");
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  }


  const maxNumero = revisoes.reduce((m, r) => Math.max(m, Number(r.numero || 0)), 0);

  async function reverterRevisao(rev: any) {
    if (Number(rev.numero) !== maxNumero) {
      toast.error("Reverta primeiro a revisão mais recente.");
      return;
    }
    setRevertendoId(rev.id);
    try {
      const { data: snaps, error: snapErr } = await supabase
        .from("cronograma_item_revisoes")
        .select("id, cronograma_item_id, tipo_mudanca, data_inicio_anterior, data_fim_anterior, percentual_realizado_anterior, custo_anterior")
        .eq("revisao_id", rev.id);
      if (snapErr) throw snapErr;

      const novos = (snaps ?? []).filter((s) => s.tipo_mudanca === "novo");
      const novosIds = novos.map((s) => s.cronograma_item_id);

      // Bloqueia se algum item "novo" tem medição lançada
      if (novosIds.length) {
        const { data: meds, error: medErr } = await supabase
          .from("itens_medicao")
          .select("cronograma_item_id")
          .in("cronograma_item_id", novosIds)
          .limit(1);
        if (medErr) throw medErr;
        if (meds && meds.length > 0) {
          toast.error("Há itens desta revisão com medição lançada. Cancele/exclua a medição antes de reverter, ou use 'Limpar importados'.", { duration: 8000 });
          return;
        }
      }

      // Aplica reversão item a item (não-novos)
      for (const s of snaps ?? []) {
        if (s.tipo_mudanca === "novo") continue;
        if (!s.cronograma_item_id) continue;
        const upd: any = {};
        if (s.tipo_mudanca === "data") {
          upd.data_inicio = s.data_inicio_anterior;
          upd.data_fim = s.data_fim_anterior;
        } else if (s.tipo_mudanca === "pct") {
          upd.percentual_realizado = s.percentual_realizado_anterior ?? 0;
        } else if (s.tipo_mudanca === "custo") {
          upd.custo = s.custo_anterior ?? 0;
        } else if (s.tipo_mudanca === "removido") {
          upd.ativo = true;
        } else if (s.tipo_mudanca === "restaurado") {
          upd.ativo = false;
        }
        if (Object.keys(upd).length) {
          const { error } = await supabase.from("cronograma_itens").update(upd).eq("id", s.cronograma_item_id);
          if (error) throw error;
        }
      }

      // Apaga dependências e itens criados pela revisão
      if (novosIds.length) {
        await supabase.from("cronograma_dependencias").delete().in("item_id", novosIds);
        const { error: delErr } = await supabase.from("cronograma_itens").delete().in("id", novosIds);
        if (delErr) throw delErr;
      }

      // Recalcula percentual_previsto proporcional ao custo_baseline
      const { data: vivos } = await supabase
        .from("cronograma_itens")
        .select("id, custo, custo_baseline")
        .eq("obra_id", obraId)
        .eq("ativo", true);
      const baseRef = (i: any) => Number(i.custo_baseline ?? i.custo ?? 0);
      const totalCusto = (vivos ?? []).reduce((a, i) => a + baseRef(i), 0);
      if (totalCusto > 0) {
        await Promise.all(
          (vivos ?? []).map((i) =>
            supabase
              .from("cronograma_itens")
              .update({ percentual_previsto: Number(((baseRef(i) / totalCusto) * 100).toFixed(6)) })
              .eq("id", i.id),
          ),
        );
      }

      // Remove snapshots + cabeçalho da revisão
      await supabase.from("cronograma_item_revisoes").delete().eq("revisao_id", rev.id);
      const { error: delRevErr } = await supabase.from("cronograma_revisoes").delete().eq("id", rev.id);
      if (delRevErr) throw delRevErr;

      toast.success(`Revisão #${rev.numero} revertida`);
      setConfirmReverter(null);
      onChange();
    } catch (e: any) {
      toast.error("Falha ao reverter: " + (e?.message ?? "erro desconhecido"));
    } finally {
      setRevertendoId(null);
    }
  }

  const grupos: { tipo: DiffRow["tipo"]; label: string; cor: string }[] = [
    { tipo: "novo", label: "Novos", cor: "bg-blue-500/15 text-blue-700" },
    { tipo: "data", label: "Datas alteradas", cor: "bg-amber-500/15 text-amber-700" },
    { tipo: "pct", label: "% realizado", cor: "bg-emerald-500/15 text-emerald-700" },
    { tipo: "custo", label: "Custo alterado", cor: "bg-purple-500/15 text-purple-700" },
    { tipo: "removido", label: "Removidos", cor: "bg-red-500/15 text-red-700" },
    { tipo: "restaurado", label: "Restaurados", cor: "bg-sky-500/15 text-sky-700" },
  ];

  return (
    <div className="space-y-4">
      {/* Faixa compacta de KPIs + ação */}
      <Card>
        <CardContent className="py-3 flex flex-wrap items-center gap-x-8 gap-y-2 justify-between">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-2">
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Atraso máximo</div>
              <div className="text-base font-semibold">{atrasoMax} {atrasoMax === 1 ? "dia" : "dias"} <span className="text-xs font-normal text-muted-foreground">· {atrasados.length} atrasada(s)</span></div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Revisões</div>
              <div className="text-base font-semibold">{revisoes.length} <span className="text-xs font-normal text-muted-foreground">· {revisoes[0] ? `última ${format(parseISO(revisoes[0].data_corte), "dd/MM/yyyy")}` : "nenhuma"}</span></div>
            </div>
          </div>
          <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetSheet(); }}>
            <MppNotSupportedDialog open={mppDialogOpen} onOpenChange={setMppDialogOpen} />
            <SheetTrigger asChild><Button><Upload className="h-4 w-4 mr-2" />Nova revisão</Button></SheetTrigger>
            <SheetContent side="right" className="w-[95vw] sm:max-w-[900px] overflow-y-auto flex flex-col">
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2"><CalendarClock className="h-4 w-4" /> Importar revisão semanal</SheetTitle>
                {/* Stepper */}
                <div className="flex items-center gap-2 mt-3 text-xs">
                  {[
                    { n: 1, l: "Arquivo" },
                    { n: 2, l: "Revisar mudanças" },
                    { n: 3, l: "Confirmar" },
                  ].map((s, i) => (
                    <div key={s.n} className="flex items-center gap-2">
                      <div className={`h-6 w-6 rounded-full flex items-center justify-center text-[11px] font-medium ${step === s.n ? "bg-primary text-primary-foreground" : step > s.n ? "bg-emerald-500/15 text-emerald-700" : "bg-muted text-muted-foreground"}`}>{s.n}</div>
                      <span className={step === s.n ? "font-medium" : "text-muted-foreground"}>{s.l}</span>
                      {i < 2 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                    </div>
                  ))}
                </div>
              </SheetHeader>

              <div className="flex-1 mt-4">
                {step === 1 && (
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <Label>Arquivos .xml do MS Project</Label>
                        <button type="button" onClick={() => setMppDialogOpen(true)} className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline">
                          Tem .mpp? Veja como converter
                        </button>
                      </div>
                      <label className="block border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 hover:bg-accent/50 transition-colors">
                        <Upload className="h-7 w-7 mx-auto mb-2 text-muted-foreground" />
                        <div className="text-sm font-medium">
                          {lotes.length ? "Adicionar mais arquivos" : "Clique para escolher um ou mais arquivos XML"}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          Selecione vários para importar diversas revisões de uma vez (em sequência cronológica).
                        </div>
                        <Input type="file" accept=".xml,.mpp" multiple onChange={onFile} className="hidden" />
                      </label>
                    </div>

                    {lotes.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-xs uppercase tracking-wide text-muted-foreground">
                          {lotes.length} arquivo(s) pronto(s) — defina a data de corte de cada um
                        </div>
                        {lotes.map((l, idx) => {
                          const n = l.diffs.filter((d) => d.apply).length;
                          return (
                            <div key={l.id} className="rounded-md border p-3 flex items-center gap-3">
                              <div className="text-xs font-mono w-6 text-center text-muted-foreground">#{idx + 1}</div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate" title={l.arquivoNome}>{l.arquivoNome}</div>
                                <div className="text-xs text-muted-foreground">{n} mudança(s) detectada(s)</div>
                              </div>
                              <div>
                                <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Data de corte</Label>
                                <Input
                                  type="date"
                                  value={l.dataCorte}
                                  onChange={(e) => atualizarDataLote(l.id, e.target.value)}
                                  className="h-8 w-[150px]"
                                />
                              </div>
                              <Button variant="ghost" size="icon" onClick={() => removerLote(l.id)} title="Remover">
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {step === 2 && lotes.length > 0 && (() => {
                  const ativos = tiposVisiveis ?? new Set(grupos.map((g) => g.tipo));
                  const loteAtual = lotes.find((l) => l.id === loteAtivoId) ?? lotes[0];
                  const diffsLote = loteAtual.diffs;
                  const contagem: Record<DiffRow["tipo"], number> = { novo: 0, data: 0, pct: 0, custo: 0, removido: 0, restaurado: 0 };
                  for (const d of diffsLote) contagem[d.tipo]++;
                  const totalAplicar = diffsLote.filter((d) => d.apply).length;
                  return (
                    <div className="space-y-4">
                      {lotes.length > 1 && (
                        <Tabs value={loteAtual.id} onValueChange={setLoteAtivoId}>
                          <TabsList className="w-full overflow-x-auto flex-wrap h-auto">
                            {lotes.map((l, idx) => {
                              const marcadas = l.diffs.filter((d) => d.apply).length;
                              return (
                                <TabsTrigger key={l.id} value={l.id} className="text-xs">
                                  <span className="font-mono mr-1">#{idx + 1}</span>
                                  <span className="max-w-[140px] truncate">{l.arquivoNome}</span>
                                  <Badge variant="secondary" className="ml-2 h-4 px-1.5 text-[10px]">{marcadas}</Badge>
                                </TabsTrigger>
                              );
                            })}
                          </TabsList>
                        </Tabs>
                      )}

                      {diffsLote.length === 0 ? (
                        <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                          <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                          Sem mudanças neste arquivo.
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-center gap-2">
                            {grupos.map((g) => {
                              const n = contagem[g.tipo];
                              if (!n) return null;
                              const on = ativos.has(g.tipo);
                              return (
                                <button
                                  key={g.tipo}
                                  type="button"
                                  onClick={() => {
                                    setTiposVisiveis((prev) => {
                                      const cur = new Set(prev ?? grupos.map((x) => x.tipo));
                                      if (cur.has(g.tipo)) cur.delete(g.tipo); else cur.add(g.tipo);
                                      return cur;
                                    });
                                  }}
                                  className={`text-xs px-2.5 py-1 rounded-full border transition ${on ? g.cor + " border-transparent" : "text-muted-foreground border-border opacity-60 hover:opacity-100"}`}
                                >
                                  {g.label} · {n}
                                </button>
                              );
                            })}
                            <div className="ml-auto text-xs text-muted-foreground">
                              {totalAplicar} de {diffsLote.length} marcadas
                            </div>
                          </div>

                          <Input
                            placeholder="Buscar tarefa por descrição…"
                            value={filtroDiff}
                            onChange={(e) => setFiltroDiff(e.target.value)}
                            className="h-9"
                          />

                          <div className="space-y-2">
                            {grupos.map((g) => {
                              if (!ativos.has(g.tipo)) return null;
                              const linhas = diffsLote
                                .map((d, i) => ({ d, i }))
                                .filter((x) => x.d.tipo === g.tipo)
                                .filter((x) => !filtroDiff || x.d.descricao.toLowerCase().includes(filtroDiff.toLowerCase()));
                              if (!linhas.length) return null;
                              const todosOn = linhas.every((x) => x.d.apply);
                              return (
                                <Collapsible key={g.tipo} defaultOpen={false}>
                                  <Card>
                                    <CollapsibleTrigger asChild>
                                      <CardHeader className="py-2.5 cursor-pointer hover:bg-accent/40 flex flex-row items-center justify-between">
                                        <CardTitle className="text-sm flex items-center gap-2">
                                          <ChevronRight className="h-4 w-4 transition-transform data-[state=open]:rotate-90 [[data-state=open]_&]:rotate-90" />
                                          <Badge className={g.cor + " border-none"}>{g.label}</Badge>
                                          <span className="text-muted-foreground font-normal">{linhas.length}</span>
                                        </CardTitle>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={(e) => { e.stopPropagation(); toggleAll(loteAtual.id, g.tipo, !todosOn); }}
                                        >
                                          {todosOn ? "Desmarcar todos" : "Marcar todos"}
                                        </Button>
                                      </CardHeader>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent>
                                      <CardContent className="pt-0">
                                        <Table>
                                          <TableHeader><TableRow>
                                            <TableHead className="w-8"></TableHead>
                                            <TableHead>Tarefa</TableHead>
                                            <TableHead>Antes</TableHead>
                                            <TableHead>Depois</TableHead>
                                          </TableRow></TableHeader>
                                          <TableBody>
                                            {linhas.slice(0, 200).map(({ d, i }) => (
                                              <TableRow key={i}>
                                                <TableCell><input type="checkbox" checked={d.apply} onChange={(e) => toggleRow(loteAtual.id, i, e.target.checked)} /></TableCell>
                                                <TableCell className="max-w-[380px] truncate" title={d.descricao}>{d.descricao}</TableCell>
                                                <TableCell className="text-xs whitespace-nowrap">{formatBefore(d)}</TableCell>
                                                <TableCell className="text-xs whitespace-nowrap">{formatAfter(d)}</TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                        {linhas.length > 200 && (
                                          <p className="text-xs text-muted-foreground mt-2">Mostrando 200 de {linhas.length}. Use a busca acima para refinar.</p>
                                        )}
                                      </CardContent>
                                    </CollapsibleContent>
                                  </Card>
                                </Collapsible>
                              );
                            })}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}

                {step === 3 && lotes.length > 0 && (
                  <div className="space-y-4">
                    {lotes.length > 1 && (
                      <div className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
                        As {lotes.length} revisões serão aplicadas em sequência, na ordem listada. Cada uma vira uma entrada própria no histórico. Itens "novos" duplicados por <span className="font-mono">uid_mpp</span> de lotes anteriores são ignorados automaticamente.
                      </div>
                    )}

                    {lotes.map((l, idx) => {
                      const aplicar = l.diffs.filter((d) => d.apply);
                      return (
                        <Card key={l.id}>
                          <CardHeader className="py-3">
                            <CardTitle className="text-sm flex items-center justify-between">
                              <span className="flex items-center gap-2">
                                <span className="font-mono text-xs text-muted-foreground">#{idx + 1}</span>
                                <span className="truncate max-w-[420px]" title={l.arquivoNome}>{l.arquivoNome}</span>
                              </span>
                              <span className="text-xs font-normal text-muted-foreground">
                                {aplicar.length} de {l.diffs.length} marcadas · corte {(() => { try { return l.dataCorte ? format(parseISO(l.dataCorte), "dd/MM/yyyy") : "—"; } catch { return l.dataCorte || "—"; } })()}
                              </span>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="pt-0 pb-3">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                              {grupos.map((g) => {
                                const n = aplicar.filter((d) => d.tipo === g.tipo).length;
                                if (!n) return null;
                                return (
                                  <div key={g.tipo} className="rounded-md border p-2 flex items-center justify-between">
                                    <Badge className={g.cor + " border-none"}>{g.label}</Badge>
                                    <span className="font-semibold tabular-nums">{n}</span>
                                  </div>
                                );
                              })}
                              {aplicar.length === 0 && (
                                <div className="col-span-full text-xs text-muted-foreground">Nenhuma mudança marcada — esta revisão será registrada vazia.</div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}

                    <Card>
                      <CardContent className="pt-6 space-y-3">
                        <div className="flex items-start gap-3">
                          <Switch checked={atualizarPct} onCheckedChange={setAtualizarPct} id="att-pct" />
                          <Label htmlFor="att-pct" className="cursor-pointer text-sm font-normal leading-snug">
                            Atualizar % realizado pelo PercentComplete do XML
                            <div className="text-xs text-muted-foreground mt-0.5">Aplica a todas as revisões deste lote. Nunca rebaixa um lançamento manual maior.</div>
                          </Label>
                        </div>
                        <div>
                          <Label>Observações (opcional, aplicadas a todas)</Label>
                          <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} placeholder="Ex.: revisões pós reunião mensal" />
                        </div>
                      </CardContent>
                    </Card>

                    {importProgress && (
                      <div className="rounded-md border bg-muted/30 p-3 text-xs">
                        Aplicando {importProgress.atual}/{importProgress.total}: <span className="font-medium">{importProgress.nome}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <SheetFooter className="mt-4 flex-row justify-between sm:justify-between">
                <Button variant="ghost" disabled={step === 1 || importing} onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))}>
                  Voltar
                </Button>
                {step < 3 ? (
                  <Button
                    disabled={lotes.length === 0 || (step === 2 && lotes.every((l) => l.diffs.length === 0))}
                    onClick={() => setStep((s) => (s < 3 ? ((s + 1) as 1 | 2 | 3) : s))}
                  >
                    Avançar
                  </Button>
                ) : (
                  <Button
                    disabled={lotes.length === 0 || lotes.reduce((a, l) => a + l.diffs.filter((d) => d.apply).length, 0) === 0 || importing}
                    onClick={confirmar}
                  >
                    {importing
                      ? (importProgress ? `Aplicando ${importProgress.atual}/${importProgress.total}…` : "Aplicando…")
                      : (lotes.length > 1 ? `Confirmar ${lotes.length} revisões` : "Confirmar revisão")}
                  </Button>
                )}
              </SheetFooter>

            </SheetContent>
          </Sheet>
        </CardContent>
      </Card>

      {/* Histórico resumido */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2"><History className="h-4 w-4" /> Histórico de revisões</CardTitle>
          {revisoes.length > 3 && (
            <Button variant="ghost" size="sm" onClick={() => setVerTodasRev((v) => !v)}>
              {verTodasRev ? "Mostrar últimas 3" : `Ver todas (${revisoes.length})`}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {revisoes.length === 0 ? (
            <div className="text-sm text-muted-foreground">Nenhuma revisão registrada ainda. Clique em "Nova revisão" para importar a primeira.</div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead className="w-12">#</TableHead>
                <TableHead>Data de corte</TableHead>
                <TableHead>Arquivo</TableHead>
                <TableHead>Mudanças</TableHead>
                <TableHead>Importada em</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {(verTodasRev ? revisoes : revisoes.slice(0, 3)).map((r) => {
                  const t = r.totais ?? {};
                  const chips = [
                    t.novos ? `+${t.novos} novas` : null,
                    t.alterados_data ? `${t.alterados_data} datas` : null,
                    t.alterados_pct ? `${t.alterados_pct} %` : null,
                    t.removidos ? `${t.removidos} removidas` : null,
                  ].filter(Boolean);
                  const aberta = revExpandida === r.id;
                  const podeReverter = Number(r.numero) === maxNumero;
                  return (
                    <Fragment key={r.id}>
                      <TableRow
                        className="cursor-pointer hover:bg-accent/40"
                        onClick={() => setRevExpandida((cur) => (cur === r.id ? null : r.id))}
                      >
                        <TableCell>
                          {aberta ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                        </TableCell>
                        <TableCell>{r.numero}</TableCell>
                        <TableCell>{format(parseISO(r.data_corte), "dd/MM/yyyy")}</TableCell>
                        <TableCell className="max-w-[260px] truncate" title={r.arquivo_nome ?? ""}>{r.arquivo_nome ?? "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground" title={`Novos ${t.novos ?? 0} · Datas ${t.alterados_data ?? 0} · % ${t.alterados_pct ?? 0} · Removidos ${t.removidos ?? 0}`}>
                          {chips.length ? chips.join(" · ") : "sem mudanças"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{format(parseISO(r.created_at), "dd/MM/yy HH:mm")}</TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={!podeReverter || revertendoId === r.id}
                            title={podeReverter ? "Reverter esta revisão" : `Reverta primeiro a revisão #${maxNumero}`}
                            onClick={() => setConfirmReverter(r)}
                          >
                            <Undo2 className="h-4 w-4 mr-1" />
                            Reverter
                          </Button>
                        </TableCell>
                      </TableRow>
                      {aberta && (
                        <TableRow className="bg-muted/30 hover:bg-muted/30">
                          <TableCell colSpan={7} className="p-0">
                            <RevisaoDetalhes revisaoId={r.id} />
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmReverter} onOpenChange={(v) => !v && setConfirmReverter(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reverter revisão #{confirmReverter?.numero}?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Data de corte:</span>{" "}
                  {confirmReverter && format(parseISO(confirmReverter.data_corte), "dd/MM/yyyy")}
                  {confirmReverter?.arquivo_nome ? <> · <span className="font-mono text-xs">{confirmReverter.arquivo_nome}</span></> : null}
                </div>
                {confirmReverter && (
                  <div className="text-xs text-muted-foreground">
                    {[
                      confirmReverter.totais?.novos ? `+${confirmReverter.totais.novos} novas` : null,
                      confirmReverter.totais?.alterados_data ? `${confirmReverter.totais.alterados_data} datas` : null,
                      confirmReverter.totais?.alterados_pct ? `${confirmReverter.totais.alterados_pct} %` : null,
                      confirmReverter.totais?.alterados_custo ? `${confirmReverter.totais.alterados_custo} custo` : null,
                      confirmReverter.totais?.removidos ? `${confirmReverter.totais.removidos} removidas` : null,
                      confirmReverter.totais?.restaurados ? `${confirmReverter.totais.restaurados} restauradas` : null,
                    ].filter(Boolean).join(" · ") || "sem mudanças registradas"}
                  </div>
                )}
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                  Esta ação desfaz as mudanças aplicadas por esta revisão: itens criados serão removidos do cronograma, e datas, % e custos voltarão aos valores anteriores. Não é reversível.
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!revertendoId}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!!revertendoId}
              onClick={(e) => { e.preventDefault(); if (confirmReverter) reverterRevisao(confirmReverter); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {revertendoId ? "Revertendo…" : "Reverter revisão"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}



function formatBefore(d: DiffRow): string {
  if (d.tipo === "novo") return "—";
  if (d.tipo === "removido") return "(ativo)";
  if (d.tipo === "restaurado") return "(inativo)";
  if (d.tipo === "data") return `${d.inicio_antes ?? "—"} → ${d.fim_antes ?? "—"}`;
  if (d.tipo === "pct") return `${Number(d.pct_antes ?? 0).toFixed(1)}%`;
  if (d.tipo === "custo") return brl(d.custo_antes ?? 0);
  return "";
}
function formatAfter(d: DiffRow): string {
  if (d.tipo === "removido") return "(inativo)";
  if (d.tipo === "restaurado") return "(ativo)";
  if (d.tipo === "novo" || d.tipo === "data") return `${d.inicio_novo ?? "—"} → ${d.fim_novo ?? "—"}`;
  if (d.tipo === "pct") return `${Number(d.pct_novo ?? 0).toFixed(1)}%`;
  if (d.tipo === "custo") return brl(d.custo_novo ?? 0);
  return "";
}

function LimparImportadosButton({
  obraId,
  temMedicoes,
  temNfs,
  temRecebimentos,
  onDone,
}: {
  obraId: string;
  temMedicoes: boolean;
  temNfs: boolean;
  temRecebimentos: boolean;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [incluirFaturamento, setIncluirFaturamento] = useState(false);

  const temFinanceiro = temMedicoes || temNfs || temRecebimentos;
  const bloqueado = temFinanceiro && !incluirFaturamento;
  const podeExecutar = confirmText.trim().toUpperCase() === "LIMPAR" && !bloqueado;

  async function limpar() {
    if (!podeExecutar) return;
    setLoading(true);
    try {
      if (incluirFaturamento) {
        // 0a) Itens de medição → medições → NFs → todos recebimentos
        const { data: meds } = await supabase
          .from("medicoes").select("id").eq("obra_id", obraId);
        const medIds = (meds ?? []).map((m) => m.id);
        if (medIds.length) {
          await supabase.from("itens_medicao").delete().in("medicao_id", medIds);
        }
        // Recebimentos antes das NFs (têm FK lógica nota_fiscal_id)
        await supabase.from("recebimentos").delete().eq("obra_id", obraId);
        await supabase.from("notas_fiscais").delete().eq("obra_id", obraId);
        if (medIds.length) {
          await supabase.from("medicoes").delete().in("id", medIds);
        }
      } else {
        // 1) Previsões de recebimento (não efetivadas) — derivadas do cronograma
        await supabase
          .from("recebimentos")
          .delete()
          .eq("obra_id", obraId)
          .is("data_recebimento", null);
      }

      // 2) Revisões: itens primeiro, depois cabeçalhos
      const { data: revs } = await supabase
        .from("cronograma_revisoes").select("id").eq("obra_id", obraId);
      const revIds = (revs ?? []).map((r) => r.id);
      if (revIds.length) {
        await supabase.from("cronograma_item_revisoes").delete().in("revisao_id", revIds);
        await supabase.from("cronograma_revisoes").delete().in("id", revIds);
      }

      // 3) Baselines de cronograma
      const { data: bls } = await supabase
        .from("cronograma_baselines").select("id").eq("obra_id", obraId);
      const blIds = (bls ?? []).map((b) => b.id);
      if (blIds.length) {
        await supabase.from("cronograma_item_baseline").delete().in("baseline_id", blIds);
        await supabase.from("cronograma_baselines").delete().in("id", blIds);
      }

      // 4) Dependências e itens do cronograma
      await supabase.from("cronograma_dependencias").delete().eq("obra_id", obraId);
      const { error: errItens } = await supabase
        .from("cronograma_itens").delete().eq("obra_id", obraId);
      if (errItens) throw errItens;

      toast.success(
        incluirFaturamento
          ? "Cronograma e faturamento removidos. Você pode reimportar do zero."
          : "Dados importados removidos. Você pode reimportar o XML."
      );
      setOpen(false);
      setConfirmText("");
      setIncluirFaturamento(false);
      onDone();
    } catch (e: any) {
      toast.error("Falha ao limpar: " + (e?.message ?? "erro desconhecido"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setConfirmText(""); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive">
          <Trash2 className="h-4 w-4 mr-1" /> Limpar importados
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-destructive" />
            Limpar dados importados de contrato e revisões
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-destructive">
            <p className="font-medium">Esta ação é irreversível.</p>
            <p className="mt-1">
              Serão removidos permanentemente desta obra:
            </p>
            <ul className="list-disc ml-5 mt-1 space-y-0.5">
              <li>Todos os itens do cronograma (incluindo baseline e CPM)</li>
              <li>Todas as revisões importadas e seu histórico de mudanças</li>
              <li>Baselines congelados e dependências entre tarefas</li>
              <li>Previsões de recebimento ainda não efetivadas</li>
            </ul>
          </div>

          <div className="rounded-md border border-border bg-muted/30 p-3 text-muted-foreground">
            <p className="font-medium text-foreground">Não serão alterados:</p>
            <p>Contrato, aditivos e logs de auditoria.</p>
          </div>

          {temFinanceiro && (
            <div className={`rounded-md border p-3 ${incluirFaturamento ? "border-destructive/40 bg-destructive/5 text-destructive" : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"}`}>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={incluirFaturamento}
                  onChange={(e) => setIncluirFaturamento(e.target.checked)}
                  className="mt-1"
                  disabled={loading}
                />
                <div className="text-sm">
                  <p className="font-medium">
                    Também remover medições, notas fiscais e recebimentos
                  </p>
                  <p className="mt-1">
                    Esta obra possui registros financeiros:
                    {temMedicoes && <span className="block">• medições</span>}
                    {temNfs && <span className="block">• notas fiscais</span>}
                    {temRecebimentos && <span className="block">• recebimentos já efetivados</span>}
                  </p>
                  <p className="mt-1">
                    {incluirFaturamento
                      ? "Tudo será apagado em cascata — inclusive valores já recebidos."
                      : "Marque para apagar tudo em cascata, ou cancele para preservar o histórico financeiro."}
                  </p>
                </div>
              </label>
            </div>
          )}

          <div>
            <Label htmlFor="confirm-limpar" className="text-xs">
              Para confirmar, digite <span className="font-mono font-semibold">LIMPAR</span>:
            </Label>
            <Input
              id="confirm-limpar"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="LIMPAR"
              disabled={bloqueado || loading}
              className="mt-1"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={limpar}
            disabled={!podeExecutar || loading}
          >
            {loading ? "Limpando…" : "Limpar definitivamente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RevisaoDetalhes({ revisaoId }: { revisaoId: string }) {
  const [filtro, setFiltro] = useState("");
  const [tipo, setTipo] = useState<string>("todos");

  const { data, isLoading } = useQuery({
    queryKey: ["revisao_detalhes", revisaoId],
    queryFn: async () =>
      (
        await supabase
          .from("cronograma_item_revisoes")
          .select(
            "id, descricao_item, tipo_mudanca, data_inicio_anterior, data_inicio_novo, data_fim_anterior, data_fim_novo, percentual_realizado_anterior, percentual_realizado_novo, custo_anterior, custo_novo",
          )
          .eq("revisao_id", revisaoId)
      ).data ?? [],
  });

  if (isLoading) {
    return <div className="px-4 py-3 text-xs text-muted-foreground">Carregando mudanças…</div>;
  }
  if (!data || data.length === 0) {
    return <div className="px-4 py-3 text-xs text-muted-foreground">Nenhuma mudança registrada nesta revisão.</div>;
  }

  const tipos = Array.from(new Set(data.map((d) => d.tipo_mudanca))).sort();
  const filtradas = data
    .filter((d) => tipo === "todos" || d.tipo_mudanca === tipo)
    .filter((d) => !filtro || (d.descricao_item ?? "").toLowerCase().includes(filtro.toLowerCase()));

  function fmtDate(s?: string | null) {
    if (!s) return "—";
    try { return format(parseISO(s), "dd/MM/yy"); } catch { return s; }
  }
  function deltaDias(antes?: string | null, depois?: string | null) {
    if (!antes || !depois) return null;
    try { return differenceInCalendarDays(parseISO(depois), parseISO(antes)); } catch { return null; }
  }
  function antesDepois(d: NonNullable<typeof data>[number]) {
    switch (d.tipo_mudanca) {
      case "novo":
        return { antes: "—", depois: `${fmtDate(d.data_inicio_novo)} → ${fmtDate(d.data_fim_novo)}` };
      case "removido":
        return { antes: "(ativo)", depois: "(inativo)" };
      case "restaurado":
        return { antes: "(inativo)", depois: "(ativo)" };
      case "data": {
        const d1 = deltaDias(d.data_fim_anterior, d.data_fim_novo);
        return {
          antes: `${fmtDate(d.data_inicio_anterior)} → ${fmtDate(d.data_fim_anterior)}`,
          depois: `${fmtDate(d.data_inicio_novo)} → ${fmtDate(d.data_fim_novo)}`,
          delta: d1,
        };
      }
      case "pct":
        return {
          antes: `${Number(d.percentual_realizado_anterior ?? 0).toFixed(1)}%`,
          depois: `${Number(d.percentual_realizado_novo ?? 0).toFixed(1)}%`,
        };
      case "custo":
        return { antes: brl(Number(d.custo_anterior ?? 0)), depois: brl(Number(d.custo_novo ?? 0)) };
      default:
        return { antes: "—", depois: "—" };
    }
  }
  const tipoCor: Record<string, string> = {
    novo: "bg-blue-500/15 text-blue-700",
    data: "bg-amber-500/15 text-amber-700",
    pct: "bg-emerald-500/15 text-emerald-700",
    custo: "bg-purple-500/15 text-purple-700",
    removido: "bg-red-500/15 text-red-700",
    restaurado: "bg-sky-500/15 text-sky-700",
  };

  // Monta árvore hierárquica (mesma lógica da aba Cronograma) só com nós que contêm mudanças.
  type DiffNode = {
    wbs: string;
    name: string;
    children: Map<string, DiffNode>;
    diffs: NonNullable<typeof data>;
  };
  const root: DiffNode = { wbs: "", name: "", children: new Map(), diffs: [] };
  const ensureNode = (parent: DiffNode, wbs: string, name: string): DiffNode => {
    let n = parent.children.get(wbs);
    if (!n) {
      n = { wbs, name, children: new Map(), diffs: [] };
      parent.children.set(wbs, n);
    } else if (!n.name && name) {
      n.name = name;
    }
    return n;
  };
  for (const d of filtradas) {
    const { wbs, name, chain } = parseDescricao(String(d.descricao_item ?? ""));
    let cursor = root;
    for (const p of chain) cursor = ensureNode(cursor, p.wbs, p.name);
    const leaf = ensureNode(cursor, wbs || `__${d.id}`, name || "(sem nome)");
    leaf.diffs.push(d);
  }

  const flat: { node: DiffNode; depth: number; isLeaf: boolean }[] = [];
  const walkNode = (n: DiffNode, depth: number) => {
    const children = Array.from(n.children.values()).sort((a, b) => wbsCompare(a.wbs, b.wbs));
    for (const c of children) {
      const isLeaf = c.diffs.length > 0 && c.children.size === 0;
      flat.push({ node: c, depth, isLeaf });
      if (!isLeaf) walkNode(c, depth + 1);
    }
  };
  walkNode(root, 0);

  const countDiffs = (n: DiffNode): number => {
    let s = n.diffs.length;
    for (const c of n.children.values()) s += countDiffs(c);
    return s;
  };

  return (
    <div className="p-4 space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar tarefa…"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
          className="h-8 max-w-xs"
        />
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger className="h-8 w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os tipos</SelectItem>
            {tipos.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{filtradas.length} de {data.length}</span>
      </div>
      <div className="rounded-md border bg-background overflow-hidden">
        <Table>
          <TableHeader><TableRow>
            <TableHead className="w-24">EDT</TableHead>
            <TableHead>Tarefa</TableHead>
            <TableHead className="w-[90px]">Tipo</TableHead>
            <TableHead>Antes</TableHead>
            <TableHead>Depois</TableHead>
            <TableHead className="text-right w-[80px]">Δ</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {flat.map(({ node, depth, isLeaf }) => {
              if (!isLeaf) {
                const totalDiffs = countDiffs(node);
                return (
                  <TableRow key={`g-${node.wbs}`} className="bg-muted/40">
                    <TableCell className="font-mono text-xs text-muted-foreground">{node.wbs}</TableCell>
                    <TableCell colSpan={4}>
                      <div className="flex items-center font-semibold" style={{ paddingLeft: `${depth * 18}px` }}>
                        <span className="mr-1 inline-block w-4 text-center text-xs text-muted-foreground">▾</span>
                        {node.name}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">{totalDiffs}</TableCell>
                  </TableRow>
                );
              }
              return (
                <Fragment key={`leaf-${node.wbs}-${node.diffs[0]?.id}`}>
                  {node.diffs.map((d, i) => {
                    const ad = antesDepois(d);
                    return (
                      <TableRow key={d.id}>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {i === 0 && !node.wbs.startsWith("__") ? node.wbs : ""}
                        </TableCell>
                        <TableCell className="max-w-[420px] truncate" title={node.name}>
                          <div className="flex items-center" style={{ paddingLeft: `${depth * 18}px` }}>
                            <span className="mr-1 inline-block w-4 text-center text-xs text-muted-foreground">·</span>
                            {i === 0 ? node.name : <span className="text-muted-foreground">↳</span>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={(tipoCor[d.tipo_mudanca] ?? "bg-muted text-muted-foreground") + " border-none"}>{d.tipo_mudanca}</Badge>
                        </TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{ad.antes}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{ad.depois}</TableCell>
                        <TableCell className="text-right text-xs">
                          {"delta" in ad && ad.delta != null && ad.delta !== 0 ? (
                            <Badge variant={ad.delta > 0 ? "destructive" : "secondary"}>{ad.delta > 0 ? `+${ad.delta}` : ad.delta}d</Badge>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </Fragment>
              );
            })}
            {flat.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6 text-xs">Nenhuma mudança corresponde aos filtros.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
