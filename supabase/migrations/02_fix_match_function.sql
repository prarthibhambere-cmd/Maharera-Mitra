-- Fix: PostgREST does not reliably coerce a JS number[] into pgvector(768)
-- when passed as an RPC parameter, causing match_maharera_documents to silently
-- return zero rows. Accept the embedding as text and cast inside the function.

drop function if exists match_maharera_documents(vector, float, int);

create or replace function match_maharera_documents(
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
  with q as (select query_embedding::vector(768) as v)
  select
    mk.id,
    mk.source_type,
    mk.title,
    mk.content,
    mk.metadata,
    1 - (mk.embedding <=> q.v) as similarity
  from maharera_knowledge mk, q
  where 1 - (mk.embedding <=> q.v) > match_threshold
  order by mk.embedding <=> q.v
  limit match_count;
$$;
