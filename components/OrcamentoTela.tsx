"use client";

import { useMemo } from "react";
import { CATEGORIAS_DESPESA, type Categoria, type Dados } from "@/lib/tipos";
import { resumoDoMes } from "@/lib/analise";
import { mesISO, reais } from "@/lib/formato";
import type { Acoes } from "@/lib/armazenamento";

export function OrcamentoTela({ dados, acoes }: { dados: Dados; acoes: Acoes }) {
  const resumo = useMemo(() => resumoDoMes(dados.transacoes, mesISO()), [dados.transacoes]);
  const totalLimites = Object.values(dados.orcamento).reduce((s, v) => s + (v ?? 0), 0);

  const definir = (cat: Categoria, valor: number) => void acoes.definirOrcamento(cat, valor);

  return (
    <div className="pilha">
      <section className="cartao">
        <h2>Limites do mês</h2>
        <p className="sutil">
          Defina quanto quer gastar em cada categoria. O app avisa quando você chegar a 80% e quando o ritmo indicar que
          vai estourar.
        </p>
        {totalLimites > 0 && (
          <p>
            Total planejado: <strong>{reais(totalLimites)}</strong>
            {resumo.receitas > 0 && (
              <span className={totalLimites > resumo.receitas ? "negativo" : "sutil"}>
                {" "}
                · {Math.round((totalLimites / resumo.receitas) * 100)}% das receitas do mês
              </span>
            )}
          </p>
        )}
      </section>

      <section className="cartao">
        <ul className="lista">
          {CATEGORIAS_DESPESA.map((cat) => {
            const limite = dados.orcamento[cat] ?? 0;
            const gasto = resumo.porCategoria[cat] ?? 0;
            const pct = limite ? Math.min(100, (gasto / limite) * 100) : 0;
            return (
              <li key={cat} className="limite">
                <div className="barra-topo">
                  <span>{cat}</span>
                  <span className="sutil">gasto {reais(gasto)}</span>
                </div>
                <div className="limite-linha">
                  <span className="prefixo">R$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="10"
                    placeholder="sem limite"
                    defaultValue={limite || ""}
                    onBlur={(e) => definir(cat, Number(e.target.value))}
                    aria-label={`Limite para ${cat}`}
                  />
                </div>
                {limite > 0 && (
                  <div className="barra">
                    <div
                      className={`barra-cheia ${pct >= 100 ? "estourou" : pct >= 80 ? "quase" : ""}`}
                      style={{ width: `${Math.max(2, pct)}%` }}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
