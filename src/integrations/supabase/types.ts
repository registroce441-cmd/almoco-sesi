/**
 * Tipos do banco. Escritos à mão para espelhar as migrations em supabase/migrations.
 * Quando quiser, regere com o CLI:  npx supabase gen types typescript --project-id SEU_ID
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
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
          nif: string | null;
          grupo_id: string;
          ativo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          nome: string;
          nif?: string | null;
          grupo_id: string;
          ativo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          nome?: string;
          nif?: string | null;
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
      hoje_sp: { Args: Record<PropertyKey, never>; Returns: string };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      marcacao_aberta: { Args: { p_data: string }; Returns: boolean };
      motivo_bloqueio_marcacao: { Args: { p_data: string }; Returns: string };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
