/*
 * Na versão publicada não existe servidor: as chamadas que o app faz para
 * /api/interpretar e /api/conselho são atendidas aqui, pedindo ao Claude pela
 * capacidade "sample" (na conta de quem está testando).
 */
import { CATEGORIAS, type Sugestao } from "@/lib/tipos";
import { SISTEMA_COACH, SISTEMA_LANCAMENTOS } from "@/lib/prompts";
import { sampleP } from "./claude";

const json = (corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), { status, headers: { "Content-Type": "application/json" } });

function mensagemErro(code?: string): string {
  switch (code) {
    case "not_granted":
      return "Para usar a IA, permita que esta página use o Claude (o pedido aparece na tela).";
    case "rate_limited":
      return "Muitos pedidos seguidos. Espere um pouco e tente de novo.";
    case "images_unavailable":
    case "image_rejected":
      return "Não consegui enviar essa foto. Tente outra imagem ou digite o gasto.";
    case "refused":
      return "Não consegui ajudar com isso. Tente escrever de outro jeito.";
    default:
      return "A IA não respondeu agora. Tente de novo em instantes.";
  }
}

function base64ParaBlob(dados: string, tipo: string): Blob {
  const bin = atob(dados);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: tipo });
}

async function interpretar(corpo: { texto?: string; imagem?: { dados: string; tipo: string }; hoje: string }) {
  const sample = await sampleP;
  if (!sample) return json({ erro: "A IA só funciona dentro do claude.ai." }, 503);
  const pedido = `${SISTEMA_LANCAMENTOS}

Hoje é ${corpo.hoje}.
${corpo.texto?.trim() ? `Mensagem da pessoa: """${corpo.texto.trim()}"""` : "Analise a foto enviada."}

Responda SOMENTE com um objeto JSON neste formato, sem texto antes ou depois:
{"transacoes":[{"descricao":"...","valor":0,"tipo":"despesa","categoria":"...","data":"AAAA-MM-DD"}],"observacao":"..."}
"categoria" deve ser exatamente uma destas: ${CATEGORIAS.join(", ")}.`;
  try {
    const r = await sample.json<{ transacoes?: Partial<Sugestao>[]; observacao?: string }>(pedido, {
      modelTier: corpo.imagem ? "default" : "quick",
      ...(corpo.imagem ? { images: [base64ParaBlob(corpo.imagem.dados, corpo.imagem.tipo)] } : {}),
    });
    const dataOk = /^\d{4}-\d{2}-\d{2}$/;
    const transacoes = (Array.isArray(r?.transacoes) ? r.transacoes : [])
      .map((t) => ({
        descricao: String(t.descricao ?? "").slice(0, 200) || "Lançamento",
        valor: Math.round(Number(t.valor) * 100) / 100,
        tipo: t.tipo === "receita" ? "receita" : "despesa",
        categoria: (CATEGORIAS as readonly string[]).includes(String(t.categoria))
          ? t.categoria
          : t.tipo === "receita"
            ? "Outras receitas"
            : "Outros",
        data: dataOk.test(String(t.data)) ? t.data : corpo.hoje,
      }))
      .filter((t) => Number.isFinite(t.valor) && t.valor > 0);
    return json({ transacoes, observacao: String(r?.observacao ?? "") });
  } catch (e) {
    return json({ erro: mensagemErro((e as { code?: string })?.code) }, 502);
  }
}

async function conselho(corpo: Record<string, unknown>) {
  const sample = await sampleP;
  if (!sample) return json({ erro: "A IA só funciona dentro do claude.ai." }, 503);
  const { pergunta, ...resumo } = corpo as { pergunta?: string };
  const pedido = `${SISTEMA_COACH}

Resumo financeiro (valores em reais):
${JSON.stringify(resumo, null, 2)}

${pergunta?.trim() ? `Pergunta da pessoa: ${pergunta.trim()}` : "Me dê seu diagnóstico e o que fazer este mês."}`;
  try {
    const { text } = await sample(pedido, { cache: false });
    return json({ texto: text.trim() || "Sem resposta agora, tente de novo." });
  } catch (e) {
    return json({ erro: mensagemErro((e as { code?: string })?.code) }, 502);
  }
}

const fetchOriginal = globalThis.fetch.bind(globalThis);

globalThis.fetch = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof entrada === "string" ? entrada : entrada instanceof URL ? entrada.href : entrada.url;
  const corpo = () => JSON.parse(String(init?.body ?? "{}"));
  if (url.endsWith("/api/interpretar")) return interpretar(corpo());
  if (url.endsWith("/api/conselho")) return conselho(corpo());
  return fetchOriginal(entrada, init);
}) as typeof fetch;
