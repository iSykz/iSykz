export const CATEGORIAS_DESPESA = [
  "Mercado",
  "Alimentação",
  "Transporte",
  "Moradia",
  "Contas",
  "Saúde",
  "Lazer",
  "Compras",
  "Educação",
  "Assinaturas",
  "Dívidas",
  "Outros",
] as const;

export const CATEGORIAS_RECEITA = ["Salário", "Renda extra", "Outras receitas"] as const;

export const CATEGORIAS = [...CATEGORIAS_DESPESA, ...CATEGORIAS_RECEITA] as const;

export type Categoria = (typeof CATEGORIAS)[number];
export type TipoTransacao = "despesa" | "receita";
export type Origem = "texto" | "voz" | "foto" | "manual";

export interface Transacao {
  id: string;
  descricao: string;
  valor: number; // sempre positivo, em reais
  tipo: TipoTransacao;
  categoria: Categoria;
  data: string; // AAAA-MM-DD
  origem: Origem;
}

export interface Divida {
  id: string;
  nome: string;
  saldo: number;
  jurosMensal: number; // % ao mês
  parcelaMinima: number;
}

export type Orcamento = Partial<Record<Categoria, number>>;

export interface Plano {
  tipo: "gratis" | "premium";
  mes: string; // AAAA-MM do contador
  usosIA: number;
}

export interface Dados {
  transacoes: Transacao[];
  dividas: Divida[];
  orcamento: Orcamento;
  plano: Plano;
  valorExtraDividas: number; // quanto a pessoa consegue pagar a mais por mês
}

export const LIMITE_IA_GRATIS = 30;
export const PRECO_PREMIUM = "R$ 9,90";

/** Lançamento sugerido pela IA, antes de a pessoa confirmar. */
export interface Sugestao {
  descricao: string;
  valor: number;
  tipo: TipoTransacao;
  categoria: Categoria;
  data: string;
}
