"use client";

import { useEffect, useRef, useState } from "react";
import {
  CATEGORIAS_DESPESA,
  CATEGORIAS_RECEITA,
  LIMITE_IA_GRATIS,
  type Categoria,
  type Dados,
  type Origem,
  type Sugestao,
} from "@/lib/tipos";
import { hojeISO, novoId, reais } from "@/lib/formato";
import { prepararImagem } from "@/lib/imagem";
import { ouvir, vozDisponivel } from "@/lib/voz";
import type { Atualizar } from "./App";

const EXEMPLOS = ["gastei 40 no mercado", "uber 23,50 ontem", "recebi 2.500 de salário", "paguei 180 da fatura do cartão"];

export function Lancar({ dados, atualizar, aoConcluir }: { dados: Dados; atualizar: Atualizar; aoConcluir: () => void }) {
  const [texto, setTexto] = useState("");
  const [ouvindo, setOuvindo] = useState(false);
  const [carregando, setCarregando] = useState<null | "texto" | "foto">(null);
  const [sugestoes, setSugestoes] = useState<Sugestao[]>([]);
  const [origem, setOrigem] = useState<Origem>("texto");
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [temVoz, setTemVoz] = useState(false);
  const pararVoz = useRef<() => void>(() => {});
  const inputFoto = useRef<HTMLInputElement>(null);

  useEffect(() => setTemVoz(vozDisponivel()), []);
  useEffect(() => () => pararVoz.current(), []);

  const premium = dados.plano.tipo === "premium";
  const restantes = LIMITE_IA_GRATIS - dados.plano.usosIA;
  const semCota = !premium && restantes <= 0;

  async function interpretar(corpo: { texto?: string; imagem?: { dados: string; tipo: string } }, de: Origem) {
    if (semCota) {
      setErro(`Você usou os ${LIMITE_IA_GRATIS} lançamentos com IA do plano grátis este mês. Lance manualmente ou assine o Premium.`);
      return;
    }
    setErro(null);
    setAviso(null);
    setOrigem(de);
    setCarregando(de === "foto" ? "foto" : "texto");
    try {
      const r = await fetch("/api/interpretar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...corpo, hoje: hojeISO() }),
      });
      const json = (await r.json()) as { transacoes?: Sugestao[]; observacao?: string; erro?: string };
      if (!r.ok) throw new Error(json.erro ?? "Falha ao interpretar.");
      atualizar((d) => ({ ...d, plano: { ...d.plano, usosIA: d.plano.usosIA + 1 } }));
      setSugestoes(json.transacoes ?? []);
      setAviso(json.observacao ?? null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao interpretar.");
    } finally {
      setCarregando(null);
    }
  }

  function alternarVoz() {
    if (ouvindo) {
      pararVoz.current();
      return;
    }
    setErro(null);
    setOuvindo(true);
    pararVoz.current = ouvir({
      aoParcial: setTexto,
      aoFinal: (t) => {
        setOuvindo(false);
        setTexto(t);
        void interpretar({ texto: t }, "voz");
      },
      aoErro: (m) => {
        setOuvindo(false);
        setErro(m);
      },
    });
  }

  async function aoEscolherFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    e.target.value = "";
    if (!arquivo) return;
    try {
      const imagem = await prepararImagem(arquivo);
      await interpretar({ imagem, texto: texto.trim() || undefined }, "foto");
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não consegui ler a foto.");
    }
  }

  function editar(i: number, campo: Partial<Sugestao>) {
    setSugestoes((s) => s.map((x, j) => (j === i ? { ...x, ...campo } : x)));
  }

  function salvar() {
    const validas = sugestoes.filter((s) => s.valor > 0 && s.descricao.trim());
    if (!validas.length) return;
    atualizar((d) => ({
      ...d,
      transacoes: [...validas.map((s) => ({ ...s, id: novoId(), origem })), ...d.transacoes],
    }));
    setSugestoes([]);
    setTexto("");
    setAviso(null);
    aoConcluir();
  }

  function lancarManual() {
    setErro(null);
    setAviso(null);
    setOrigem("manual");
    setSugestoes([{ descricao: "", valor: 0, tipo: "despesa", categoria: "Outros", data: hojeISO() }]);
  }

  return (
    <div className="pilha">
      <section className="cartao">
        <h2>O que entrou ou saiu?</h2>
        <form
          className="campo-ia"
          onSubmit={(e) => {
            e.preventDefault();
            if (texto.trim()) void interpretar({ texto }, "texto");
          }}
        >
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Ex.: gastei 40 no mercado e 12 no café"
            rows={2}
            maxLength={4000}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (texto.trim()) void interpretar({ texto }, "texto");
              }
            }}
          />
          <div className="acoes">
            <button
              type="button"
              className={`botao redondo ${ouvindo ? "gravando" : ""}`}
              onClick={alternarVoz}
              disabled={!temVoz || carregando !== null}
              title={temVoz ? "Falar o gasto" : "Áudio indisponível neste navegador"}
              aria-label={ouvindo ? "Parar de ouvir" : "Falar o gasto"}
            >
              🎙
            </button>
            <button
              type="button"
              className="botao redondo"
              onClick={() => inputFoto.current?.click()}
              disabled={carregando !== null}
              title="Foto do recibo ou comprovante"
              aria-label="Foto do recibo"
            >
              📷
            </button>
            <input ref={inputFoto} type="file" accept="image/*" capture="environment" hidden onChange={aoEscolherFoto} />
            <button type="submit" className="botao primario" disabled={!texto.trim() || carregando !== null}>
              {carregando === "texto" ? "Entendendo…" : carregando === "foto" ? "Lendo recibo…" : "Lançar"}
            </button>
          </div>
        </form>
        {ouvindo && <p className="sutil pulsando">Ouvindo… fale o gasto.</p>}
        <div className="chips">
          {EXEMPLOS.map((ex) => (
            <button key={ex} className="chip" onClick={() => setTexto(ex)} type="button">
              {ex}
            </button>
          ))}
        </div>
        <p className="sutil pequeno">
          {premium
            ? "Premium: lançamentos com IA ilimitados."
            : `${Math.max(0, restantes)} de ${LIMITE_IA_GRATIS} lançamentos com IA restantes este mês.`}{" "}
          <button className="link" onClick={lancarManual} type="button">
            Lançar manualmente
          </button>
        </p>
      </section>

      {erro && <div className="alerta perigo">{erro}</div>}
      {aviso && !sugestoes.length && <div className="alerta atencao">{aviso}</div>}

      {sugestoes.length > 0 && (
        <section className="cartao">
          <h2>{origem === "manual" ? "Novo lançamento" : "Confira antes de salvar"}</h2>
          {aviso && origem !== "manual" && <p className="sutil">{aviso}</p>}
          <div className="pilha-pequena">
            {sugestoes.map((s, i) => (
              <div key={i} className="sugestao">
                <div className="alternar">
                  {(["despesa", "receita"] as const).map((tipo) => (
                    <button
                      key={tipo}
                      type="button"
                      className={s.tipo === tipo ? "ativo" : ""}
                      onClick={() =>
                        editar(i, { tipo, categoria: tipo === "receita" ? "Salário" : "Outros" })
                      }
                    >
                      {tipo === "despesa" ? "Gasto" : "Receita"}
                    </button>
                  ))}
                </div>
                <label>
                  Descrição
                  <input value={s.descricao} onChange={(e) => editar(i, { descricao: e.target.value })} />
                </label>
                <div className="grade-2">
                  <label>
                    Valor (R$)
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      value={s.valor || ""}
                      onChange={(e) => editar(i, { valor: Number(e.target.value) })}
                    />
                  </label>
                  <label>
                    Data
                    <input type="date" value={s.data} onChange={(e) => editar(i, { data: e.target.value })} />
                  </label>
                </div>
                <label>
                  Categoria
                  <select value={s.categoria} onChange={(e) => editar(i, { categoria: e.target.value as Categoria })}>
                    {(s.tipo === "receita" ? CATEGORIAS_RECEITA : CATEGORIAS_DESPESA).map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                {sugestoes.length > 1 && (
                  <button className="link perigo" type="button" onClick={() => setSugestoes((x) => x.filter((_, j) => j !== i))}>
                    Remover este
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="acoes fim">
            <button className="botao fantasma" onClick={() => setSugestoes([])} type="button">
              Cancelar
            </button>
            <button className="botao primario" onClick={salvar} type="button">
              Salvar {sugestoes.length > 1 ? `${sugestoes.length} lançamentos` : ""} ·{" "}
              {reais(sugestoes.reduce((t, s) => t + (s.valor || 0), 0))}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
