import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { GitCompare, Zap } from "lucide-react";
import { computeCpm, diasAtraso } from "@/lib/cpm";
import { brl } from "@/lib/billing";

type Snap = {
  key: string;
  label: string;
  // map por uid_mpp ou item_id
  itens: Map<string, { descricao: string; data_inicio: string; data_fim: string; percentual_previsto: number; custo: number }>;
};

export function CompararRevisoesTab({ obraId }: { obraId: string }) {
  const qc = useQueryClient();
  const [de, setDe] = useState<string>("baseline_v1");
  const [para, setPara] = useState<string>("atual");
  const [filtro, setFiltro] = useState("");
  const [soMudancas, setSoMudancas] = useState(true);
  const [computing, setComputing] = useState(false);

  const { data: baselines } = useQuery({
    queryKey: ["baselines", obraId],
    queryFn: async () =>
      (await supabase.from("cronograma_baselines").select("id, versao, motivo, created_at").eq("obra_id", obraId).order("versao")).data ?? [],
  });
  const { data: revisoes } = useQuery({
    queryKey: ["revisoes_all", obraId],
    queryFn: async () =>
      (await supabase.from("cronograma_revisoes").select("id, numero, data_corte, observacoes").eq("obra_id", obraId).order("numero")).data ?? [],
  });
  const { data: crono } = useQuery({
    queryKey: ["crono_compare", obraId],
    queryFn: async () =>
      (await supabase
        .from("cronograma_itens")
        .select("id, uid_mpp, descricao, data_inicio, data_fim, data_inicio_baseline, data_fim_baseline, custo, custo_baseline, percentual_previsto, percentual_realizado, ativo, folga_dias, critico")
        .eq("obra_id", obraId)).data ?? [],
  });
  const { data: itensBaseline } = useQuery({
    queryKey: ["item_baseline", obraId],
    queryFn: async () =>
      (await supabase
        .from("cronograma_item_baseline")
        .select("baseline_id, cronograma_item_id, uid_mpp, descricao, data_inicio, data_fim, custo, percentual_previsto")
        .in("baseline_id", (baselines ?? []).map((b) => b.id))).data ?? [],
    enabled: !!baselines?.length,
  });
  const { data: itensRevisoes } = useQuery({
    queryKey: ["item_revisao", obraId],
    queryFn: async () =>
      (await supabase
        .from("cronograma_item_revisoes")
        .select("revisao_id, cronograma_item_id, descricao_item, data_inicio_novo, data_fim_novo, custo_novo, percentual_realizado_novo, tipo_mudanca")
        .in("revisao_id", (revisoes ?? []).map((r) => r.id))).data ?? [],
    enabled: !!revisoes?.length,
  });

  const snapshots: Snap[] = useMemo(() => {
    const out: Snap[] = [];

    // Baselines
    for (const b of baselines ?? []) {
      const map = new Map();
      for (const li of itensBaseline ?? []) {
        if (li.baseline_id !== b.id) continue;
        const key = String(li.uid_mpp ?? li.cronograma_item_id);
        map.set(key, {
          descricao: li.descricao ?? "",
          data_inicio: li.data_inicio,
          data_fim: li.data_fim,
          percentual_previsto: Number(li.percentual_previsto ?? 0),
          custo: Number(li.custo ?? 0),
        });
      }
      out.push({ key: `baseline_${b.id}`, label: `Baseline v${b.versao}${b.motivo ? ` · ${b.motivo}` : ""}`, itens: map });
    }

    // Estado "atual"
    const atualMap = new Map();
    for (const i of crono ?? []) {
      if (i.ativo === false) continue;
      const key = String(i.uid_mpp ?? i.id);
      atualMap.set(key, {
        descricao: i.descricao ?? "",
        data_inicio: i.data_inicio,
        data_fim: i.data_fim,
        percentual_previsto: Number(i.percentual_previsto ?? 0),
        custo: Number(i.custo_baseline ?? i.custo ?? 0),
      });
    }
    out.push({ key: "atual", label: "Estado atual", itens: atualMap });

    return out;
  }, [baselines, itensBaseline, crono]);

  const snapDe = snapshots.find((s) => s.key === de) ?? snapshots[0];
  const snapPara = snapshots.find((s) => s.key === para) ?? snapshots[snapshots.length - 1];

  type Row = {
    key: string;
    descricao: string;
    inicioA?: string; fimA?: string; pctA?: number; custoA?: number;
    inicioB?: string; fimB?: string; pctB?: number; custoB?: number;
    deltaInicio?: number;
    deltaFim?: number;
    deltaPct?: number;
    deltaCusto?: number;
    tipo: "novo" | "removido" | "alterado" | "igual";
  };

  const linhas: Row[] = useMemo(() => {
    if (!snapDe || !snapPara) return [];
    const keys = new Set([...snapDe.itens.keys(), ...snapPara.itens.keys()]);
    const out: Row[] = [];
    for (const k of keys) {
      const a = snapDe.itens.get(k);
      const b = snapPara.itens.get(k);
      if (a && !b) {
        out.push({ key: k, descricao: a.descricao, inicioA: a.data_inicio, fimA: a.data_fim, pctA: a.percentual_previsto, custoA: a.custo, tipo: "removido" });
        continue;
      }
      if (!a && b) {
        out.push({ key: k, descricao: b.descricao, inicioB: b.data_inicio, fimB: b.data_fim, pctB: b.percentual_previsto, custoB: b.custo, tipo: "novo" });
        continue;
      }
      if (!a || !b) continue;
      const dInicio = differenceInCalendarDays(parseISO(b.data_inicio), parseISO(a.data_inicio));
      const dFim = differenceInCalendarDays(parseISO(b.data_fim), parseISO(a.data_fim));
      const dPct = Number((b.percentual_previsto - a.percentual_previsto).toFixed(4));
      const dCusto = Number((b.custo - a.custo).toFixed(2));
      const igual = dInicio === 0 && dFim === 0 && Math.abs(dPct) < 0.0001 && Math.abs(dCusto) < 0.01;
      out.push({
        key: k,
        descricao: b.descricao || a.descricao,
        inicioA: a.data_inicio, fimA: a.data_fim, pctA: a.percentual_previsto, custoA: a.custo,
        inicioB: b.data_inicio, fimB: b.data_fim, pctB: b.percentual_previsto, custoB: b.custo,
        deltaInicio: dInicio, deltaFim: dFim, deltaPct: dPct, deltaCusto: dCusto,
        tipo: igual ? "igual" : "alterado",
      });
    }
    return out
      .filter((r) => !soMudancas || r.tipo !== "igual")
      .filter((r) => !filtro || r.descricao.toLowerCase().includes(filtro.toLowerCase()))
      .sort((a, b) => (a.descricao || "").localeCompare(b.descricao || ""));
  }, [snapDe, snapPara, soMudancas, filtro]);

  const resumo = {
    novos: linhas.filter((l) => l.tipo === "novo").length,
    removidos: linhas.filter((l) => l.tipo === "removido").length,
    alterados: linhas.filter((l) => l.tipo === "alterado").length,
    atraso: linhas.reduce((m, l) => Math.max(m, l.deltaFim ?? 0), 0),
    custoDelta: linhas.reduce((a, l) => a + (l.deltaCusto ?? 0), 0),
  };

  async function recalcularCpm() {
    if (!crono?.length) return toast.error("Sem itens no cronograma");
    setComputing(true);
    try {
      const { data: deps } = await supabase
        .from("cronograma_dependencias")
        .select("item_id, predecessor_uid_mpp, tipo, lag_dias")
        .eq("obra_id", obraId);
      const ativos = crono.filter((i) => i.ativo !== false);
      const result = computeCpm(
        ativos.map((i) => ({ id: i.id, uid_mpp: i.uid_mpp, data_inicio: i.data_inicio, data_fim: i.data_fim })),
        (deps ?? []) as any,
      );
      // Persistir em lote (uma update por item — agrupar por valor para reduzir chamadas)
      await Promise.all(
        result.map((r) =>
          supabase.from("cronograma_itens").update({ folga_dias: r.folga_dias, critico: r.critico }).eq("id", r.id),
        ),
      );
      const criticas = result.filter((r) => r.critico).length;
      const atraso = diasAtraso(
        ativos
          .filter((i) => result.find((r) => r.id === i.id)?.critico)
          .map((i) => ({ data_fim: i.data_fim, data_fim_baseline: i.data_fim_baseline })),
      );
      toast.success(`CPM recalculado · ${criticas} tarefas críticas · atraso da cadeia: ${atraso}d`);
      qc.invalidateQueries({ queryKey: ["crono_compare", obraId] });
      qc.invalidateQueries({ queryKey: ["crono", obraId] });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setComputing(false);
    }
  }

  const criticas = (crono ?? []).filter((i) => i.critico).length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Zap className="h-4 w-4" /> Caminho crítico</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4 flex-wrap">
          <div className="text-sm text-muted-foreground">
            {criticas > 0
              ? <>Hoje há <span className="font-medium text-foreground">{criticas}</span> tarefa(s) com folga ≤ 0 (críticas).</>
              : "Folgas ainda não calculadas. Recalcule após importar uma revisão para identificar as tarefas críticas."}
          </div>
          <Button size="sm" onClick={recalcularCpm} disabled={computing}>
            <Zap className="h-4 w-4 mr-2" />{computing ? "Calculando…" : "Recalcular CPM"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><GitCompare className="h-4 w-4" /> Comparar revisões</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">De</div>
              <Select value={de} onValueChange={setDe}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {snapshots.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Para</div>
              <Select value={para} onValueChange={setPara}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {snapshots.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Filtro</div>
              <Input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Descrição…" />
            </div>
            <div className="space-y-1">
              <div className="text-xs text-muted-foreground">Exibição</div>
              <Button variant={soMudancas ? "default" : "outline"} size="sm" onClick={() => setSoMudancas((v) => !v)} className="w-full">
                {soMudancas ? "Somente mudanças" : "Todas as linhas"}
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
            <Stat label="Novos" value={String(resumo.novos)} />
            <Stat label="Removidos" value={String(resumo.removidos)} />
            <Stat label="Alterados" value={String(resumo.alterados)} />
            <Stat label="Maior atraso" value={`${resumo.atraso}d`} />
            <Stat label="Δ Custo" value={brl(resumo.custoDelta)} />
          </div>

          {linhas.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Sem diferenças entre as versões selecionadas.</div>
          ) : (
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Datas A</TableHead>
                    <TableHead>Datas B</TableHead>
                    <TableHead className="text-right">Δ início</TableHead>
                    <TableHead className="text-right">Δ fim</TableHead>
                    <TableHead className="text-right">Δ %</TableHead>
                    <TableHead className="text-right">Δ custo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {linhas.slice(0, 500).map((r) => (
                    <TableRow key={r.key}>
                      <TableCell className="max-w-md truncate">{r.descricao}</TableCell>
                      <TableCell>
                        <Badge variant={r.tipo === "novo" ? "default" : r.tipo === "removido" ? "destructive" : "secondary"}>{r.tipo}</Badge>
                      </TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{r.inicioA ? fmt(r.inicioA) : "—"} → {r.fimA ? fmt(r.fimA) : "—"}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{r.inicioB ? fmt(r.inicioB) : "—"} → {r.fimB ? fmt(r.fimB) : "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{deltaCell(r.deltaInicio, "d")}</TableCell>
                      <TableCell className="text-right tabular-nums">{deltaCell(r.deltaFim, "d")}</TableCell>
                      <TableCell className="text-right tabular-nums">{deltaCell(r.deltaPct, "%")}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.deltaCusto != null ? brl(r.deltaCusto) : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {linhas.length > 500 && (
                <p className="text-xs text-muted-foreground mt-2">Mostrando 500 de {linhas.length} linhas. Use o filtro para refinar.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium mt-0.5">{value}</div>
    </div>
  );
}

function fmt(d: string) {
  try { return format(parseISO(d), "dd/MM/yy"); } catch { return d; }
}

function deltaCell(v: number | undefined, suf: string) {
  if (v == null) return "—";
  if (v === 0) return <span className="text-muted-foreground">0{suf}</span>;
  const color = v > 0 ? "text-amber-600" : "text-emerald-600";
  return <span className={color}>{v > 0 ? "+" : ""}{v}{suf}</span>;
}
