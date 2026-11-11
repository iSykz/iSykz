// Gera a versão de teste publicável (um único HTML) a partir do código do app.
// Uso: node demo/build.mjs <saida.html>
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const saida = process.argv[2] ?? path.join(raiz, "demo/zerou-teste.html");

const trocas = {
  "@/lib/armazenamento": "demo/armazenamento.ts",
  "@/lib/voz": "demo/voz.ts",
  "./Entrar": "demo/entrar-stub.tsx",
};

const plugin = {
  name: "zerou-demo",
  setup(b) {
    b.onResolve({ filter: /.*/ }, (a) => {
      if (trocas[a.path]) return { path: path.join(raiz, trocas[a.path]) };
      if (a.path.startsWith("@/")) {
        const base = path.join(raiz, a.path.slice(2));
        for (const ext of [".ts", ".tsx", "/index.ts"]) {
          try {
            readFileSync(base + ext);
            return { path: base + ext };
          } catch {}
        }
      }
      if (["react", "react-dom/client", "react/jsx-runtime"].includes(a.path)) return { path: a.path, namespace: "global" };
      return undefined;
    });
    b.onLoad({ filter: /.*/, namespace: "global" }, (a) => ({
      loader: "js",
      contents:
        a.path === "react"
          ? "module.exports = window.React;"
          : a.path === "react-dom/client"
            ? "module.exports = window.ReactDOM;"
            : `const R = window.React;
               const j = (t, p, k) => R.createElement(t, k === undefined ? p : { ...p, key: k });
               module.exports = { jsx: j, jsxs: j, Fragment: R.Fragment };`,
    }));
  },
};

const r = await build({
  entryPoints: [path.join(raiz, "demo/main.tsx")],
  bundle: true,
  minify: true,
  format: "iife",
  target: "es2020",
  jsx: "automatic",
  write: false,
  logLevel: "warning",
  plugins: [plugin],
  define: { "process.env.NODE_ENV": '"production"' },
});
const js = r.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");

// CSS do app, com o modo escuro no formato que o claude.ai pede (respeita o tema escolhido no visualizador)
let css = readFileSync(path.join(raiz, "app/globals.css"), "utf8");
const m = css.match(/@media \(prefers-color-scheme: dark\) \{\s*:root \{([^}]*)\}\s*\}/);
if (!m) throw new Error("bloco escuro não encontrado em globals.css");
const tokens = m[1].trim() + "\n    color-scheme: dark;";
css = css.replace(
  m[0],
  `@media (prefers-color-scheme: dark) {\n  :root:not([data-theme="light"]) {\n    ${tokens}\n  }\n}\n:root[data-theme="dark"] {\n    ${tokens}\n}`,
);
css += `
.topo { top: env(safe-area-inset-top, 0px); }
body::before { content: ""; position: fixed; inset: 0 0 auto; height: env(safe-area-inset-top, 0px); z-index: 10; background: var(--fundo); }
.faixa-teste {
  max-width: 560px; margin: 0 auto; padding: 10px 16px; font-size: 0.82rem; color: var(--sutil);
  display: flex; flex-wrap: wrap; gap: 6px 14px; justify-content: space-between; align-items: center;
  border-bottom: 1px solid var(--borda);
}
.faixa-acoes { display: flex; gap: 12px; align-items: center; }
.perigo-texto { color: var(--negativo); }
`;

const html = `<title>Zerou</title>
<style>
${css}
</style>
<div id="raiz"><main class="carregando">Carregando…</main></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script>${js}</script>
`;
writeFileSync(saida, html);
console.log(`ok: ${saida} (${(html.length / 1024).toFixed(0)} KB)`);
