# Grana: finanças pessoais com IA

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
| **Freemium** | Grátis: 30 lançamentos com IA/mês. Premium (R$ 9,90/mês): IA ilimitada + Coach |
| **Instalável no celular** | PWA: "Adicionar à tela inicial" no Chrome/Safari |

## Rodar localmente

```bash
npm install
cp .env.example .env.local   # coloque sua ANTHROPIC_API_KEY
npm run dev                  # http://localhost:3000
```

Para testar no celular na mesma rede Wi-Fi: `npm run dev -- -H 0.0.0.0` e acesse `http://IP-DO-PC:3000`. Câmera e microfone exigem HTTPS fora do `localhost`, por isso o ideal é publicar (veja abaixo).

## Publicar

O jeito mais simples é a [Vercel](https://vercel.com): importe o repositório e adicione a variável `ANTHROPIC_API_KEY`.

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
  armazenamento.ts          # dados no aparelho (localStorage)
  claude.ts                 # cliente da API (só no servidor)
```

## Próximos passos

1. **Login + banco de dados** (ex.: Supabase) para sincronizar entre aparelhos e não perder dados ao limpar o navegador
2. **Pagamento real do Premium** (Stripe ou Mercado Pago, com Pix) e limite de uso aplicado no servidor
3. **Importar extrato** (CSV/OFX do banco) e, depois, Open Finance
4. Lançar pelo **WhatsApp** (mandar áudio/foto para um número)
5. Metas de economia e reserva de emergência
6. Versão nas lojas (Android/iOS) empacotando o PWA

> Hoje os dados ficam só no navegador do aparelho, e o limite do plano grátis é contado no aparelho. Isso basta para validar a ideia, mas precisa mudar antes de cobrar de verdade.
