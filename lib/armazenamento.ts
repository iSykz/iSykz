"use client";

import { useCallback, useEffect, useState } from "react";
import type { Dados } from "./tipos";
import { mesISO } from "./formato";

const CHAVE = "zerou:v1";

const inicial = (): Dados => ({
  transacoes: [],
  dividas: [],
  orcamento: {},
  plano: { tipo: "gratis", mes: mesISO(), usosIA: 0 },
  valorExtraDividas: 0,
});

function carregar(): Dados {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return inicial();
    return { ...inicial(), ...(JSON.parse(bruto) as Partial<Dados>) };
  } catch {
    return inicial();
  }
}

/**
 * Guarda os dados no próprio aparelho (localStorage). Na próxima etapa isso
 * vira um banco com login, para sincronizar entre celular e computador.
 */
export function useDados() {
  const [dados, setDados] = useState<Dados>(inicial);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    const d = carregar();
    // zera o contador de uso da IA quando vira o mês
    if (d.plano.mes !== mesISO()) d.plano = { ...d.plano, mes: mesISO(), usosIA: 0 };
    setDados(d);
    setPronto(true);
  }, []);

  useEffect(() => {
    if (!pronto) return;
    try {
      localStorage.setItem(CHAVE, JSON.stringify(dados));
    } catch {
      /* armazenamento indisponível (aba anônima etc.) */
    }
  }, [dados, pronto]);

  const atualizar = useCallback((fn: (d: Dados) => Dados) => setDados((d) => fn(d)), []);

  return { dados, atualizar, pronto };
}
