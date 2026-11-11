"use client";
/*
 * Mesma interface do lib/armazenamento.ts, mas salvando no banco da página
 * publicada (capacidade "db"), num documento privado de cada pessoa.
 * Sem o banco (fora do claude.ai), usa o armazenamento do navegador.
 */
import { useEffect, useRef, useState } from "react";
import type { Categoria, Dados, Divida, Plano, Transacao } from "@/lib/tipos";
import { mesISO } from "@/lib/formato";
import { usar, type Db, type DocRef, type Usuario } from "./claude";

const CHAVE = "zerou:demo";

const inicial = (): Dados => ({
  transacoes: [],
  dividas: [],
  orcamento: {},
  plano: { tipo: "gratis", mes: mesISO(), usosIA: 0 },
  valorExtraDividas: 0,
});

function normalizar(bruto: unknown): Dados {
  const d = { ...inicial(), ...((bruto ?? {}) as Partial<Dados>) };
  if (d.plano.mes !== mesISO()) d.plano = { ...d.plano, mes: mesISO(), usosIA: 0 };
  return d;
}

const id = () => (crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

async function abrirDoc(): Promise<DocRef | null> {
  const [db, user] = await Promise.all([usar<Db>("db"), usar<Usuario>("user")]);
  if (!db || !user) return null;
  const uid = await user.id().catch(() => null);
  return uid ? db.doc(`data/users/${uid}/estado`) : null;
}

export type Modo = "local" | "conta" | "demo";

export interface Acoes {
  adicionarTransacoes: (lista: Omit<Transacao, "id">[]) => Promise<void>;
  removerTransacao: (id: string) => Promise<void>;
  adicionarDivida: (d: Omit<Divida, "id">) => Promise<void>;
  removerDivida: (id: string) => Promise<void>;
  definirOrcamento: (cat: Categoria, valor: number) => Promise<void>;
  definirValorExtra: (v: number) => Promise<void>;
  registrarUsoIA: (r: { usos?: number | null; plano?: Plano["tipo"] | null }) => void;
  definirPlano: (tipo: Plano["tipo"]) => Promise<void>;
  sair: () => Promise<void>;
  substituirTudo: (d: Dados) => void;
}

export function useDados() {
  const [dados, setDados] = useState<Dados>(inicial);
  const [estado, setEstado] = useState<"carregando" | "pronto">("carregando");
  const [erro, setErro] = useState<string | null>(null);
  const [nuvem, setNuvem] = useState(false);
  const doc = useRef<DocRef | null>(null);
  const salvando = useRef<Promise<void>>(Promise.resolve());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      const ref = await abrirDoc();
      let d: Dados | null = null;
      if (ref) {
        try {
          const snap = await ref.get();
          if (snap.exists) d = normalizar(snap.data()?.dados);
          doc.current = ref;
          if (vivo) setNuvem(true);
        } catch {
          /* cai para o navegador */
        }
      }
      if (!d) {
        try {
          const bruto = localStorage.getItem(CHAVE);
          d = bruto ? normalizar(JSON.parse(bruto)) : inicial();
        } catch {
          d = inicial();
        }
      }
      if (vivo) {
        setDados(d);
        setEstado("pronto");
      }
    })();
    return () => {
      vivo = false;
    };
  }, []);

  // salva (agrupando mudanças rápidas, uma gravação por vez)
  useEffect(() => {
    if (estado !== "pronto") return;
    try {
      localStorage.setItem(CHAVE, JSON.stringify(dados));
    } catch {
      /* ignora */
    }
    const ref = doc.current;
    if (!ref) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      salvando.current = salvando.current
        .then(() => ref.set({ dados: JSON.parse(JSON.stringify(dados)) }))
        .then(() => setErro(null))
        .catch(() => setErro("Não consegui salvar na nuvem agora. Seus dados continuam neste aparelho."));
    }, 700);
  }, [dados, estado]);

  // a faixa da versão de teste pede "preencher com exemplo" / "apagar tudo" por evento
  useEffect(() => {
    const ouvir = (e: Event) => setDados(normalizar((e as CustomEvent<Dados>).detail));
    window.addEventListener("zerou:substituir", ouvir);
    return () => window.removeEventListener("zerou:substituir", ouvir);
  }, []);

  const acoes: Acoes = {
    adicionarTransacoes: async (lista) =>
      setDados((d) => ({ ...d, transacoes: [...lista.map((t) => ({ ...t, id: id() })), ...d.transacoes] })),
    removerTransacao: async (x) => setDados((d) => ({ ...d, transacoes: d.transacoes.filter((t) => t.id !== x) })),
    adicionarDivida: async (div) => setDados((d) => ({ ...d, dividas: [...d.dividas, { ...div, id: id() }] })),
    removerDivida: async (x) => setDados((d) => ({ ...d, dividas: d.dividas.filter((v) => v.id !== x) })),
    definirOrcamento: async (cat, valor) =>
      setDados((d) => {
        const orcamento = { ...d.orcamento };
        if (valor > 0) orcamento[cat] = valor;
        else delete orcamento[cat];
        return { ...d, orcamento };
      }),
    definirValorExtra: async (v) => setDados((d) => ({ ...d, valorExtraDividas: Math.max(0, v || 0) })),
    registrarUsoIA: ({ plano }) =>
      setDados((d) => ({
        ...d,
        plano: { tipo: plano ?? d.plano.tipo, mes: mesISO(), usosIA: d.plano.usosIA + 1 },
      })),
    definirPlano: async (tipo) => setDados((d) => ({ ...d, plano: { ...d.plano, tipo } })),
    sair: async () => {},
    substituirTudo: (novo) => setDados(normalizar(novo)),
  };

  return {
    dados,
    acoes,
    modo: "demo" as Modo,
    email: null as string | null,
    estado,
    erro,
    aviso: null as string | null,
    nuvem,
    limparAviso: () => {},
    limparErro: () => setErro(null),
  };
}
