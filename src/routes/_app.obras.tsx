import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { brl } from "@/lib/billing";

export const Route = createFileRoute("/_app/obras")({ component: ObrasPage });

function ObrasPage() {
  const qc = useQueryClient();
  const { data: obras } = useQuery({
    queryKey: ["obras"],
    queryFn: async () => (await supabase.from("obras").select("*, clientes(nome)").order("codigo")).data ?? [],
  });
  const { data: clientes } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => (await supabase.from("clientes").select("*").order("nome")).data ?? [],
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({});

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return toast.error("Sessão expirada");
    const payload = {
      owner_id: u.user.id,
      cliente_id: form.cliente_id || null,
      codigo: form.codigo,
      nome: form.nome,
      pedido_contrato: form.pedido_contrato || null,
      local: form.local || null,
      valor_contrato: Number(form.valor_contrato || 0),
      percentual_antecipacao: Number(form.percentual_antecipacao || 0),
      data_inicio: form.data_inicio || null,
      data_fim: form.data_fim || null,
      regra_medicao: form.regra_medicao || null,
      prazo_emitir_nf_dias: form.prazo_emitir_nf_dias ? Number(form.prazo_emitir_nf_dias) : null,
      prazo_pagamento_dias: form.prazo_pagamento_dias ? Number(form.prazo_pagamento_dias) : null,
      dia_fixo_pagamento: form.dia_fixo_pagamento ? Number(form.dia_fixo_pagamento) : null,
      observacoes: form.observacoes || null,
    };
    const { error } = await supabase.from("obras").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Obra criada");
    setOpen(false);
    setForm({});
    qc.invalidateQueries({ queryKey: ["obras"] });
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Obras</h1>
          <p className="text-sm text-muted-foreground">Contratos em andamento e concluídos.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" />Nova obra</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Nova obra</DialogTitle></DialogHeader>
            <form onSubmit={save} className="grid grid-cols-2 gap-3">
              <F label="Código *"><Input required value={form.codigo ?? ""} onChange={(e) => setForm({ ...form, codigo: e.target.value })} /></F>
              <F label="Nome *"><Input required value={form.nome ?? ""} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></F>
              <F label="Cliente">
                <Select value={form.cliente_id ?? ""} onValueChange={(v) => setForm({ ...form, cliente_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {(clientes ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </F>
              <F label="Pedido/Contrato"><Input value={form.pedido_contrato ?? ""} onChange={(e) => setForm({ ...form, pedido_contrato: e.target.value })} /></F>
              <F label="Local"><Input value={form.local ?? ""} onChange={(e) => setForm({ ...form, local: e.target.value })} /></F>
              <F label="Valor do contrato (R$) *"><Input required type="number" step="0.01" value={form.valor_contrato ?? ""} onChange={(e) => setForm({ ...form, valor_contrato: e.target.value })} /></F>
              <F label="% Antecipação"><Input type="number" step="0.01" value={form.percentual_antecipacao ?? ""} onChange={(e) => setForm({ ...form, percentual_antecipacao: e.target.value })} /></F>
              <F label="Início"><Input type="date" value={form.data_inicio ?? ""} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} /></F>
              <F label="Fim"><Input type="date" value={form.data_fim ?? ""} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} /></F>
              <F label="Regra de medição"><Input placeholder="ex: Dia 15, Dias 15 e 30, Mensal" value={form.regra_medicao ?? ""} onChange={(e) => setForm({ ...form, regra_medicao: e.target.value })} /></F>
              <F label="Prazo emitir NF (dias)"><Input type="number" value={form.prazo_emitir_nf_dias ?? ""} onChange={(e) => setForm({ ...form, prazo_emitir_nf_dias: e.target.value })} /></F>
              <F label="Prazo pagamento (DDL)"><Input type="number" value={form.prazo_pagamento_dias ?? ""} onChange={(e) => setForm({ ...form, prazo_pagamento_dias: e.target.value })} /></F>
              <F label="Dia fixo pagto cliente"><Input type="number" min="1" max="31" value={form.dia_fixo_pagamento ?? ""} onChange={(e) => setForm({ ...form, dia_fixo_pagamento: e.target.value })} /></F>
              <div className="col-span-2"><F label="Observações"><Textarea value={form.observacoes ?? ""} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></F></div>
              <DialogFooter className="col-span-2"><Button type="submit">Salvar</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <Card>
        <CardHeader><CardTitle>{obras?.length ?? 0} obras</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Obra</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Fim</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(obras ?? []).map((o: any) => (
                <TableRow key={o.id} className="cursor-pointer" onClick={() => null}>
                  <TableCell>
                    <Link to="/obras/$id" params={{ id: o.id }} className="text-primary underline">{o.codigo}</Link>
                  </TableCell>
                  <TableCell>{o.nome}</TableCell>
                  <TableCell>{o.clientes?.nome ?? "—"}</TableCell>
                  <TableCell>{brl(o.valor_contrato)}</TableCell>
                  <TableCell>{o.data_inicio ?? "—"}</TableCell>
                  <TableCell>{o.data_fim ?? "—"}</TableCell>
                </TableRow>
              ))}
              {(obras ?? []).length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma obra cadastrada</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
