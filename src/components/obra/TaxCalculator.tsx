import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brl } from "@/lib/billing";

export type TaxValues = {
  percentual_material: number;
  valor_material: number;
  valor_servico: number;
  retencao_inss: number;
  retencao_iss: number;
  retencao_cbs: number;
  retencao_ibs: number;
  outras_retencoes: number;
  valor_liquido: number;
};

export function calcTaxes(
  valor: number,
  cfg: { percentual_material: number; aliquota_iss: number; aliquota_inss: number; aliquota_cbs: number; aliquota_ibs: number; outras_retencoes?: number },
): TaxValues {
  const pctMat = Math.max(0, Math.min(100, cfg.percentual_material)) / 100;
  const valor_material = valor * pctMat;
  const valor_servico = valor - valor_material;
  const retencao_inss = (valor_servico * cfg.aliquota_inss) / 100;
  const retencao_iss = (valor * cfg.aliquota_iss) / 100;
  const retencao_cbs = (valor * cfg.aliquota_cbs) / 100;
  const retencao_ibs = (valor * cfg.aliquota_ibs) / 100;
  const outras = cfg.outras_retencoes ?? 0;
  const valor_liquido = valor - retencao_inss - retencao_iss - retencao_cbs - retencao_ibs - outras;
  return {
    percentual_material: cfg.percentual_material,
    valor_material,
    valor_servico,
    retencao_inss,
    retencao_iss,
    retencao_cbs,
    retencao_ibs,
    outras_retencoes: outras,
    valor_liquido,
  };
}

export function TaxCalculator({
  valor,
  obra,
  values,
  onChange,
}: {
  valor: number;
  obra: { percentual_material?: number | null; aliquota_iss?: number | null; aliquota_inss?: number | null; aliquota_cbs?: number | null; aliquota_ibs?: number | null };
  values: { percentual_material?: number; aliquota_iss?: number; aliquota_inss?: number; aliquota_cbs?: number; aliquota_ibs?: number; outras_retencoes?: number };
  onChange: (v: typeof values) => void;
}) {
  const cfg = {
    percentual_material: Number(values.percentual_material ?? obra.percentual_material ?? 70),
    aliquota_iss: Number(values.aliquota_iss ?? obra.aliquota_iss ?? 5),
    aliquota_inss: Number(values.aliquota_inss ?? obra.aliquota_inss ?? 11),
    aliquota_cbs: Number(values.aliquota_cbs ?? obra.aliquota_cbs ?? 0),
    aliquota_ibs: Number(values.aliquota_ibs ?? obra.aliquota_ibs ?? 0),
    outras_retencoes: Number(values.outras_retencoes ?? 0),
  };

  const t = useMemo(() => calcTaxes(valor, cfg), [valor, cfg.percentual_material, cfg.aliquota_iss, cfg.aliquota_inss, cfg.aliquota_cbs, cfg.aliquota_ibs, cfg.outras_retencoes]);

  function patch(field: keyof typeof cfg, v: string) {
    onChange({ ...values, [field]: v === "" ? undefined : Number(v) });
  }

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-3">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Calculadora de tributos</div>

      <div className="grid grid-cols-5 gap-2">
        <Field label="% Material" v={cfg.percentual_material} onChange={(s) => patch("percentual_material", s)} />
        <Field label="ISS %" v={cfg.aliquota_iss} onChange={(s) => patch("aliquota_iss", s)} />
        <Field label="INSS %" v={cfg.aliquota_inss} onChange={(s) => patch("aliquota_inss", s)} />
        <Field label="CBS %" v={cfg.aliquota_cbs} onChange={(s) => patch("aliquota_cbs", s)} />
        <Field label="IBS %" v={cfg.aliquota_ibs} onChange={(s) => patch("aliquota_ibs", s)} />
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <Row label={`Material (${cfg.percentual_material}%)`} v={t.valor_material} />
        <Row label={`Serviço (${(100 - cfg.percentual_material).toFixed(0)}%)`} v={t.valor_servico} />
        <Row label={`INSS (${cfg.aliquota_inss}% s/ serviço)`} v={-t.retencao_inss} />
        <Row label={`ISS (${cfg.aliquota_iss}% s/ total)`} v={-t.retencao_iss} />
        {cfg.aliquota_cbs > 0 && <Row label={`CBS (${cfg.aliquota_cbs}%)`} v={-t.retencao_cbs} />}
        {cfg.aliquota_ibs > 0 && <Row label={`IBS (${cfg.aliquota_ibs}%)`} v={-t.retencao_ibs} />}
      </div>

      <div className="flex items-center gap-2 pt-2 border-t">
        <Label className="text-xs">Outras retenções</Label>
        <Input
          type="number"
          step="0.01"
          className="h-7 w-32"
          value={values.outras_retencoes ?? ""}
          onChange={(e) => patch("outras_retencoes", e.target.value)}
        />
      </div>

      <div className="flex items-center justify-between bg-background rounded-md px-3 py-2 border">
        <div className="text-sm text-muted-foreground">Líquido a receber</div>
        <div className="text-base font-semibold">{brl(t.valor_liquido)}</div>
      </div>
    </div>
  );
}

function Field({ label, v, onChange }: { label: string; v: number; onChange: (s: string) => void }) {
  return (
    <div className="space-y-1">
      <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</Label>
      <Input type="number" step="0.01" className="h-8" value={v} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Row({ label, v }: { label: string; v: number }) {
  return (
    <>
      <div className="text-muted-foreground">{label}</div>
      <div className={`text-right tabular-nums ${v < 0 ? "text-red-700 dark:text-red-300" : ""}`}>{brl(v)}</div>
    </>
  );
}
