import type { Divida } from "./tipos";

export type Estrategia = "avalanche" | "bolaDeNeve";

export interface ResultadoQuitacao {
  meses: number;
  jurosTotais: number;
  ordem: { id: string; nome: string; mes: number }[];
  quita: boolean; // false se o pagamento não cobre os juros
}

const MAX_MESES = 600;

/**
 * Simula a quitação mês a mês: aplica os juros, paga as parcelas mínimas e
 * joga todo o dinheiro que sobrar (extra + mínimos de dívidas já quitadas)
 * na dívida-alvo da estratégia.
 *  - avalanche: maior juros primeiro (paga menos juros no total)
 *  - bola de neve: menor saldo primeiro (vitórias rápidas, mais motivação)
 */
export function simularQuitacao(
  dividas: Divida[],
  extraMensal: number,
  estrategia: Estrategia,
): ResultadoQuitacao {
  const abertas = dividas
    .filter((d) => d.saldo > 0)
    .map((d) => ({ ...d, saldo: d.saldo }));
  const orcamentoMensal = abertas.reduce((s, d) => s + d.parcelaMinima, 0) + Math.max(0, extraMensal);
  const ordem: ResultadoQuitacao["ordem"] = [];
  let jurosTotais = 0;
  let mes = 0;

  while (abertas.some((d) => d.saldo > 0.005) && mes < MAX_MESES) {
    mes++;
    for (const d of abertas) {
      if (d.saldo <= 0) continue;
      const juros = d.saldo * (d.jurosMensal / 100);
      d.saldo += juros;
      jurosTotais += juros;
    }

    let disponivel = orcamentoMensal;
    // 1) parcelas mínimas
    for (const d of abertas) {
      if (d.saldo <= 0) continue;
      const pago = Math.min(d.parcelaMinima, d.saldo, disponivel);
      d.saldo -= pago;
      disponivel -= pago;
    }
    // 2) sobra vai para a dívida-alvo (repete se quitar e ainda sobrar)
    while (disponivel > 0.005) {
      const alvo = abertas
        .filter((d) => d.saldo > 0.005)
        .sort((a, b) =>
          estrategia === "avalanche" ? b.jurosMensal - a.jurosMensal || a.saldo - b.saldo : a.saldo - b.saldo,
        )[0];
      if (!alvo) break;
      const pago = Math.min(alvo.saldo, disponivel);
      alvo.saldo -= pago;
      disponivel -= pago;
    }

    for (const d of abertas) {
      if (d.saldo <= 0.005 && !ordem.some((o) => o.id === d.id)) {
        d.saldo = 0;
        ordem.push({ id: d.id, nome: d.nome, mes });
      }
    }
  }

  return {
    meses: mes,
    jurosTotais,
    ordem,
    quita: !abertas.some((d) => d.saldo > 0.005),
  };
}

/**
 * Menor valor extra por mês que faz a dívida acabar dentro de `maxMeses`.
 * Devolve null se nem um valor alto resolve (aí o caminho é renegociar).
 */
export function extraParaQuitar(dividas: Divida[], maxMeses = 120): number | null {
  const total = dividas.reduce((s, d) => s + d.saldo, 0);
  if (!total) return null;
  if (simularQuitacao(dividas, 0, "avalanche").meses <= maxMeses) return 0;

  let baixo = 0;
  let alto = 50;
  // dobra até achar um valor que resolve (teto: pagar tudo à vista)
  while (simularQuitacao(dividas, alto, "avalanche").meses > maxMeses) {
    alto *= 2;
    if (alto > total) return null;
  }
  // 25 passos chegam a menos de R$ 1 de precisão
  for (let i = 0; i < 25 && alto - baixo > 1; i++) {
    const meio = (baixo + alto) / 2;
    if (simularQuitacao(dividas, meio, "avalanche").meses > maxMeses) baixo = meio;
    else alto = meio;
  }
  return Math.ceil(alto / 10) * 10;
}

export interface Recomendacao {
  estrategia: Estrategia;
  motivo: string;
}

/**
 * Qual estratégia sugerir. A avalanche paga menos juros, mas quando as taxas
 * são parecidas a diferença é pequena e a bola de neve ganha pela motivação:
 * a primeira dívida sai bem antes e a pessoa não desiste no meio.
 */
export function recomendar(avalanche: ResultadoQuitacao, bola: ResultadoQuitacao): Recomendacao {
  const economia = bola.jurosTotais - avalanche.jurosTotais;
  const relevante = economia > Math.max(150, avalanche.jurosTotais * 0.05);
  const primeiraAvalanche = avalanche.ordem[0]?.mes ?? 0;
  const primeiraBola = bola.ordem[0]?.mes ?? 0;

  if (relevante) {
    return {
      estrategia: "avalanche",
      motivo: `Economiza ${moeda(economia)} em juros, uma diferença que vale a pena.`,
    };
  }
  if (primeiraBola < primeiraAvalanche) {
    return {
      estrategia: "bolaDeNeve",
      motivo:
        economia > 0.5
          ? `As taxas são parecidas: a avalanche economizaria só ${moeda(economia)}. Quitar a menor primeiro dá um resultado visível logo e ajuda a não desistir.`
          : "As duas custam praticamente o mesmo. Quitar a menor primeiro dá um resultado visível logo e ajuda a não desistir.",
    };
  }
  return { estrategia: "avalanche", motivo: "Paga menos juros e quita na mesma ordem." };
}

const moeda = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
