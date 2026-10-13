-- =====================================================================
-- 05_queries.sql - demo queries for the viva (PostgreSQL)
-- =====================================================================

-- Q1 [JOIN 3 tables] Full build sheet
SELECT c.name, b.build_name, w.name AS weapon, a.set_name AS artifact
FROM builds b JOIN characters c ON c.id=b.character_id
JOIN weapons w ON w.id=b.weapon_id JOIN artifacts a ON a.id=b.artifact_id
ORDER BY c.name, b.build_name;

-- Q2 [JOIN junction] Recommended team of Hu Tao's Main Build
SELECT tc.name AS teammate, m.notes
FROM build_team_members m
JOIN builds b ON b.id=m.build_id JOIN characters c ON c.id=b.character_id
JOIN characters tc ON tc.id=m.character_id
WHERE c.name='Hu Tao' AND b.build_name='Main Build';

-- Q3 [GROUP BY + HAVING] Elements with more than 11 characters
SELECT element, COUNT(*) AS total FROM characters
GROUP BY element HAVING COUNT(*) > 11 ORDER BY total DESC;

-- Q4 [Aggregate] Average weapon rarity per type
SELECT type, ROUND(AVG(rarity),2) AS avg_rarity, COUNT(*) AS weapons
FROM weapons GROUP BY type ORDER BY avg_rarity DESC;

-- Q5 [Subquery in WHERE] Characters with an S-tier combat entry
SELECT name, element FROM characters
WHERE id IN (SELECT character_id FROM tier_list_combat WHERE tier='S') ORDER BY name;

-- Q6 [Correlated subquery] Builds above their character's average damage
SELECT c.name, b.build_name, ROUND(AVG(d.damage_value)::numeric,0) AS avg_dmg
FROM builds b JOIN characters c ON c.id=b.character_id
JOIN build_damage_logs d ON d.build_id=b.id
GROUP BY c.name, b.id, b.build_name, b.character_id
HAVING AVG(d.damage_value) > (
   SELECT AVG(d2.damage_value) FROM build_damage_logs d2
   JOIN builds b2 ON b2.id=d2.build_id WHERE b2.character_id=b.character_id);

-- Q7 [LEFT JOIN anti-join] Characters with no builds
SELECT c.name FROM characters c LEFT JOIN builds b ON b.character_id=c.id
WHERE b.id IS NULL ORDER BY c.name LIMIT 15;

-- Q8 [View] Character overview
SELECT * FROM v_character_overview WHERE best_combat_tier='S' ORDER BY name;

-- Q9 [View] Builds with weapon, artifact and team
SELECT * FROM v_build_details ORDER BY character_name;

-- Q10 [View] Damage summary, best first
SELECT * FROM v_build_damage_summary WHERE runs>0 ORDER BY avg_damage DESC;

-- Q11 [Function] Best build for Ganyu
SELECT * FROM get_best_build((SELECT id FROM characters WHERE name='Ganyu'));

-- Q12 [JSONB] Liyue characters and their stat priority
SELECT c.name, p.profile->>'playstyle' AS playstyle, p.profile->'stat_priority' AS stats
FROM character_profiles p JOIN characters c ON c.id=p.character_id
WHERE p.profile @> '{"region":"Liyue"}'::jsonb;

-- Q13 [Procedure] Log damage through the stored procedure
-- (CALL arguments cannot be subqueries, so use a build id from Q9, e.g. 29)
CALL add_damage_log(29, 'Demo Run', 99000, 'viva demo');

-- Q14 [Trigger] Negative damage is rejected (expect an ERROR)
-- INSERT INTO build_damage_logs (build_id,label,damage_value) VALUES (1,'bad',-5);

-- Q15 [Transaction] Rolled-back update
BEGIN;
UPDATE weapons SET rarity=1 WHERE name='Skyward Harp';
SELECT name, rarity FROM weapons WHERE name='Skyward Harp';
ROLLBACK;

-- Q16 [Audit trigger] Insert then delete a character, then read the log
BEGIN;
INSERT INTO characters (release_order,name,rarity,element,weapon_type) VALUES (9999,'Demo Hero',4,'Pyro','Sword');
DELETE FROM characters WHERE name='Demo Hero';
SELECT action, details FROM audit_log ORDER BY id DESC LIMIT 2;
ROLLBACK;
