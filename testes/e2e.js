/*
 * Teste de ponta a ponta do Zerou, num navegador de verdade.
 *
 *   npm run db:iniciar && npm run build && npx next start -p 3000 &
 *   npm run testar
 *
 * Precisa do Supabase local rodando (os códigos de login são lidos do Mailpit).
 */
const { chromium } = require('playwright');
const S = process.argv[2] ?? require('node:os').tmpdir();
const codigo = async (email) => {
  for (let i = 0; i < 25; i++) {
    const r = await (await fetch(`http://127.0.0.1:54324/api/v1/search?query=to:${email}`)).json();
    if (r.messages?.length) {
      const m = await (await fetch(`http://127.0.0.1:54324/api/v1/message/${r.messages[0].ID}`)).json();
      return m.Text.match(/\b(\d{6})\b/)[1];
    }
    await new Promise(r => setTimeout(r, 400));
  }
  throw new Error('sem e-mail');
};
let falhas = 0;
const ok = (c, msg) => { console.log((c ? 'OK   ' : 'FALHA') + ' ' + msg); if (!c) falhas++; };
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:3000');
  await p.getByLabel('E-mail').fill('ana@teste.dev');
  await p.getByRole('button', { name: 'Receber código' }).click();
  await p.getByLabel('Código').fill(await codigo('ana@teste.dev'));
  await p.getByRole('button', { name: 'Entrar', exact: true }).click();
  await p.waitForSelector('.marca');

  // --- BUG DA VÍRGULA ---
  await p.locator('nav').getByRole('button', { name: /Lançar/ }).click();
  await p.getByRole('button', { name: 'Lançar manualmente' }).click();
  await p.getByLabel('Descrição').fill('Pão');
  await p.getByLabel('Valor').fill('40,50');
  await p.locator('main').getByRole('button', { name: /Salvar/ }).click();
  await p.getByText('Pão').first().waitFor();
  const txt = await p.locator('.item', { hasText: 'Pão' }).innerText();
  ok(txt.includes('40,50'), 'vírgula: "40,50" grava R$ 40,50 — ' + txt.replace(/\n/g, ' '));

  // receita para ter base
  await p.locator('nav').getByRole('button', { name: /Lançar/ }).click();
  await p.getByRole('button', { name: 'Lançar manualmente' }).click();
  await p.getByRole('button', { name: 'Receita' }).click();
  await p.getByLabel('Descrição').fill('Salário');
  await p.getByLabel('Valor').fill('3.200,00');
  await p.locator('main').getByRole('button', { name: /Salvar/ }).click();
  await p.getByText('Salário').first().waitFor();
  ok((await p.locator('.saldo').innerText()).includes('3.159,50'), 'milhar: "3.200,00" -> saldo 3.159,50');

  // --- DÍVIDAS: validação, presets, juros ao ano ---
  await p.locator('nav').getByRole('button', { name: /Dívidas/ }).click();
  await p.locator('main').getByRole('button', { name: 'Salvar' }).click();
  ok(await p.getByText('Informe quanto você deve hoje.').isVisible(), 'formulário vazio mostra erro (não falha calado)');

  await p.getByRole('button', { name: 'Cartão de crédito' }).click();
  await p.waitForFunction(() => document.querySelectorAll('input')[0] && true);
  await p.waitForTimeout(150);
  ok((await p.getByLabel('Juros por mês').inputValue()) === '14', 'preset preenche juros do cartão');
  ok(await p.getByText(/= 382% ao ano/).isVisible(), 'mostra a taxa anual equivalente');
  ok((await p.getByLabel('Nome').inputValue()) === 'Cartão de crédito', 'preset preenche o nome');

  await p.getByLabel('Juros por mês').fill('180');
  ok(await p.getByText(/por mês, não por ano/).isVisible(), 'juros acima de 100% ao mês avisa');
  await p.getByLabel('Juros por mês').fill('14');

  await p.getByLabel('Quanto deve hoje').fill('2.500');
  await p.getByLabel('Quanto você paga por mês').fill('300');
  ok(await p.getByText(/não cobre nem os juros/).isVisible(), 'parcela menor que os juros avisa');
  await p.getByLabel('Quanto você paga por mês').fill('400');
  await p.locator('main').getByRole('button', { name: 'Salvar' }).click();
  await p.getByText('Cartão de crédito').first().waitFor();
  ok((await p.locator('.divida-saldo').first().innerText()).includes('2.500,00'), 'dívida salva com milhar');

  // segunda dívida
  await p.getByRole('button', { name: /Adicionar dívida/ }).click();
  await p.getByRole('button', { name: 'Consignado' }).click();
  await p.getByLabel('Quanto deve hoje').fill('5000');
  await p.getByLabel('Quanto você paga por mês').fill('250');
  await p.locator('main').getByRole('button', { name: 'Salvar' }).click();
  await p.getByText('Consignado').first().waitFor();
  const primeiro = await p.locator('.divida').first().innerText();
  ok(primeiro.includes('Cartão'), 'ordena pela estratégia (cartão 14% antes do consignado 1,8%)');

  // --- REGISTRAR PAGAMENTO ---
  await p.locator('.divida', { hasText: 'Cartão' }).getByRole('button', { name: 'Registrar pagamento' }).click();
  ok((await p.getByLabel(/Quanto você pagou/).inputValue()) === '400', 'pagamento já vem com a parcela');
  await p.getByRole('button', { name: 'Registrar', exact: true }).click();
  await p.waitForTimeout(600);
  ok((await p.locator('.divida', { hasText: 'Cartão' }).innerText()).includes('2.100,00'), 'pagamento baixa o saldo');
  await p.locator('nav').getByRole('button', { name: /Início/ }).click();
  ok(await p.getByText('Pagamento Cartão de crédito').isVisible(), 'pagamento vira gasto do mês');

  // --- EDITAR ---
  await p.locator('nav').getByRole('button', { name: /Dívidas/ }).click();
  await p.locator('.divida', { hasText: 'Cartão' }).getByRole('button', { name: 'Editar' }).click();
  await p.getByLabel('Nome').fill('Cartão Nubank');
  await p.locator('main').getByRole('button', { name: 'Salvar' }).click();
  await p.getByText('Cartão Nubank').first().waitFor();
  ok(true, 'editar dívida');

  // --- ESTRATÉGIA ---
  await p.getByLabel(/pagar a mais/).fill('300');
  await p.getByLabel(/pagar a mais/).blur();
  await p.waitForTimeout(600);
  ok(await p.getByText('Extra vai aqui').isVisible(), 'marca para onde vai o dinheiro extra');
  await p.getByRole('button', { name: /Bola de neve/ }).click();
  ok((await p.getByRole('button', { name: /Bola de neve/ }).getAttribute('aria-pressed')) === 'true', 'trocar de estratégia seleciona o outro plano');
  ok(await p.getByText(/vão todos para/).isVisible(), 'diz para onde vai o dinheiro extra');
  ok((await p.locator('.comparacao').innerText()).includes('Recomendada'), 'marca a estratégia recomendada');

  // --- LIMITES ---
  await p.locator('nav').getByRole('button', { name: /Limites/ }).click();
  await p.getByRole('button', { name: /Ver todas as categorias/ }).click();
  await p.getByLabel('Limite para Mercado').fill('450,50');
  await p.getByLabel('Limite para Mercado').blur();
  await p.waitForTimeout(600);
  ok(await p.getByText(/por dia nos \d+ dias/).isVisible(), 'mostra quanto dá por dia até o fim do mês');
  await p.getByLabel('Limite para Dívidas').fill('5000');
  await p.getByLabel('Limite para Dívidas').blur();
  await p.waitForTimeout(600);
  ok(await p.getByText(/somam mais do que você ganha/).isVisible(), 'avisa quando os limites passam a renda');
  await p.getByLabel('Limite para Dívidas').fill('500');
  await p.getByLabel('Limite para Dívidas').blur();
  await p.waitForTimeout(600);

  // --- PERSISTE ---
  await p.reload(); await p.waitForSelector('.marca');
  await p.locator('nav').getByRole('button', { name: /Limites/ }).click();
  ok((await p.getByLabel('Limite para Mercado').inputValue()) === '450,50', 'limite com centavos persiste');
  await p.locator('nav').getByRole('button', { name: /Dívidas/ }).click();
  ok((await p.locator('.divida', { hasText: 'Nubank' }).innerText()).includes('2.100,00'), 'saldo e nome editados persistem');
  ok((await p.getByLabel(/pagar a mais/).inputValue()) === '300', 'valor extra persiste');
  await p.screenshot({ path: S + '/nova-dividas.png', fullPage: true });
  await p.locator('nav').getByRole('button', { name: /Limites/ }).click();
  await p.screenshot({ path: S + '/nova-limites.png', fullPage: true });

  // --- QUITAR ---
  await p.locator('nav').getByRole('button', { name: /Dívidas/ }).click();
  await p.locator('.divida', { hasText: 'Nubank' }).getByRole('button', { name: 'Registrar pagamento' }).click();
  await p.getByLabel(/Quanto você pagou/).fill('2100');
  ok(await p.getByText('Isso quita a dívida inteira.').isVisible(), 'avisa que o valor quita a dívida');
  await p.getByRole('button', { name: 'Quitar dívida' }).click();
  await p.getByText('Dívida quitada!').waitFor();
  await p.reload(); await p.waitForSelector('.marca');
  await p.locator('nav').getByRole('button', { name: /Dívidas/ }).click();
  ok(!(await p.getByText('Nubank').isVisible()), 'dívida quitada sai da lista e persiste');

  ok(errs.length === 0, 'sem erros de JavaScript ' + JSON.stringify(errs.slice(0, 3)));
  await b.close();
  console.log(falhas ? `\n${falhas} FALHAS` : '\nTudo ok');
  process.exitCode = falhas ? 1 : 0;
})();
