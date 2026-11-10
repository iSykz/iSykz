import { NextResponse } from "next/server";
import { LIMITE_IA_GRATIS } from "@/lib/tipos";
import { supabaseConfigurado } from "./config";
import { supabaseServidor } from "./servidor";

export type Acesso =
  | { ok: true; usos: number | null; plano: "gratis" | "premium" | null }
  | { ok: false; resposta: NextResponse };

const negar = (status: number, erro: string): Acesso => ({ ok: false, resposta: NextResponse.json({ erro }, { status }) });

/** Sem Supabase, a IA só fica aberta em desenvolvimento (ou com ALLOW_ANON_AI=1). */
function modoLocalPermitido(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.ALLOW_ANON_AI === "1";
}

/** Exige login e desconta 1 uso da IA (limite do plano grátis aplicado no banco). */
export async function consumirUsoIA(): Promise<Acesso> {
  if (!supabaseConfigurado) {
    return modoLocalPermitido()
      ? { ok: true, usos: null, plano: null }
      : negar(503, "Servidor sem banco de dados configurado.");
  }
  const supabase = await supabaseServidor();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return negar(401, "Entre na sua conta para usar a IA.");
  const { data, error } = await supabase.rpc("consumir_ia", { limite_gratis: LIMITE_IA_GRATIS });
  if (error) {
    return error.code === "28000" ? negar(401, "Entre na sua conta para usar a IA.") : negar(500, "Erro ao verificar seu plano.");
  }
  const linha = (data as { permitido: boolean; usos: number; plano: "gratis" | "premium" }[])[0];
  if (!linha?.permitido) {
    return negar(402, `Você usou os ${LIMITE_IA_GRATIS} lançamentos com IA do plano grátis este mês. Lance manualmente ou assine o Premium.`);
  }
  return { ok: true, usos: linha.usos, plano: linha.plano };
}

/** Exige login e plano Premium. */
export async function exigirPremium(): Promise<Acesso> {
  if (!supabaseConfigurado) {
    return modoLocalPermitido() ? { ok: true, usos: null, plano: null } : negar(503, "Servidor sem banco de dados configurado.");
  }
  const supabase = await supabaseServidor();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return negar(401, "Entre na sua conta.");
  const { data, error } = await supabase.from("perfis").select("plano_atual").single();
  if (error) return negar(500, "Erro ao verificar seu plano.");
  if ((data as { plano_atual: string }).plano_atual !== "premium") return negar(402, "O Coach é exclusivo do Premium.");
  return { ok: true, usos: null, plano: "premium" };
}
