import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { brl } from "@/lib/billing";
import { addDays, addMonths, format, parseISO, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

export const Route = createFileRoute("/_app/fluxo")({ component: FluxoPage });

function FluxoPage() {
  const [obraId, setObraId] = useState<string>("all");
  const [clienteId, setClienteId] = useState<string>("all");
  const [mesesQtd, setMesesQtd] = useState<number>(12);
  const [inicio, setInicio] = useState<string>(format(startOfMonth(addMonths(new Date(), -2)), "yyyy-MM-dd"));

  const { data } = useQuery({
    queryKey: ["fluxo"],
    queryFn: async () => {
      const [r, n, o, c] = await Promise.all([
        supabase.from("recebimentos").select("*, obras(id,codigo,nome,cliente_id)"),
        supabase.from("notas_fiscais").select("*, obras(id,codigo,nome,cliente_id)"),
        supabase.from("obras").select("id,codigo,nome,cliente_id"),
        supabase.from("clientes").select("id,nome"),
      ]);
      return { receb: r.data ?? [], nfs: n.data ?? [], obras: o.data ?? [], clientes: c.data ?? [] };
    },
  });

  if (!data) return <div className="p-8 text-muted-foreground">Carregando…</div>;

  // aplicar filtros
  const obrasFiltradas = data.obras.filter((o: any) =>
    (clienteId === "all" || o.cliente_id === clienteId) && (obraId === "all" || o.id === obraId),
  );
  const obraIds = new Set(obrasFiltradas.map((o: any) => o.id));
  const receb = data.receb.filter((r: any) => obraIds.has(r.obra_id));
  const nfs = data.nfs.filter((n: any) => obraIds.has(n.obra_id));

  const meses = Array.from({ length: mesesQtd }, (_, i) => addMonths(parseISO(inicio), i));
  const chart = meses.map((m) => {
    const k = format(m, "yyyy-MM");
    const previsto = receb.filter((r: any) => r.data_prevista?.startsWith(k) && !r.data_recebimento).reduce((a: number, r: any) => a + Number(r.valor_previsto), 0);
    const recebido = receb.filter((r: any) => r.data_recebimento?.startsWith(k)).reduce((a: number, r: any) => a + Number(r.valor_recebido || r.valor_previsto), 0);
    const faturado = nfs.filter((n: any) => n.data_emissao?.startsWith(k)).reduce((a: number, n: any) => a + Number(n.valor), 0);
    return { mes: format(m, "MMM/yy", { locale: ptBR }), key: k, previsto, recebido, faturado };
  });

  // KPIs janelas
  const hoje = new Date();
  const j30 = receb.filter((r: any) => !r.data_recebimento && parseISO(r.data_prevista) <= addDays(hoje, 30)).reduce((a: number, r: any) => a + Number(r.valor_previsto), 0);
  const j60 = receb.filter((r: any) => !r.data_recebimento && parseISO(r.data_prevista) <= addDays(hoje, 60)).reduce((a: number, r: any) => a + Number(r.valor_previsto), 0);
  const j90 = receb.filter((r: any) => !r.data_recebimento && parseISO(r.data_prevista) <= addDays(hoje, 90)).reduce((a: number, r: any) => a + Number(r.valor_previsto), 0);
  const atrasado = receb.filter((r: any) => !r.data_recebimento && parseISO(r.data_prevista) < hoje).reduce((a: number, r: any) => a + Number(r.valor_previsto), 0);

  // Pivot por obra × mês (valor previsto)
  const pivot = obrasFiltradas.map((o: any) => {
    const cols = meses.map((m) => {
      const k = format(m, "yyyy-MM");
      const prev = receb.filter((r: any) => r.obra_id === o.id && r.data_prevista?.startsWith(k) && !r.data_recebimento).reduce((a: number, r: any) => a + Number(r.valor_previsto), 0);
      const rec = receb.filter((r: any) => r.obra_id === o.id && r.data_recebimento?.startsWith(k)).reduce((a: number, r: any) => a + Number(r.valor_recebido || r.valor_previsto), 0);
      return { k, prev, rec };
    });
    const total = cols.reduce((a, c) => a + c.prev + c.rec, 0);
    return { obra: o, cols, total };
  });

  const totalGeral = pivot.reduce((a: number, p: any) => a + p.total, 0);

  function exportCsv() {
    const head = ["Obra", ...meses.map((m) => format(m, "MMM/yy", { locale: ptBR })), "Total"].join(";");
    const rows = pivot.map((p: any) => [
      `${p.obra.codigo} ${p.obra.nome}`,
      ...p.cols.map((c: any) => (c.prev + c.rec).toFixed(2).replace(".", ",")),
      p.total.toFixed(2).replace(".", ","),
    ].join(";"));
    const csv = [head, ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `fluxo_${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Fluxo de Caixa</h1>
          <p className="text-sm text-muted-foreground">Faturamento × recebimentos previstos × realizados.</p>
        </div>
        <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-2" />Exportar CSV</Button>
      </header>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base flex items-center gap-2"><Filter className="h-4 w-4" />Filtros</CardTitle></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <div className="space-y-1.5"><Label>Cliente</Label>
            <Select value={clienteId} onValueChange={(v) => { setClienteId(v); setObraId("all"); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {data.clientes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Obra</Label>
            <Select value={obraId} onValueChange={setObraId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {data.obras.filter((o: any) => clienteId === "all" || o.cliente_id === clienteId).map((o: any) => (
                  <SelectItem key={o.id} value={o.id}>{o.codigo} · {o.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Início</Label>
            <Input type="month" value={inicio.slice(0, 7)} onChange={(e) => setInicio(e.target.value + "-01")} />
          </div>
          <div className="space-y-1.5"><Label>Meses</Label>
            <Select value={String(mesesQtd)} onValueChange={(v) => setMesesQtd(Number(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {[3, 6, 12, 18, 24].map((n) => <SelectItem key={n} value={String(n)}>{n} meses</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-4">
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">A receber 30 dias</div><div className="text-lg font-semibold mt-1">{brl(j30)}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">A receber 60 dias</div><div className="text-lg font-semibold mt-1">{brl(j60)}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">A receber 90 dias</div><div className="text-lg font-semibold mt-1">{brl(j90)}</div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="text-xs text-muted-foreground">Atrasado</div><div className="text-lg font-semibold mt-1 text-destructive">{brl(atrasado)}</div></CardContent></Card>
      </div>

      <Tabs defaultValue="grafico">
        <TabsList>
          <TabsTrigger value="grafico">Gráfico mensal</TabsTrigger>
          <TabsTrigger value="pivot">Pivot por obra</TabsTrigger>
          <TabsTrigger value="lista">Próximos recebimentos</TabsTrigger>
        </TabsList>

        <TabsContent value="grafico">
          <Card>
            <CardHeader><CardTitle>Faturamento × Recebimentos</CardTitle></CardHeader>
            <CardContent>
              <div className="h-80 w-full">
                <ResponsiveContainer>
                  <BarChart data={chart}>
                    <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => (v / 1000).toFixed(0) + "k"} />
                    <Tooltip formatter={(v: any) => brl(v)} />
                    <Legend />
                    <Bar dataKey="faturado" fill="hsl(var(--primary))" name="Faturado (NFs)" />
                    <Bar dataKey="previsto" fill="hsl(var(--muted-foreground))" name="A receber" />
                    <Bar dataKey="recebido" fill="hsl(142 71% 45%)" name="Recebido" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pivot">
          <Card>
            <CardHeader><CardTitle>Recebimentos por obra × mês</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-background z-10">Obra</TableHead>
                    {meses.map((m) => <TableHead key={m.toISOString()} className="text-right whitespace-nowrap">{format(m, "MMM/yy", { locale: ptBR })}</TableHead>)}
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pivot.map((p: any) => (
                    <TableRow key={p.obra.id}>
                      <TableCell className="sticky left-0 bg-background z-10 font-medium text-sm">
                        <Link to="/obras/$id" params={{ id: p.obra.id }} className="hover:underline">{p.obra.codigo} · {p.obra.nome}</Link>
                      </TableCell>
                      {p.cols.map((c: any) => {
                        const v = c.prev + c.rec;
                        return <TableCell key={c.k} className="text-right text-sm whitespace-nowrap">
                          {v === 0 ? <span className="text-muted-foreground/50">—</span> : (
                            <span className={c.rec > 0 ? "text-green-600 dark:text-green-400" : ""}>{brl(v)}</span>
                          )}
                        </TableCell>;
                      })}
                      <TableCell className="text-right font-semibold">{brl(p.total)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-semibold bg-muted/30">
                    <TableCell className="sticky left-0 bg-muted/30 z-10">Total</TableCell>
                    {meses.map((m) => {
                      const k = format(m, "yyyy-MM");
                      const v = pivot.reduce((a: number, p: any) => {
                        const c = p.cols.find((x: any) => x.k === k);
                        return a + (c ? c.prev + c.rec : 0);
                      }, 0);
                      return <TableCell key={k} className="text-right whitespace-nowrap">{v === 0 ? "—" : brl(v)}</TableCell>;
                    })}
                    <TableCell className="text-right">{brl(totalGeral)}</TableCell>
                  </TableRow>
                  {pivot.length === 0 && <TableRow><TableCell colSpan={meses.length + 2} className="text-center text-muted-foreground py-8">Sem obras no filtro</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="lista">
          <Card>
            <CardHeader><CardTitle>Próximos recebimentos</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Data prevista</TableHead><TableHead>Obra</TableHead><TableHead>Origem</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>
                  {receb
                    .filter((r: any) => !r.data_recebimento)
                    .sort((a: any, b: any) => a.data_prevista.localeCompare(b.data_prevista))
                    .slice(0, 50)
                    .map((r: any) => {
                      const atras = parseISO(r.data_prevista) < hoje;
                      return (
                        <TableRow key={r.id}>
                          <TableCell className={atras ? "text-destructive font-medium" : ""}>{format(parseISO(r.data_prevista), "dd/MM/yy")}</TableCell>
                          <TableCell><Link to="/obras/$id" params={{ id: r.obra_id }} className="hover:underline">{r.obras?.codigo} · {r.obras?.nome}</Link></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{r.origem ?? "manual"}</TableCell>
                          <TableCell className="text-right">{brl(r.valor_previsto)}</TableCell>
                          <TableCell><Badge variant={atras ? "destructive" : "secondary"}>{atras ? "atrasado" : r.status}</Badge></TableCell>
                        </TableRow>
                      );
                    })}
                  {receb.filter((r: any) => !r.data_recebimento).length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhum recebimento previsto</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
