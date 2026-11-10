import { NextResponse } from "next/server";
import { z } from "zod";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type Anthropic from "@anthropic-ai/sdk";
import { claude, FALLBACK, MODELO, mensagemDeErro } from "@/lib/claude";
import { consumirUsoIA } from "@/lib/supabase/acesso";
import { CATEGORIAS, CATEGORIAS_DESPESA, CATEGORIAS_RECEITA } from "@/lib/tipos";

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

const SISTEMA = `Você é o motor de lançamentos de um app brasileiro de finanças pessoais.
Transforme o que a pessoa enviou (frase digitada, frase falada transcrita ou foto de recibo/nota fiscal/comprovante Pix) em lançamentos financeiros.

Regras:
- "valor" é sempre positivo, em reais (ex.: "40 conto" = 40; "1,5 mil" = 1500; "R$ 12,90" = 12.9).
- "tipo": "despesa" para gastos/pagamentos; "receita" para salário, Pix recebido, venda, etc.
- Categorias de despesa: ${CATEGORIAS_DESPESA.join(", ")}.
- Categorias de receita: ${CATEGORIAS_RECEITA.join(", ")}.
- Use "Mercado" para supermercado/feira/padaria de compras do mês; "Alimentação" para restaurante, lanche, delivery, iFood.
- Pagamento de fatura, empréstimo ou parcela de dívida vai em "Dívidas".
- "data" no formato AAAA-MM-DD. Interprete datas relativas ("ontem", "sexta") a partir da data de hoje informada. Sem data, use hoje.
- "descricao": curta e clara, com o nome do estabelecimento quando houver (ex.: "Mercado Extra", "Uber para o trabalho").
- Uma frase pode ter vários lançamentos ("gastei 30 de uber e 50 no almoço" = 2).
- Foto de recibo/nota: gere UM lançamento com o valor TOTAL pago (não liste item por item), usando a data impressa se estiver legível.
- Se não houver nada financeiro ou o valor estiver ilegível, devolva a lista vazia.
- "observacao": uma frase curta em português para a pessoa (ex.: "Registrei 2 gastos." ou o motivo de não ter registrado nada).`;

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
