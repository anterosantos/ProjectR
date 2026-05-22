-- RGPD Art. 17 — Right to Erasure: PL/pgSQL function for atomic cascade deletion
-- Transação implícita: se qualquer DML falha, tudo faz ROLLBACK
create or replace function fn_erase_subject_cascade(
  p_player_id uuid,
  p_actor_id uuid,
  OUT result jsonb
) language plpgsql security definer
set search_path = public
as $$
declare
  v_profile_id uuid;
  v_club_id uuid;
begin
  -- Verifica que o jogador existe e obtém profile_id + club_id
  select profile_id, club_id
    into v_profile_id, v_club_id
    from players
   where id = p_player_id;

  if not found then
    result := jsonb_build_object('ok', false, 'error', 'not_found');
    return;
  end if;

  -- Cria audit log ANTES de qualquer delete (evidência imutável do evento)
  insert into audit_logs (id, club_id, actor_id, action, target_kind, target_id, metadata, created_at)
  values (
    gen_random_uuid(),
    v_club_id,
    p_actor_id,
    'subject.erased',
    'player',
    p_player_id,
    jsonb_build_object('erased_at', now(), 'reason', 'gdpr_right_erasure'),
    now()
  );

  -- Deletes em ordem de dependência (profile_id first, depois player_id, depois players)
  delete from push_subscriptions where profile_id = v_profile_id;
  delete from notification_log   where profile_id = v_profile_id;
  delete from data_decisions      where player_id = p_player_id;
  delete from parental_consents   where player_id = p_player_id;
  delete from match_lineups       where player_id = p_player_id;
  delete from attendances         where player_id = p_player_id;
  delete from session_metrics     where player_id = p_player_id;
  delete from match_events        where player_id = p_player_id;
  delete from fatigue_responses   where player_id = p_player_id;
  delete from player_metrics      where player_id = p_player_id;

  -- UPDATE audit_logs: preserva entradas mas anonimiza IDs (evidência sem dados pessoais)
  update audit_logs
     set actor_id = null,
         target_id = null
   where target_id = p_player_id
      or actor_id = v_profile_id;

  -- DELETE players (e qualquer cascade de FK activa)
  delete from players where id = p_player_id;

  result := jsonb_build_object('ok', true, 'erased', true, 'profile_id', v_profile_id);

exception
  when others then
    result := jsonb_build_object('ok', false, 'error', sqlerrm);
    raise; -- força ROLLBACK de toda a transação
end;
$$;
