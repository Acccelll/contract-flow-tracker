
-- Enums
CREATE TYPE public.medicao_status AS ENUM ('rascunho','enviada','aprovada','rejeitada');
CREATE TYPE public.recebimento_status AS ENUM ('previsto','a_receber','pago','atrasado','antecipado');

-- Clientes
CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  cnpj TEXT,
  prazo_pagamento_dias INTEGER,
  dia_fixo_pagamento INTEGER,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Obras
CREATE TABLE public.obras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  codigo TEXT NOT NULL,
  nome TEXT NOT NULL,
  pedido_contrato TEXT,
  local TEXT,
  valor_contrato NUMERIC(14,2) NOT NULL DEFAULT 0,
  percentual_antecipacao NUMERIC(5,2) DEFAULT 0,
  data_inicio DATE,
  data_fim DATE,
  regra_medicao TEXT,
  prazo_emitir_nf_dias INTEGER,
  prazo_pagamento_dias INTEGER,
  dia_fixo_pagamento INTEGER,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.obras(owner_id);
CREATE INDEX ON public.obras(cliente_id);

-- Cronograma
CREATE TABLE public.cronograma_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL DEFAULT 0,
  descricao TEXT,
  data_inicio DATE NOT NULL,
  data_fim DATE NOT NULL,
  percentual_previsto NUMERIC(7,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.cronograma_itens(obra_id);

-- Medições
CREATE TABLE public.medicoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  numero TEXT NOT NULL,
  data_corte DATE NOT NULL,
  data_aprovacao DATE,
  valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  percentual NUMERIC(7,4),
  status public.medicao_status NOT NULL DEFAULT 'rascunho',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.medicoes(obra_id);

-- Notas Fiscais
CREATE TABLE public.notas_fiscais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  medicao_id UUID REFERENCES public.medicoes(id) ON DELETE SET NULL,
  numero TEXT,
  data_emissao DATE,
  valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  data_vencimento DATE,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.notas_fiscais(obra_id);
CREATE INDEX ON public.notas_fiscais(medicao_id);

-- Recebimentos
CREATE TABLE public.recebimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id UUID NOT NULL REFERENCES public.obras(id) ON DELETE CASCADE,
  nota_fiscal_id UUID REFERENCES public.notas_fiscais(id) ON DELETE SET NULL,
  data_prevista DATE NOT NULL,
  data_recebimento DATE,
  valor_previsto NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_recebido NUMERIC(14,2),
  status public.recebimento_status NOT NULL DEFAULT 'previsto',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON public.recebimentos(obra_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_clientes_updated BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_obras_updated BEFORE UPDATE ON public.obras FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_medicoes_updated BEFORE UPDATE ON public.medicoes FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_nfs_updated BEFORE UPDATE ON public.notas_fiscais FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_receb_updated BEFORE UPDATE ON public.recebimentos FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- RLS
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.obras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cronograma_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medicoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notas_fiscais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recebimentos ENABLE ROW LEVEL SECURITY;

-- Clientes & Obras: owner_id direto
CREATE POLICY "own clientes" ON public.clientes FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "own obras" ON public.obras FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

-- Filhos: através de obra
CREATE POLICY "own cronograma" ON public.cronograma_itens FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.obras o WHERE o.id = obra_id AND o.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.obras o WHERE o.id = obra_id AND o.owner_id = auth.uid()));
CREATE POLICY "own medicoes" ON public.medicoes FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.obras o WHERE o.id = obra_id AND o.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.obras o WHERE o.id = obra_id AND o.owner_id = auth.uid()));
CREATE POLICY "own nfs" ON public.notas_fiscais FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.obras o WHERE o.id = obra_id AND o.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.obras o WHERE o.id = obra_id AND o.owner_id = auth.uid()));
CREATE POLICY "own receb" ON public.recebimentos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.obras o WHERE o.id = obra_id AND o.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.obras o WHERE o.id = obra_id AND o.owner_id = auth.uid()));
