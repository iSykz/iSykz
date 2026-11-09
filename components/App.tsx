"use client";

import { useState } from "react";
import { useDados } from "@/lib/armazenamento";
import { Inicio } from "./Inicio";
import { Lancar } from "./Lancar";
import { OrcamentoTela } from "./OrcamentoTela";
import { DividasTela } from "./DividasTela";
import { Coach } from "./Coach";

type Aba = "inicio" | "lancar" | "orcamento" | "dividas" | "coach";

const ABAS: { id: Aba; rotulo: string; icone: string }[] = [
  { id: "inicio", rotulo: "Início", icone: "◉" },
  { id: "orcamento", rotulo: "Limites", icone: "▤" },
  { id: "lancar", rotulo: "Lançar", icone: "+" },
  { id: "dividas", rotulo: "Dívidas", icone: "↘" },
  { id: "coach", rotulo: "Coach", icone: "✦" },
];

export function App() {
  const { dados, atualizar, pronto } = useDados();
  const [aba, setAba] = useState<Aba>("inicio");

  if (!pronto) return <main className="carregando">Carregando…</main>;

  return (
    <>
      <header className="topo">
        <span className="marca">Grana</span>
        <span className={`selo ${dados.plano.tipo}`}>{dados.plano.tipo === "premium" ? "Premium" : "Grátis"}</span>
      </header>

      <main className="conteudo">
        {aba === "inicio" && <Inicio dados={dados} atualizar={atualizar} irPara={setAba} />}
        {aba === "lancar" && <Lancar dados={dados} atualizar={atualizar} aoConcluir={() => setAba("inicio")} />}
        {aba === "orcamento" && <OrcamentoTela dados={dados} atualizar={atualizar} />}
        {aba === "dividas" && <DividasTela dados={dados} atualizar={atualizar} />}
        {aba === "coach" && <Coach dados={dados} atualizar={atualizar} />}
      </main>

      <nav className="abas" aria-label="Navegação">
        {ABAS.map((a) => (
          <button
            key={a.id}
            className={`aba ${aba === a.id ? "ativa" : ""} ${a.id === "lancar" ? "destaque" : ""}`}
            onClick={() => setAba(a.id)}
            aria-current={aba === a.id ? "page" : undefined}
          >
            <span className="icone" aria-hidden>
              {a.icone}
            </span>
            <span>{a.rotulo}</span>
          </button>
        ))}
      </nav>
    </>
  );
}

export type Atualizar = ReturnType<typeof useDados>["atualizar"];
export type { Aba };
