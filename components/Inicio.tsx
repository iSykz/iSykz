"use client";

import { useMemo, useState } from "react";
import type { Dados } from "@/lib/tipos";
import { gerarAlertas, resumoDoMes } from "@/lib/analise";
import { dataCurta, mesISO, nomeMes, reais } from "@/lib/formato";
import type { Aba, Atualizar } from "./App";

const ICONE_ORIGEM = { texto: "⌨", voz: "🎙", foto: "📷", manual: "✎" } as const;

function deslocarMes(mes: string, delta: number): string {
  const [a, m] = mes.split("-").map(Number);
  return mesISO(new Date(a, m - 1 + delta, 1));
}

export function Inicio({ dados, atualizar, irPara }: { dados: Dados; atualizar: Atualizar; irPara: (a: Aba) => void }) {
  const [mes, setMes] = useState(mesISO());
  const mesAtual = mes === mesISO();
  const resumo = useMemo(() => resumoDoMes(dados.transacoes, mes), [dados.transacoes, mes]);
  const alertas = useMemo(
    () => gerarAlertas(resumo, dados.orcamento, new Date(), mesAtual),
    [resumo, dados.orcamento, mesAtual],
  );
  const saldo = resumo.receitas - resumo.despesas;
  const categorias = Object.entries(resumo.porCategoria).sort((a, b) => b[1] - a[1]);
  const maior = categorias[0]?.[1] ?? 1;

  const remover = (id: string) =>
    atualizar((d) => ({ ...d, transacoes: d.transacoes.filter((t) => t.id !== id) }));

  return (
    <div className="pilha">
      <div className="seletor-mes">
        <button className="botao fantasma" onClick={() => setMes(deslocarMes(mes, -1))} aria-label="Mês anterior">
          ‹
        </button>
        <strong>{nomeMes(mes)}</strong>
        <button
          className="botao fantasma"
          onClick={() => setMes(deslocarMes(mes, 1))}
          disabled={mesAtual}
          aria-label="Próximo mês"
        >
          ›
        </button>
      </div>

      <section className="cartao saldo">
        <span className="rotulo">Saldo do mês</span>
        <span className={`valor-grande ${saldo < 0 ? "negativo" : ""}`}>{reais(saldo)}</span>
        <div className="linha-dupla">
          <div>
            <span className="rotulo">Entrou</span>
            <span className="positivo">{reais(resumo.receitas)}</span>
          </div>
          <div>
            <span className="rotulo">Saiu</span>
            <span className="negativo">{reais(resumo.despesas)}</span>
          </div>
        </div>
      </section>

      {alertas.length > 0 && (
        <section className="pilha-pequena">
          {alertas.map((a, i) => (
            <div key={i} className={`alerta ${a.nivel}`} role="status">
              <strong>{a.titulo}</strong>
              <span>{a.detalhe}</span>
            </div>
          ))}
        </section>
      )}

      {resumo.transacoes.length === 0 ? (
        <section className="cartao vazio">
          <p>Nenhum lançamento em {nomeMes(mes).toLowerCase()}.</p>
          {mesAtual && (
            <>
              <p className="sutil">Fale, digite ou fotografe um recibo. Ex.: “gastei 40 no mercado”.</p>
              <button className="botao primario" onClick={() => irPara("lancar")}>
                Lançar primeiro gasto
              </button>
            </>
          )}
        </section>
      ) : (
        <>
          {categorias.length > 0 && (
            <section className="cartao">
              <h2>Para onde foi o dinheiro</h2>
              <ul className="barras">
                {categorias.map(([cat, v]) => {
                  const limite = dados.orcamento[cat as keyof typeof dados.orcamento];
                  const estourou = limite ? v > limite : false;
                  return (
                    <li key={cat}>
                      <div className="barra-topo">
                        <span>{cat}</span>
                        <span>
                          {reais(v)}
                          {limite ? <span className="sutil"> / {reais(limite)}</span> : null}
                        </span>
                      </div>
                      <div className="barra">
                        <div
                          className={`barra-cheia ${estourou ? "estourou" : ""}`}
                          style={{ width: `${Math.max(3, (v / maior) * 100)}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className="cartao">
            <h2>Lançamentos</h2>
            <ul className="lista">
              {resumo.transacoes.map((t) => (
                <li key={t.id} className="item">
                  <span className="item-icone" title={`Lançado por ${t.origem}`}>
                    {ICONE_ORIGEM[t.origem]}
                  </span>
                  <div className="item-texto">
                    <span>{t.descricao}</span>
                    <span className="sutil">
                      {dataCurta(t.data)} · {t.categoria}
                    </span>
                  </div>
                  <span className={t.tipo === "receita" ? "positivo" : ""}>
                    {t.tipo === "receita" ? "+" : "−"}
                    {reais(t.valor)}
                  </span>
                  <button className="botao-x" onClick={() => remover(t.id)} aria-label={`Apagar ${t.descricao}`}>
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
