-- Zerou: estrutura inicial
-- Cada pessoa só enxerga e altera os próprios dados (Row Level Security).
-- Plano e contador de uso da IA só mudam pelo servidor, nunca pelo navegador.

create table public.perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  orcamento jsonb not null default '{}'::jsonb,
  valor_extra_dividas numeric(12, 2) not null default 0 check (valor_extra_dividas >= 0),
  plano text not null default 'gratis' check (plano in ('gratis', 'premium')),
  premium_ate timestamptz,
  uso_mes text not null default to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM'),
  usos_ia integer not null default 0,
  criado_em timestamptz not null default now()
);

create table public.transacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  descricao text not null check (char_length(descricao) between 1 and 200),
  valor numeric(12, 2) not null check (valor > 0),
  tipo text not null check (tipo in ('despesa', 'receita')),
  categoria text not null check (char_length(categoria) between 1 and 40),
  data date not null,
  origem text not null default 'manual' check (origem in ('texto', 'voz', 'foto', 'manual')),
  criado_em timestamptz not null default now()
);
create index transacoes_user_data on public.transacoes (user_id, data desc);

create table public.dividas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nome text not null check (char_length(nome) between 1 and 80),
  saldo numeric(12, 2) not null check (saldo > 0),
  juros_mensal numeric(6, 3) not null check (juros_mensal >= 0 and juros_mensal <= 100),
  parcela_minima numeric(12, 2) not null check (parcela_minima > 0),
  criado_em timestamptz not null default now()
);
create index dividas_user on public.dividas (user_id);

alter table public.perfis enable row level security;
alter table public.transacoes enable row level security;
alter table public.dividas enable row level security;

create policy "perfil: ler o próprio" on public.perfis
  for select to authenticated using (id = (select auth.uid()));
create policy "perfil: alterar o próprio" on public.perfis
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "transacoes: só as próprias" on public.transacoes
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "dividas: só as próprias" on public.dividas
  for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- O navegador só pode mudar orçamento e valor extra; plano e uso da IA ficam travados.
revoke all on public.perfis from anon, authenticated;
grant select on public.perfis to authenticated;
grant update (orcamento, valor_extra_dividas) on public.perfis to authenticated;

revoke all on public.transacoes, public.dividas from anon;
grant select, insert, update, delete on public.transacoes, public.dividas to authenticated;

-- Cria o perfil automaticamente quando a pessoa se cadastra.
create function public.criar_perfil() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.perfis (id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger ao_criar_usuario after insert on auth.users
  for each row execute function public.criar_perfil();

-- Plano efetivo: premium vencido volta a ser grátis.
create function public.plano_atual(p public.perfis) returns text
language sql stable set search_path = '' as $$
  select case when p.plano = 'premium' and (p.premium_ate is null or p.premium_ate > now())
              then 'premium' else 'gratis' end;
$$;

-- Consome 1 uso da IA de forma atômica. Chamada pelo servidor com a sessão da pessoa.
-- Zera o contador quando vira o mês (horário de Brasília).
create function public.consumir_ia(limite_gratis integer)
returns table (permitido boolean, usos integer, plano text)
language plpgsql security definer set search_path = '' as $$
declare
  mes_atual text := to_char(now() at time zone 'America/Sao_Paulo', 'YYYY-MM');
  p public.perfis;
  efetivo text;
begin
  if auth.uid() is null then
    raise exception 'não autenticado' using errcode = '28000';
  end if;

  select * into p from public.perfis where id = auth.uid() for update;
  if not found then
    insert into public.perfis (id) values (auth.uid()) returning * into p;
  end if;

  if p.uso_mes <> mes_atual then
    update public.perfis set uso_mes = mes_atual, usos_ia = 0 where id = p.id returning * into p;
  end if;

  efetivo := public.plano_atual(p);
  if efetivo = 'gratis' and p.usos_ia >= limite_gratis then
    return query select false, p.usos_ia, efetivo;
    return;
  end if;

  update public.perfis set usos_ia = usos_ia + 1 where id = p.id returning * into p;
  return query select true, p.usos_ia, efetivo;
end;
$$;

-- Sem função de "devolver uso": ela poderia ser chamada direto pelo navegador para burlar o limite.
revoke execute on function public.consumir_ia(integer), public.criar_perfil() from public, anon;
grant execute on function public.consumir_ia(integer) to authenticated;
