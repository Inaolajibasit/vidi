create table public.account_attention_reads (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('friend_request', 'game')),
  entity_id uuid not null,
  seen_at timestamptz not null default now(),
  primary key (profile_id, kind, entity_id)
);

create index account_attention_reads_profile_kind_idx
  on public.account_attention_reads (profile_id, kind);

alter table public.account_attention_reads enable row level security;

create policy "users can read their attention state"
  on public.account_attention_reads for select to authenticated
  using (profile_id = (select auth.uid()));

create policy "users can create their attention state"
  on public.account_attention_reads for insert to authenticated
  with check (profile_id = (select auth.uid()));

create policy "users can update their attention state"
  on public.account_attention_reads for update to authenticated
  using (profile_id = (select auth.uid()))
  with check (profile_id = (select auth.uid()));

grant select, insert, update on public.account_attention_reads to authenticated;

