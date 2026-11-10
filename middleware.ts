import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_KEY, SUPABASE_URL, supabaseConfigurado } from "@/lib/supabase/config";

// Renova a sessão de login a cada requisição (padrão recomendado pelo Supabase).
export async function middleware(request: NextRequest) {
  let resposta = NextResponse.next({ request });
  if (!supabaseConfigurado) return resposta;

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (lista, headers) => {
        lista.forEach(({ name, value }) => request.cookies.set(name, value));
        resposta = NextResponse.next({ request });
        lista.forEach(({ name, value, options }) => resposta.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([k, v]) => resposta.headers.set(k, v));
      },
    },
  });
  await supabase.auth.getClaims();
  return resposta;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|marca/|icon.svg|apple-icon.png|manifest.webmanifest).*)"],
};
