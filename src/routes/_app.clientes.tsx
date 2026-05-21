import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_app/clientes")({ component: ClientesPage });

function ClientesPage() {
  const qc = useQueryClient();
  const { data: clientes } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => (await supabase.from("clientes").select("*").order("nome")).data ?? [],
  });
  const [open, setOpen] = useState(false);
  const [f, setF] = useState<any>({});

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return toast.error("Sessão expirada");
    const { error } = await supabase.from("clientes").insert({
      owner_id: u.user.id,
      nome: f.nome,
      cnpj: f.cnpj || null,
      prazo_pagamento_dias: f.prazo_pagamento_dias ? Number(f.prazo_pagamento_dias) : null,
      dia_fixo_pagamento: f.dia_fixo_pagamento ? Number(f.dia_fixo_pagamento) : null,
      observacoes: f.observacoes || null,
    });
    if (error) return toast.error(error.message);
    toast.success("Cliente criado");
    setOpen(false); setF({});
    qc.invalidateQueries({ queryKey: ["clientes"] });
  }

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Clientes</h1>
          <p className="text-sm text-muted-foreground">Empresas contratantes e prazos padrão.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Novo cliente</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo cliente</DialogTitle></DialogHeader>
            <form onSubmit={save} className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5"><Label>Nome *</Label><Input required value={f.nome ?? ""} onChange={(e) => setF({ ...f, nome: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>CNPJ</Label><Input value={f.cnpj ?? ""} onChange={(e) => setF({ ...f, cnpj: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Prazo padrão (DDL)</Label><Input type="number" value={f.prazo_pagamento_dias ?? ""} onChange={(e) => setF({ ...f, prazo_pagamento_dias: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Dia fixo de pagamento</Label><Input type="number" min="1" max="31" value={f.dia_fixo_pagamento ?? ""} onChange={(e) => setF({ ...f, dia_fixo_pagamento: e.target.value })} /></div>
              <DialogFooter className="col-span-2"><Button type="submit">Salvar</Button></DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      <Card>
        <CardHeader><CardTitle>{clientes?.length ?? 0} clientes</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>CNPJ</TableHead><TableHead>Prazo</TableHead><TableHead>Dia fixo</TableHead></TableRow></TableHeader>
            <TableBody>
              {(clientes ?? []).map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.nome}</TableCell>
                  <TableCell>{c.cnpj ?? "—"}</TableCell>
                  <TableCell>{c.prazo_pagamento_dias ? `${c.prazo_pagamento_dias} DDL` : "—"}</TableCell>
                  <TableCell>{c.dia_fixo_pagamento ?? "—"}</TableCell>
                </TableRow>
              ))}
              {(clientes ?? []).length === 0 && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Sem clientes</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
