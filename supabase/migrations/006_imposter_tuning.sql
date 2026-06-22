-- ============================================================
-- Lounge: Imposter tuning — 100-word pool, min 4 players, and up to TWO
-- imposters when there are more than 7 players. Run after 005. Safe to re-run.
-- ============================================================

-- The old 2-arg deal is replaced by a 3-arg version (imposter count).
DROP FUNCTION IF EXISTS imposter_deal(uuid, uuid[]);

CREATE OR REPLACE FUNCTION imposter_deal(p_match uuid, p_players uuid[], p_imposters int DEFAULT 1)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_host  uuid;
  v_count int;
  v_n     int;
  v_word  text;
  v_imps  uuid[];
  v_words text[] := ARRAY[
    'Beach','Library','Hospital','Airport','Castle','Volcano','Submarine','Circus','Bakery','Museum',
    'Stadium','Jungle','Desert','Spaceship','Lighthouse','Aquarium','Vineyard','Glacier','Pyramid','Waterfall',
    'Carnival','Observatory','Greenhouse','Harbour','Cathedral','Windmill','Treehouse','Igloo','Saloon','Laboratory',
    'Orchard','Marketplace','Temple','Canyon','Reef','Tundra','Bazaar','Cottage','Arena','Studio',
    'Volcano','Subway','Cinema','Casino','Farmhouse','Ferry','Bridge','Tavern','Monastery','Planetarium',
    'Campsite','Dungeon','Penthouse','Cellar','Attic','Garage','Playground','Zoo','Safari','Ranch',
    'Dock','Pier','Cabin','Bunker','Fortress','Palace','Cottage','Barn','Mill','Forge',
    'Clinic','Pharmacy','Bookshop','Cafe','Diner','Brewery','Distillery','Gallery','Theatre','Opera',
    'Gymnasium','Spa','Sauna','Marina','Airfield','Runway','Station','Depot','Warehouse','Factory',
    'Quarry','Mine','Oasis','Lagoon','Fjord','Meadow','Prairie','Savanna','Swamp','Rainforest'
  ];
BEGIN
  SELECT host_id INTO v_host FROM game_matches WHERE id = p_match;
  IF v_host IS NULL OR v_host <> auth.uid() THEN RAISE EXCEPTION 'only host can deal'; END IF;

  v_count := COALESCE(array_length(p_players, 1), 0);
  IF v_count < 4 THEN RAISE EXCEPTION 'need at least 4 players'; END IF;

  -- Two imposters only allowed with more than 7 players; otherwise exactly one.
  v_n := CASE WHEN p_imposters >= 2 AND v_count > 7 THEN 2 ELSE 1 END;

  v_word := v_words[1 + floor(random() * array_length(v_words, 1))::int];

  SELECT array_agg(p) INTO v_imps
  FROM (SELECT unnest(p_players) AS p ORDER BY random() LIMIT v_n) s;

  INSERT INTO match_secrets (match_id, data, revealed, updated_at)
  VALUES (
    p_match,
    jsonb_build_object('word', v_word, 'imposters', to_jsonb(v_imps), 'players', to_jsonb(p_players)),
    false, now()
  )
  ON CONFLICT (match_id) DO UPDATE SET data = EXCLUDED.data, revealed = false, updated_at = now();
END; $$;

-- Caller's own role. Imposter membership is now an array.
CREATE OR REPLACE FUNCTION imposter_my_role(p_match uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_data jsonb; v_is_imp boolean;
BEGIN
  SELECT data INTO v_data FROM match_secrets WHERE match_id = p_match;
  IF v_data IS NULL THEN RETURN NULL; END IF;
  IF NOT is_member(v_data->'players') THEN RAISE EXCEPTION 'not a participant'; END IF;
  v_is_imp := EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(COALESCE(v_data->'imposters', '[]'::jsonb)) e
    WHERE e = auth.uid()::text
  );
  IF v_is_imp THEN
    RETURN jsonb_build_object('role', 'imposter', 'word', NULL);
  END IF;
  RETURN jsonb_build_object('role', 'crew', 'word', v_data->>'word');
END; $$;

-- Full truth, only after reveal. Returns the imposter id ARRAY.
CREATE OR REPLACE FUNCTION imposter_truth(p_match uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_data jsonb; v_rev boolean;
BEGIN
  SELECT data, revealed INTO v_data, v_rev FROM match_secrets WHERE match_id = p_match;
  IF v_data IS NULL OR NOT v_rev THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('word', v_data->>'word', 'imposters', COALESCE(v_data->'imposters', '[]'::jsonb));
END; $$;

GRANT EXECUTE ON FUNCTION imposter_deal(uuid, uuid[], int) TO authenticated;
GRANT EXECUTE ON FUNCTION imposter_my_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION imposter_truth(uuid) TO authenticated;
