// Utilidades para o motor de previsão de faturamento.
import { addDays, isAfter } from "date-fns";

export type ParcelaPrevisao = {
  id?: string;
  data_medicao: Date;
  valor_previsto: number;
  valor_realizado?: number | null;
  congelada?: boolean;
};

/**
 * Redistribui o saldo restante (valor_contrato - já realizado/congelado)
 * proporcionalmente entre as parcelas futuras (não congeladas e sem realizado).
 */
export function redistribuirSaldo(
  valorContrato: number,
  parcelas: ParcelaPrevisao[],
): ParcelaPrevisao[] {
  const consumido = parcelas.reduce((acc, p) => {
    if (p.valor_realizado != null) return acc + Number(p.valor_realizado);
    if (p.congelada) return acc + Number(p.valor_previsto);
    return acc;
  }, 0);

  const restantes = parcelas.filter((p) => p.valor_realizado == null && !p.congelada);
  const totalPrevistoRestante = restantes.reduce(
    (acc, p) => acc + Number(p.valor_previsto || 0),
    0,
  );
  const saldo = valorContrato - consumido;

  return parcelas.map((p) => {
    if (p.valor_realizado != null || p.congelada) return p;
    if (totalPrevistoRestante <= 0) return { ...p, valor_previsto: 0 };
    const proporcao = Number(p.valor_previsto || 0) / totalPrevistoRestante;
    return { ...p, valor_previsto: Math.max(0, saldo * proporcao) };
  });
}

/**
 * Calcula data de vencimento considerando DDL + dia fixo de pagamento do cliente.
 * Ex.: emissão 03/05, 30 DDL, dia fixo 15 → 02/06 → próximo dia 15 = 15/06.
 * Quando o dia fixo não existe no mês (ex.: 31/fev), cai para o último dia do mês.
 */
export function calcularVencimento(
  dataEmissao: Date,
  prazoDDL: number,
  diaFixo?: number | null,
): Date {
  const base = addDays(dataEmissao, prazoDDL);
  if (!diaFixo) return base;
  const d = new Date(base);
  if (d.getDate() > diaFixo) {
    d.setMonth(d.getMonth() + 1);
  }
  // Aplica clamp: usa min(diaFixo, ultimoDiaDoMes) para evitar overflow (31/fev → mar).
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(diaFixo, lastDay));
  return d;
}

export function brl(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function pct(n: number | string | null | undefined, frac = 2): string {
  return `${Number(n ?? 0).toFixed(frac)}%`;
}

export function statusRecebimento(
  dataPrevista: Date,
  dataRecebimento?: Date | null,
): "pago" | "atrasado" | "a_receber" {
  if (dataRecebimento) return "pago";
  if (isAfter(new Date(), dataPrevista)) return "atrasado";
  return "a_receber";
}
