import { Badge } from "@/components/ui/badge";
import { differenceInCalendarDays, parseISO } from "date-fns";

export type ObraStatus = "planejada" | "em_andamento" | "paralisada" | "concluida" | "cancelada";

const LABELS: Record<ObraStatus, string> = {
  planejada: "Planejada",
  em_andamento: "Em andamento",
  paralisada: "Paralisada",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

const CLASSES: Record<ObraStatus, string> = {
  planejada: "bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-200",
  em_andamento: "bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200",
  paralisada: "bg-orange-100 text-orange-900 dark:bg-orange-900/30 dark:text-orange-200",
  concluida: "bg-green-100 text-green-900 dark:bg-green-900/30 dark:text-green-200",
  cancelada: "bg-muted text-muted-foreground",
};

export function isAtrasada(obra: { status?: string | null; data_previsao_termino?: string | null; data_fim?: string | null }) {
  if (obra.status && obra.status !== "em_andamento") return false;
  const dt = obra.data_previsao_termino ?? obra.data_fim;
  if (!dt) return false;
  try {
    return differenceInCalendarDays(parseISO(dt), new Date()) < 0;
  } catch {
    return false;
  }
}

export function StatusObraBadge({ obra }: { obra: { status?: string | null; data_previsao_termino?: string | null; data_fim?: string | null } }) {
  const s = (obra.status ?? "em_andamento") as ObraStatus;
  const atrasada = isAtrasada(obra);
  return (
    <span className="inline-flex gap-1.5 items-center">
      <Badge variant="secondary" className={CLASSES[s] ?? ""}>{LABELS[s] ?? s}</Badge>
      {atrasada && (
        <Badge variant="secondary" className="bg-red-100 text-red-900 dark:bg-red-900/30 dark:text-red-200">
          Atrasada
        </Badge>
      )}
    </span>
  );
}
