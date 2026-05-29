-- 1) Obras: status + previsão término + percentuais tributários por obra
CREATE TYPE public.obra_status AS ENUM ('planejada','em_andamento','paralisada','concluida','cancelada');

ALTER TABLE public.obras
  ADD COLUMN status public.obra_status NOT NULL DEFAULT 'em_andamento',
  ADD COLUMN data_previsao_termino date,
  ADD COLUMN percentual_material numeric NOT NULL DEFAULT 70,
  ADD COLUMN aliquota_iss numeric NOT NULL DEFAULT 5,
  ADD COLUMN aliquota_inss numeric NOT NULL DEFAULT 11,
  ADD COLUMN aliquota_cbs numeric NOT NULL DEFAULT 0,
  ADD COLUMN aliquota_ibs numeric NOT NULL DEFAULT 0;

-- 2) Notas fiscais: campos tributários complementares
ALTER TABLE public.notas_fiscais
  ADD COLUMN percentual_material numeric,
  ADD COLUMN valor_material numeric,
  ADD COLUMN retencao_cbs numeric NOT NULL DEFAULT 0,
  ADD COLUMN retencao_ibs numeric NOT NULL DEFAULT 0,
  ADD COLUMN codigo_cno text,
  ADD COLUMN codigo_art text;

-- 3) Medicoes: link com import BMS (sheet name + arquivo)
ALTER TABLE public.medicoes
  ADD COLUMN arquivo_origem text,
  ADD COLUMN sheet_origem text;

-- Unicidade do número da medição por obra (para upsert do importador BMS)
CREATE UNIQUE INDEX IF NOT EXISTS medicoes_obra_numero_uniq
  ON public.medicoes (obra_id, numero);

-- 4) Itens de medicao: amarração ao item do BMS (índice da linha) para reimportação
ALTER TABLE public.itens_medicao
  ADD COLUMN bms_item_codigo text,
  ADD COLUMN bms_descricao text;