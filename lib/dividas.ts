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
