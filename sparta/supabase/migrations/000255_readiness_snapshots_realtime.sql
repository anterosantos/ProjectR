-- Story 5.7: Habilitar Supabase Realtime na tabela readiness_snapshots
-- REPLICA IDENTITY FULL necessário para eventos UPDATE incluírem o row antigo (payload.old)

ALTER TABLE readiness_snapshots REPLICA IDENTITY FULL;

-- Adicionar tabela à publication do Realtime
-- (supabase_realtime publication já existe no projeto Supabase)
ALTER PUBLICATION supabase_realtime ADD TABLE readiness_snapshots;
