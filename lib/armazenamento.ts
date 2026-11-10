"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import type { Categoria, Dados, Divida, Plano, Transacao } from "./tipos";
import { mesISO } from "./formato";
import { supabaseConfigurado } from "./supabase/config";
import { supabaseNavegador } from "./supabase/navegador";

const CHAVE = "zerou:v1";

const inicial = (): Dados => ({
  transacoes: [],
  dividas: [],
  orcamento: {},
  plano: { tipo: "gratis", mes: mesISO(), usosIA: 0 },
  valorExtraDividas: 0,
});

function lerLocal(): Dados {
  try {
    const bruto = localStorage.getItem(CHAVE);
    if (!bruto) return inicial();
    const d = { ...inicial(), ...(JSON.parse(bruto) as Partial<Dados>) };
    if (d.plano.mes !== mesISO()) d.plano = { ...d.plano, mes: mesISO(), usosIA: 0 };
    return d;
  } catch {
    return inicial();
  }
}

function gravarLocal(d: Dados) {
  try {
    localStorage.setItem(CHAVE, JSON.stringify(d));
  } catch {
    /* armazenamento indisponível (aba anônima etc.) */
  }
}

function apagarLocal() {
  try {
    localStorage.removeItem(CHAVE);
  } catch {
    /* ignora */
  }
}

/* ---------- conversão banco (snake_case) <-> app ---------- */

interface LinhaTransacao {
  id: string;
  descricao: string;
  valor: number | string;
  tipo: Transacao["tipo"];
  categoria: Categoria;
  data: string;
  origem: Transacao["origem"];
}
interface LinhaDivida {
  id: string;
  nome: string;
  saldo: number | string;
  juros_mensal: number | string;
  parcela_minima: number | string;
}
interface LinhaPerfil {
  orcamento: Dados["orcamento"];
  valor_extra_dividas: number | string;
  uso_mes: string;
  usos_ia: number;
  plano_atual: Plano["tipo"];
}

const deTransacao = (l: LinhaTransacao): Transacao => ({ ...l, valor: Number(l.valor) });
const deDivida = (l: LinhaDivida): Divida => ({
  id: l.id,
  nome: l.nome,
  saldo: Number(l.saldo),
  jurosMensal: Number(l.juros_mensal),
  parcelaMinima: Number(l.parcela_minima),
});
const paraTransacao = (t: Omit<Transacao, "id">) => ({
  descricao: t.descricao.slice(0, 200),
  valor: t.valor,
  tipo: t.tipo,
  categoria: t.categoria,
  data: t.data,
  origem: t.origem,
});
const paraDivida = (d: Omit<Divida, "id">) => ({
  nome: d.nome.slice(0, 80),
  saldo: d.saldo,
  juros_mensal: d.jurosMensal,
  parcela_minima: d.parcelaMinima,
});

async function carregarDaConta(): Promise<Dados> {
  const sb = supabaseNavegador();
  const [perfil, transacoes, dividas] = await Promise.all([
    sb.from("perfis").select("orcamento, valor_extra_dividas, uso_mes, usos_ia, plano_atual").single(),
    sb.from("transacoes").select("id, descricao, valor, tipo, categoria, data, origem").order("data", { ascending: false }),
    sb.from("dividas").select("id, nome, saldo, juros_mensal, parcela_minima").order("criado_em"),
  ]);
  const erro = perfil.error ?? transacoes.error ?? dividas.error;
  if (erro) throw new Error(erro.message);
  const p = perfil.data as LinhaPerfil;
  return {
    transacoes: (transacoes.data as LinhaTransacao[]).map(deTransacao),
    dividas: (dividas.data as LinhaDivida[]).map(deDivida),
    orcamento: p.orcamento ?? {},
    valorExtraDividas: Number(p.valor_extra_dividas),
    plano: { tipo: p.plano_atual, mes: mesISO(), usosIA: p.uso_mes === mesISO() ? p.usos_ia : 0 },
  };
}

