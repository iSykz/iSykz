import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SUPABASE_KEY, SUPABASE_URL } from "./config";

/** Cliente com a sessão da pessoa (respeita as regras de segurança do banco). */
export async function supabaseServidor(): Promise<SupabaseClient> {
  const loja = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => loja.getAll(),
      setAll: (lista) => {
        try {
          lista.forEach(({ name, value, options }) => loja.set(name, value, options));
        } catch {
          /* chamado fora de uma resposta; o middleware renova a sessão */
        }
      },
    },
  });
}

/** Cliente administrativo (ignora as regras). Só para ações do servidor, como mudar o plano. */
export function supabaseAdmin(): SupabaseClient | null {
  const segredo = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !segredo) return null;
  return createClient(SUPABASE_URL, segredo, { auth: { persistSession: false, autoRefreshToken: false } });
}
