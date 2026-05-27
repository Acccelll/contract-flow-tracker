export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          acao: string
          after: Json | null
          before: Json | null
          created_at: string
          entidade: string
          entidade_id: string
          id: string
          obra_id: string | null
          user_id: string | null
        }
        Insert: {
          acao: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          entidade: string
          entidade_id: string
          id?: string
          obra_id?: string | null
          user_id?: string | null
        }
        Update: {
          acao?: string
          after?: Json | null
          before?: Json | null
          created_at?: string
          entidade?: string
          entidade_id?: string
          id?: string
          obra_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      clientes: {
        Row: {
          cnpj: string | null
          created_at: string
          dia_fixo_pagamento: number | null
          id: string
          nome: string
          observacoes: string | null
          owner_id: string
          prazo_pagamento_dias: number | null
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          dia_fixo_pagamento?: number | null
          id?: string
          nome: string
          observacoes?: string | null
          owner_id: string
          prazo_pagamento_dias?: number | null
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          dia_fixo_pagamento?: number | null
          id?: string
          nome?: string
          observacoes?: string | null
          owner_id?: string
          prazo_pagamento_dias?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      cronograma_baselines: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          motivo: string
          obra_id: string
          observacoes: string | null
          versao: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          motivo: string
          obra_id: string
          observacoes?: string | null
          versao: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          motivo?: string
          obra_id?: string
          observacoes?: string | null
          versao?: number
        }
        Relationships: []
      }
      cronograma_item_baseline: {
        Row: {
          baseline_id: string
          created_at: string
          cronograma_item_id: string
          custo: number
          data_fim: string | null
          data_inicio: string | null
          descricao: string | null
          id: string
          percentual_previsto: number
          uid_mpp: string | null
        }
        Insert: {
          baseline_id: string
          created_at?: string
          cronograma_item_id: string
          custo?: number
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          id?: string
          percentual_previsto?: number
          uid_mpp?: string | null
        }
        Update: {
          baseline_id?: string
          created_at?: string
          cronograma_item_id?: string
          custo?: number
          data_fim?: string | null
          data_inicio?: string | null
          descricao?: string | null
          id?: string
          percentual_previsto?: number
          uid_mpp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cronograma_item_baseline_baseline_id_fkey"
            columns: ["baseline_id"]
            isOneToOne: false
            referencedRelation: "cronograma_baselines"
            referencedColumns: ["id"]
          },
        ]
      }
      cronograma_item_revisoes: {
        Row: {
          created_at: string
          cronograma_item_id: string
          custo_anterior: number | null
          custo_novo: number | null
          data_fim_anterior: string | null
          data_fim_novo: string | null
          data_inicio_anterior: string | null
          data_inicio_novo: string | null
          descricao_item: string | null
          id: string
          percentual_realizado_anterior: number | null
          percentual_realizado_novo: number | null
          revisao_id: string
          tipo_mudanca: string
        }
        Insert: {
          created_at?: string
          cronograma_item_id: string
          custo_anterior?: number | null
          custo_novo?: number | null
          data_fim_anterior?: string | null
          data_fim_novo?: string | null
          data_inicio_anterior?: string | null
          data_inicio_novo?: string | null
          descricao_item?: string | null
          id?: string
          percentual_realizado_anterior?: number | null
          percentual_realizado_novo?: number | null
          revisao_id: string
          tipo_mudanca: string
        }
        Update: {
          created_at?: string
          cronograma_item_id?: string
          custo_anterior?: number | null
          custo_novo?: number | null
          data_fim_anterior?: string | null
          data_fim_novo?: string | null
          data_inicio_anterior?: string | null
          data_inicio_novo?: string | null
          descricao_item?: string | null
          id?: string
          percentual_realizado_anterior?: number | null
          percentual_realizado_novo?: number | null
          revisao_id?: string
          tipo_mudanca?: string
        }
        Relationships: [
          {
            foreignKeyName: "cronograma_item_revisoes_revisao_id_fkey"
            columns: ["revisao_id"]
            isOneToOne: false
            referencedRelation: "cronograma_revisoes"
            referencedColumns: ["id"]
          },
        ]
      }
      cronograma_itens: {
        Row: {
          ativo: boolean
          created_at: string
          custo: number
          custo_baseline: number | null
          data_fim: string
          data_fim_baseline: string | null
          data_inicio: string
          data_inicio_baseline: string | null
          descricao: string | null
          id: string
          obra_id: string
          ordem: number
          percentual_previsto: number
          percentual_realizado: number
          uid_mpp: string | null
          versao_otimista: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          custo?: number
          custo_baseline?: number | null
          data_fim: string
          data_fim_baseline?: string | null
          data_inicio: string
          data_inicio_baseline?: string | null
          descricao?: string | null
          id?: string
          obra_id: string
          ordem?: number
          percentual_previsto?: number
          percentual_realizado?: number
          uid_mpp?: string | null
          versao_otimista?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          custo?: number
          custo_baseline?: number | null
          data_fim?: string
          data_fim_baseline?: string | null
          data_inicio?: string
          data_inicio_baseline?: string | null
          descricao?: string | null
          id?: string
          obra_id?: string
          ordem?: number
          percentual_previsto?: number
          percentual_realizado?: number
          uid_mpp?: string | null
          versao_otimista?: number
        }
        Relationships: [
          {
            foreignKeyName: "cronograma_itens_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      cronograma_revisoes: {
        Row: {
          arquivo_nome: string | null
          created_at: string
          data_corte: string
          id: string
          numero: number
          obra_id: string
          observacoes: string | null
          totais: Json
        }
        Insert: {
          arquivo_nome?: string | null
          created_at?: string
          data_corte: string
          id?: string
          numero: number
          obra_id: string
          observacoes?: string | null
          totais?: Json
        }
        Update: {
          arquivo_nome?: string | null
          created_at?: string
          data_corte?: string
          id?: string
          numero?: number
          obra_id?: string
          observacoes?: string | null
          totais?: Json
        }
        Relationships: []
      }
      itens_medicao: {
        Row: {
          created_at: string
          cronograma_item_id: string
          id: string
          medicao_id: string
          percentual_anterior: number
          percentual_atual: number
          valor_anterior: number
          valor_atual: number
        }
        Insert: {
          created_at?: string
          cronograma_item_id: string
          id?: string
          medicao_id: string
          percentual_anterior?: number
          percentual_atual?: number
          valor_anterior?: number
          valor_atual?: number
        }
        Update: {
          created_at?: string
          cronograma_item_id?: string
          id?: string
          medicao_id?: string
          percentual_anterior?: number
          percentual_atual?: number
          valor_anterior?: number
          valor_atual?: number
        }
        Relationships: [
          {
            foreignKeyName: "itens_medicao_cronograma_item_id_fkey"
            columns: ["cronograma_item_id"]
            isOneToOne: false
            referencedRelation: "cronograma_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itens_medicao_medicao_id_fkey"
            columns: ["medicao_id"]
            isOneToOne: false
            referencedRelation: "medicoes"
            referencedColumns: ["id"]
          },
        ]
      }
      medicoes: {
        Row: {
          baseline_id: string | null
          created_at: string
          data_aprovacao: string | null
          data_corte: string
          data_inicio: string | null
          id: string
          numero: string
          obra_id: string
          observacoes: string | null
          percentual: number | null
          status: Database["public"]["Enums"]["medicao_status"]
          updated_at: string
          valor: number
          versao_otimista: number
        }
        Insert: {
          baseline_id?: string | null
          created_at?: string
          data_aprovacao?: string | null
          data_corte: string
          data_inicio?: string | null
          id?: string
          numero: string
          obra_id: string
          observacoes?: string | null
          percentual?: number | null
          status?: Database["public"]["Enums"]["medicao_status"]
          updated_at?: string
          valor?: number
          versao_otimista?: number
        }
        Update: {
          baseline_id?: string | null
          created_at?: string
          data_aprovacao?: string | null
          data_corte?: string
          data_inicio?: string | null
          id?: string
          numero?: string
          obra_id?: string
          observacoes?: string | null
          percentual?: number | null
          status?: Database["public"]["Enums"]["medicao_status"]
          updated_at?: string
          valor?: number
          versao_otimista?: number
        }
        Relationships: [
          {
            foreignKeyName: "medicoes_baseline_id_fkey"
            columns: ["baseline_id"]
            isOneToOne: false
            referencedRelation: "cronograma_baselines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medicoes_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      notas_fiscais: {
        Row: {
          codigo_verificacao: string | null
          competencia: string | null
          created_at: string
          data_emissao: string | null
          data_vencimento: string | null
          id: string
          inss_retido: number
          iss_retido: number
          medicao_id: string | null
          numero: string | null
          obra_id: string
          observacoes: string | null
          outras_retencoes: number
          pdf_url: string | null
          status: Database["public"]["Enums"]["nf_status"]
          tomador_cnpj: string | null
          tomador_nome: string | null
          updated_at: string
          valor: number
          valor_liquido: number | null
          valor_servicos: number | null
          versao_otimista: number
        }
        Insert: {
          codigo_verificacao?: string | null
          competencia?: string | null
          created_at?: string
          data_emissao?: string | null
          data_vencimento?: string | null
          id?: string
          inss_retido?: number
          iss_retido?: number
          medicao_id?: string | null
          numero?: string | null
          obra_id: string
          observacoes?: string | null
          outras_retencoes?: number
          pdf_url?: string | null
          status?: Database["public"]["Enums"]["nf_status"]
          tomador_cnpj?: string | null
          tomador_nome?: string | null
          updated_at?: string
          valor?: number
          valor_liquido?: number | null
          valor_servicos?: number | null
          versao_otimista?: number
        }
        Update: {
          codigo_verificacao?: string | null
          competencia?: string | null
          created_at?: string
          data_emissao?: string | null
          data_vencimento?: string | null
          id?: string
          inss_retido?: number
          iss_retido?: number
          medicao_id?: string | null
          numero?: string | null
          obra_id?: string
          observacoes?: string | null
          outras_retencoes?: number
          pdf_url?: string | null
          status?: Database["public"]["Enums"]["nf_status"]
          tomador_cnpj?: string | null
          tomador_nome?: string | null
          updated_at?: string
          valor?: number
          valor_liquido?: number | null
          valor_servicos?: number | null
          versao_otimista?: number
        }
        Relationships: [
          {
            foreignKeyName: "notas_fiscais_medicao_id_fkey"
            columns: ["medicao_id"]
            isOneToOne: false
            referencedRelation: "medicoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notas_fiscais_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      obras: {
        Row: {
          cliente_id: string | null
          codigo: string
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          dia_fixo_pagamento: number | null
          id: string
          local: string | null
          nome: string
          observacoes: string | null
          owner_id: string
          pedido_contrato: string | null
          percentual_antecipacao: number | null
          prazo_emitir_nf_dias: number | null
          prazo_pagamento_dias: number | null
          regra_medicao: string | null
          updated_at: string
          valor_contrato: number
        }
        Insert: {
          cliente_id?: string | null
          codigo: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          dia_fixo_pagamento?: number | null
          id?: string
          local?: string | null
          nome: string
          observacoes?: string | null
          owner_id: string
          pedido_contrato?: string | null
          percentual_antecipacao?: number | null
          prazo_emitir_nf_dias?: number | null
          prazo_pagamento_dias?: number | null
          regra_medicao?: string | null
          updated_at?: string
          valor_contrato?: number
        }
        Update: {
          cliente_id?: string | null
          codigo?: string
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          dia_fixo_pagamento?: number | null
          id?: string
          local?: string | null
          nome?: string
          observacoes?: string | null
          owner_id?: string
          pedido_contrato?: string | null
          percentual_antecipacao?: number | null
          prazo_emitir_nf_dias?: number | null
          prazo_pagamento_dias?: number | null
          regra_medicao?: string | null
          updated_at?: string
          valor_contrato?: number
        }
        Relationships: [
          {
            foreignKeyName: "obras_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      recebimentos: {
        Row: {
          congelado: boolean
          created_at: string
          cronograma_item_id: string | null
          data_prevista: string
          data_recebimento: string | null
          id: string
          nota_fiscal_id: string | null
          obra_id: string
          observacoes: string | null
          origem: string
          status: Database["public"]["Enums"]["recebimento_status"]
          updated_at: string
          valor_previsto: number
          valor_previsto_inicial: number | null
          valor_recebido: number | null
          versao_otimista: number
        }
        Insert: {
          congelado?: boolean
          created_at?: string
          cronograma_item_id?: string | null
          data_prevista: string
          data_recebimento?: string | null
          id?: string
          nota_fiscal_id?: string | null
          obra_id: string
          observacoes?: string | null
          origem?: string
          status?: Database["public"]["Enums"]["recebimento_status"]
          updated_at?: string
          valor_previsto?: number
          valor_previsto_inicial?: number | null
          valor_recebido?: number | null
          versao_otimista?: number
        }
        Update: {
          congelado?: boolean
          created_at?: string
          cronograma_item_id?: string | null
          data_prevista?: string
          data_recebimento?: string | null
          id?: string
          nota_fiscal_id?: string | null
          obra_id?: string
          observacoes?: string | null
          origem?: string
          status?: Database["public"]["Enums"]["recebimento_status"]
          updated_at?: string
          valor_previsto?: number
          valor_previsto_inicial?: number | null
          valor_recebido?: number | null
          versao_otimista?: number
        }
        Relationships: [
          {
            foreignKeyName: "recebimentos_nota_fiscal_id_fkey"
            columns: ["nota_fiscal_id"]
            isOneToOne: false
            referencedRelation: "notas_fiscais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recebimentos_nota_fiscal_id_fkey"
            columns: ["nota_fiscal_id"]
            isOneToOne: false
            referencedRelation: "vw_nf_saldo"
            referencedColumns: ["nota_fiscal_id"]
          },
          {
            foreignKeyName: "recebimentos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      vw_nf_saldo: {
        Row: {
          nota_fiscal_id: string | null
          numero: string | null
          obra_id: string | null
          saldo_aberto: number | null
          total_recebido: number | null
          valor_liquido: number | null
        }
        Relationships: [
          {
            foreignKeyName: "notas_fiscais_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      medicao_status:
        | "rascunho"
        | "enviada"
        | "aprovada"
        | "rejeitada"
        | "em_revisao"
        | "faturada"
        | "cancelada"
      nf_status:
        | "rascunho"
        | "emitida"
        | "enviada"
        | "aprovada_cliente"
        | "recebida"
        | "cancelada"
      recebimento_status:
        | "previsto"
        | "a_receber"
        | "pago"
        | "atrasado"
        | "antecipado"
        | "parcial"
        | "recebido"
        | "inadimplente"
        | "cancelado"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      medicao_status: [
        "rascunho",
        "enviada",
        "aprovada",
        "rejeitada",
        "em_revisao",
        "faturada",
        "cancelada",
      ],
      nf_status: [
        "rascunho",
        "emitida",
        "enviada",
        "aprovada_cliente",
        "recebida",
        "cancelada",
      ],
      recebimento_status: [
        "previsto",
        "a_receber",
        "pago",
        "atrasado",
        "antecipado",
        "parcial",
        "recebido",
        "inadimplente",
        "cancelado",
      ],
    },
  },
} as const
