import { NextResponse } from "next/server";
import { z } from "zod";
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

const SISTEMA = `Você é o "Coach Grana", um educador financeiro brasileiro, direto e acolhedor, dentro de um app de finanças pessoais.
Você recebe o resumo do mês da pessoa (receitas, gastos por categoria, limites de orçamento e dívidas).

Como responder:
- Português do Brasil, linguagem simples, sem julgamento.
- No máximo 180 palavras. Comece com uma frase sobre a situação geral.
- Depois, de 3 a 5 ações concretas em lista com "- ", cada uma com números tirados dos dados (ex.: "Cortar R$ 120 em delivery libera R$ 1.440 por ano").
- Se houver dívidas, priorize: cartão de crédito rotativo e cheque especial costumam ter os maiores juros; sugira avalanche (maior juros primeiro) e, se fizer sentido, renegociação (ex.: Desenrola, feirões de bancos) ou portabilidade de crédito.
- Se a pessoa gasta mais do que ganha, trate isso como prioridade número 1.
- Não recomende investimentos específicos, produtos de um banco específico ou criptomoedas. Não prometa resultados.
- Texto puro, sem títulos nem negrito.`;

export async function POST(req: Request) {
  const corpo = Entrada.safeParse(await req.json().catch(() => null));
  if (!corpo.success) return NextResponse.json({ erro: "Dados inválidos." }, { status: 400 });

  const { pergunta, ...resumo } = corpo.data;

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
