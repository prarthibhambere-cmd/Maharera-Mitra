-- Comprehensive rebuild: drops ALL overloads of match_maharera_documents
-- and creates a single text-param version. Also reloads the PostgREST
-- schema cache so the change is picked up immediately.

do $$
declare
  fn_args text;
begin
  for fn_args in
    select pg_get_function_identity_arguments(oid)
    from pg_proc
    where proname = 'match_maharera_documents'
  loop
    execute format('drop function if exists match_maharera_documents(%s)', fn_args);
  end loop;
end $$;

create function match_maharera_documents(
  query_embedding text,
  match_threshold float default 0.7,
  match_count int default 5
)
returns table (
  id uuid,
  source_type text,
  title text,
  content text,
  metadata jsonb,
  similarity float
)
language sql
stable
as $$
  select
    mk.id,
    mk.source_type,
    mk.title,
    mk.content,
    mk.metadata,
    (1 - (mk.embedding <=> query_embedding::extensions.vector(768)))::float as similarity
  from maharera_knowledge mk
  where mk.embedding is not null
    and (1 - (mk.embedding <=> query_embedding::extensions.vector(768))) > match_threshold
  order by mk.embedding <=> query_embedding::extensions.vector(768)
  limit match_count;
$$;

-- Force PostgREST to reload its schema cache
notify pgrst, 'reload schema';
