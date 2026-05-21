-- Enable pgvector extension for embedding storage and similarity search
create extension if not exists vector with schema extensions;

-- Core knowledge base table for all MahaRERA documents
create table maharera_knowledge (
  id uuid primary key default gen_random_uuid(),
  source_type text not null check (source_type in ('circular', 'act', 'user-upload')),
  title text not null,
  content text not null,
  metadata jsonb default '{}'::jsonb,
  embedding vector(768),
  created_at timestamptz default now()
);

-- Index for fast vector similarity search
create index on maharera_knowledge using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- Index for filtering by source type
create index on maharera_knowledge (source_type);

-- Vector similarity search function used by the RAG pipeline
create or replace function match_maharera_documents(
  query_embedding vector(768),
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
language plpgsql
as $$
begin
  return query
  select
    mk.id,
    mk.source_type,
    mk.title,
    mk.content,
    mk.metadata,
    1 - (mk.embedding <=> query_embedding) as similarity
  from maharera_knowledge mk
  where 1 - (mk.embedding <=> query_embedding) > match_threshold
  order by mk.embedding <=> query_embedding
  limit match_count;
end;
$$;