/** Se a pessoa usou o app antes de criar a conta, leva os dados do aparelho para a conta (uma vez). */
async function importarDadosLocais(conta: Dados): Promise<number> {
  const local = lerLocal();
  const temLocal = local.transacoes.length || local.dividas.length || Object.keys(local.orcamento).length;
  const contaVazia = !conta.transacoes.length && !conta.dividas.length;
  if (!temLocal || !contaVazia) return 0;

  const sb = supabaseNavegador();
  if (local.transacoes.length) {
    const { error } = await sb.from("transacoes").insert(local.transacoes.map(paraTransacao));
    if (error) throw new Error(error.message);
  }
  if (local.dividas.length) {
    const { error } = await sb.from("dividas").insert(local.dividas.map(paraDivida));
    if (error) throw new Error(error.message);
  }
  const { data: u } = await sb.auth.getUser();
  if (u.user) {
    await sb
      .from("perfis")
      .update({ orcamento: local.orcamento, valor_extra_dividas: local.valorExtraDividas })
      .eq("id", u.user.id);
  }
  apagarLocal();
  return local.transacoes.length + local.dividas.length;
}

/* ---------- hook ---------- */

export type Modo = "local" | "conta";

export interface Acoes {
  adicionarTransacoes: (lista: Omit<Transacao, "id">[]) => Promise<void>;
  removerTransacao: (id: string) => Promise<void>;
  adicionarDivida: (d: Omit<Divida, "id">) => Promise<void>;
  removerDivida: (id: string) => Promise<void>;
  definirOrcamento: (cat: Categoria, valor: number) => Promise<void>;
  definirValorExtra: (v: number) => Promise<void>;
  /** Atualiza o contador da IA com o que o servidor respondeu (ou soma 1 no modo local). */
  registrarUsoIA: (resposta: { usos?: number | null; plano?: Plano["tipo"] | null }) => void;
  definirPlano: (tipo: Plano["tipo"]) => Promise<void>;
  sair: () => Promise<void>;
}

const novoIdLocal = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);

