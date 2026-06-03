CREATE OR REPLACE FUNCTION execute_raid(
  p_attacker_id       bigint,
  p_defender_id       bigint,
  p_attack_score      int,
  p_defense_score     int,
  p_success           boolean,
  p_attack_breakdown  jsonb,
  p_defense_breakdown jsonb,
  p_vehicle           text,
  p_tag_style         text
)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_raid_id           bigint;
  v_attacker_raid_xp  int;
  v_defender_raid_xp  int;
BEGIN
  -- Prevent duplicate raids in the same request (idempotency guard)
  IF EXISTS (
    SELECT 1 FROM raids
    WHERE attacker_id = p_attacker_id
      AND defender_id = p_defender_id
      AND created_at >= now() - interval '10 seconds'
  ) THEN
    RAISE EXCEPTION 'duplicate_raid';
  END IF;

  -- 1. Insert raid row
  INSERT INTO raids (
    attacker_id, defender_id,
    attack_score, defense_score,
    success,
    attack_breakdown, defense_breakdown,
    attacker_vehicle, attacker_tag_style
  )
  VALUES (
    p_attacker_id, p_defender_id,
    p_attack_score, p_defense_score,
    p_success,
    p_attack_breakdown, p_defense_breakdown,
    p_vehicle, p_tag_style
  )
  RETURNING id INTO v_raid_id;

  -- 2. Apply peace shield + clear active defenses on defender
  UPDATE developers
  SET last_raided_at = now(),
      active_defenses = '[]'::jsonb
  WHERE id = p_defender_id;

  -- 3. XP grants
  SELECT COALESCE(raid_xp, 0) INTO v_attacker_raid_xp FROM developers WHERE id = p_attacker_id;
  SELECT COALESCE(raid_xp, 0) INTO v_defender_raid_xp FROM developers WHERE id = p_defender_id;

  IF p_success THEN
    -- Deactivate existing tag on defender
    UPDATE raid_tags SET active = false
    WHERE building_id = p_defender_id AND active = true;

    -- Insert new tag
    INSERT INTO raid_tags (raid_id, building_id, attacker_id, attacker_login, tag_style, expires_at)
    SELECT v_raid_id, p_defender_id, p_attacker_id, d.github_login, p_tag_style,
           now() + interval '3 days'
    FROM developers d WHERE d.id = p_attacker_id;

    -- raid_xp
    UPDATE developers SET raid_xp = v_attacker_raid_xp + 30 WHERE id = p_attacker_id;
    UPDATE developers SET raid_xp = v_defender_raid_xp + 10 WHERE id = p_defender_id;

    -- activity feed
    INSERT INTO activity_feed (event_type, actor_id, target_id, metadata)
    SELECT 'raid_success', p_attacker_id, p_defender_id,
           jsonb_build_object(
             'attacker_login', a.github_login,
             'defender_login', d.github_login,
             'attack_score', p_attack_score,
             'defense_score', p_defense_score
           )
    FROM developers a, developers d
    WHERE a.id = p_attacker_id AND d.id = p_defender_id;
  ELSE
    UPDATE developers SET raid_xp = v_defender_raid_xp + 20 WHERE id = p_defender_id;

    INSERT INTO activity_feed (event_type, actor_id, target_id, metadata)
    SELECT 'raid_failed', p_attacker_id, p_defender_id,
           jsonb_build_object(
             'attacker_login', a.github_login,
             'defender_login', d.github_login,
             'attack_score', p_attack_score,
             'defense_score', p_defense_score
           )
    FROM developers a, developers d
    WHERE a.id = p_attacker_id AND d.id = p_defender_id;
  END IF;

  RETURN jsonb_build_object(
    'raid_id',          v_raid_id,
    'success',          p_success,
    'attack_score',     p_attack_score,
    'defense_score',    p_defense_score,
    'attack_breakdown', p_attack_breakdown,
    'defense_breakdown',p_defense_breakdown,
    'vehicle',          p_vehicle,
    'tag_style',        p_tag_style
  );
END;
$$;