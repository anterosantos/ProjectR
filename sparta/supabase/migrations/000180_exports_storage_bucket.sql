-- Bucket privado para exportações de dados pessoais (RGPD Art. 20)
-- Acesso exclusivamente via service-role key (Edge Function) ou signed URL (TTL 7 dias)
INSERT INTO storage.buckets (id, name, public)
VALUES ('exports', 'exports', false)
ON CONFLICT (id) DO NOTHING;
