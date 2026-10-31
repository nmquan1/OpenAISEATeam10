-- Shared-workspace database only. Apply using the Supabase SQL editor.
-- This migration does not create users or authentication policies.
create table if not exists public.market_maker_runs (
 id uuid primary key default gen_random_uuid(),
 workspace_id text not null default 'workspace' check(workspace_id='workspace'),
 created_at timestamptz not null default now(),
 kind text not null check(kind in ('evaluate','recommend')),
 schema_version text not null default '2.0',
 input jsonb not null,
 result jsonb not null
);
create index if not exists market_maker_runs_workspace_time on public.market_maker_runs(workspace_id,created_at desc);
alter table public.market_maker_runs enable row level security;
revoke all on public.market_maker_runs from anon,authenticated;
grant select,insert on public.market_maker_runs to service_role;
create table if not exists public.market_maker_ai_usage (
 workspace_id text not null default 'workspace' check(workspace_id='workspace'),
 day date not null default (now() at time zone 'utc')::date,
 calls integer not null default 0,
 primary key(workspace_id,day)
);
alter table public.market_maker_ai_usage enable row level security;
revoke all on public.market_maker_ai_usage from anon,authenticated;
create or replace function public.market_maker_consume_ai(daily_limit integer)
returns boolean language plpgsql security definer set search_path=public as $$
declare changed integer;
begin
 if daily_limit<1 then return false;end if;
 insert into public.market_maker_ai_usage(workspace_id,day,calls)
 values('workspace',(now() at time zone 'utc')::date,1)
 on conflict(workspace_id,day)do update set calls=market_maker_ai_usage.calls+1
 where market_maker_ai_usage.calls<least(daily_limit,20);
 get diagnostics changed=row_count;
 return changed=1;
end;
$$;
revoke all on function public.market_maker_consume_ai(integer) from public,anon,authenticated;
grant execute on function public.market_maker_consume_ai(integer) to service_role;
-- Per-client AI ledger: model, tokens, estimated cost and context of each paid call.
create table if not exists public.market_maker_ai_calls (
 id uuid primary key,
 created_at timestamptz not null default now(),
 client_id text not null,
 run_id uuid not null,
 model text not null,
 request_id text not null,
 prompt_version text not null,
 input_tokens integer,
 output_tokens integer,
 cost_usd numeric,
 attempts integer not null default 1,
 context jsonb not null
);
create index if not exists market_maker_ai_calls_client_time on public.market_maker_ai_calls(client_id,created_at desc);
alter table public.market_maker_ai_calls enable row level security;
revoke all on public.market_maker_ai_calls from anon,authenticated;
grant select,insert on public.market_maker_ai_calls to service_role;