export function useDados() {
  const modo: Modo = supabaseConfigurado ? "conta" : "local";
  const [dados, setDados] = useState<Dados>(inicial);
  const [sessao, setSessao] = useState<Session | null>(null);
  const [estado, setEstado] = useState<"carregando" | "entrar" | "pronto">("carregando");
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const usuarioCarregado = useRef<string | null>(null);
  const dadosRef = useRef(dados);
  dadosRef.current = dados;

  // modo local: lê do aparelho
  useEffect(() => {
    if (modo !== "local") return;
    setDados(lerLocal());
    setEstado("pronto");
  }, [modo]);

  // modo local: grava a cada mudança
  useEffect(() => {
    if (modo === "local" && estado === "pronto") gravarLocal(dados);
  }, [dados, estado, modo]);

  // modo conta: acompanha o login
  useEffect(() => {
    if (modo !== "conta") return;
    const sb = supabaseNavegador();
    const aoMudar = async (s: Session | null) => {
      setSessao(s);
      if (!s) {
        usuarioCarregado.current = null;
        setDados(inicial());
        setEstado("entrar");
        return;
      }
      if (usuarioCarregado.current === s.user.id) return;
      usuarioCarregado.current = s.user.id;
      setEstado("carregando");
      try {
        let d = await carregarDaConta();
        const importados = await importarDadosLocais(d);
        if (importados) {
          d = await carregarDaConta();
          setAviso(`Trouxemos ${importados} itens que estavam salvos neste aparelho para a sua conta.`);
        }
        setDados(d);
        setErro(null);
      } catch {
        setErro("Não consegui carregar seus dados. Verifique a internet e recarregue a página.");
      }
      setEstado("pronto");
    };
    sb.auth.getSession().then(({ data }) => aoMudar(data.session));
    const { data: inscricao } = sb.auth.onAuthStateChange((_evento, s) => {
      // evita chamar o banco dentro do callback do auth (recomendação do Supabase)
      setTimeout(() => void aoMudar(s), 0);
    });
    return () => inscricao.subscription.unsubscribe();
  }, [modo]);

  /** Aplica a mudança na tela na hora e salva na conta; se falhar, recarrega do banco. */
  const salvar = useCallback(
    async (otimista: (d: Dados) => Dados, remoto?: () => PromiseLike<{ error: { message: string } | null }>) => {
      setDados(otimista);
      if (modo === "local" || !remoto) return;
      const { error } = await remoto();
      if (error) {
        setErro("Não consegui salvar. Verifique a internet e tente de novo.");
        try {
          setDados(await carregarDaConta());
        } catch {
          /* mantém o que está na tela */
        }
      } else setErro(null);
    },
    [modo],
  );

  const acoes: Acoes = {
    adicionarTransacoes: async (lista) => {
      if (modo === "local") {
        setDados((d) => ({ ...d, transacoes: [...lista.map((t) => ({ ...t, id: novoIdLocal() })), ...d.transacoes] }));
        return;
      }
      const sb = supabaseNavegador();
      const { data, error } = await sb
        .from("transacoes")
        .insert(lista.map(paraTransacao))
        .select("id, descricao, valor, tipo, categoria, data, origem");
      if (error) {
        setErro("Não consegui salvar o lançamento. Tente de novo.");
        throw new Error(error.message);
      }
      setErro(null);
      setDados((d) => ({ ...d, transacoes: [...(data as LinhaTransacao[]).map(deTransacao), ...d.transacoes] }));
    },
    removerTransacao: (id) =>
      salvar(
        (d) => ({ ...d, transacoes: d.transacoes.filter((t) => t.id !== id) }),
        () => supabaseNavegador().from("transacoes").delete().eq("id", id),
      ),
    adicionarDivida: async (divida) => {
      if (modo === "local") {
        setDados((d) => ({ ...d, dividas: [...d.dividas, { ...divida, id: novoIdLocal() }] }));
        return;
      }
      const { data, error } = await supabaseNavegador()
        .from("dividas")
        .insert(paraDivida(divida))
        .select("id, nome, saldo, juros_mensal, parcela_minima")
        .single();
      if (error) {
        setErro("Não consegui salvar a dívida. Tente de novo.");
        throw new Error(error.message);
      }
      setErro(null);
      setDados((d) => ({ ...d, dividas: [...d.dividas, deDivida(data as LinhaDivida)] }));
    },
    removerDivida: (id) =>
      salvar(
        (d) => ({ ...d, dividas: d.dividas.filter((x) => x.id !== id) }),
        () => supabaseNavegador().from("dividas").delete().eq("id", id),
      ),
    definirOrcamento: async (cat, valor) => {
      const novo: Dados["orcamento"] = { ...dadosRef.current.orcamento };
      if (valor > 0) novo[cat] = valor;
      else delete novo[cat];
      if ((dadosRef.current.orcamento[cat] ?? 0) === (novo[cat] ?? 0)) return;
      await salvar(
        (d) => ({ ...d, orcamento: novo }),
        sessao ? () => supabaseNavegador().from("perfis").update({ orcamento: novo }).eq("id", sessao.user.id) : undefined,
      );
    },
    definirValorExtra: async (v) => {
      const valor = Math.max(0, Number.isFinite(v) ? v : 0);
      await salvar(
        (d) => ({ ...d, valorExtraDividas: valor }),
        sessao
          ? () => supabaseNavegador().from("perfis").update({ valor_extra_dividas: valor }).eq("id", sessao.user.id)
          : undefined,
      );
    },
    registrarUsoIA: ({ usos, plano }) =>
      setDados((d) => ({
        ...d,
        plano: {
          tipo: plano ?? d.plano.tipo,
          mes: mesISO(),
          usosIA: typeof usos === "number" ? usos : d.plano.usosIA + 1,
        },
      })),
    definirPlano: async (tipo) => {
      if (modo === "local") {
        setDados((d) => ({ ...d, plano: { ...d.plano, tipo } }));
        return;
      }
      const r = await fetch("/api/premium-demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plano: tipo }),
      });
      const json = (await r.json()) as { plano?: Plano["tipo"]; erro?: string };
      if (!r.ok || !json.plano) throw new Error(json.erro ?? "Não consegui mudar o plano.");
      setDados((d) => ({ ...d, plano: { ...d.plano, tipo: json.plano! } }));
    },
    sair: async () => {
      if (modo === "conta") await supabaseNavegador().auth.signOut();
    },
  };

  return {
    dados,
    acoes,
    modo,
    email: sessao?.user.email ?? null,
    estado,
    erro,
    aviso,
    limparAviso: () => setAviso(null),
    limparErro: () => setErro(null),
  };
}
