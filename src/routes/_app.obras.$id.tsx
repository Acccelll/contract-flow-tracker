import { useState } from "react";
import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Plus, CheckCircle2, FileText, Banknote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { brl, calcularVencimento, redistribuirSaldo } from "@/lib/billing";
import { addDays, format, parseISO } from "date-fns";

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
  const { data: nfs } = useQuery({
    queryKey: ["nfs", id],
    queryFn: async () => (await supabase.from("notas_fiscais").select("*").eq("obra_id", id).order("data_emissao", { ascending: true, nullsFirst: false })).data ?? [],
  });
  const { data: receb } = useQuery({
    queryKey: ["receb", id],
    queryFn: async () => (await supabase.from("recebimentos").select("*").eq("obra_id", id).order("data_prevista")).data ?? [],
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
        <div className="text-right">
          <div className="text-2xl font-semibold">{brl(obra.valor_contrato)}</div>
          <div className="text-xs text-muted-foreground">Valor do contrato</div>
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
        <TabsList>
          <TabsTrigger value="previsao">Previsão</TabsTrigger>
          <TabsTrigger value="cronograma">Cronograma</TabsTrigger>
          <TabsTrigger value="medicoes">Medições</TabsTrigger>
          <TabsTrigger value="nfs">Faturamento</TabsTrigger>
          <TabsTrigger value="recebimentos">Recebimentos</TabsTrigger>
        </TabsList>

        <TabsContent value="previsao"><PrevisaoTab obra={obra} crono={crono ?? []} receb={receb ?? []} nfs={nfs ?? []} onChange={() => qc.invalidateQueries({ queryKey: ["receb", id] })} /></TabsContent>
        <TabsContent value="cronograma"><CronogramaTab obra={obra} itens={crono ?? []} onChange={() => { qc.invalidateQueries({ queryKey: ["crono", id] }); qc.invalidateQueries({ queryKey: ["receb", id] }); }} /></TabsContent>
        <TabsContent value="medicoes"><MedicoesTab obra={obra} medicoes={medicoes ?? []} receb={receb ?? []} onChange={() => { qc.invalidateQueries({ queryKey: ["medicoes", id] }); qc.invalidateQueries({ queryKey: ["receb", id] }); }} /></TabsContent>
        <TabsContent value="nfs"><NfsTab obra={obra} nfs={nfs ?? []} medicoes={medicoes ?? []} onChange={() => { qc.invalidateQueries({ queryKey: ["nfs", id] }); qc.invalidateQueries({ queryKey: ["receb", id] }); }} /></TabsContent>
        <TabsContent value="recebimentos"><RecebTab receb={receb ?? []} onChange={() => qc.invalidateQueries({ queryKey: ["receb", id] })} /></TabsContent>
      </Tabs>

    </div>
  );
}

function CronogramaTab({ obra, itens, onChange }: { obra: any; itens: any[]; onChange: () => void }) {
  const obraId = obra.id;
  const valorContrato = Number(obra.valor_contrato);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<any>({});
  const total = itens.reduce((a, i) => a + Number(i.percentual_previsto || 0), 0);

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
    // remove previsões anteriores ainda sem NF e sem recebimento e não congeladas
    const { data: receb } = await supabase.from("recebimentos").select("id, nota_fiscal_id, data_recebimento, congelado").eq("obra_id", obraId);
    const apagar = (receb ?? []).filter((r: any) => !r.nota_fiscal_id && !r.data_recebimento && !r.congelado).map((r: any) => r.id);
    if (apagar.length) await supabase.from("recebimentos").delete().in("id", apagar);

    const prazoNF = Number(obra.prazo_emitir_nf_dias || 0);
    const pctAntec = Number(obra.percentual_antecipacao || 0);
    const linhas: any[] = [];

    // Antecipação (se houver) — recebida no início da obra
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

    // valor a distribuir nas janelas = contrato - antecipação
    const baseDist = valorContrato * (1 - pctAntec / 100);
    for (const i of itens) {
      const valor = (Number(i.percentual_previsto) / 100) * baseDist;
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
        observacoes: `Janela ${format(parseISO(i.data_inicio), "dd/MM/yy")}–${format(parseISO(i.data_fim), "dd/MM/yy")} · ${Number(i.percentual_previsto).toFixed(2)}%`,
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
        <CardTitle>Cronograma · {total.toFixed(2)}% planejado</CardTitle>
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
        <Table>
          <TableHeader><TableRow><TableHead>Período</TableHead><TableHead>Descrição</TableHead><TableHead>% previsto</TableHead><TableHead>Valor</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {itens.map((i) => (
              <TableRow key={i.id}>
                <TableCell>{format(parseISO(i.data_inicio), "dd/MM/yy")} – {format(parseISO(i.data_fim), "dd/MM/yy")}</TableCell>
                <TableCell>{i.descricao ?? "—"}</TableCell>
                <TableCell>{Number(i.percentual_previsto).toFixed(2)}%</TableCell>
                <TableCell>{brl((Number(i.percentual_previsto) / 100) * valorContrato)}</TableCell>
                <TableCell className="text-right"><Button variant="ghost" size="sm" onClick={() => remove(i.id)}>Remover</Button></TableCell>
              </TableRow>
            ))}
            {itens.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Cadastre as janelas do cronograma</TableCell></TableRow>}
          </TableBody>
        </Table>
        {total > 0 && Math.abs(total - 100) > 0.01 && (
          <p className="text-xs text-amber-600 mt-3">Atenção: soma do cronograma é {total.toFixed(2)}% (ideal 100%).</p>
        )}
      </CardContent>
    </Card>
  );
}


