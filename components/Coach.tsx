"use client";

import { useMemo, useState } from "react";
import { PRECO_PREMIUM, type Dados } from "@/lib/tipos";
import { resumoDoMes } from "@/lib/analise";
import { mesISO } from "@/lib/formato";
import type { Atualizar } from "./App";

export function Coach({ dados, atualizar }: { dados: Dados; atualizar: Atualizar }) {
  const [pergunta, setPergunta] = useState("");
  const [resposta, setResposta] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const premium = dados.plano.tipo === "premium";
  const resumo = useMemo(() => resumoDoMes(dados.transacoes, mesISO()), [dados.transacoes]);
  const semDados = resumo.transacoes.length === 0 && dados.dividas.length === 0;

  async function perguntar() {
    setCarregando(true);
    setErro(null);
    try {
      const r = await fetch("/api/conselho", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mes: mesISO(),
          receitas: resumo.receitas,
          despesas: resumo.despesas,
          porCategoria: resumo.porCategoria,
          orcamento: dados.orcamento,
          dividas: dados.dividas.map(({ nome, saldo, jurosMensal, parcelaMinima }) => ({
            nome,
            saldo,
            jurosMensal,
            parcelaMinima,
          })),
          valorExtraDividas: dados.valorExtraDividas,
          pergunta: pergunta.trim() || undefined,
        }),
      });
      const json = (await r.json()) as { texto?: string; erro?: string };
      if (!r.ok) throw new Error(json.erro ?? "Falha ao falar com o coach.");
      setResposta(json.texto ?? "");
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao falar com o coach.");
    } finally {
      setCarregando(false);
    }
  }

  if (!premium) {
    return (
      <div className="pilha">
        <section className="cartao premium-cartao">
          <span className="selo premium">Premium</span>
          <h2>Coach financeiro com IA</h2>
          <ul className="beneficios">
            <li>Diagnóstico do seu mês com ações concretas</li>
            <li>Plano personalizado para sair das dívidas</li>
            <li>Tire dúvidas: “vale a pena renegociar?”, “como montar reserva?”</li>
            <li>Lançamentos com IA ilimitados (voz, texto e foto)</li>
          </ul>
          <p className="preco">
            {PRECO_PREMIUM}
            <span className="sutil">/mês</span>
          </p>
          <button
            className="botao primario largo"
            onClick={() => atualizar((d) => ({ ...d, plano: { ...d.plano, tipo: "premium" } }))}
          >
            Ativar Premium (demonstração)
          </button>
          <p className="sutil pequeno">Pagamento ainda não integrado: este botão só libera o recurso para testes.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="pilha">
      <section className="cartao pilha-pequena">
        <h2>Coach Grana</h2>
        <p className="sutil">
          Ele analisa o resumo do seu mês e suas dívidas. Só os totais por categoria são enviados, não cada lançamento.
        </p>
        <textarea
          rows={2}
          value={pergunta}
          maxLength={1000}
          onChange={(e) => setPergunta(e.target.value)}
          placeholder="Pergunta opcional. Ex.: Como faço para sobrar R$ 300 por mês?"
        />
        <button className="botao primario largo" onClick={perguntar} disabled={carregando || semDados}>
          {carregando ? "Analisando…" : pergunta.trim() ? "Perguntar" : "Analisar meu mês"}
        </button>
        {semDados && <p className="sutil pequeno">Lance alguns gastos ou cadastre suas dívidas primeiro.</p>}
      </section>

      {erro && <div className="alerta perigo">{erro}</div>}

      {resposta && (
        <section className="cartao resposta-coach">
          {resposta.split(/\n+/).map((linha, i) =>
            linha.trim().startsWith("- ") ? (
              <p key={i} className="item-lista">
                {linha.trim().slice(2)}
              </p>
            ) : (
              <p key={i}>{linha}</p>
            ),
          )}
          <p className="sutil pequeno">Orientação educativa, não é recomendação de investimento.</p>
        </section>
      )}

      <button
        className="link sutil"
        onClick={() => atualizar((d) => ({ ...d, plano: { ...d.plano, tipo: "gratis" } }))}
      >
        Voltar ao plano grátis (teste)
      </button>
    </div>
  );
}
