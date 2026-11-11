"use client";

import { useMemo, useState } from "react";
import type { Dados, Divida } from "@/lib/tipos";
import { extraParaQuitar, recomendar, simularQuitacao, type Estrategia } from "@/lib/dividas";
import { hojeISO, mesesParaTexto, reais } from "@/lib/formato";
import { jurosAoAno, porcento } from "@/lib/numero";
import type { Acoes } from "@/lib/armazenamento";
import { CampoNumero } from "./Campos";

/** Tipos comuns de dívida. As taxas são estimativas para quem não sabe a sua. */
const TIPOS = [
  { rotulo: "Cartão de crédito", nome: "Cartão de crédito", juros: 14 },
  { rotulo: "Cheque especial", nome: "Cheque especial", juros: 7.5 },
  { rotulo: "Empréstimo pessoal", nome: "Empréstimo pessoal", juros: 5 },
  { rotulo: "Carnê de loja", nome: "Carnê de loja", juros: 6 },
  { rotulo: "Financiamento de carro", nome: "Financiamento de carro", juros: 2 },
  { rotulo: "Consignado", nome: "Consignado", juros: 1.8 },
  { rotulo: "Outra", nome: "", juros: 0 },
] as const;

interface Rascunho {
  nome: string;
  saldo: number;
  jurosMensal: number;
  parcelaMinima: number;
}
const VAZIO: Rascunho = { nome: "", saldo: 0, jurosMensal: 0, parcelaMinima: 0 };

function validar(r: Rascunho): Partial<Record<keyof Rascunho, string>> {
  const e: Partial<Record<keyof Rascunho, string>> = {};
  if (!(r.saldo > 0)) e.saldo = "Informe quanto você deve hoje.";
  else if (r.saldo > 90_000_000) e.saldo = "Valor muito alto. Confira o que você digitou.";
  if (!Number.isFinite(r.jurosMensal) || r.jurosMensal < 0) e.jurosMensal = "Informe os juros.";
  else if (r.jurosMensal > 100) e.jurosMensal = "A taxa é por mês, não por ano. Acima de 100% ao mês é raro.";
  if (!(r.parcelaMinima > 0)) e.parcelaMinima = "Informe quanto você paga por mês.";
  return e;
}

