// Parser de planilhas BMS (Boletim de Medição de Serviço).
// Cada sheet do workbook é uma medição (BMS 01, BMS 02, …).
// Estrutura observada (referência: BMS MARFRIG):
//   Linhas 1-6 = cabeçalho (contrato, obra, nº BMS, data, período)
//   Linhas 7-8 = títulos de colunas (duas linhas mescladas)
//   Linhas 9+  = itens; termina em "SUB TOTAL" e logo abaixo "Total Desta Medição"

export type BmsItem = {
  codigo: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  preco_unitario: number;
  valor_total: number;
  qtd_anterior: number;
  valor_anterior: number;
  qtd_mes: number;
  valor_mes: number;
  qtd_acumulado: number;
  valor_acumulado: number;
  saldo_qtd: number;
  saldo_valor: number;
  percentual_atual: number; // valor_acumulado / valor_total
  percentual_anterior: number; // valor_anterior / valor_total
};

export type BmsSheet = {
  sheetName: string;
  numero: string; // "BMS 01"
  data?: string; // YYYY-MM-DD
  data_inicio?: string;
  data_fim?: string;
  periodo_raw?: string;
  valor_contrato?: number;
  total_medicao: number;
  itens: BmsItem[];
};

export type BmsWorkbook = {
  arquivoNome: string;
  sheets: BmsSheet[];
};

function num(v: any): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return isFinite(v) ? v : 0;
  const s = String(v).replace(/\s/g, "").replace(/\./g, "").replace(",", ".").replace(/[^\d.\-]/g, "");
  const n = Number(s);
  return isFinite(n) ? n : 0;
}