function MedicoesTab({ obra, medicoes, receb, onChange }: { obra: any; medicoes: any[]; receb: any[]; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<any>({});

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("medicoes").insert({
      obra_id: obra.id,
      numero: f.numero,
      data_corte: f.data_corte,
      valor: Number(f.valor || 0),
      percentual: f.percentual ? Number(f.percentual) : null,
      status: "rascunho",
    });
    if (error) return toast.error(error.message);
    toast.success("Medição criada");
    setOpen(false); setF({});
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
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-2" />Medição</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova medição</DialogTitle></DialogHeader>
            <form onSubmit={save} className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Número *</Label><Input required value={f.numero ?? ""} onChange={(e) => setF({ ...f, numero: e.target.value })} placeholder="1ª, 2ª, BMS 03…" /></div>
              <div className="space-y-1.5"><Label>Data de corte *</Label><Input type="date" required value={f.data_corte ?? ""} onChange={(e) => setF({ ...f, data_corte: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Valor (R$) *</Label><Input type="number" step="0.01" required value={f.valor ?? ""} onChange={(e) => setF({ ...f, valor: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>% acumulado</Label><Input type="number" step="0.01" value={f.percentual ?? ""} onChange={(e) => setF({ ...f, percentual: e.target.value })} /></div>
              <DialogFooter className="col-span-2"><Button type="submit">Salvar</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Nº</TableHead><TableHead>Corte</TableHead><TableHead>Valor</TableHead><TableHead>%</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {medicoes.map((m) => (
              <TableRow key={m.id}>
                <TableCell>{m.numero}</TableCell>
                <TableCell>{format(parseISO(m.data_corte), "dd/MM/yy")}</TableCell>
                <TableCell>{brl(m.valor)}</TableCell>
                <TableCell>{m.percentual ? `${Number(m.percentual).toFixed(2)}%` : "—"}</TableCell>
                <TableCell><StatusBadge status={m.status} /></TableCell>
                <TableCell className="text-right">
                  {m.status !== "aprovada" && <Button size="sm" variant="outline" onClick={() => aprovar(m)}><CheckCircle2 className="h-3 w-3 mr-1" />Aprovar</Button>}
                </TableCell>
              </TableRow>
            ))}
            {medicoes.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sem medições</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
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
    const { data: nf, error } = await supabase.from("notas_fiscais").insert({
      obra_id: obra.id,
      medicao_id: f.medicao_id || null,
      numero: f.numero || null,
      data_emissao: f.data_emissao || null,
      valor,
      data_vencimento: venc.toISOString().slice(0, 10),
    }).select().single();
    if (error || !nf) return toast.error(error?.message ?? "Erro");
    // criar recebimento previsto vinculado à NF
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

    // recalcular previsão: redistribuir saldo entre parcelas futuras sem NF
    await recalcularPrevisaoNF(obra.id, Number(obra.valor_contrato));
    toast.success(`NF salva · vencimento ${format(venc, "dd/MM/yyyy")} · previsão recalculada`);
    setOpen(false); setF({});
    onChange();
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
              <DialogFooter className="col-span-2"><Button type="submit">Salvar</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow><TableHead>Nº</TableHead><TableHead>Emissão</TableHead><TableHead>Valor</TableHead><TableHead>Vencimento</TableHead></TableRow></TableHeader>
          <TableBody>
            {nfs.map((n) => (
              <TableRow key={n.id}>
                <TableCell>{n.numero ?? "—"}</TableCell>
                <TableCell>{n.data_emissao ? format(parseISO(n.data_emissao), "dd/MM/yy") : "—"}</TableCell>
                <TableCell>{brl(n.valor)}</TableCell>
                <TableCell>{n.data_vencimento ? format(parseISO(n.data_vencimento), "dd/MM/yy") : "—"}</TableCell>
              </TableRow>
            ))}
            {nfs.length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Sem NFs</TableCell></TableRow>}
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

// Recalcula previsões futuras após emissão de NF.
// Saldo = valor do contrato - soma das NFs emitidas. Esse saldo é redistribuído
// proporcionalmente entre as parcelas previstas que ainda não têm NF vinculada
// nem recebimento confirmado.
async function recalcularPrevisaoNF(obraId: string, valorContrato: number) {
  const [{ data: nfs }, { data: receb }] = await Promise.all([
    supabase.from("notas_fiscais").select("valor").eq("obra_id", obraId),
    supabase.from("recebimentos").select("*").eq("obra_id", obraId),
  ]);
  const faturado = (nfs ?? []).reduce((a, n) => a + Number(n.valor || 0), 0);
  const futuras = (receb ?? []).filter((r) => !r.data_recebimento && !r.nota_fiscal_id);
  const totalFuturo = futuras.reduce((a, r) => a + Number(r.valor_previsto), 0);
  const saldo = Math.max(0, valorContrato - faturado);
  if (futuras.length === 0) return;
  if (totalFuturo === 0) {
    // distribuir saldo igualmente
    const v = saldo / futuras.length;
    await Promise.all(futuras.map((r) => supabase.from("recebimentos").update({ valor_previsto: v }).eq("id", r.id)));
    return;
  }
  await Promise.all(futuras.map((r) => {
    const prop = Number(r.valor_previsto) / totalFuturo;
    return supabase.from("recebimentos").update({ valor_previsto: saldo * prop }).eq("id", r.id);
  }));
}

