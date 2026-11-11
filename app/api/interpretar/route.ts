import { NextResponse } from "next/server";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type Anthropic from "@anthropic-ai/sdk";
import { claude, FALLBACK, MODELO, mensagemDeErro } from "@/lib/claude";
import { consumirUsoIA } from "@/lib/supabase/acesso";
import { CATEGORIAS } from "@/lib/tipos";
import { SISTEMA_LANCAMENTOS as SISTEMA } from "@/lib/prompts";

export const runtime = "nodejs";

const Saida = z.object({
  transacoes: z.array(
    z.object({
      descricao: z.string(),
      valor: z.number(),
      tipo: z.enum(["despesa", "receita"]),
      categoria: z.enum(CATEGORIAS),
      data: z.string(),
    }),
  ),
  observacao: z.string(),
});

const Entrada = z.object({
  texto: z.string().max(4000).optional(),
  imagem: z
    .object({
      dados: z.string().max(8_000_000),
      tipo: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
    })
    .optional(),
  hoje: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});


export async function POST(req: Request) {
  const corpo = Entrada.safeParse(await req.json().catch(() => null));
  if (!corpo.success || (!corpo.data.texto?.trim() && !corpo.data.imagem)) {
    return NextResponse.json({ erro: "Envie um texto ou uma foto." }, { status: 400 });
  }
  const { texto, imagem, hoje } = corpo.data;

  // Login + limite do plano grátis, contado no banco (não dá para burlar pelo navegador).
  const acesso = await consumirUsoIA();
  if (!acesso.ok) return acesso.resposta;
  const uso = { usos: acesso.usos, plano: acesso.plano };

  const conteudo: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (imagem) {
    conteudo.push({ type: "image", source: { type: "base64", media_type: imagem.tipo, data: imagem.dados } });
  }
  conteudo.push({
    type: "text",
    text: `Hoje é ${hoje}.\n${texto?.trim() ? `Mensagem da pessoa: """${texto.trim()}"""` : "Analise a foto acima."}`,
  });

  try {
    const resposta = await claude.beta.messages.parse({
      model: MODELO,
      max_tokens: 4000,
      ...FALLBACK,
      system: SISTEMA,
      output_config: { effort: "low", format: betaZodOutputFormat(Saida) },
      messages: [{ role: "user", content: conteudo }],
    });

    if (resposta.stop_reason === "refusal" || !resposta.parsed_output) {
      return NextResponse.json({ transacoes: [], observacao: "Não consegui entender. Tente escrever de outro jeito.", ...uso });
    }

    const saida = resposta.parsed_output;
    const dataValida = /^\d{4}-\d{2}-\d{2}$/;
    const transacoes = saida.transacoes
      .filter((t) => Number.isFinite(t.valor) && t.valor > 0)
      .map((t) => ({ ...t, valor: Math.round(t.valor * 100) / 100, data: dataValida.test(t.data) ? t.data : hoje }));

    return NextResponse.json({ transacoes, observacao: saida.observacao, ...uso });
  } catch (e) {
    console.error(e);
    const { status, erro } = mensagemDeErro(e);
    return NextResponse.json({ erro }, { status });
  }
}
