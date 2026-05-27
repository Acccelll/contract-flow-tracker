import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { ChevronDown, History } from "lucide-react";
import { format, parseISO } from "date-fns";

const ENTIDADES = ["todas", "medicoes", "itens_medicao", "notas_fiscais", "recebimentos", "cronograma_baselines", "aditivos_contrato"];
const ACAO_COLORS: Record<string, any> = {
  insert: "default",
  update: "secondary",
  delete: "destructive",
};

export function HistoricoTab({ obraId }: { obraId: string }) {
  const [filtro, setFiltro] = useState("todas");

  const { data: logs } = useQuery({
    queryKey: ["audit_logs", obraId, filtro],
    queryFn: async () => {
      let q = supabase.from("audit_logs").select("*").eq("obra_id", obraId).order("created_at", { ascending: false }).limit(200);
      if (filtro !== "todas") q = q.eq("entidade", filtro);
      return (await q).data ?? [];
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground flex items-center gap-2">
          <History className="h-4 w-4" /> Últimas 200 alterações
        </div>
        <Select value={filtro} onValueChange={setFiltro}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            {ENTIDADES.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="pt-6">
          {!logs?.length ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Sem registros.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quando</TableHead>
                  <TableHead>Entidade</TableHead>
                  <TableHead>Ação</TableHead>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Detalhes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs whitespace-nowrap">{format(parseISO(l.created_at), "dd/MM/yy HH:mm:ss")}</TableCell>
                    <TableCell className="text-xs">{l.entidade}</TableCell>
                    <TableCell><Badge variant={ACAO_COLORS[l.acao]}>{l.acao}</Badge></TableCell>
                    <TableCell className="text-xs font-mono">{l.user_id ? l.user_id.slice(0, 8) : "—"}</TableCell>
                    <TableCell>
                      <Collapsible>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 text-xs">
                            <ChevronDown className="h-3 w-3 mr-1" /> ver diff
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <pre className="text-[10px] bg-muted/40 p-2 rounded mt-2 overflow-auto max-w-2xl max-h-64">
{JSON.stringify({ before: l.before, after: l.after }, null, 2)}
                          </pre>
                        </CollapsibleContent>
                      </Collapsible>
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
