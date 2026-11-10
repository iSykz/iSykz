# Zerou: finanças pessoais com IA

![Zerou](public/marca/zerou-logo.svg)

Fale, digite ou fotografe seus gastos. A IA organiza tudo, avisa quando você está gastando demais e monta um plano para sair das dívidas.

## O que já funciona

| Recurso | Como |
|---|---|
| **Lançar por texto** | "gastei 40 no mercado e 12 no café" → 2 lançamentos categorizados |
| **Lançar por voz** | Botão 🎙 usa o reconhecimento de voz do navegador (pt-BR) e manda o texto para a IA |
| **Foto do recibo** | 📷 abre a câmera; a IA lê a nota/comprovante Pix e extrai valor total, local e data |
| **Confirmar antes de salvar** | A pessoa revisa e edita o que a IA entendeu |
| **Alertas de gasto** | Limite por categoria: avisa em 80%, ao estourar e quando o *ritmo* do mês indica que vai estourar |
| **Plano de dívidas** | Compara avalanche (maior juros primeiro) × bola de neve (menor saldo primeiro): meses até quitar, juros totais, ordem de quitação e economia com o valor extra |
| **Coach com IA** (Premium) | Diagnóstico do mês com ações concretas em reais; só os totais por categoria são enviados |
| **Login sem senha** | Código de 6 dígitos por e-mail (funciona bem no app instalado no celular) |
| **Dados na nuvem** | Supabase (Postgres): mesmos dados no celular e no computador; cada pessoa só acessa os próprios dados |
| **Freemium** | Grátis: 30 lançamentos com IA/mês. Premium (R$ 9,90/mês): IA ilimitada + Coach. O limite é contado no banco, então não dá para burlar pelo navegador |
| **Instalável no celular** | PWA: "Adicionar à tela inicial" no Chrome/Safari |

## Rodar localmente

Precisa de Node 20+ e, para o login, Docker.

```bash
npm install
npm run db:iniciar           # sobe um Supabase local (login + banco) no Docker
cp .env.example .env.local   # preencha com a sua ANTHROPIC_API_KEY
npx supabase status          # copie API_URL, PUBLISHABLE_KEY e SECRET_KEY para o .env.local
npm run dev                  # http://localhost:3000
```

- No modo local, os códigos de login chegam no Mailpit, em http://127.0.0.1:54324 (o Supabase local não envia e-mail de verdade).
- **Sem Supabase configurado**, o app abre em *modo de teste*: sem login e com os dados só no aparelho. Nesse modo a IA só funciona em desenvolvimento.
- Para o celular na mesma rede Wi-Fi: `npm run dev -- -H 0.0.0.0`. Câmera e microfone exigem HTTPS fora do `localhost`.

## Publicar

1. **Supabase**: crie um projeto em [supabase.com](https://supabase.com) (plano grátis) na região São Paulo.
   - Rode `npx supabase login`, depois `npx supabase link --project-ref SEU-PROJETO` e `npm run db:publicar` para criar as tabelas.
   - Em *Authentication > Email Templates*, cole o conteúdo de `supabase/templates/codigo.html` nos modelos **Magic Link** e **Confirm signup**, para o e-mail mandar o código em vez de um link.
   - Em *Authentication > URL Configuration*, coloque o endereço do site.
   - Para produção, configure um envio de e-mail próprio (SMTP, por exemplo Resend). O envio padrão do Supabase tem limite baixo por hora.
2. **Vercel**: importe o repositório e adicione as variáveis do `.env.example`. Não use `PREMIUM_DEMO` em produção.

## Segurança dos dados

- **Row Level Security** em todas as tabelas: cada conta só lê e altera as próprias linhas.
- O navegador **não consegue** mudar o plano nem o contador de uso da IA; isso só acontece no servidor.
- As rotas da IA exigem login. O Coach exige Premium, verificado no banco.
- A chave da Anthropic e a chave secreta do Supabase ficam só no servidor.

## Estrutura

```
app/
  api/interpretar/route.ts  # texto/foto → lançamentos (Claude + saída estruturada)
  api/conselho/route.ts     # Coach financeiro
  page.tsx, layout.tsx, globals.css
components/                 # telas: Início, Lançar, Limites, Dívidas, Coach
lib/
  dividas.ts                # simulação avalanche / bola de neve
  analise.ts                # resumo do mês e alertas
  armazenamento.ts          # dados: conta (Supabase) ou aparelho (modo de teste)
  supabase/                 # clientes do Supabase e verificação de login/plano
  claude.ts                 # cliente da API (só no servidor)
supabase/
  migrations/               # tabelas, regras de segurança e limite da IA
  templates/codigo.html     # e-mail com o código de login
middleware.ts               # renova a sessão de login
```

## Próximos passos

1. ~~Login + banco de dados~~ ✅
2. **Pagamento real do Premium** (Mercado Pago ou Stripe, com Pix), com o aviso de pagamento (webhook) liberando o plano
3. **Importar extrato** (CSV/OFX do banco) e, depois, Open Finance
4. Lançar pelo **WhatsApp** (mandar áudio/foto para um número)
5. Metas de economia e reserva de emergência
6. Versão nas lojas (Android/iOS) empacotando o PWA
