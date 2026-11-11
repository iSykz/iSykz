import { NextResponse } from "next/server";
import { z } from "zod";
import { exigirPremium } from "@/lib/supabase/acesso";
import { SISTEMA_COACH as SISTEMA } from "@/lib/prompts";
import { claude, FALLBACK, MODELO, mensagemDeErro } from "@/lib/claude";

export const runtime = "nodejs";

// Resumo já agregado no aparelho: o servidor não recebe a lista de transações.
const Entrada = z.object({
  mes: z.string(),
  receitas: z.number(),
  despesas: z.number(),
  porCategoria: z.record(z.string(), z.number()),
  orcamento: z.record(z.string(), z.number()),
  dividas: z.array(z.object({ nome: z.string(), saldo: z.number(), jurosMensal: z.number(), parcelaMinima: z.number() })),
  valorExtraDividas: z.number(),
  pergunta: z.string().max(1000).optional(),
});


export async function POST(req: Request) {
  const corpo = Entrada.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });

  const { pergunta, ...resumo } = corpo.data;

  const acesso = await exigirPremium();
  if (!acesso.ok) return acesso.resposta;

  try {
    const resposta = await claude.beta.messages.create({
      model: MODELO,
      max_tokens: 4000,
      ...FALLBACK,
      system: SISTEMA,
      output_config: { effort: "medium" },
      messages: [
        {
          role: "user",
          content: `Resumo financeiro (valores em reais):\n${JSON.stringify(resumo, null, 2)}\n\n${
            pergunta?.trim() ? `Pergunta da pessoa: ${pergunta.trim()}` : "Me dê seu diagnóstico e o que fazer este mês."
          }`,
        },
      ],
    });

    if (resposta.stop_reason === "refusal") {
      return NextResponse.json({ texto: "Não consigo ajudar com isso. Tente perguntar de outro jeito." });
    }
    const texto = resposta.content
      .flatMap((b) => (b.type === "text" ? [b.text] : []))
      .join("\n")
      .trim();
    return NextResponse.json({ texto: texto || "Sem resposta agora, tente de novo." });
  } catch (e) {
    console.error(e);
    const { status, erro } = mensagemDeErro(e);
    return NextResponse.json({ erro }, { status });
  }
}
