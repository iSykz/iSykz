import type { Categoria, Orcamento, Transacao } from "./tipos";

export interface ResumoMes {
  receitas: number;
  despesas: number;
  porCategoria: Partial<Record<Categoria, number>>;
  transacoes: Transacao[];
}

export function resumoDoMes(transacoes: Transacao[], mes: string): ResumoMes {
  const doMes = transacoes.filter((t) => t.data.startsWith(mes));
  const porCategoria: ResumoMes["porCategoria"] = {};
  let receitas = 0;
  let despesas = 0;
  for (const t of doMes) {
    if (t.tipo === "receita") receitas += t.valor;
    else {
      despesas += t.valor;
      porCategoria[t.categoria] = (porCategoria[t.categoria] ?? 0) + t.valor;
    }
  }
  return {
    receitas,
    despesas,
    porCategoria,
    transacoes: doMes.sort((a, b) => b.data.localeCompare(a.data)),
  };
}

export type NivelAlerta = "perigo" | "atencao" | "ok";

export interface Alerta {
  nivel: NivelAlerta;
  titulo: string;
  detalhe: string;
}

/**
 * Alertas de "está gastando demais": compara o gasto de cada categoria com o
 * limite e também projeta o ritmo atual até o fim do mês.
 */
export function gerarAlertas(resumo: ResumoMes, orcamento: Orcamento, hoje: Date, mesAtual: boolean): Alerta[] {
  const alertas: Alerta[] = [];
  const diasNoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  const fracao = mesAtual ? Math.max(hoje.getDate(), 1) / diasNoMes : 1;
  // Projetar nos primeiros dias dá alarme falso: no dia 2, uma compra de
  // R$ 50 viraria "projeção de R$ 750". Só projeta a partir do dia 8.
  const podeProjetar = mesAtual && hoje.getDate() >= 8;

  if (resumo.receitas > 0 && resumo.despesas > resumo.receitas) {
    alertas.push({
      nivel: "perigo",
      titulo: "Você gastou mais do que ganhou",
      detalhe: `Os gastos passaram as receitas em ${fmt(resumo.despesas - resumo.receitas)} este mês.`,
    });
  } else if (podeProjetar && resumo.receitas > 0 && resumo.despesas / fracao > resumo.receitas) {
    alertas.push({
      nivel: "atencao",
      titulo: "Nesse ritmo, o dinheiro não fecha o mês",
      detalhe: `Projeção de gastos: ${fmt(resumo.despesas / fracao)} para ${fmt(resumo.receitas)} de receitas.`,
    });
  }

  for (const [cat, limite] of Object.entries(orcamento) as [Categoria, number][]) {
    if (!limite) continue;
    const gasto = resumo.porCategoria[cat] ?? 0;
    const pct = gasto / limite;
    if (pct >= 1) {
      alertas.push({
        nivel: "perigo",
        titulo: `${cat}: limite estourado`,
        detalhe: `${fmt(gasto)} de ${fmt(limite)} (${Math.round(pct * 100)}%).`,
      });
    } else if (pct >= 0.8) {
      alertas.push({
        nivel: "atencao",
        titulo: `${cat}: quase no limite`,
        detalhe: `Restam ${fmt(limite - gasto)} de ${fmt(limite)}.`,
      });
    } else if (podeProjetar && fracao < 0.85 && gasto > limite * 0.25 && gasto / fracao > limite * 1.15) {
      alertas.push({
        nivel: "atencao",
        titulo: `${cat}: ritmo acima do planejado`,
        detalhe: `Nesse ritmo você vai gastar ${fmt(gasto / fracao)} (limite ${fmt(limite)}).`,
      });
    }
  }

  const ordem: Record<NivelAlerta, number> = { perigo: 0, atencao: 1, ok: 2 };
  return alertas.sort((a, b) => ordem[a.nivel] - ordem[b.nivel]);
}

/** Quantos dias ainda faltam no mês (contando hoje). */
export function diasRestantes(hoje = new Date()): number {
  const ultimo = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
  return Math.max(1, ultimo - hoje.getDate() + 1);
}

export interface Historico {
  media: Partial<Record<Categoria, number>>;
  mesesUsados: number;
}

/**
 * Média de gasto por categoria nos meses anteriores (o mês atual fica de
 * fora porque ainda está pela metade). Serve para sugerir limites.
 */
export function historicoCategorias(transacoes: Transacao[], mesAtual: string, quantos = 3): Historico {
  const meses = [...new Set(transacoes.filter((t) => t.tipo === "despesa").map((t) => t.data.slice(0, 7)))]
    .filter((m) => m < mesAtual)
    .sort()
    .slice(-quantos);
  if (!meses.length) return { media: {}, mesesUsados: 0 };

  const soma: Partial<Record<Categoria, number>> = {};
  for (const t of transacoes) {
    if (t.tipo !== "despesa" || !meses.includes(t.data.slice(0, 7))) continue;
    soma[t.categoria] = (soma[t.categoria] ?? 0) + t.valor;
  }
  const media: Partial<Record<Categoria, number>> = {};
  for (const [cat, v] of Object.entries(soma) as [Categoria, number][]) {
    media[cat] = Math.round(v / meses.length);
  }
  return { media, mesesUsados: meses.length };
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