function isoDate(v: any, XLSX: any): string | undefined {
  if (!v) return undefined;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return undefined;
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(v).trim();
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (br) {
    const y = br[3].length === 2 ? `20${br[3]}` : br[3];
    return `${y}-${br[2].padStart(2, "0")}-${br[1].padStart(2, "0")}`;
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  return undefined;
}

function parsePeriodo(s: string, XLSX: any): { ini?: string; fim?: string } {
  if (!s) return {};
  const m = s.match(/(\d{1,2}\/\d{1,2}\/\d{2,4})\s*(?:a|à|-)\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
  if (m) return { ini: isoDate(m[1], XLSX), fim: isoDate(m[2], XLSX) };
  return {};
}

function findInRow(row: any[], needle: string): number {
  const n = needle.toLowerCase();
  for (let i = 0; i < row.length; i++) {
    const c = String(row[i] ?? "").toLowerCase();
    if (c.includes(n)) return i;
  }
  return -1;
}

function valueRightOf(rows: any[][], rowIdx: number, col: number, maxOffset = 4): any {
  const row = rows[rowIdx] ?? [];
  for (let i = col + 1; i <= col + maxOffset && i < row.length; i++) {
    if (row[i] !== "" && row[i] != null) return row[i];
  }
  return undefined;
}

function parseSheet(name: string, rows: any[][], XLSX: any): BmsSheet | null {
  // Identifica linhas-chave por busca textual nas primeiras 12 linhas
  let numero = name;
  let dataIso: string | undefined;
  let periodoRaw: string | undefined;
  let valorContrato: number | undefined;
  let headerEnd = -1;

  for (let r = 0; r < Math.min(12, rows.length); r++) {
    const row = rows[r];
    const cNum = findInRow(row, "boletim de medição n");
    if (cNum >= 0) {
      const v = valueRightOf(rows, r, cNum);
      if (v) numero = String(v).trim();
    }
    const cData = findInRow(row, "data:");
    if (cData >= 0) {
      const v = valueRightOf(rows, r, cData);
      const d = isoDate(v, XLSX);
      if (d) dataIso = d;
    }
    const cPer = findInRow(row, "período:");
    if (cPer >= 0) {
      const v = valueRightOf(rows, r, cPer);
      if (v) periodoRaw = String(v).trim();
    }
    const cVal = findInRow(row, "valor total contrato");
    if (cVal >= 0) {
      const v = valueRightOf(rows, r, cVal);
      if (v != null && v !== "") valorContrato = num(v);
    }
    const cItem = findInRow(row, "ítem") >= 0 ? findInRow(row, "ítem") : findInRow(row, "item");
    if (cItem >= 0 && findInRow(row, "descrição") >= 0) {
      headerEnd = r + 1; // segunda linha do header (quant/valor)
    }
  }

  if (headerEnd < 0) return null;

  // Detecta colunas pelos cabeçalhos: usamos posições típicas observadas
  // A=0 (item), B=1 (descrição), D=3 (quant), E=4 (UM), F=5 (preço), G=6 (valor total)
  // H=7 qtd ant, I=8 valor ant, J=9 qtd mes, K=10 valor mes,
  // L=11 qtd acum, M=12 valor acum, N=13 saldo qtd, O=14 saldo valor
  const COL = {
    item: 0, desc: 1, qtd: 3, um: 4, preco: 5, total: 6,
    qa: 7, va: 8, qm: 9, vm: 10, qac: 11, vac: 12, sq: 13, sv: 14,
  };

  const itens: BmsItem[] = [];
  let totalMedicao = 0;

  for (let r = headerEnd + 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.length === 0) continue;
    const first = String(row[COL.item] ?? "").trim();
    const desc = String(row[COL.desc] ?? "").trim();
    const firstLower = first.toLowerCase();

    if (firstLower === "sub total" || firstLower === "subtotal") {
      continue;
    }
    if (findInRow(row, "total desta medição") >= 0) {
      const v = valueRightOf(rows, r, findInRow(row, "total desta medição"), 6);
      totalMedicao = num(v);
      continue;
    }
    if (firstLower.startsWith("observa") || firstLower.startsWith("histórico") || firstLower.startsWith("historico")) {
      break;
    }
    if (!desc) continue;
    if (first === "" && desc === "") continue;

    const valor_total = num(row[COL.total]);
    const valor_acumulado = num(row[COL.vac]);
    const valor_anterior = num(row[COL.va]);
    const pctAtual = valor_total !== 0 ? valor_acumulado / valor_total : 0;
    const pctAnt = valor_total !== 0 ? valor_anterior / valor_total : 0;

    itens.push({
      codigo: first,
      descricao: desc,
      quantidade: num(row[COL.qtd]),
      unidade: String(row[COL.um] ?? "").trim(),
      preco_unitario: num(row[COL.preco]),
      valor_total,
      qtd_anterior: num(row[COL.qa]),
      valor_anterior,
      qtd_mes: num(row[COL.qm]),
      valor_mes: num(row[COL.vm]),
      qtd_acumulado: num(row[COL.qac]),
      valor_acumulado,
      saldo_qtd: num(row[COL.sq]),
      saldo_valor: num(row[COL.sv]),
      percentual_atual: pctAtual * 100,
      percentual_anterior: pctAnt * 100,
    });
  }

  if (!totalMedicao) {
    totalMedicao = itens.reduce((a, i) => a + i.valor_mes, 0);
  }

  const per = parsePeriodo(periodoRaw ?? "", XLSX);

  return {
    sheetName: name,
    numero,
    data: dataIso,
    data_inicio: per.ini,
    data_fim: per.fim ?? dataIso,
    periodo_raw: periodoRaw,
    valor_contrato: valorContrato,
    total_medicao: totalMedicao,
    itens,
  };
}

export async function parseBmsWorkbook(file: File): Promise<BmsWorkbook> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  const sheets: BmsSheet[] = [];
  for (const name of wb.SheetNames) {
    const ws = wb.Sheets[name];
    const rows = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: "" });
    const parsed = parseSheet(name, rows, XLSX);
    if (parsed && parsed.itens.length > 0) sheets.push(parsed);
  }
  return { arquivoNome: file.name, sheets };
}
