"use client";

import { useState } from "react";
import { supabaseNavegador } from "@/lib/supabase/navegador";
import { Logo } from "./Logo";

/**
 * Login sem senha: a pessoa recebe um código de 6 dígitos por e-mail.
 * Código (e não link) funciona melhor no app instalado no celular, porque o
 * link do e-mail abriria em outro navegador.
 */
export function Entrar() {
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [etapa, setEtapa] = useState<"email" | "codigo">("email");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviarCodigo(e?: React.FormEvent) {
    e?.preventDefault();
    setErro(null);
    setCarregando(true);
    const { error } = await supabaseNavegador().auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });
    setCarregando(false);
    if (error) {
      setErro(
        error.status === 429
          ? "Muitas tentativas. Espere um minuto e tente de novo."
          : "Não consegui enviar o código. Confira o e-mail.",
      );
      return;
    }
    setEtapa("codigo");
  }

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setCarregando(true);
    const { error } = await supabaseNavegador().auth.verifyOtp({
      email: email.trim(),
      token: codigo.trim(),
      type: "email",
    });
    setCarregando(false);
    if (error) setErro("Código inválido ou vencido. Confira ou peça outro.");
    // sucesso: o useDados percebe a sessão nova e carrega os dados
  }

  return (
    <main className="entrar">
      <Logo altura={40} />
      <p className="entrar-slogan">Do vermelho ao zerou.</p>

      {etapa === "email" ? (
        <form className="cartao pilha-pequena" onSubmit={enviarCodigo}>
          <h2>Entrar ou criar conta</h2>
          <p className="sutil pequeno">Sem senha: mandamos um código para o seu e-mail.</p>
          <label>
            E-mail
            <input
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@email.com"
            />
          </label>
          <button className="botao primario largo" disabled={carregando || !email.includes("@")}>
            {carregando ? "Enviando…" : "Receber código"}
          </button>
        </form>
      ) : (
        <form className="cartao pilha-pequena" onSubmit={confirmar}>
          <h2>Digite o código</h2>
          <p className="sutil pequeno">
            Enviamos 6 números para <strong>{email}</strong>. Confira também o spam.
          </p>
          <label>
            Código
            <input
              className="campo-codigo"
              required
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
              placeholder="000000"
              autoFocus
            />
          </label>
          <button className="botao primario largo" disabled={carregando || codigo.length !== 6}>
            {carregando ? "Entrando…" : "Entrar"}
          </button>
          <div className="acoes">
            <button type="button" className="link" onClick={() => enviarCodigo()} disabled={carregando}>
              Reenviar código
            </button>
            <button
              type="button"
              className="link sutil"
              onClick={() => {
                setEtapa("email");
                setCodigo("");
              }}
            >
              Trocar e-mail
            </button>
          </div>
        </form>
      )}

      {erro && <div className="alerta perigo">{erro}</div>}
      <p className="sutil pequeno centro">Seus dados ficam guardados com segurança e só você tem acesso.</p>
    </main>
  );
}
