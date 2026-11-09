import Anthropic from "@anthropic-ai/sdk";

// Só roda no servidor: a chave nunca vai para o navegador.
export const claude = new Anthropic();

export const MODELO = "claude-opus-5-5";

/**
 * Se o modelo principal recusar o pedido, a própria API refaz a chamada num
 * modelo reserva escolhido automaticamente.
 */
export const FALLBACK = {
  betas: ["server-side-fallback-2026-07-01"] as Anthropic.Beta.AnthropicBeta[],
  fallbacks: "default" as const,
};

export function mensagemDeErro(e: unknown): { status: number; erro: string } {
  if (e instanceof Anthropic.AuthenticationError) {
    return { status: 500, erro: "Chave da API inválida ou ausente. Configure ANTHROPIC_API_KEY no arquivo .env.local." };
  }
  if (e instanceof Anthropic.RateLimitError) {
    return { status: 429, erro: "Muitos pedidos ao mesmo tempo. Espere alguns segundos e tente de novo." };
  }
  if (e instanceof Anthropic.BadRequestError) {
    return { status: 400, erro: "Não consegui processar esse conteúdo. Tente uma foto mais nítida ou outro texto." };
  }
  if (e instanceof Anthropic.APIError) {
    return { status: 502, erro: "A IA está indisponível agora. Tente de novo em instantes." };
  }
  if (e instanceof Anthropic.APIConnectionError) {
    return { status: 502, erro: "Sem conexão com a IA. Verifique a internet do servidor." };
  }
  // Erro antes de chegar à API, normalmente falta de credencial.
  return { status: 500, erro: "Erro no servidor. Verifique se ANTHROPIC_API_KEY está configurada no .env.local." };
}
