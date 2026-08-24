do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'communications'
  ) then
    alter publication supabase_realtime add table public.communications;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'communication_threads'
  ) then
    alter publication supabase_realtime add table public.communication_threads;
  end if;
end
$$;
