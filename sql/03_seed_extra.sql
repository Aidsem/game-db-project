-- =====================================================================
-- 03_seed_extra.sql - extra builds, JSONB profiles, SAMPLE damage data.
-- !! Damage numbers below are SAMPLE / illustrative values, not measured !!
-- Run AFTER 02_seed_data.sql. Re-runnable only after re-running 01 + 02.
-- =====================================================================

-- Extra builds so the "compare builds" graph has something to compare
INSERT INTO builds (character_id, build_name, weapon_id, artifact_id)
SELECT c.id, x.bname, w.id, a.id
FROM (VALUES
  ('Hu Tao',  'F2P Build',    'Deathmatch',      'Crimson Witch of Flames'),
  ('Ganyu',   'Melt Build',   'Skyward Harp',    'Blizzard Strayer'),
  ('Xiao',    'Budget Build', 'Favonius Lance',  'Viridescent Venerer'),
  ('Diluc',   'Budget Build', 'Rainslasher',     'Crimson Witch of Flames'),
  ('Eula',    'Budget Build', 'Serpent Spine',   'Gladiator''s Finale')
) AS x(cname, bname, wname, aname)
JOIN characters c ON c.name = x.cname
JOIN weapons    w ON w.name = x.wname
JOIN artifacts  a ON a.set_name = x.aname;

-- Teammates for the extra builds
INSERT INTO build_team_members (build_id, character_id, notes)
SELECT b.id, t.id, x.note
FROM (VALUES
  ('Hu Tao','F2P Build','Xingqiu','Hydro for Vaporize'),
  ('Hu Tao','F2P Build','Bennett','ATK buff and healing'),
  ('Ganyu','Melt Build','Xiangling','Pyro for Melt'),
  ('Ganyu','Melt Build','Venti','Grouping'),
  ('Xiao','Budget Build','Bennett','ATK buff'),
  ('Diluc','Budget Build','Xingqiu','Hydro for Vaporize'),
  ('Eula','Budget Build','Bennett','ATK buff')
) AS x(cname, bname, tname, note)
JOIN characters c ON c.name = x.cname
JOIN builds     b ON b.character_id = c.id AND b.build_name = x.bname
JOIN characters t ON t.name = x.tname;

-- JSONB profiles (semi-structured: region, stat priority, playstyle)
INSERT INTO character_profiles (character_id, profile)
SELECT c.id, x.p::jsonb
FROM (VALUES
 ('Hu Tao',          '{"region":"Liyue","stat_priority":["Crit Rate","Crit DMG","Elemental Mastery"],"playstyle":"Melee burst-window DPS"}'),
 ('Ganyu',           '{"region":"Liyue","stat_priority":["Crit Rate","Crit DMG","ATK%"],"playstyle":"Ranged charged-shot DPS"}'),
 ('Zhongli',         '{"region":"Liyue","stat_priority":["HP%","Crit Rate","Elemental Mastery"],"playstyle":"Shielder and support"}'),
 ('Xiao',            '{"region":"Liyue","stat_priority":["Crit Rate","Crit DMG","ATK%"],"playstyle":"Plunge-attack melee DPS"}'),
 ('Yelan',           '{"region":"Liyue","stat_priority":["Crit Rate","Crit DMG","HP%"],"playstyle":"Off-field Hydro sub-DPS"}'),
 ('Venti',           '{"region":"Mondstadt","stat_priority":["Elemental Mastery","Energy Recharge"],"playstyle":"Crowd-control support"}'),
 ('Diluc',           '{"region":"Mondstadt","stat_priority":["Crit Rate","Crit DMG","ATK%"],"playstyle":"Melee Pyro DPS"}'),
 ('Eula',            '{"region":"Mondstadt","stat_priority":["Crit Rate","Physical DMG","ATK%"],"playstyle":"Burst-window physical DPS"}'),
 ('Bennett',         '{"region":"Mondstadt","stat_priority":["Energy Recharge","HP%"],"playstyle":"Buff and healing support"}'),
 ('Raiden Shogun',   '{"region":"Inazuma","stat_priority":["Energy Recharge","Crit Rate","Crit DMG"],"playstyle":"Burst DPS and battery"}'),
 ('Kamisato Ayaka',  '{"region":"Inazuma","stat_priority":["Crit DMG","Crit Rate","ATK%"],"playstyle":"Dash-based Cryo DPS"}'),
 ('Nahida',          '{"region":"Sumeru","stat_priority":["Elemental Mastery","Energy Recharge"],"playstyle":"Dendro support"}'),
 ('Nilou',           '{"region":"Sumeru","stat_priority":["HP%","Elemental Mastery"],"playstyle":"Bloom-team enabler"}'),
 ('Neuvillette',     '{"region":"Fontaine","stat_priority":["Crit Rate","Crit DMG","HP%"],"playstyle":"Charged-attack Hydro DPS"}'),
 ('Furina',          '{"region":"Fontaine","stat_priority":["HP%","Crit Rate","Energy Recharge"],"playstyle":"Team-wide damage buffer"}')
) AS x(cname, p)
JOIN characters c ON c.name = x.cname;

-- SAMPLE damage logs (illustrative numbers)
INSERT INTO build_damage_logs (build_id, label, damage_value, notes)
SELECT b.id, x.label, x.dmg, 'Sample data'
FROM (VALUES
  ('Hu Tao','Main Build','Full Rotation',148000), ('Hu Tao','Main Build','Charged Attack',62000),
  ('Hu Tao','Main Build','Elemental Burst',91000), ('Hu Tao','F2P Build','Full Rotation',104000),
  ('Hu Tao','F2P Build','Charged Attack',45000),
  ('Ganyu','Main Build','Full Rotation',135000), ('Ganyu','Main Build','Charged Attack',88000),
  ('Ganyu','Melt Build','Full Rotation',152000), ('Ganyu','Melt Build','Charged Attack',96000),
  ('Xiao','Main Build','Full Rotation',142000), ('Xiao','Budget Build','Full Rotation',98000),
  ('Diluc','Main Build','Full Rotation',120000), ('Diluc','Budget Build','Full Rotation',87000),
  ('Eula','Main Build','Full Rotation',130000), ('Eula','Budget Build','Full Rotation',92000),
  ('Raiden Shogun','Main Build','Elemental Burst',110000),
  ('Kamisato Ayaka','Main Build','Full Rotation',138000)
) AS x(cname, bname, label, dmg)
JOIN characters c ON c.name = x.cname
JOIN builds     b ON b.character_id = c.id AND b.build_name = x.bname;
