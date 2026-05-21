import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { brl } from "@/lib/billing";
import { format, parseISO, addMonths, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

export const Route = createFileRoute("/_app/fluxo")({ component: FluxoPage });

function FluxoPage() {
  const { data } = useQuery({
    queryKey: ["fluxo"],
    queryFn: async () => {
      const [r, n, o] = await Promise.all([
        supabase.from("recebimentos").select("*, obras(codigo,nome)"),
        supabase.from("notas_fiscais").select("*, obras(codigo,nome)"),
        supabase.from("obras").select("id,codigo,nome"),
      ]);
      return { receb: r.data ?? [], nfs: n.data ?? [], obras: o.data ?? [] };
    },
  });

  if (!data) return <div className="p-8 text-muted-foreground">Carregando…</div>;

  // 12 meses a partir do mês atual − 2
  const inicio = startOfMonth(addMonths(new Date(), -2));
  const meses = Array.from({ length: 12 }, (_, i) => addMonths(inicio, i));

  const chart = meses.map((m) => {
    const key = format(m, "yyyy-MM");
    const previsto = data.receb.filter((r: any) => r.data_prevista?.startsWith(key) && !r.data_recebimento).reduce((a: number, r: any) => a + Number(r.valor_previsto), 0);
    const recebido = data.receb.filter((r: any) => r.data_recebimento?.startsWith(key)).reduce((a: number, r: any) => a + Number(r.valor_recebido || r.valor_previsto), 0);
    const faturado = data.nfs.filter((n: any) => n.data_emissao?.startsWith(key)).reduce((a: number, n: any) => a + Number(n.valor), 0);
    return { mes: format(m, "MMM/yy", { locale: ptBR }), previsto, recebido, faturado };
  });

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Fluxo de Caixa</h1>
        <p className="text-sm text-muted-foreground">Faturamento e recebimentos previstos × realizados.</p>
      </header>

      <Card>
        <CardHeader><CardTitle>12 meses</CardTitle></CardHeader>
        <CardContent>
          <div className="h-72 w-full">
            <ResponsiveContainer>
              <BarChart data={chart}>
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => (v / 1000).toFixed(0) + "k"} />
                <Tooltip formatter={(v: any) => brl(v)} />
                <Legend />
                <Bar dataKey="faturado" fill="#2d8a9e" name="Faturado" />
                <Bar dataKey="previsto" fill="#cbd5e1" name="A receber" />
                <Bar dataKey="recebido" fill="#16a34a" name="Recebido" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Próximos recebimentos</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Data</TableHead><TableHead>Obra</TableHead><TableHead>Valor</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.receb
                .filter((r: any) => !r.data_recebimento)
                .sort((a: any, b: any) => a.data_prevista.localeCompare(b.data_prevista))
                .slice(0, 30)
                .map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell>{format(parseISO(r.data_prevista), "dd/MM/yy")}</TableCell>
                    <TableCell>{r.obras?.codigo} · {r.obras?.nome}</TableCell>
                    <TableCell>{brl(r.valor_previsto)}</TableCell>
                    <TableCell>{r.status}</TableCell>
                  </TableRow>
                ))}
              {data.receb.filter((r: any) => !r.data_recebimento).length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhum recebimento previsto</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
