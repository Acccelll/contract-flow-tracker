import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { brl } from "@/lib/billing";
import { Wallet, HardHat, TrendingUp, AlertCircle } from "lucide-react";
import { format, addDays, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [obras, recebimentos, nfs] = await Promise.all([
        supabase.from("obras").select("id, codigo, nome, valor_contrato"),
        supabase.from("recebimentos").select("*"),
        supabase.from("notas_fiscais").select("*"),
      ]);
      return {
        obras: obras.data ?? [],
        recebimentos: recebimentos.data ?? [],
        nfs: nfs.data ?? [],
      };
    },
  });

  if (isLoading) return <div className="p-8 text-muted-foreground">Carregando…</div>;
  const obras = data?.obras ?? [];
  const recebimentos = data?.recebimentos ?? [];
  const nfs = data?.nfs ?? [];
  const hoje = new Date();
  const fim30 = addDays(hoje, 30);
  const fim60 = addDays(hoje, 60);
  const fim90 = addDays(hoje, 90);

  const totalCarteira = obras.reduce((a, o) => a + Number(o.valor_contrato || 0), 0);
  const aReceber = recebimentos
    .filter((r) => !r.data_recebimento)
    .reduce((a, r) => a + Number(r.valor_previsto || 0), 0);
  const range = (ate: Date) =>
    recebimentos
      .filter((r) => !r.data_recebimento && new Date(r.data_prevista) <= ate && new Date(r.data_prevista) >= hoje)
      .reduce((a, r) => a + Number(r.valor_previsto || 0), 0);
  const faturadoMes = nfs
    .filter((n) => n.data_emissao && new Date(n.data_emissao) >= startOfMonth(hoje) && new Date(n.data_emissao) <= endOfMonth(hoje))
    .reduce((a, n) => a + Number(n.valor || 0), 0);

  return (
    <div className="p-6 lg:p-8 space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Visão geral de carteira e recebimentos.</p>
      </header>

      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        <Kpi icon={HardHat} label="Carteira total" value={brl(totalCarteira)} hint={`${obras.length} obras`} />
        <Kpi icon={TrendingUp} label={`Faturado em ${format(hoje, "MMMM", { locale: ptBR })}`} value={brl(faturadoMes)} />
        <Kpi icon={Wallet} label="A receber" value={brl(aReceber)} />
        <Kpi icon={AlertCircle} label="Próximos 30d" value={brl(range(fim30))} hint={`60d: ${brl(range(fim60))} · 90d: ${brl(range(fim90))}`} />
      </div>

      <AlertasCard recebimentos={recebimentos} obras={obras} />

      <Card>
        <CardHeader><CardTitle>Obras</CardTitle></CardHeader>
        <CardContent>
          {obras.length === 0 ? (
            <div className="text-sm text-muted-foreground py-6 text-center">
              Nenhuma obra cadastrada. <Link to="/obras" className="text-primary underline">Cadastrar a primeira</Link>.
            </div>
          ) : (
            <div className="divide-y">
              {obras.map((o) => {
                const fat = nfs.filter((n) => n.obra_id === o.id).reduce((a, n) => a + Number(n.valor || 0), 0);
                const pct = o.valor_contrato ? (fat / Number(o.valor_contrato)) * 100 : 0;
                return (
                  <Link key={o.id} to="/obras/$id" params={{ id: o.id }} className="flex items-center justify-between py-3 hover:bg-accent/50 px-2 rounded-md">
                    <div>
                      <div className="font-medium">{o.nome}</div>
                      <div className="text-xs text-muted-foreground">Cód. {o.codigo}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm">{brl(fat)} / {brl(o.valor_contrato)}</div>
                      <div className="text-xs text-muted-foreground">{pct.toFixed(1)}% faturado</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="text-2xl font-semibold mt-2">{value}</div>
        {hint && <div className="text-xs text-muted-foreground mt-1">{hint}</div>}
      </CardContent>
    </Card>
  );
}

function AlertasCard({ recebimentos, obras }: { recebimentos: any[]; obras: any[] }) {
  const hoje = new Date();
  const em7 = addDays(hoje, 7);
  const obraMap = new Map(obras.map((o) => [o.id, o]));
  const pendentes = recebimentos.filter((r) => !r.data_recebimento);
  const atrasados = pendentes
    .filter((r) => new Date(r.data_prevista) < hoje)
    .sort((a, b) => a.data_prevista.localeCompare(b.data_prevista));
  const proximos = pendentes
    .filter((r) => new Date(r.data_prevista) >= hoje && new Date(r.data_prevista) <= em7)
    .sort((a, b) => a.data_prevista.localeCompare(b.data_prevista));

  if (atrasados.length === 0 && proximos.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertCircle className="h-4 w-4 text-amber-600" /> Alertas
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {atrasados.length > 0 && (
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-red-700 dark:text-red-300 mb-2">
              Atrasados ({atrasados.length})
            </div>
            <ul className="space-y-1 text-sm">
              {atrasados.slice(0, 5).map((r) => {
                const o = obraMap.get(r.obra_id);
                return (
                  <li key={r.id} className="flex items-center justify-between border-l-2 border-red-500 pl-3 py-1">
                    <Link to="/obras/$id" params={{ id: r.obra_id }} className="hover:underline">
                      {o?.codigo ?? "—"} · {o?.nome ?? "?"}
                    </Link>
                    <span className="text-red-700 dark:text-red-300">
                      {format(new Date(r.data_prevista), "dd/MM/yy")} · {brl(r.valor_previsto)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {proximos.length > 0 && (
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-300 mb-2">
              Próximos 7 dias ({proximos.length})
            </div>
            <ul className="space-y-1 text-sm">
              {proximos.slice(0, 5).map((r) => {
                const o = obraMap.get(r.obra_id);
                return (
                  <li key={r.id} className="flex items-center justify-between border-l-2 border-amber-500 pl-3 py-1">
                    <Link to="/obras/$id" params={{ id: r.obra_id }} className="hover:underline">
                      {o?.codigo ?? "—"} · {o?.nome ?? "?"}
                    </Link>
                    <span className="text-amber-700 dark:text-amber-300">
                      {format(new Date(r.data_prevista), "dd/MM/yy")} · {brl(r.valor_previsto)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
