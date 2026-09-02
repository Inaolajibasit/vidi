-- Personality definitions are display metadata and an auditable description of
-- the application-side deterministic rules. Assignment remains server-side so
-- clients cannot choose or write their own personality.
insert into public.personalities (slug, name, description, result_copy, criteria)
values
  ('the_overthinker', 'THE OVERTHINKER', 'You finish the film. The film does not finish with you.', 'still processing the ending.', '{"minimum":{"answered":15,"seen":6,"positive":4},"signals":["mystery","science_fiction","psychological_and_nonlinear_keywords"]}'::jsonb),
  ('plot_twist_addict', 'PLOT-TWIST ADDICT', 'If the third act behaves itself, you feel cheated.', 'trust issues, but cinematic.', '{"minimum":{"answered":15,"seen":6,"positive":4},"signals":["thriller","mystery","twist_and_unreliable_narrator_keywords"]}'::jsonb),
  ('blockbuster_merchant', 'BLOCKBUSTER MERCHANT', 'Big screen. Big stakes. Reasonable amount of structural damage.', 'subtlety was never invited.', '{"minimum":{"answered":15,"seen":7,"positive":5},"signals":["mainstream_popularity","action","adventure","exposure"]}'::jsonb),
  ('film_bro', 'FILM BRO', 'You have thoughts about aspect ratios. Several, apparently.', 'the director’s cut was better, presumably.', '{"minimum":{"answered":20,"seen":8,"positive":6},"signals":["crime_and_drama","science_fiction","pre_2005","non_mainstream"]}'::jsonb),
  ('horror_menace', 'HORROR MENACE', 'A dark hallway is apparently a perfectly good evening.', 'sleep was optional anyway.', '{"minimum":{"answered":15,"seen":5,"positive":4},"signals":["horror","horror_keywords"]}'::jsonb),
  ('the_casual', 'THE CASUAL', 'You like movies. You also have other things going on.', 'healthy, honestly.', '{"minimum":{"answered":20,"seen":3,"positive":2},"signals":["lower_exposure","cant_remember","mainstream_popularity"]}'::jsonb),
  ('animation_defender', 'ANIMATION DEFENDER', 'It is a medium, not a genre. Yes, you have explained this before.', 'correct, and willing to say it again.', '{"minimum":{"answered":15,"seen":5,"positive":4},"signals":["animation","anime_and_animation_keywords"]}'::jsonb),
  ('the_completionist', 'THE COMPLETIONIST', 'You have seen nearly everything. This is not an intervention.', 'have you considered sunlight?', '{"minimum":{"answered":20,"seen":14,"positive":3},"signals":["seen_ratio","seen_count","recall"]}'::jsonb),
  ('cult_classic_merchant', 'CULT CLASSIC MERCHANT', 'Your recommendations usually begin with “hear me out.”', 'the group chat has been warned.', '{"minimum":{"answered":20,"seen":7,"positive":5},"signals":["lower_popularity","pre_2005","cult_and_independent_keywords"]}'::jsonb),
  ('the_romantic', 'THE ROMANTIC', 'Feeling wins. Plot logistics can wait outside.', 'emotionally available for approximately 120 minutes.', '{"minimum":{"answered":15,"seen":5,"positive":4},"signals":["romance","love_keywords","drama"]}'::jsonb)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  result_copy = excluded.result_copy,
  criteria = excluded.criteria,
  updated_at = now();
