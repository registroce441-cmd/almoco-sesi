/**
 * Tipos do banco. Escritos à mão para espelhar as migrations em supabase/migrations.
 * Quando quiser, regere com o CLI:  npx supabase gen types typescript --project-id SEU_ID
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      acesso_cozinha: {
        Row: { id: number; salt: string; codigo_hash: string; updated_at: string };
        Insert: { id?: number; salt: string; codigo_hash: string; updated_at?: string };
        Update: { id?: number; salt?: string; codigo_hash?: string; updated_at?: string };
        Relationships: [];
      };
      tentativas_cozinha: {
        Row: { id: number; criado_em: string };
        Insert: { id?: never; criado_em?: string };
        Update: { id?: never; criado_em?: string };
        Relationships: [];
      };
      admins: {
        Row: { user_id: string; created_at: string };
        Insert: { user_id: string; created_at?: string };
        Update: { user_id?: string; created_at?: string };
        Relationships: [];
      };
      cardapio: {
        Row: {
          id: string;
          data: string;
          prato: string;
          acompanhamento: string;
          sobremesa: string;
          tags: string[];
          foto_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          data: string;
          prato: string;
          acompanhamento?: string;
          sobremesa?: string;
          tags?: string[];
          foto_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          data?: string;
          prato?: string;
          acompanhamento?: string;
          sobremesa?: string;
          tags?: string[];
          foto_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      configuracoes: {
        Row: {
          id: number;
          prazo_limite: string;
          dias_bloqueados: string[];
          aviso_home: string | null;
          nome_unidade: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          prazo_limite?: string;
          dias_bloqueados?: string[];
          aviso_home?: string | null;
          nome_unidade?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          prazo_limite?: string;
          dias_bloqueados?: string[];
          aviso_home?: string | null;
          nome_unidade?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      grupos: {
        Row: { id: string; nome: string; created_at: string };
        Insert: { id?: string; nome: string; created_at?: string };
        Update: { id?: string; nome?: string; created_at?: string };
        Relationships: [];
      };
      marcacoes: {
        Row: {
          id: string;
          pessoa_id: string;
          data: string;
          vai_almocar: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          pessoa_id: string;
          data: string;
          vai_almocar: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          pessoa_id?: string;
          data?: string;
          vai_almocar?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "marcacoes_pessoa_id_fkey";
            columns: ["pessoa_id"];
            isOneToOne: false;
            referencedRelation: "pessoas";
            referencedColumns: ["id"];
          },
        ];
      };
      pessoas: {
        Row: {
          id: string;
          nome: string;
          nif: string;
          grupo_id: string;
          ativo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          nome: string;
          nif: string;
          grupo_id?: string;
          ativo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          nome?: string;
          nif?: string;
          grupo_id?: string;
          ativo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "pessoas_grupo_id_fkey";
            columns: ["grupo_id"];
            isOneToOne: false;
            referencedRelation: "grupos";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      buscar_pessoas: {
        Args: { p_termo: string };
        Returns: { id: string; nome: string; nif_mascarado: string; homonimo: boolean }[];
      };
      definir_codigo_cozinha: { Args: { p_codigo: string }; Returns: undefined };
      grupo_padrao: { Args: Record<PropertyKey, never>; Returns: string };
      hoje_sp: { Args: Record<PropertyKey, never>; Returns: string };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      lista_cozinha: { Args: { p_inicio: string; p_codigo?: string }; Returns: Json };
      marcacao_aberta: { Args: { p_data: string }; Returns: boolean };
      marcacoes_da_pessoa: {
        Args: { p_pessoa_id: string; p_inicio: string };
        Returns: { data: string; vai_almocar: boolean }[];
      };
      motivo_bloqueio_marcacao: { Args: { p_data: string }; Returns: string };
      relatorio_totais: { Args: { p_inicio: string; p_fim: string; p_codigo?: string }; Returns: Json };
      remover_codigo_cozinha: { Args: Record<PropertyKey, never>; Returns: undefined };
      salvar_marcacoes: { Args: { p_pessoa_id: string; p_marcas: Json }; Returns: undefined };
      totais_por_dia: { Args: { p_inicio: string }; Returns: { data: string; total: number }[] };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
