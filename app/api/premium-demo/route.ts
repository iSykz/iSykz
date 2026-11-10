import { NextResponse } from "next/server";
import { z } from "zod";
import { supabaseAdmin, supabaseServidor } from "@/lib/supabase/servidor";

export const runtime = "nodejs";

/**
 * Liga/desliga o Premium SEM pagamento, só para testes.
 * Funciona apenas com PREMIUM_DEMO=1. Em produção, quem muda o plano é o
 * aviso (webhook) do sistema de pagamento.
 */
export async function POST(req: Request) {
  if (process.env.PREMIUM_DEMO !== "1") {
    return NextResponse.json({ erro: "Assinatura ainda não disponível." }, { status: 403 });
  }
  const corpo = z.object({ plano: z.enum(["gratis", "premium"]) }).safeParse(await req.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });

  const supabase = await supabaseServidor();
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) return NextResponse.json({ erro: "Entre na sua conta." }, { status: 401 });

  const admin = supabaseAdmin();
  if (!admin) return NextResponse.json({ erro: "Falta SUPABASE_SECRET_KEY no servidor." }, { status: 500 });

  const { error } = await admin.from("perfis").update({ plano: corpo.data.plano, premium_ate: null }).eq("id", id);
  if (error) return NextResponse.json({ erro: "Não consegui mudar o plano." }, { status: 500 });
  return NextResponse.json({ plano: corpo.data.plano });
}
