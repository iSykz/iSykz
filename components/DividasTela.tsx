"use client";

import { useMemo, useState } from "react";
import type { Dados, Divida } from "@/lib/tipos";
import { simularQuitacao } from "@/lib/dividas";
import { mesesParaTexto, reais } from "@/lib/formato";
import type { Acoes } from "@/lib/armazenamento";

const VAZIA = { nome: "", saldo: "", jurosMensal: "", parcelaMinima: "" };

export function DividasTela({ dados, acoes }: { dados: Dados; acoes: Acoes }) {
  const [form, setForm] = useState(VAZIA);
  const [abrirForm, setAbrirForm] = useState(dados.dividas.length === 0);
  const [salvando, setSalvando] = useState(false);
  // valor extra: salva ao sair do campo (não a cada tecla)
  const [extra, setExtra] = useState(dados.valorExtraDividas ? String(dados.valorExtraDividas) : "");
  const extraNum = Math.max(0, Number(extra) || 0);


  const total = dados.dividas.reduce((s, d) => s + d.saldo, 0);
  const minimos = dados.dividas.reduce((s, d) => s + d.parcelaMinima, 0);

  const sim = useMemo(() => {
    if (!dados.dividas.length) return null;
    return {
      avalanche: simularQuitacao(dados.dividas, extraNum, "avalanche"),
      bola: simularQuitacao(dados.dividas, extraNum, "bolaDeNeve"),
      semExtra: simularQuitacao(dados.dividas, 0, "avalanche"),
    };
  }, [dados.dividas, extraNum]);

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    const d: Omit<Divida, "id"> = {
      nome: form.nome.trim() || "Dívida",
      saldo: Number(form.saldo),
      jurosMensal: Number(form.jurosMensal),
      parcelaMinima: Number(form.parcelaMinima),
    };
    if (!(d.saldo > 0) || d.jurosMensal < 0 || !(d.parcelaMinima > 0)) return;
    setSalvando(true);
    try {
      await acoes.adicionarDivida(d);
      setForm(VAZIA);
      setAbrirForm(false);
    } catch {
      /* erro já aparece no topo */
    } finally {
      setSalvando(false);
    }
  }

  const remover = (id: string) => void acoes.removerDivida(id);

  const melhor = sim && sim.avalanche.jurosTotais <= sim.bola.jurosTotais ? "avalanche" : "bola";

  return (
    <div className="pilha">
      <section className="cartao">
        <h2>Sair das dívidas</h2>
        {dados.dividas.length ? (
          <div className="linha-dupla">
            <div>
              <span className="rotulo">Total devido</span>
              <span className="valor-grande negativo">{reais(total)}</span>
            </div>
            <div>
              <span className="rotulo">Mínimos por mês</span>
              <span>{reais(minimos)}</span>
            </div>
          </div>
        ) : (
          <p className="sutil">
            Cadastre cartão, cheque especial, empréstimos e carnês. O app monta o plano mais rápido para quitar tudo.
          </p>
        )}
      </section>

      {dados.dividas.length > 0 && (
        <section className="cartao">
          <ul className="lista">
            {[...dados.dividas]
              .sort((a, b) => b.jurosMensal - a.jurosMensal)
              .map((d) => (
                <li key={d.id} className="item">
                  <div className="item-texto">
                    <span>{d.nome}</span>
                    <span className="sutil">
                      {d.jurosMensal.toLocaleString("pt-BR")}% ao mês · mínimo {reais(d.parcelaMinima)}
                    </span>
                  </div>
                  <span>{reais(d.saldo)}</span>
                  <button className="botao-x" onClick={() => remover(d.id)} aria-label={`Apagar ${d.nome}`}>
                    ×
                  </button>
                </li>
              ))}
          </ul>
          {!abrirForm && (
            <button className="botao fantasma largo" onClick={() => setAbrirForm(true)}>
              + Adicionar dívida
            </button>
          )}
        </section>
      )}

      {abrirForm && (
        <form className="cartao pilha-pequena" onSubmit={adicionar}>
          <h2>Nova dívida</h2>
          <label>
            Nome
            <input
              placeholder="Ex.: Cartão Nubank, Cheque especial"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
            />
          </label>
          <div className="grade-2">
            <label>
              Quanto deve (R$)
              <input
                required
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                value={form.saldo}
                onChange={(e) => setForm({ ...form, saldo: e.target.value })}
              />
            </label>
            <label>
              Juros (% ao mês)
              <input
                required
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                placeholder="cartão ≈ 14"
                value={form.jurosMensal}
                onChange={(e) => setForm({ ...form, jurosMensal: e.target.value })}
              />
            </label>
          </div>
          <label>
            Parcela mínima (R$/mês)
            <input
              required
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              value={form.parcelaMinima}
              onChange={(e) => setForm({ ...form, parcelaMinima: e.target.value })}
            />
          </label>
          <div className="acoes fim">
            {dados.dividas.length > 0 && (
              <button type="button" className="botao fantasma" onClick={() => setAbrirForm(false)}>
                Cancelar
              </button>
            )}
            <button className="botao primario" disabled={salvando}>
              {salvando ? "Salvando…" : "Adicionar"}
            </button>
          </div>
        </form>
      )}

      {sim && (
        <section className="cartao pilha-pequena">
          <h2>Seu plano</h2>
          <label>
            Quanto consegue pagar a mais por mês, além dos mínimos? (R$)
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="10"
              value={extra}
              placeholder="0"
              onChange={(e) => setExtra(e.target.value)}
              onBlur={() => extraNum !== dados.valorExtraDividas && void acoes.definirValorExtra(extraNum)}
            />
          </label>

          {!sim.avalanche.quita ? (
            <div className="alerta perigo">
              <strong>Com esses pagamentos a dívida não acaba</strong>
              <span>
                Os juros crescem mais rápido do que você paga. Aumente o valor extra ou tente renegociar as dívidas de
                juros mais altos.
              </span>
            </div>
          ) : (
            <>
              <div className="comparacao">
                <EstrategiaCartao
                  titulo="Avalanche"
                  subtitulo="Maior juros primeiro"
                  r={sim.avalanche}
                  recomendada={melhor === "avalanche"}
                />
                <EstrategiaCartao
                  titulo="Bola de neve"
                  subtitulo="Menor dívida primeiro"
                  r={sim.bola}
                  recomendada={melhor === "bola"}
                />
              </div>
              {extraNum > 0 && sim.semExtra.quita && (
                <p className="sutil">
                  Pagando só os mínimos levaria {mesesParaTexto(sim.semExtra.meses)} e {reais(sim.semExtra.jurosTotais)}{" "}
                  de juros. Com o extra você economiza{" "}
                  <strong className="positivo">{reais(sim.semExtra.jurosTotais - sim.avalanche.jurosTotais)}</strong>.
                </p>
              )}
              <div>
                <span className="rotulo">Ordem de quitação (avalanche)</span>
                <ol className="ordem">
                  {sim.avalanche.ordem.map((o) => (
                    <li key={o.id}>
                      {o.nome} <span className="sutil">— quitada em {mesesParaTexto(o.mes)}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}

function EstrategiaCartao({
  titulo,
  subtitulo,
  r,
  recomendada,
}: {
  titulo: string;
  subtitulo: string;
  r: ReturnType<typeof simularQuitacao>;
  recomendada: boolean;
}) {
  return (
    <div className={`estrategia ${recomendada ? "recomendada" : ""}`}>
      {recomendada && <span className="etiqueta">Menos juros</span>}
      <strong>{titulo}</strong>
      <span className="sutil pequeno">{subtitulo}</span>
      <span className="valor-medio">{mesesParaTexto(r.meses)}</span>
      <span className="sutil pequeno">{reais(r.jurosTotais)} de juros</span>
    </div>
  );
}
