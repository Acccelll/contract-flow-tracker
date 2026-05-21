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
      cronograma_itens: {
        Row: {
          created_at: string
          custo: number
          data_fim: string
          data_inicio: string
          descricao: string | null
          id: string
          obra_id: string
          ordem: number
          percentual_previsto: number
        }
        Insert: {
          created_at?: string
          custo?: number
          data_fim: string
          data_inicio: string
          descricao?: string | null
          id?: string
          obra_id: string
          ordem?: number
          percentual_previsto?: number
        }
        Update: {
          created_at?: string
          custo?: number
          data_fim?: string
          data_inicio?: string
          descricao?: string | null
          id?: string
          obra_id?: string
          ordem?: number
          percentual_previsto?: number
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
      medicoes: {
        Row: {
          created_at: string
          data_aprovacao: string | null
          data_corte: string
          id: string
          numero: string
          obra_id: string
          observacoes: string | null
          percentual: number | null
          status: Database["public"]["Enums"]["medicao_status"]
          updated_at: string
          valor: number
        }
        Insert: {
          created_at?: string
          data_aprovacao?: string | null
          data_corte: string
          id?: string
          numero: string
          obra_id: string
          observacoes?: string | null
          percentual?: number | null
          status?: Database["public"]["Enums"]["medicao_status"]
          updated_at?: string
          valor?: number
        }
        Update: {
          created_at?: string
          data_aprovacao?: string | null
          data_corte?: string
          id?: string
          numero?: string
          obra_id?: string
          observacoes?: string | null
          percentual?: number | null
          status?: Database["public"]["Enums"]["medicao_status"]
          updated_at?: string
          valor?: number
        }
        Relationships: [
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
          created_at: string
          data_emissao: string | null
          data_vencimento: string | null
          id: string
          medicao_id: string | null
          numero: string | null
          obra_id: string
          observacoes: string | null
          pdf_url: string | null
          updated_at: string
          valor: number
        }
        Insert: {
          created_at?: string
          data_emissao?: string | null
          data_vencimento?: string | null
          id?: string
          medicao_id?: string | null
          numero?: string | null
          obra_id: string
          observacoes?: string | null
          pdf_url?: string | null
          updated_at?: string
          valor?: number
        }
        Update: {
          created_at?: string
          data_emissao?: string | null
          data_vencimento?: string | null
          id?: string
          medicao_id?: string | null
          numero?: string | null
          obra_id?: string
          observacoes?: string | null
          pdf_url?: string | null
          updated_at?: string
          valor?: number
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
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      medicao_status: "rascunho" | "enviada" | "aprovada" | "rejeitada"
      recebimento_status:
        | "previsto"
        | "a_receber"
        | "pago"
        | "atrasado"
        | "antecipado"
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
      medicao_status: ["rascunho", "enviada", "aprovada", "rejeitada"],
      recebimento_status: [
        "previsto",
        "a_receber",
        "pago",
        "atrasado",
        "antecipado",
      ],
    },
  },
} as const
