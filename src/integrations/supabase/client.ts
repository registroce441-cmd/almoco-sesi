import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const url = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
const anonKey = import.meta.env["VITE_SUPABASE_ANON_KEY"] as string | undefined;

/** `false` quando o .env ainda não foi preenchido (o app mostra um aviso amigável). */
export const supabaseConfigurado = Boolean(url && anonKey);

let client: SupabaseClient<Database> | null = null;

/** Cliente Supabase do navegador. Usa só a chave pública (anon); a segurança vem do RLS. */
export function getSupabase(): SupabaseClient<Database> {
  if (!url || !anonKey) {
    throw new Error("SUPABASE_NAO_CONFIGURADO");
  }
  // retry: false -> quem refaz a consulta é o React Query (1 tentativa extra), assim o aviso de erro aparece em poucos segundos.
  client ??= createClient<Database>(url, anonKey, { db: { retry: false } });
  return client;
}
