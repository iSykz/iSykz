"use client";

import { useState } from "react";
import { useDados } from "@/lib/armazenamento";
import { Inicio } from "./Inicio";
import { Lancar } from "./Lancar";
import { OrcamentoTela } from "./OrcamentoTela";
import { DividasTela } from "./DividasTela";
import { Coach } from "./Coach";
import { Entrar } from "./Entrar";
import { Logo } from "./Logo";

type Aba = "inicio" | "lancar" | "orcamento" | "dividas" | "coach";

const ABAS: { id: Aba; rotulo: string; icone: string }[] = [
  { id: "inicio", rotulo: "Início", icone: "◉" },
  { id: "orcamento", rotulo: "Limites", icone: "▤" },
  { id: "lancar", rotulo: "Lançar", icone: "+" },
  { id: "dividas", rotulo: "Dívidas", icone: "↘" },
  { id: "coach", rotulo: "Coach", icone: "✦" },
];

export function App() {
  const { dados, acoes, modo, email, estado, erro, aviso, limparAviso, limparErro } = useDados();
  const [aba, setAba] = useState<Aba>("inicio");
  const [menu, setMenu] = useState(false);

  if (estado === "carregando") return <main className="carregando">Carregando…</main>;
  if (estado === "entrar") return <Entrar />;

  return (
    <>
      <header className="topo">
        <span className="marca">
          <Logo altura={28} />
        </span>
        <div className="topo-direita">
          <span className={`selo ${dados.plano.tipo}`}>{dados.plano.tipo === "premium" ? "Premium" : "Grátis"}</span>
          {modo === "conta" && (
            <button className="botao-conta" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-label="Minha conta">
              {(email ?? "?").charAt(0).toUpperCase()}
            </button>
          )}
        </div>
        {menu && (
          <div className="menu-conta cartao">
            <span className="sutil pequeno">Conectado como</span>
            <strong className="email">{email}</strong>
            <button
              className="botao fantasma largo"
              onClick={() => {
                setMenu(false);
                void acoes.sair();
              }}
            >
              Sair
            </button>
          </div>
        )}
      </header>

      <main className="conteudo">
        {modo === "local" && (
          <div className="alerta atencao faixa">
            Modo de teste: os dados ficam só neste aparelho. Configure o Supabase para ter login e salvar na nuvem.
          </div>
        )}
        {aviso && (
          <div className="alerta ok faixa" role="status">
            <span>{aviso}</span>
            <button className="link" onClick={limparAviso}>
              Ok
            </button>
          </div>
        )}
        {erro && (
          <div className="alerta perigo faixa" role="alert">
            <span>{erro}</span>
            <button className="link" onClick={limparErro}>
              Fechar
            </button>
          </div>
        )}

        {aba === "inicio" && <Inicio dados={dados} acoes={acoes} irPara={setAba} />}
        {aba === "lancar" && <Lancar dados={dados} acoes={acoes} aoConcluir={() => setAba("inicio")} />}
        {aba === "orcamento" && <OrcamentoTela dados={dados} acoes={acoes} />}
        {aba === "dividas" && <DividasTela dados={dados} acoes={acoes} />}
        {aba === "coach" && <Coach dados={dados} acoes={acoes} />}
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

export type { Aba };
