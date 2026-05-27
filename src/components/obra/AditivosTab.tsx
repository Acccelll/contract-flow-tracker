import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, FileSignature } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { brl } from "@/lib/billing";
import { format, parseISO } from "date-fns";

const TIPOS = ["acrescimo", "supressao", "reajuste", "prazo", "misto"] as const;
const STATUS_COLORS: Record<string, string> = {
  rascunho: "secondary",
  aprovado: "default",
  cancelado: "destructive",
};

export function AditivosTab({ obraId }: { obraId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<any>({ tipo: "acrescimo", valor_financeiro: 0, dias_prazo: 0, status: "rascunho" });

  const { data: aditivos } = useQuery({
    queryKey: ["aditivos", obraId],
    queryFn: async () =>
      (await supabase.from("aditivos_contrato").select("*").eq("obra_id", obraId).order("numero")).data ?? [],
  });

  async function salvar() {
    if (!f.numero?.toString().trim()) return toast.error("Informe o número do aditivo");
    const payload = {
      obra_id: obraId,
      numero: String(f.numero).trim(),
      tipo: f.tipo,
      valor_financeiro: Number(f.valor_financeiro || 0),
      dias_prazo: Number(f.dias_prazo || 0),
      data_aprovacao: f.data_aprovacao || null,
      documento_url: f.documento_url || null,
      observacoes: f.observacoes || null,
      status: f.status,
    };
    const { error } = await supabase.from("aditivos_contrato").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Aditivo criado");
    setOpen(false);
    setF({ tipo: "acrescimo", valor_financeiro: 0, dias_prazo: 0, status: "rascunho" });
    qc.invalidateQueries({ queryKey: ["aditivos", obraId] });
    qc.invalidateQueries({ queryKey: ["obra_valores", obraId] });
  }

  async function alterarStatus(id: string, novoStatus: string, versao: number) {
    const { error } = await supabase
      .from("aditivos_contrato")
      .update({ status: novoStatus, data_aprovacao: novoStatus === "aprovado" ? new Date().toISOString().slice(0, 10) : null })
      .eq("id", id)
      .eq("versao_otimista", versao);
    if (error) return toast.error(error.message);
    toast.success("Status atualizado");
    qc.invalidateQueries({ queryKey: ["aditivos", obraId] });
    qc.invalidateQueries({ queryKey: ["obra_valores", obraId] });
  }

  const totalAprovado = (aditivos ?? [])
    .filter((a) => a.status === "aprovado")
    .reduce((s, a) => s + Number(a.valor_financeiro || 0), 0);
  const diasAprovados = (aditivos ?? [])
    .filter((a) => a.status === "aprovado")
    .reduce((s, a) => s + Number(a.dias_prazo || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-6 text-sm">
          <div>
            <div className="text-xs text-muted-foreground uppercase">Aditivos aprovados</div>
            <div className="font-semibold">{brl(totalAprovado)}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground uppercase">Dias adicionais</div>
            <div className="font-semibold">{diasAprovados}d</div>
          </div>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" />Novo aditivo</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo aditivo contratual</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Número</Label>
                  <Input value={f.numero ?? ""} onChange={(e) => setF({ ...f, numero: e.target.value })} placeholder="01" />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={f.tipo} onValueChange={(v) => setF({ ...f, tipo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Valor financeiro (R$)</Label>
                  <Input type="number" step="0.01" value={f.valor_financeiro} onChange={(e) => setF({ ...f, valor_financeiro: e.target.value })} />
                  <p className="text-xs text-muted-foreground mt-1">Use negativo para supressão</p>
                </div>
                <div>
                  <Label>Dias de prazo</Label>
                  <Input type="number" value={f.dias_prazo} onChange={(e) => setF({ ...f, dias_prazo: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Data de aprovação</Label>
                  <Input type="date" value={f.data_aprovacao ?? ""} onChange={(e) => setF({ ...f, data_aprovacao: e.target.value })} />
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rascunho">Rascunho</SelectItem>
                      <SelectItem value="aprovado">Aprovado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>URL do documento</Label>
                <Input value={f.documento_url ?? ""} onChange={(e) => setF({ ...f, documento_url: e.target.value })} placeholder="https://..." />
              </div>
              <div>
                <Label>Observações</Label>
                <Textarea value={f.observacoes ?? ""} onChange={(e) => setF({ ...f, observacoes: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button onClick={salvar}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="pt-6">
          {!aditivos?.length ? (
            <div className="text-sm text-muted-foreground py-8 text-center flex flex-col items-center gap-2">
              <FileSignature className="h-8 w-8 opacity-50" />
              Nenhum aditivo cadastrado.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">Prazo</TableHead>
                  <TableHead>Aprovação</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {aditivos.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.numero}</TableCell>
                    <TableCell className="capitalize">{a.tipo}</TableCell>
                    <TableCell className="text-right">{brl(a.valor_financeiro)}</TableCell>
                    <TableCell className="text-right">{a.dias_prazo}d</TableCell>
                    <TableCell>{a.data_aprovacao ? format(parseISO(a.data_aprovacao), "dd/MM/yy") : "—"}</TableCell>
                    <TableCell><Badge variant={STATUS_COLORS[a.status] as any}>{a.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      {a.status === "rascunho" && (
                        <Button size="sm" variant="outline" onClick={() => alterarStatus(a.id, "aprovado", a.versao_otimista)}>Aprovar</Button>
                      )}
                      {a.status !== "cancelado" && (
                        <Button size="sm" variant="ghost" onClick={() => alterarStatus(a.id, "cancelado", a.versao_otimista)}>Cancelar</Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