export function DividasTela({ dados, acoes }: { dados: Dados; acoes: Acoes }) {
  const [editando, setEditando] = useState<string | "nova" | null>(dados.dividas.length === 0 ? "nova" : null);
  const [pagando, setPagando] = useState<string | null>(null);
  const [apagando, setApagando] = useState<string | null>(null);
  const [quitada, setQuitada] = useState<string | null>(null);
  const [estrategia, setEstrategia] = useState<Estrategia | null>(null);

  const total = dados.dividas.reduce((s, d) => s + d.saldo, 0);
  const minimos = dados.dividas.reduce((s, d) => s + d.parcelaMinima, 0);
  const jurosDoMes = dados.dividas.reduce((s, d) => s + (d.saldo * d.jurosMensal) / 100, 0);
  const extra = dados.valorExtraDividas;

  const sim = useMemo(() => {
    if (!dados.dividas.length) return null;
    const avalanche = simularQuitacao(dados.dividas, extra, "avalanche");
    const bola = simularQuitacao(dados.dividas, extra, "bolaDeNeve");
    return {
      avalanche,
      bola,
      semExtra: simularQuitacao(dados.dividas, 0, "avalanche"),
      recomendada: recomendar(avalanche, bola),
      faltaExtra: avalanche.quita ? null : extraParaQuitar(dados.dividas),
    };
  }, [dados.dividas, extra]);

  const usada: Estrategia = estrategia ?? sim?.recomendada.estrategia ?? "avalanche";
  const plano = sim ? (usada === "avalanche" ? sim.avalanche : sim.bola) : null;

  const ordenadas = [...dados.dividas].sort((a, b) =>
    usada === "avalanche" ? b.jurosMensal - a.jurosMensal || a.saldo - b.saldo : a.saldo - b.saldo,
  );

  async function salvarDivida(r: Rascunho, id?: string) {
    const dados_ = { ...r, nome: r.nome.trim() || "Dívida" };
    if (id) await acoes.atualizarDivida(id, dados_);
    else await acoes.adicionarDivida(dados_);
    setEditando(null);
  }

  async function registrarPagamento(d: Divida, valor: number, lancar: boolean) {
    if (lancar) {
      await acoes.adicionarTransacoes([
        {
          descricao: `Pagamento ${d.nome}`,
          valor,
          tipo: "despesa",
          categoria: "Dívidas",
          data: hojeISO(),
          origem: "manual",
        },
      ]);
    }
    if (valor >= d.saldo - 0.005) {
      await acoes.removerDivida(d.id);
      setQuitada(d.nome);
    } else {
      await acoes.atualizarDivida(d.id, { saldo: Math.round((d.saldo - valor) * 100) / 100 });
    }
    setPagando(null);
  }

  return (
    <div className="pilha">
      {quitada && (
        <div className="alerta ok faixa" role="status">
          <span>
            <strong>Dívida quitada! 🎉</strong> {quitada} saiu da sua lista.
          </span>
          <button className="link" onClick={() => setQuitada(null)}>
            Ok
          </button>
        </div>
      )}

      <section className="cartao">
        <h2>Sair das dívidas</h2>
        {dados.dividas.length ? (
          <>
            <span className="rotulo">Total devido</span>
            <span className="valor-grande negativo">{reais(total)}</span>
            <div className="linha-tripla">
              <div>
                <span className="rotulo">Mínimos/mês</span>
                <span>{reais(minimos)}</span>
              </div>
              <div>
                <span className="rotulo">Só de juros/mês</span>
                <span className="negativo">{reais(jurosDoMes)}</span>
              </div>
              <div>
                <span className="rotulo">Dívidas</span>
                <span>{dados.dividas.length}</span>
              </div>
            </div>
            {jurosDoMes > 0 && (
              <p className="sutil pequeno espaco-topo">
                Sem pagar nada, a dívida cresce {reais(jurosDoMes)} por mês só de juros.
              </p>
            )}
          </>
        ) : (
          <p className="sutil">
            Cadastre cartão, cheque especial, empréstimos e carnês. O app monta o plano mais rápido para quitar tudo.
          </p>
        )}
      </section>

      {dados.dividas.length > 0 && (
        <section className="cartao">
          <ul className="lista">
            {ordenadas.map((d, i) => (
              <li key={d.id} className="divida">
                {editando === d.id ? (
                  <FormDivida
                    inicial={d}
                    aoSalvar={(r) => salvarDivida(r, d.id)}
                    aoCancelar={() => setEditando(null)}
                    titulo="Editar dívida"
                  />
                ) : (
                  <>
                    <div className="divida-topo">
                      <div className="item-texto">
                        <span>
                          {d.nome}
                          {i === 0 && extra > 0 && sim?.avalanche.quita && (
                            <span className="etiqueta-inline">Extra vai aqui</span>
                          )}
                        </span>
                        <span className="sutil pequeno">
                          {porcento(d.jurosMensal)} ao mês
                          {d.jurosMensal > 0 && ` · ${porcento(jurosAoAno(d.jurosMensal))} ao ano`} · mínimo{" "}
                          {reais(d.parcelaMinima)}
                        </span>
                      </div>
                      <span className="divida-saldo">{reais(d.saldo)}</span>
                    </div>
                    {apagando === d.id ? (
                      <div className="confirmar">
                        <span className="sutil pequeno">Apagar {d.nome}?</span>
                        <button
                          className="link perigo"
                          onClick={() => {
                            void acoes.removerDivida(d.id);
                            setApagando(null);
                          }}
                        >
                          Apagar
                        </button>
                        <button className="link sutil" onClick={() => setApagando(null)}>
                          Cancelar
                        </button>
                      </div>
                    ) : pagando === d.id ? (
                      <FormPagamento divida={d} aoPagar={registrarPagamento} aoCancelar={() => setPagando(null)} />
                    ) : (
                      <div className="divida-acoes">
                        <button className="botao pequeno" onClick={() => setPagando(d.id)}>
                          Registrar pagamento
                        </button>
                        <button className="link" onClick={() => setEditando(d.id)}>
                          Editar
                        </button>
                        <button className="link sutil" onClick={() => setApagando(d.id)}>
                          Apagar
                        </button>
                      </div>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
          {editando === null && (
            <button className="botao fantasma largo espaco-topo" onClick={() => setEditando("nova")}>
              + Adicionar dívida
            </button>
          )}
        </section>
      )}

      {editando === "nova" && (
        <section className="cartao">
          <FormDivida
            inicial={VAZIO}
            aoSalvar={(r) => salvarDivida(r)}
            aoCancelar={dados.dividas.length ? () => setEditando(null) : undefined}
            titulo="Nova dívida"
            mostrarTipos
          />
        </section>
      )}

      {sim && plano && (
        <section className="cartao pilha-pequena">
          <h2>Seu plano</h2>
          <CampoNumero
            rotulo="Quanto consegue pagar a mais por mês, além dos mínimos?"
            prefixo="R$"
            valor={extra}
            placeholder="0"
            gravarAoSair
            aoMudar={(v) => void acoes.definirValorExtra(v)}
            dica="Todo mês esse valor vai para a dívida-alvo. Quando ela acaba, a parcela dela entra na próxima."
          />

          {!plano.quita ? (
            <div className="pilha-pequena">
              <div className="alerta perigo">
                <strong>Com esses pagamentos a dívida não acaba</strong>
                <span>Os juros crescem mais rápido do que você paga. Pagar só o mínimo não resolve.</span>
              </div>
              {sim.faltaExtra !== null && sim.faltaExtra > extra && (
                <p>
                  Para quitar em até 10 anos, seriam <strong>{reais(sim.faltaExtra)}</strong> a mais por mês (hoje:{" "}
                  {reais(extra)}).
                </p>
              )}
              <div className="caixa-ajuda">
                <strong>Se não couber no orçamento, renegociar é o caminho</strong>
                <ul>
                  <li>Peça ao banco a troca da dívida mais cara (cartão, cheque especial) por uma linha mais barata.</li>
                  <li>Procure feirões de renegociação do seu banco ou dos birôs de crédito.</li>
                  <li>
                    Se a dívida não cabe na sua renda sem faltar o básico, a Lei 14.181/2021 permite um plano de até 5
                    anos. Procure o <strong>Procon</strong> ou a <strong>Defensoria Pública</strong> da sua cidade: o
                    atendimento é gratuito.
                  </li>
                </ul>
              </div>
            </div>
          ) : (
            <>
              <div className="comparacao">
                {(
                  [
                    ["avalanche", "Avalanche", "Maior juros primeiro", sim.avalanche],
                    ["bolaDeNeve", "Bola de neve", "Menor dívida primeiro", sim.bola],
                  ] as const
                ).map(([id, titulo, sub, r]) => (
                  <button
                    key={id}
                    type="button"
                    className={`estrategia ${usada === id ? "escolhida" : ""}`}
                    onClick={() => setEstrategia(id)}
                    aria-pressed={usada === id}
                  >
                    {sim.recomendada.estrategia === id && <span className="etiqueta">Recomendada</span>}
                    <strong>{titulo}</strong>
                    <span className="sutil pequeno">{sub}</span>
                    <span className="valor-medio">{mesesParaTexto(r.meses)}</span>
                    <span className="sutil pequeno">{reais(r.jurosTotais)} de juros</span>
                  </button>
                ))}
              </div>
              <p className="sutil pequeno">{sim.recomendada.motivo}</p>

              {extra > 0 && sim.semExtra.quita && (
                <p className="sutil">
                  Pagando só os mínimos levaria {mesesParaTexto(sim.semExtra.meses)} e {reais(sim.semExtra.jurosTotais)}{" "}
                  de juros. Com o extra você economiza{" "}
                  <strong className="positivo">{reais(Math.max(0, sim.semExtra.jurosTotais - plano.jurosTotais))}</strong>.
                </p>
              )}

              {extra > 0 && ordenadas[0] && (
                <p className="sutil">
                  Os {reais(extra)} a mais vão todos para <strong>{ordenadas[0].nome}</strong> até ela acabar. As outras
                  seguem recebendo só o mínimo.
                </p>
              )}

              <div>
                <span className="rotulo">Quando cada dívida acaba</span>
                <ol className="ordem">
                  {plano.ordem.map((o) => (
                    <li key={o.id}>
                      {o.nome} <span className="sutil">— em {mesesParaTexto(o.mes)}</span>
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

function FormDivida({
  inicial,
  aoSalvar,
  aoCancelar,
  titulo,
  mostrarTipos,
}: {
  inicial: Rascunho;
  aoSalvar: (r: Rascunho) => Promise<void>;
  aoCancelar?: () => void;
  titulo: string;
  mostrarTipos?: boolean;
}) {
  const [r, setR] = useState<Rascunho>(inicial);
  const [tocado, setTocado] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const erros = validar(r);
  const mostrar = (campo: keyof Rascunho) => (tocado ? erros[campo] : undefined);

  // aviso (não impede salvar): a parcela não cobre nem os juros do mês
  const jurosMes = (r.saldo * r.jurosMensal) / 100;
  const parcelaFraca = r.saldo > 0 && r.parcelaMinima > 0 && r.parcelaMinima <= jurosMes;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setTocado(true);
    if (Object.keys(erros).length) return;
    setSalvando(true);
    try {
      await aoSalvar(r);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form className="pilha-pequena" onSubmit={enviar} noValidate>
      <h2>{titulo}</h2>

      {mostrarTipos && (
        <div>
          <span className="rotulo">Que tipo de dívida é?</span>
          <div className="chips">
            {TIPOS.map((t) => (
              <button
                key={t.rotulo}
                type="button"
                className={`chip ${r.nome === t.nome && t.nome ? "ativo" : ""}`}
                onClick={() => setR((x) => ({ ...x, nome: t.nome, jurosMensal: t.juros || x.jurosMensal }))}
              >
                {t.rotulo}
              </button>
            ))}
          </div>
          <span className="msg-dica">A taxa vem preenchida por estimativa. Confira na sua fatura ou contrato.</span>
        </div>
      )}

      <label className="campo-rotulado">
        <span>Nome</span>
        <input
          placeholder="Ex.: Cartão Nubank"
          maxLength={80}
          value={r.nome}
          onChange={(e) => setR({ ...r, nome: e.target.value })}
        />
      </label>

      <div className="grade-2">
        <CampoNumero
          rotulo="Quanto deve hoje"
          prefixo="R$"
          valor={r.saldo}
          aoMudar={(v) => setR((x) => ({ ...x, saldo: v }))}
          erro={mostrar("saldo")}
        />
        <CampoNumero
          rotulo="Juros por mês"
          sufixo="%"
          valor={r.jurosMensal}
          aoMudar={(v) => setR((x) => ({ ...x, jurosMensal: v }))}
          erro={mostrar("jurosMensal")}
          dica={
            r.jurosMensal > 0 && r.jurosMensal <= 100
              ? `= ${porcento(jurosAoAno(r.jurosMensal))} ao ano`
              : "Está na fatura ou no contrato (procure por CET)."
          }
        />
      </div>

      <CampoNumero
        rotulo="Quanto você paga por mês"
        prefixo="R$"
        valor={r.parcelaMinima}
        aoMudar={(v) => setR((x) => ({ ...x, parcelaMinima: v }))}
        erro={mostrar("parcelaMinima")}
        dica="A parcela fixa ou o pagamento mínimo da fatura."
      />

      {parcelaFraca && (
        <div className="alerta atencao">
          <strong>Essa parcela não cobre nem os juros</strong>
          <span>
            Só de juros são {reais(jurosMes)} por mês. Pagando {reais(r.parcelaMinima)}, a dívida cresce em vez de
            diminuir. Pode cadastrar assim mesmo: o plano vai mostrar o que falta.
          </span>
        </div>
      )}

      <div className="acoes fim">
        {aoCancelar && (
          <button type="button" className="botao fantasma" onClick={aoCancelar}>
            Cancelar
          </button>
        )}
        <button className="botao primario" disabled={salvando}>
          {salvando ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </form>
  );
}

function FormPagamento({
  divida,
  aoPagar,
  aoCancelar,
}: {
  divida: Divida;
  aoPagar: (d: Divida, valor: number, lancar: boolean) => Promise<void>;
  aoCancelar: () => void;
}) {
  const [valor, setValor] = useState(Math.min(divida.parcelaMinima, divida.saldo));
  const [lancar, setLancar] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const quita = valor >= divida.saldo - 0.005;
  const valido = valor > 0;

  return (
    <div className="pagamento pilha-pequena">
      <CampoNumero
        rotulo={`Quanto você pagou de ${divida.nome}?`}
        prefixo="R$"
        valor={valor}
        aoMudar={setValor}
        autoFocus
        erro={!valido ? "Informe o valor pago." : null}
        dica={quita ? "Isso quita a dívida inteira." : `Saldo depois: ${reais(divida.saldo - valor)}`}
      />
      <label className="caixa-marcar">
        <input type="checkbox" checked={lancar} onChange={(e) => setLancar(e.target.checked)} />
        <span>Lançar como gasto do mês em Dívidas</span>
      </label>
      <div className="acoes fim">
        <button type="button" className="botao fantasma" onClick={aoCancelar}>
          Cancelar
        </button>
        <button
          type="button"
          className="botao primario"
          disabled={!valido || salvando}
          onClick={async () => {
            setSalvando(true);
            try {
              await aoPagar(divida, valor, lancar);
            } finally {
              setSalvando(false);
            }
          }}
        >
          {salvando ? "Salvando…" : quita ? "Quitar dívida" : "Registrar"}
        </button>
      </div>
    </div>
  );
}
