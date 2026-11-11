import "./ia"; // atende /api/* com a capacidade "sample"
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/components/App";
import type { Dados } from "@/lib/tipos";
import { hojeISO, mesISO } from "@/lib/formato";

function exemplo(): Dados {
  const hoje = new Date();
  const dia = (d: number) => hojeISO(new Date(hoje.getFullYear(), hoje.getMonth(), Math.min(d, hoje.getDate())));
  const t = (descricao: string, valor: number, categoria: string, d: number, tipo = "despesa", origem = "texto") => ({
    id: Math.random().toString(36).slice(2),
    descricao: `${descricao} (exemplo)`,
    valor,
    tipo,
    categoria,
    data: dia(d),
    origem,
  });
  return {
    transacoes: [
      t("Salário", 3200, "Salário", 5, "receita", "manual"),
      t("Mercado Assaí", 412.8, "Mercado", 6, "despesa", "foto"),
      t("iFood", 58.9, "Alimentação", 7, "despesa", "voz"),
      t("Uber para o trabalho", 23.5, "Transporte", 8),
      t("Conta de luz", 187.4, "Contas", 9, "despesa", "foto"),
      t("Netflix", 44.9, "Assinaturas", 10),
      t("Farmácia", 36, "Saúde", 10, "despesa", "voz"),
      t("Fatura do cartão (parcial)", 300, "Dívidas", 10),
    ] as Dados["transacoes"],
    dividas: [
      { id: "e1", nome: "Cartão de crédito (exemplo)", saldo: 2800, jurosMensal: 14, parcelaMinima: 300 },
      { id: "e2", nome: "Empréstimo pessoal (exemplo)", saldo: 4500, jurosMensal: 4.5, parcelaMinima: 280 },
      { id: "e3", nome: "Carnê da loja (exemplo)", saldo: 600, jurosMensal: 6, parcelaMinima: 90 },
    ],
    orcamento: { Mercado: 450, Alimentação: 200, Transporte: 150, Lazer: 150 },
    plano: { tipo: "gratis", mes: mesISO(), usosIA: 0 },
    valorExtraDividas: 200,
  };
}

const substituir = (d: Dados) => window.dispatchEvent(new CustomEvent("zerou:substituir", { detail: d }));

function FaixaTeste() {
  const [confirmar, setConfirmar] = useState(false);
  return (
    <div className="faixa-teste">
      <span>
        <strong>Versão de teste.</strong> A IA usa a sua conta Claude e os dados ficam salvos só para você.
      </span>
      <span className="faixa-acoes">
        {confirmar ? (
          <>
            <span>Apagar tudo?</span>
            <button
              className="link perigo-texto"
              onClick={() => {
                substituir({} as Dados);
                setConfirmar(false);
              }}
            >
              Sim, apagar
            </button>
            <button className="link" onClick={() => setConfirmar(false)}>
              Cancelar
            </button>
          </>
        ) : (
          <>
            <button className="link" onClick={() => substituir(exemplo())}>
              Preencher com exemplo
            </button>
            <button className="link" onClick={() => setConfirmar(true)}>
              Apagar tudo
            </button>
          </>
        )}
      </span>
    </div>
  );
}

createRoot(document.getElementById("raiz")!).render(
  <>
    <FaixaTeste />
    <App />
  </>,
);
