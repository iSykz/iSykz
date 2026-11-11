"use client";

import { useMemo, useState } from "react";
import { CATEGORIAS_DESPESA, type Categoria, type Dados } from "@/lib/tipos";
import { diasRestantes, historicoCategorias, resumoDoMes } from "@/lib/analise";
import { mesISO, reais } from "@/lib/formato";
import type { Acoes } from "@/lib/armazenamento";
import { CampoNumero } from "./Campos";

export function OrcamentoTela({ dados, acoes }: { dados: Dados; acoes: Acoes }) {
  const [verTodas, setVerTodas] = useState(false);
  const mes = mesISO();
  const resumo = useMemo(() => resumoDoMes(dados.transacoes, mes), [dados.transacoes, mes]);
  const historico = useMemo(() => historicoCategorias(dados.transacoes, mes), [dados.transacoes, mes]);
  const dias = diasRestantes();

  const totalLimites = Object.values(dados.orcamento).reduce((s, v) => s + (v ?? 0), 0);
  const sobra = resumo.receitas - totalLimites;
  const comLimite = CATEGORIAS_DESPESA.filter((c) => (dados.orcamento[c] ?? 0) > 0);
  const semLimiteComGasto = CATEGORIAS_DESPESA.filter(
    (c) => !(dados.orcamento[c] ?? 0) && ((resumo.porCategoria[c] ?? 0) > 0 || (historico.media[c] ?? 0) > 0),
  );
  const restantes = CATEGORIAS_DESPESA.filter(
    (c) => !comLimite.includes(c) && !semLimiteComGasto.includes(c),
  );
  const visiveis = verTodas ? [...comLimite, ...semLimiteComGasto, ...restantes] : [...comLimite, ...semLimiteComGasto];

  const definir = (cat: Categoria, valor: number) => void acoes.definirOrcamento(cat, valor);

  async function usarMedia() {
    for (const [cat, v] of Object.entries(historico.media) as [Categoria, number][]) {
      if (v > 0 && !(dados.orcamento[cat] ?? 0)) await acoes.definirOrcamento(cat, v);
    }
  }

  const sugestoesNovas = (Object.entries(historico.media) as [Categoria, number][]).filter(
    ([cat, v]) => v > 0 && !(dados.orcamento[cat] ?? 0),
  ).length;

  return (
    <div className="pilha">
      <section className="cartao">
        <h2>Limites do mês</h2>
        {totalLimites > 0 ? (
          <>
            <div className="linha-tripla">
              <div>
                <span className="rotulo">Planejado</span>
                <span>{reais(totalLimites)}</span>
              </div>
              <div>
                <span className="rotulo">Já gasto</span>
                <span>{reais(resumo.despesas)}</span>
              </div>
              {resumo.receitas > 0 && (
                <div>
                  <span className="rotulo">Sobra prevista</span>
                  <span className={sobra < 0 ? "negativo" : "positivo"}>{reais(sobra)}</span>
                </div>
              )}
            </div>
            {resumo.receitas > 0 && sobra < 0 && (
              <div className="alerta perigo espaco-topo">
                <strong>Seus limites somam mais do que você ganha</strong>
                <span>
                  São {reais(totalLimites)} planejados para {reais(resumo.receitas)} de receitas. Corte{" "}
                  {reais(-sobra)} em alguma categoria para o mês fechar.
                </span>
              </div>
            )}
          </>
        ) : (
          <p className="sutil">
            Escolha quanto quer gastar em cada categoria. O app avisa quando você chegar a 80%, quando estourar e quando
            o ritmo indicar que vai estourar.
          </p>
        )}

        {sugestoesNovas > 0 && (
          <div className="caixa-sugestao espaco-topo">
            <span>
              Com base nos seus últimos {historico.mesesUsados === 1 ? "1 mês" : `${historico.mesesUsados} meses`}, dá
              para preencher {sugestoesNovas} {sugestoesNovas === 1 ? "categoria" : "categorias"} automaticamente.
            </span>
            <button className="botao pequeno" onClick={usarMedia}>
              Usar minha média
            </button>
          </div>
        )}
      </section>

      <section className="cartao">
        <ul className="lista">
          {visiveis.map((cat) => {
            const limite = dados.orcamento[cat] ?? 0;
            const gasto = resumo.porCategoria[cat] ?? 0;
            const media = historico.media[cat] ?? 0;
            const pct = limite ? (gasto / limite) * 100 : 0;
            const resta = limite - gasto;
            const porDia = resta > 0 ? resta / dias : 0;
            return (
              <li key={cat} className="limite">
                <div className="barra-topo">
                  <span>{cat}</span>
                  <span className="sutil">gasto {reais(gasto)}</span>
                </div>

                <div className="limite-linha">
                  <CampoNumero
                    prefixo="R$"
                    placeholder="sem limite"
                    etiquetaAria={`Limite para ${cat}`}
                    valor={limite}
                    gravarAoSair
                    aoMudar={(v) => definir(cat, v)}
                  />
                  {!limite && media > 0 && (
                    <button className="chip" onClick={() => definir(cat, media)}>
                      usar {reais(media)}
                    </button>
                  )}
                </div>

                {limite > 0 && (
                  <>
                    <div className="barra">
                      <div
                        className={`barra-cheia ${pct >= 100 ? "estourou" : pct >= 80 ? "quase" : ""}`}
                        style={{ width: `${gasto > 0 ? Math.max(2, Math.min(100, pct)) : 0}%` }}
                      />
                    </div>
                    <span className="sutil pequeno">
                      {resta >= 0 ? (
                        <>
                          Restam {reais(resta)} · {reais(porDia)} por dia nos {dias} dias que faltam
                        </>
                      ) : (
                        <span className="negativo">Estourou em {reais(-resta)}</span>
                      )}
                    </span>
                  </>
                )}
              </li>
            );
          })}
        </ul>

        {!verTodas && restantes.length > 0 && (
          <button className="botao fantasma largo espaco-topo" onClick={() => setVerTodas(true)}>
            Ver todas as categorias ({restantes.length})
          </button>
        )}
        {visiveis.length === 0 && (
          <p className="sutil centro">Lance alguns gastos primeiro, ou veja todas as categorias.</p>
        )}
      </section>
    </div>
  );
}
