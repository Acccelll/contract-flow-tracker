
-- Onda 4.1: índices de performance
CREATE INDEX IF NOT EXISTS idx_crono_obra_ativo ON public.cronograma_itens(obra_id, ativo);
CREATE INDEX IF NOT EXISTS idx_crono_uid_mpp ON public.cronograma_itens(uid_mpp);
CREATE INDEX IF NOT EXISTS idx_crono_data_fim ON public.cronograma_itens(data_fim);
CREATE INDEX IF NOT EXISTS idx_itens_med_crono ON public.itens_medicao(cronograma_item_id);
CREATE INDEX IF NOT EXISTS idx_itens_med_medicao ON public.itens_medicao(medicao_id);
CREATE INDEX IF NOT EXISTS idx_receb_obra_data ON public.recebimentos(obra_id, data_prevista);
CREATE INDEX IF NOT EXISTS idx_audit_entidade ON public.audit_logs(entidade, entidade_id);
CREATE INDEX IF NOT EXISTS idx_medicoes_obra_status ON public.medicoes(obra_id, status);
CREATE INDEX IF NOT EXISTS idx_nfs_obra_status ON public.notas_fiscais(obra_id, status);
CREATE INDEX IF NOT EXISTS idx_aditivos_obra_status ON public.aditivos_contrato(obra_id, status);
