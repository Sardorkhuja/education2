-- Run ONCE in your Supabase project's SQL editor. Future releases use additive migrations.
-- This migration never drops or truncates user data.
begin;
create table if not exists public.education_records (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null check (id ~ '^[A-Za-z0-9_-]{1,100}$'),
  kind text not null check (kind in ('profile','course','assessment','task','class')),
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  revision bigint not null default 1 check (revision >= 1),
  deleted boolean not null default false,
  mutation_id uuid not null,
  updated_at timestamptz not null default now(),
  primary key (user_id,id)
);
create table if not exists public.education_record_history (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  revision bigint not null,
  kind text not null,
  data jsonb not null,
  deleted boolean not null,
  mutation_id uuid not null,
  updated_at timestamptz not null,
  primary key(user_id,id,revision)
);
alter table public.education_records enable row level security;
alter table public.education_record_history enable row level security;
drop policy if exists "Read own records" on public.education_records;
create policy "Read own records" on public.education_records for select to authenticated using ((select auth.uid())=user_id);
drop policy if exists "Read own history" on public.education_record_history;
create policy "Read own history" on public.education_record_history for select to authenticated using ((select auth.uid())=user_id);
revoke all on public.education_records from anon, authenticated;
revoke all on public.education_record_history from anon, authenticated;
grant select on public.education_records,public.education_record_history to authenticated;

create or replace function public.save_education_record(
  p_id text, p_kind text, p_data jsonb, p_expected_revision bigint,
  p_deleted boolean, p_mutation_id uuid
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid();
  v_row public.education_records%rowtype;
  v_new public.education_records%rowtype;
  v_found boolean;
begin
  if v_user is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if p_id is null or p_id !~ '^[A-Za-z0-9_-]{1,100}$' or p_kind not in ('profile','course','assessment','task','class') then raise exception 'Invalid record'; end if;
  if jsonb_typeof(p_data) is distinct from 'object' or p_data->>'id' is distinct from p_id or octet_length(p_data::text)>200000 then raise exception 'Invalid record data'; end if;
  if p_expected_revision is null or p_expected_revision<0 or p_mutation_id is null then raise exception 'Invalid revision'; end if;
  if p_kind in ('assessment','task') and p_data->'grade' is not null and p_data->'grade'<>'null'::jsonb then
    if jsonb_typeof(p_data->'grade')<>'number' then raise exception 'Grade must be numeric'; end if;
    if (p_data->>'grade')::numeric < 0 or (p_data->>'grade')::numeric > 10 then raise exception 'Grade must be 0-10'; end if;
  end if;
  if p_kind='assessment' and p_data->'weight' is not null and p_data->'weight'<>'null'::jsonb then
    if jsonb_typeof(p_data->'weight')<>'number' then raise exception 'Weight must be numeric'; end if;
    if (p_data->>'weight')::numeric<0 or (p_data->>'weight')::numeric>100 then raise exception 'Weight must be 0-100'; end if;
  end if;
  -- Serializes writes even for a not-yet-existing row. The user is never supplied by the client.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text||':'||p_id,0));
  select * into v_row from public.education_records where user_id=v_user and id=p_id for update;
  v_found:=found;
  if v_found and v_row.mutation_id=p_mutation_id then
    return jsonb_build_object('ok',true,'record',to_jsonb(v_row));
  end if;
  if (v_found and v_row.revision<>p_expected_revision) or (not v_found and p_expected_revision<>0) then
    return jsonb_build_object('ok',false,'record',case when v_found then to_jsonb(v_row) else null end);
  end if;
  if v_found then
    insert into public.education_record_history select v_row.user_id,v_row.id,v_row.revision,v_row.kind,v_row.data,v_row.deleted,v_row.mutation_id,v_row.updated_at on conflict do nothing;
    update public.education_records set kind=p_kind,data=p_data,revision=v_row.revision+1,deleted=p_deleted,mutation_id=p_mutation_id,updated_at=now() where user_id=v_user and id=p_id returning * into v_new;
  else
    insert into public.education_records(user_id,id,kind,data,revision,deleted,mutation_id) values(v_user,p_id,p_kind,p_data,1,p_deleted,p_mutation_id) returning * into v_new;
  end if;
  return jsonb_build_object('ok',true,'record',to_jsonb(v_new));
end;
$$;
revoke all on function public.save_education_record(text,text,jsonb,bigint,boolean,uuid) from public,anon;
grant execute on function public.save_education_record(text,text,jsonb,bigint,boolean,uuid) to authenticated;
commit;
