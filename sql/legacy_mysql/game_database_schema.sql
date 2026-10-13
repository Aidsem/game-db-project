-- =====================================================================
-- GAME DATABASE SCHEMA
-- Tables: characters, weapons, artifacts, tier lists, builds
-- Engine: InnoDB (for foreign key support), Charset: utf8mb4
-- =====================================================================

CREATE DATABASE IF NOT EXISTS game_db
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE game_db;

-- ---------------------------------------------------------------------
-- 1) MAIN TABLE: characters
-- ---------------------------------------------------------------------
CREATE TABLE characters (
    id              INT PRIMARY KEY AUTO_INCREMENT,   -- release order acts as the natural id
    release_order   INT NOT NULL UNIQUE,               -- explicit release order (in case id is reused/edited later)
    name            VARCHAR(100) NOT NULL,
    rarity          TINYINT NOT NULL CHECK (rarity BETWEEN 1 AND 5),
    element         VARCHAR(30) NOT NULL,
    weapon_type     VARCHAR(30) NOT NULL,
    description     TEXT,
    UNIQUE KEY uq_character_name (name)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 2) WEAPONS TABLE
--    "List of all weapons in each type segregated" -> modeled as
--    weapon_type being a column you can GROUP BY / filter on,
--    with rarity used for ORDER BY DESC per type.
-- ---------------------------------------------------------------------
CREATE TABLE weapons (
    id              INT PRIMARY KEY AUTO_INCREMENT,
    name            VARCHAR(100) NOT NULL,
    type            VARCHAR(30) NOT NULL,              -- Sword, Claymore, Polearm, Bow, Catalyst, etc.
    rarity          TINYINT NOT NULL CHECK (rarity BETWEEN 1 AND 5),
    description     TEXT,
    UNIQUE KEY uq_weapon_name (name),
    INDEX idx_weapon_type_rarity (type, rarity DESC)   -- supports "segregated by type, decreasing rarity"
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 3) ARTIFACTS TABLE (artifact SETS)
-- ---------------------------------------------------------------------
CREATE TABLE artifacts (
    id              INT PRIMARY KEY AUTO_INCREMENT,
    set_name        VARCHAR(100) NOT NULL,
    bonus_2pc       TEXT NOT NULL,
    bonus_4pc       TEXT NOT NULL,
    UNIQUE KEY uq_artifact_set (set_name)
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 4) TIER LIST (COMBAT)
-- ---------------------------------------------------------------------
CREATE TABLE tier_list_combat (
    id              INT PRIMARY KEY AUTO_INCREMENT,
    character_id    INT NOT NULL,
    tier            ENUM('S','A','B','C','D') NOT NULL,
    role            VARCHAR(50) NOT NULL,               -- e.g. Main DPS, Sub-DPS, Support, Healer
    CONSTRAINT fk_tlc_character
        FOREIGN KEY (character_id) REFERENCES characters(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    UNIQUE KEY uq_character_combat_role (character_id, role) -- a character can have >1 role/tier entry, not the same role twice
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 5) TIER LIST (EXPLORATION)
-- ---------------------------------------------------------------------
CREATE TABLE tier_list_exploration (
    id              INT PRIMARY KEY AUTO_INCREMENT,
    character_id    INT NOT NULL UNIQUE,                -- one exploration tier per character
    tier            ENUM('S','A','B','C','D') NOT NULL,
    CONSTRAINT fk_tle_character
        FOREIGN KEY (character_id) REFERENCES characters(id)
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- ---------------------------------------------------------------------
-- 6) BUILDS TABLE
--    A character can have multiple recommended builds (e.g. DPS build,
--    support build), each with one recommended weapon and one
--    recommended artifact set. "Team recommended" is one-to-many
--    (a team has multiple members), so it's split into a junction table.
-- ---------------------------------------------------------------------
CREATE TABLE builds (
    id              INT PRIMARY KEY AUTO_INCREMENT,
    character_id    INT NOT NULL,
    build_name      VARCHAR(100) NOT NULL DEFAULT 'Main Build',  -- lets a character have multiple named builds
    weapon_id       INT NOT NULL,
    artifact_id     INT NOT NULL,
    CONSTRAINT fk_build_character
        FOREIGN KEY (character_id) REFERENCES characters(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_build_weapon
        FOREIGN KEY (weapon_id) REFERENCES weapons(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT fk_build_artifact
        FOREIGN KEY (artifact_id) REFERENCES artifacts(id)
        ON DELETE RESTRICT ON UPDATE CASCADE,
    UNIQUE KEY uq_character_build (character_id, build_name)
) ENGINE=InnoDB;

-- Junction table for recommended team members of a build
CREATE TABLE build_team_members (
    id              INT PRIMARY KEY AUTO_INCREMENT,
    build_id        INT NOT NULL,
    character_id    INT NOT NULL,                       -- a recommended teammate
    notes           VARCHAR(255),                        -- optional: why this teammate fits
    CONSTRAINT fk_btm_build
        FOREIGN KEY (build_id) REFERENCES builds(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_btm_character
        FOREIGN KEY (character_id) REFERENCES characters(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
    UNIQUE KEY uq_build_teammate (build_id, character_id)
) ENGINE=InnoDB;

-- =====================================================================
-- SAMPLE QUERIES (for reference — not executed)
-- =====================================================================

-- All weapons of a given type, sorted by decreasing rarity:
-- SELECT * FROM weapons WHERE type = 'Sword' ORDER BY rarity DESC;

-- Full build sheet for a character:
-- SELECT c.name, b.build_name, w.name AS weapon, a.set_name AS artifact
-- FROM builds b
-- JOIN characters c ON c.id = b.character_id
-- JOIN weapons w ON w.id = b.weapon_id
-- JOIN artifacts a ON a.id = b.artifact_id
-- WHERE c.name = 'ExampleCharacter';

-- Recommended team for a build:
-- SELECT tc.name AS teammate, btm.notes
-- FROM build_team_members btm
-- JOIN characters tc ON tc.id = btm.character_id
-- WHERE btm.build_id = 1;

-- Combat S-tier list with roles:
-- SELECT c.name, tlc.role
-- FROM tier_list_combat tlc
-- JOIN characters c ON c.id = tlc.character_id
-- WHERE tlc.tier = 'S';


-- =====================================================================
-- GENSHIN IMPACT DATABASE - SEED DATA
-- Companion INSERT script for game_database_schema.sql
-- NOTE: Rarity is stored as VARCHAR per request (e.g. '5-Star', '4-Star')
-- Data compiled from public game knowledge; covers a broad, well-established
-- roster (through early Natlan). Very recently released characters/items
-- are NOT included to avoid inaccurate entries -- add those manually as
-- HoYoverse releases them.
-- =====================================================================

USE game_db;

SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE build_team_members;
TRUNCATE TABLE builds;
TRUNCATE TABLE tier_list_exploration;
TRUNCATE TABLE tier_list_combat;
TRUNCATE TABLE artifacts;
TRUNCATE TABLE weapons;
TRUNCATE TABLE characters;
SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- 1) CHARACTERS  (release_order, name, rarity, element, weapon_type, description)
-- ---------------------------------------------------------------------

INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (1, 'Kaeya', '4-Star', 'Cryo', 'Sword', 'Cavalry Captain of the Knights of Favonius; reliable off-field Cryo application.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (2, 'Amber', '4-Star', 'Pyro', 'Bow', 'Outrider of the Knights of Favonius; early-game Pyro bow user.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (3, 'Lisa', '4-Star', 'Electro', 'Catalyst', 'Librarian of the Knights of Favonius; wide AoE Electro applicator.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (4, 'Barbara', '4-Star', 'Hydro', 'Catalyst', 'Idol of Mondstadt and a natural healer with off-field Hydro application.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (5, 'Diluc', '5-Star', 'Pyro', 'Claymore', 'Owner of the Dawn Winery; a powerful standard-banner Pyro DPS.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (6, 'Jean', '5-Star', 'Anemo', 'Sword', 'Acting Grand Master of the Knights of Favonius; strong healer and Anemo support.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (7, 'Xiangling', '4-Star', 'Pyro', 'Polearm', 'Head chef of the Wanmin Restaurant; premier off-field Pyro sub-DPS.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (8, 'Beidou', '4-Star', 'Electro', 'Claymore', 'Captain of the Crux fleet; counter-based Electro claymore user.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (9, 'Ningguang', '4-Star', 'Geo', 'Catalyst', 'Tianquan of the Liyue Qixing; ranged Geo damage dealer.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (10, 'Xingqiu', '4-Star', 'Hydro', 'Sword', 'Second son of the Feiyun Commerce Guild; top-tier off-field Hydro support.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (11, 'Chongyun', '4-Star', 'Cryo', 'Claymore', 'Exorcist with excess yang energy; niche Cryo infusion support.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (12, 'Noelle', '4-Star', 'Geo', 'Claymore', 'Maid of the Knights of Favonius; tanky Geo shielder/DPS.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (13, 'Qiqi', '5-Star', 'Cryo', 'Sword', 'An undying corpse working at Bubu Pharmacy; strong healer.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (14, 'Bennett', '4-Star', 'Pyro', 'Sword', 'Unlucky but cheerful adventurer; one of the best ATK/healing supports in the game.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (15, 'Fischl', '4-Star', 'Electro', 'Bow', 'Self-proclaimed Prinzessin der Verurteilung; consistent off-field Electro sub-DPS.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (16, 'Mona', '5-Star', 'Hydro', 'Catalyst', 'Astrologist and diviner; strong Hydro DPS/support with burst-cost reduction.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (17, 'Sucrose', '4-Star', 'Anemo', 'Catalyst', 'Alchemist of the Knights of Favonius; premier EM support and Swirl enabler.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (18, 'Xinyan', '4-Star', 'Pyro', 'Claymore', 'Rock musician of Liyue; niche Pyro shielder.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (19, 'Rosaria', '4-Star', 'Cryo', 'Polearm', 'Deaconess of the Church of Favonius; crit-rate support and Cryo sub-DPS.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (20, 'Venti', '5-Star', 'Anemo', 'Bow', 'The Anemo Archon in disguise as a wandering bard; top grouping/support unit.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (21, 'Klee', '5-Star', 'Pyro', 'Catalyst', 'Mondstadt''s explosive prodigy; strong burst-based Pyro DPS.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (22, 'Diona', '4-Star', 'Cryo', 'Bow', 'Half-cat bartender who despises alcohol; strong shielder/healer.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (23, 'Zhongli', '5-Star', 'Geo', 'Polearm', 'The Geo Archon Morax; best-in-slot shielder and Geo support.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (24, 'Xiao', '5-Star', 'Anemo', 'Polearm', 'The last adeptus of Liyue''s guardian yakshas; premier Plunge-attack Anemo DPS.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (25, 'Ganyu', '5-Star', 'Cryo', 'Bow', 'Half-qilin secretary of the Liyue Qixing; top charged-shot Cryo DPS.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (26, 'Albedo', '5-Star', 'Geo', 'Sword', 'Chief alchemist of the Knights of Favonius; Geo Construct-based sub-DPS.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (27, 'Hu Tao', '5-Star', 'Pyro', 'Polearm', '77th Director of the Wangsheng Funeral Parlor; iconic HP-cost Pyro DPS.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (28, 'Yanfei', '4-Star', 'Pyro', 'Catalyst', 'Legal advisor of Liyue; strong charged-attack Pyro damage dealer.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (29, 'Eula', '5-Star', 'Cryo', 'Claymore', 'Captain of the Reconnaissance Company; burst-window Physical/Cryo DPS.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (30, 'Kamisato Ayaka', '5-Star', 'Cryo', 'Sword', 'Yashiro Commission''s Shirasagi Himegimi; iconic Cryo dash DPS.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (31, 'Yoimiya', '5-Star', 'Pyro', 'Bow', 'Naganohara Fireworks proprietor; rapid-fire Pyro bow DPS.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (32, 'Sayu', '4-Star', 'Anemo', 'Claymore', 'Shuumatsuban ninja who prefers napping; healer and exploration utility.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (33, 'Kujou Sara', '4-Star', 'Electro', 'Bow', 'Tengu adjutant of the Raiden Shogun; ATK% buffer support.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (34, 'Kamisato Ayato', '5-Star', 'Hydro', 'Sword', 'Head of the Yashiro Commission; submersion-based Hydro DPS.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (35, 'Yae Miko', '5-Star', 'Electro', 'Catalyst', 'Guuji of the Grand Narukami Shrine; totem-based Electro sub-DPS.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (36, 'Raiden Shogun', '5-Star', 'Electro', 'Polearm', 'The Electro Archon; energy-recharge focused burst DPS/support.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (37, 'Sangonomiya Kokomi', '5-Star', 'Hydro', 'Catalyst', 'Divine Priestess of Watatsumi Island; strong healer and Hydro applicator.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (38, 'Thoma', '4-Star', 'Pyro', 'Polearm', 'Housekeeper of the Kamisato Clan; shielder with Pyro application.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (39, 'Gorou', '4-Star', 'Geo', 'Bow', 'General of the Watatsumi Island defense force; Geo-team support.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (40, 'Arataki Itto', '5-Star', 'Geo', 'Claymore', 'Self-proclaimed boss of the Arataki Gang; superconduct/Geo claymore DPS.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (41, 'Shenhe', '5-Star', 'Cryo', 'Polearm', 'Cloud Retainer''s disciple; strong Cryo DMG support.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (42, 'Yun Jin', '4-Star', 'Geo', 'Polearm', 'Star of the Liyue opera scene; normal-attack DMG support.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (43, 'Kuki Shinobu', '4-Star', 'Electro', 'Sword', 'Vice general of the Arataki Gang; Electro healer/support.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (44, 'Yelan', '5-Star', 'Hydro', 'Bow', 'Undercover agent of the Liyue Qixing; off-field Hydro sub-DPS.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (45, 'Kirara', '4-Star', 'Dendro', 'Sword', 'Postal courier of the Sumeru Menagerie; niche shielder.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (46, 'Shikanoin Heizou', '4-Star', 'Anemo', 'Catalyst', 'Tenryou Commission investigator; martial-arts-style Anemo sub-DPS.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (47, 'Tighnari', '5-Star', 'Dendro', 'Bow', 'Forest Ranger of the Gandharva Ville; premier aimed-shot Dendro DPS.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (48, 'Collei', '4-Star', 'Dendro', 'Bow', 'Forest Ranger apprentice; budget Dendro sub-DPS.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (49, 'Dori', '4-Star', 'Electro', 'Claymore', 'Merchant of the Palace of Alcazarzaray; energy and healing support.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (50, 'Candace', '4-Star', 'Hydro', 'Polearm', 'Guardian of Aaru Village; Hydro shielder/support.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (51, 'Cyno', '5-Star', 'Electro', 'Polearm', 'General Mahamatra of Sumeru; Electro-charged focused DPS.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (52, 'Nilou', '5-Star', 'Hydro', 'Sword', 'Star dancer of the Zubayr Theater; Bloom-focused Hydro DPS/support.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (53, 'Nahida', '5-Star', 'Dendro', 'Catalyst', 'The Dendro Archon Lesser Lord Kusanali; best-in-slot Dendro support/DPS.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (54, 'Layla', '4-Star', 'Cryo', 'Sword', 'Sleep-deprived astronomy student; shielder support.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (55, 'Wanderer', '5-Star', 'Anemo', 'Catalyst', 'A wandering soul in a new puppet body; airborne Anemo DPS.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (56, 'Faruzan', '4-Star', 'Anemo', 'Bow', 'Scholar of Anemo mechanics; Anemo DMG and crit-DMG support.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (57, 'Yaoyao', '4-Star', 'Dendro', 'Polearm', 'Adeptus in training; healer with Dendro application.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (58, 'Alhaitham', '5-Star', 'Dendro', 'Sword', 'Scribe of the Akademiya; passive-stacking Dendro DPS.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (59, 'Dehya', '5-Star', 'Pyro', 'Claymore', 'Mercenary captain of the Eremites; tanky field-control Pyro DPS.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (60, 'Mika', '4-Star', 'Cryo', 'Polearm', 'Former Snezhnayan soldier; ATK-buffing Cryo support.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (61, 'Kaveh', '4-Star', 'Dendro', 'Claymore', 'Architect and Alhaitham''s roommate; Dendro DMG support.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (62, 'Baizhu', '5-Star', 'Dendro', 'Catalyst', 'Owner of Bubu Pharmacy; strong shielding healer.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (63, 'Lynette', '4-Star', 'Anemo', 'Sword', 'Assistant magician of the Fontaine troupe; utility Anemo support.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (64, 'Lyney', '5-Star', 'Pyro', 'Bow', 'Star magician of Fontaine; burst-based Pyro DPS.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (65, 'Freminet', '4-Star', 'Cryo', 'Claymore', 'Deep-sea diver of the House of the Hearth; niche Cryo sub-DPS.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (66, 'Neuvillette', '5-Star', 'Hydro', 'Catalyst', 'Chief Justice of Fontaine (and the last Dragon Sovereign); charged-attack Hydro DPS.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (67, 'Wriothesley', '5-Star', 'Cryo', 'Catalyst', 'Duke of the Fortress of Meropide; punch-based Cryo DPS.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (68, 'Charlotte', '4-Star', 'Cryo', 'Catalyst', 'Journalist for The Steambird; Cryo healer/support.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (69, 'Furina', '5-Star', 'Hydro', 'Sword', 'Former Hydro Archon and head of the Fontaine tribunal; HP-scaling support/DPS.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (70, 'Chevreuse', '4-Star', 'Pyro', 'Polearm', 'Special investigator of the Maison Gardiennage; Overloaded-team support.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (71, 'Navia', '5-Star', 'Geo', 'Claymore', 'President of the Spina di Rosula; Crystallize-focused Geo DPS.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (72, 'Gaming', '4-Star', 'Pyro', 'Claymore', 'Parkour livestreamer; Pyro sub-DPS with a helper panda.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (73, 'Chiori', '5-Star', 'Geo', 'Sword', 'Fashion designer of the House of Fleuve Cendre; Geo blade-summon DPS.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (74, 'Arlecchino', '5-Star', 'Pyro', 'Polearm', 'The Knave, a Fatui Harbinger; Bond of Life hypercarry DPS.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (75, 'Sigewinne', '5-Star', 'Hydro', 'Bow', 'Chief nurse of the Fortress of Meropide (a Melusine); premier healer.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (76, 'Clorinde', '5-Star', 'Electro', 'Sword', 'Duelist-Advocate of Fontaine; Aggravate-focused Electro DPS.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (77, 'Sethos', '4-Star', 'Electro', 'Bow', 'Deputy of the Akademiya''s disciplinary committee; Electro sub-DPS.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (78, 'Emilie', '5-Star', 'Dendro', 'Polearm', 'Perfumer of the Duthaunt family; lamp-based Dendro DPS.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (79, 'Xianyun', '5-Star', 'Anemo', 'Catalyst', 'An emissary of Liyue''s adepti; Anemo support with ATK buffs.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (80, 'Mavuika', '5-Star', 'Pyro', 'Claymore', 'The Pyro Archon and War Chief of Natlan; on-field Nightsoul Pyro DPS.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (81, 'Citlali', '5-Star', 'Cryo', 'Catalyst', 'Saurian rider and priestess of the Ochkanacatl tribe; Cryo support/sub-DPS.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (82, 'Kinich', '5-Star', 'Dendro', 'Claymore', 'Saurian rider of the Scions of the Canopy; Nightsoul Dendro DPS.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (83, 'Mualani', '5-Star', 'Hydro', 'Claymore', 'Saurian rider and tour guide of Natlan; surfboard-based Hydro DPS.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (84, 'Xilonen', '5-Star', 'Geo', 'Sword', 'Chief blacksmith of the Mavuika tribe; Geo support with ATK/RES buffs.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (85, 'Ororon', '4-Star', 'Electro', 'Bow', 'Saurian rider seeking his father; Electro sub-DPS with skill-cost Nightsoul.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (86, 'Kachina', '4-Star', 'Geo', 'Catalyst', 'Youngest engineer of the Scions of the Canopy; Geo shield-break support.');
INSERT INTO characters (release_order, name, rarity, element, weapon_type, description) VALUES (87, 'Kaedehara Kazuha', '5-Star', 'Anemo', 'Sword', 'A wandering samurai of Inazuma; premier Swirl-based Anemo support.');

-- ---------------------------------------------------------------------
-- 2) WEAPONS  (name, type, rarity, description)
-- ---------------------------------------------------------------------

INSERT INTO weapons (name, type, rarity, description) VALUES ('Aquila Favonia', 'Sword', '5-Star', 'Signature weapon of Mondstadt''s founders; deals bonus DMG and heals on taking damage.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Freedom-Sworn', 'Sword', '5-Star', 'Grants party-wide DMG bonus stacks on elemental skill/burst hits.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Primordial Jade Cutter', 'Sword', '5-Star', 'High base ATK/CRIT DMG sub-stat weapon; energy restore on hit.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Summit Shaper', 'Sword', '5-Star', 'Shield-strength scaling ATK and DMG bonus weapon.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Mistsplitter Reforged', 'Sword', '5-Star', 'Massive elemental DMG bonus stacking on matching element attacks.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Haran Geppaku Futsu', 'Sword', '5-Star', 'Normal/charged attack DMG bonus that stacks after skill/burst use.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Key of Khaj-Nisut', 'Sword', '5-Star', 'HP% and flat HP scaling weapon rewarding party HP totals.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Iron Sting', 'Sword', '4-Star', 'Elemental Mastery sub-stat weapon with DMG bonus on elemental application.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('The Flute', 'Sword', '4-Star', 'Normal attack DMG bonus weapon with periodic burst-like nova.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Favonius Sword', 'Sword', '4-Star', 'CRIT-Rate weapon that generates energy particles on crit hits.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Sacrificial Sword', 'Sword', '4-Star', 'Chance to reset elemental skill cooldown on hit.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('The Black Sword', 'Sword', '4-Star', 'Boosts normal/charged attack DMG and CRIT DMG on hit.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Amenoma Kageuchi', 'Sword', '4-Star', 'Refines into energy particles on hit; strong early ATK weapon.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Harbinger of Dawn', 'Sword', '3-Star', 'Low HP CRIT-rate boost weapon, mostly for beginners.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Cool Steel', 'Sword', '3-Star', 'Basic Physical DMG bonus sword for early game.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Wolf''s Gravestone', 'Claymore', '5-Star', 'ATK% weapon that buffs party ATK against low-HP enemies.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Song of Broken Pines', 'Claymore', '5-Star', 'Normal ATK SPD and party-wide ATK bonus on skill/burst use.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Redhorn Stonethresher', 'Claymore', '5-Star', 'DEF-scaling ATK bonus and CRIT DMG against shielded enemies.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Beacon of the Reed Sea', 'Claymore', '5-Star', 'Nightsoul-focused weapon boosting ATK and CRIT DMG.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('The Unforged', 'Claymore', '5-Star', 'High CRIT DMG shield-scaling weapon.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Rainslasher', 'Claymore', '4-Star', 'Bonus DMG against Hydro/Electro-affected enemies.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Sacrificial Greatsword', 'Claymore', '4-Star', 'Chance to reset elemental skill cooldown on hit.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Serpent Spine', 'Claymore', '4-Star', 'Stacking DMG bonus and DMG taken reduction over time on-field.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Akuoumaru', 'Claymore', '4-Star', 'ATK bonus after using elemental skill; good early Geo/claymore weapon.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Katsuragikiri Nagamasa', 'Claymore', '4-Star', 'Energy restore weapon with elemental skill DMG bonus.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Debate Club', 'Claymore', '3-Star', 'Charged-attack stamina reduction and DMG bonus.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Bloodtainted Greatsword', 'Claymore', '3-Star', 'HP restore on hit weapon, decent for sustain.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Staff of Homa', 'Polearm', '5-Star', 'HP% weapon that converts HP into bonus ATK and CRIT DMG.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Vortex Vanquisher', 'Polearm', '5-Star', 'Shield-strength scaling ATK bonus with party shield DMG bonus.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Primordial Jade Winged-Spear', 'Polearm', '5-Star', 'ATK/CRIT DMG stacking weapon on hit.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Engulfing Lightning', 'Polearm', '5-Star', 'Energy Recharge scaling ATK conversion weapon.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Calamity Queller', 'Polearm', '5-Star', 'ATK and normal attack DMG bonus that increases over time on-field.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Crimson Moon''s Semblance', 'Polearm', '5-Star', 'Nightsoul Burst focused ATK and CRIT DMG weapon.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Deathmatch', 'Polearm', '4-Star', 'CRIT-rate weapon with bonus vs. multiple/isolated enemies.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Favonius Lance', 'Polearm', '4-Star', 'CRIT-rate energy particle generator.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Dragon''s Bane', 'Polearm', '4-Star', 'Bonus DMG against Hydro/Pyro-affected enemies.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('The Catch', 'Polearm', '4-Star', 'Elemental Burst CRIT-rate and DMG bonus weapon.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('White Tassel', 'Polearm', '3-Star', 'Basic normal attack DMG bonus polearm.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Amos'' Bow', 'Bow', '5-Star', 'DMG bonus that scales with projectile travel distance.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Elegy for the End', 'Bow', '5-Star', 'Elemental Mastery and party-wide burst DMG bonus stacks.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Skyward Harp', 'Bow', '5-Star', 'CRIT DMG bonus with AoE DMG on hit.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Thundering Pulse', 'Bow', '5-Star', 'Normal/charged attack DMG bonus stacking on hit after using skill.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Aqua Simulacra', 'Bow', '5-Star', 'CRIT DMG and DMG reduction weapon effective vs. bosses.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Hunter''s Path', 'Bow', '5-Star', 'Charged-shot focused ATK and DMG bonus weapon.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('The Stringless', 'Bow', '4-Star', 'Elemental skill/burst DMG bonus bow.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Sacrificial Bow', 'Bow', '4-Star', 'Chance to reset elemental skill cooldown on hit.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Favonius Warbow', 'Bow', '4-Star', 'CRIT-rate energy particle generator.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Rust', 'Bow', '4-Star', 'Normal attack DMG bonus with reduced charged-attack DMG.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Alley Hunter', 'Bow', '4-Star', 'Stacking DMG bonus while character stays on-field.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Slingshot', 'Bow', '3-Star', 'High CRIT DMG bow effective at low HP enemies.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Lost Prayer to the Sacred Winds', 'Catalyst', '5-Star', 'Stacking ATK/CRIT DMG bonus while moving or after elemental reactions.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Skyward Atlas', 'Catalyst', '5-Star', 'Elemental DMG bonus with periodic bonus DMG proc.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Everlasting Moonglow', 'Catalyst', '5-Star', 'HP-scaling ATK bonus with team-wide healing on skill/burst cast.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Tulaytullah''s Remembrance', 'Catalyst', '5-Star', 'Normal attack SPD and stacking DMG bonus weapon.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Cashflow Supervision', 'Catalyst', '5-Star', 'Nightsoul-focused ATK and DMG bonus catalyst.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('The Widsith', 'Catalyst', '4-Star', 'Random buff proc (ATK/elemental DMG/CRIT DMG) on skill/burst cast.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Sacrificial Fragments', 'Catalyst', '4-Star', 'Chance to reset elemental skill cooldown on hit.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Favonius Codex', 'Catalyst', '4-Star', 'CRIT-rate energy particle generator.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Prototype Amber', 'Catalyst', '4-Star', 'Shield and healing bonus on skill cast.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Oathsworn Eye', 'Catalyst', '4-Star', 'Stacking DMG bonus based on elemental types in the party.');
INSERT INTO weapons (name, type, rarity, description) VALUES ('Magic Guide', 'Catalyst', '3-Star', 'Basic elemental DMG bonus catalyst for early game.');

-- ---------------------------------------------------------------------
-- 3) ARTIFACTS  (set_name, bonus_2pc, bonus_4pc)
-- ---------------------------------------------------------------------

INSERT INTO artifacts (set_name, bonus_2pc, bonus_4pc) VALUES ('Gladiator''s Finale', 'ATK +18%', 'If the wielder uses a Sword, Claymore, or Polearm, Normal Attack DMG +35%.');
INSERT INTO artifacts (set_name, bonus_2pc, bonus_4pc) VALUES ('Wanderer''s Troupe', 'Elemental Mastery +80', 'If the wielder uses a Catalyst or Bow, Charged Attack DMG +35%.');
INSERT INTO artifacts (set_name, bonus_2pc, bonus_4pc) VALUES ('Noblesse Oblige', 'Elemental Burst DMG +20%', 'Using an Elemental Burst increases all party members'' ATK by 20% for 12s. Cannot stack with itself.');
INSERT INTO artifacts (set_name, bonus_2pc, bonus_4pc) VALUES ('Viridescent Venerer', 'Anemo DMG Bonus +15%', 'Increases Swirl DMG and decreases the affected enemies'' Elemental RES to the corresponding element by 40% for 10s.');
INSERT INTO artifacts (set_name, bonus_2pc, bonus_4pc) VALUES ('Crimson Witch of Flames', 'Pyro DMG Bonus +15%', 'Increases Overloaded/Burning/Burgeon DMG by 40% and Vaporize/Melt DMG by 15%. Using an Elemental Skill increases the 2-Piece set bonus by 50% for 10s, stacking up to 3 times.');
INSERT INTO artifacts (set_name, bonus_2pc, bonus_4pc) VALUES ('Blizzard Strayer', 'Cryo DMG Bonus +15%', 'CRIT Rate against enemies affected by Cryo is increased by 20%; an extra 20% if the enemy is Frozen.');
INSERT INTO artifacts (set_name, bonus_2pc, bonus_4pc) VALUES ('Heart of Depth', 'Hydro DMG Bonus +15%', 'After using an Elemental Skill, Normal and Charged Attack DMG is increased by 30% for 15s.');
INSERT INTO artifacts (set_name, bonus_2pc, bonus_4pc) VALUES ('Thundering Fury', 'Electro DMG Bonus +15%', 'Increases Overloaded, Electro-Charged, Superconduct, and Hyperbloom DMG by 40%, and reduces Elemental Skill CD by 1s on reaction trigger.');
INSERT INTO artifacts (set_name, bonus_2pc, bonus_4pc) VALUES ('Archaic Petra', 'Geo DMG Bonus +15%', 'Upon Crystallize, all party members gain a DMG bonus for the corresponding element based on the crystal, +35% for 10s.');
INSERT INTO artifacts (set_name, bonus_2pc, bonus_4pc) VALUES ('Emblem of Severed Fate', 'Energy Recharge +20%', 'Elemental Burst DMG is increased by 25% of Energy Recharge, up to a maximum bonus of 75%.');
INSERT INTO artifacts (set_name, bonus_2pc, bonus_4pc) VALUES ('Shimenawa''s Reminiscence', 'ATK +18%', 'When triggering an Elemental Skill with 15+ Energy, lose 15 Energy and increase Elemental Skill/Burst DMG by 50% for 10s.');
INSERT INTO artifacts (set_name, bonus_2pc, bonus_4pc) VALUES ('Tenacity of the Millelith', 'HP +20%', 'Using an Elemental Skill increases nearby party members'' ATK by 20% and Shield Strength by 30% for 3s.');
INSERT INTO artifacts (set_name, bonus_2pc, bonus_4pc) VALUES ('Deepwood Memories', 'Dendro DMG Bonus +15%', 'After Elemental Skills or Bursts hit an opponent, their Dendro RES is decreased by 30% for 8s.');
INSERT INTO artifacts (set_name, bonus_2pc, bonus_4pc) VALUES ('Marechaussee Hunter', 'CRIT Rate +12%', 'When current HP increases or decreases, CRIT Rate +12% for 5s, stacking up to 3 times; effect works even off-field.');
INSERT INTO artifacts (set_name, bonus_2pc, bonus_4pc) VALUES ('Golden Troupe', 'Elemental Skill DMG +20%', 'When not on the field, CRIT Rate is increased by 25% (does not apply to Charged Attacks).');

-- ---------------------------------------------------------------------
-- 4) TIER LIST (COMBAT)  -- resolves character_id by name via subquery
-- ---------------------------------------------------------------------

INSERT INTO tier_list_combat (character_id, tier, role) SELECT id, 'S', 'Main DPS' FROM characters WHERE name = 'Neuvillette';
INSERT INTO tier_list_combat (character_id, tier, role) SELECT id, 'S', 'Main DPS' FROM characters WHERE name = 'Arlecchino';
INSERT INTO tier_list_combat (character_id, tier, role) SELECT id, 'S', 'Support' FROM characters WHERE name = 'Nahida';
INSERT INTO tier_list_combat (character_id, tier, role) SELECT id, 'S', 'Support' FROM characters WHERE name = 'Furina';
INSERT INTO tier_list_combat (character_id, tier, role) SELECT id, 'S', 'Main DPS' FROM characters WHERE name = 'Hu Tao';
INSERT INTO tier_list_combat (character_id, tier, role) SELECT id, 'S', 'Support' FROM characters WHERE name = 'Raiden Shogun';
INSERT INTO tier_list_combat (character_id, tier, role) SELECT id, 'S', 'Support' FROM characters WHERE name = 'Zhongli';
INSERT INTO tier_list_combat (character_id, tier, role) SELECT id, 'S', 'Sub DPS' FROM characters WHERE name = 'Xingqiu';
INSERT INTO tier_list_combat (character_id, tier, role) SELECT id, 'S', 'Support' FROM characters WHERE name = 'Bennett';
INSERT INTO tier_list_combat (character_id, tier, role) SELECT id, 'S', 'Support' FROM characters WHERE name = 'Kaedehara Kazuha';
INSERT INTO tier_list_combat (character_id, tier, role) SELECT id, 'A', 'Main DPS' FROM characters WHERE name = 'Ganyu';
INSERT INTO tier_list_combat (character_id, tier, role) SELECT id, 'A', 'Main DPS' FROM characters WHERE name = 'Kamisato Ayaka';
INSERT INTO tier_list_combat (character_id, tier, role) SELECT id, 'A', 'Sub DPS' FROM characters WHERE name = 'Yelan';
INSERT INTO tier_list_combat (character_id, tier, role) SELECT id, 'A', 'Sub DPS' FROM characters WHERE name = 'Xiangling';
INSERT INTO tier_list_combat (character_id, tier, role) SELECT id, 'A', 'Main DPS' FROM characters WHERE name = 'Nilou';
INSERT INTO tier_list_combat (character_id, tier, role) SELECT id, 'A', 'Main DPS' FROM characters WHERE name = 'Yoimiya';
INSERT INTO tier_list_combat (character_id, tier, role) SELECT id, 'A', 'Main DPS' FROM characters WHERE name = 'Tighnari';
INSERT INTO tier_list_combat (character_id, tier, role) SELECT id, 'A', 'Main DPS' FROM characters WHERE name = 'Alhaitham';
INSERT INTO tier_list_combat (character_id, tier, role) SELECT id, 'A', 'Main DPS' FROM characters WHERE name = 'Wriothesley';
INSERT INTO tier_list_combat (character_id, tier, role) SELECT id, 'A', 'Healer' FROM characters WHERE name = 'Sigewinne';
INSERT INTO tier_list_combat (character_id, tier, role) SELECT id, 'A', 'Healer' FROM characters WHERE name = 'Sangonomiya Kokomi';
INSERT INTO tier_list_combat (character_id, tier, role) SELECT id, 'S', 'Main DPS' FROM characters WHERE name = 'Mavuika';
INSERT INTO tier_list_combat (character_id, tier, role) SELECT id, 'A', 'Main DPS' FROM characters WHERE name = 'Kinich';
INSERT INTO tier_list_combat (character_id, tier, role) SELECT id, 'A', 'Main DPS' FROM characters WHERE name = 'Mualani';
INSERT INTO tier_list_combat (character_id, tier, role) SELECT id, 'A', 'Support' FROM characters WHERE name = 'Xilonen';
INSERT INTO tier_list_combat (character_id, tier, role) SELECT id, 'A', 'Support' FROM characters WHERE name = 'Citlali';
INSERT INTO tier_list_combat (character_id, tier, role) SELECT id, 'B', 'Sub DPS' FROM characters WHERE name = 'Fischl';
INSERT INTO tier_list_combat (character_id, tier, role) SELECT id, 'C', 'Sub DPS' FROM characters WHERE name = 'Xinyan';
INSERT INTO tier_list_combat (character_id, tier, role) SELECT id, 'C', 'Sub DPS' FROM characters WHERE name = 'Chongyun';
INSERT INTO tier_list_combat (character_id, tier, role) SELECT id, 'D', 'Sub DPS' FROM characters WHERE name = 'Amber';

-- ---------------------------------------------------------------------
-- 5) TIER LIST (EXPLORATION)
-- ---------------------------------------------------------------------

INSERT INTO tier_list_exploration (character_id, tier) SELECT id, 'S' FROM characters WHERE name = 'Venti';
INSERT INTO tier_list_exploration (character_id, tier) SELECT id, 'S' FROM characters WHERE name = 'Kaedehara Kazuha';
INSERT INTO tier_list_exploration (character_id, tier) SELECT id, 'S' FROM characters WHERE name = 'Wanderer';
INSERT INTO tier_list_exploration (character_id, tier) SELECT id, 'S' FROM characters WHERE name = 'Xianyun';
INSERT INTO tier_list_exploration (character_id, tier) SELECT id, 'A' FROM characters WHERE name = 'Zhongli';
INSERT INTO tier_list_exploration (character_id, tier) SELECT id, 'A' FROM characters WHERE name = 'Albedo';
INSERT INTO tier_list_exploration (character_id, tier) SELECT id, 'A' FROM characters WHERE name = 'Mona';
INSERT INTO tier_list_exploration (character_id, tier) SELECT id, 'A' FROM characters WHERE name = 'Sayu';
INSERT INTO tier_list_exploration (character_id, tier) SELECT id, 'A' FROM characters WHERE name = 'Kirara';
INSERT INTO tier_list_exploration (character_id, tier) SELECT id, 'A' FROM characters WHERE name = 'Furina';
INSERT INTO tier_list_exploration (character_id, tier) SELECT id, 'B' FROM characters WHERE name = 'Yun Jin';
INSERT INTO tier_list_exploration (character_id, tier) SELECT id, 'B' FROM characters WHERE name = 'Chongyun';
INSERT INTO tier_list_exploration (character_id, tier) SELECT id, 'B' FROM characters WHERE name = 'Xingqiu';
INSERT INTO tier_list_exploration (character_id, tier) SELECT id, 'C' FROM characters WHERE name = 'Amber';
INSERT INTO tier_list_exploration (character_id, tier) SELECT id, 'C' FROM characters WHERE name = 'Kaeya';

-- ---------------------------------------------------------------------
-- 6) BUILDS  (character, weapon, artifact set) + recommended team
-- ---------------------------------------------------------------------

INSERT INTO builds (character_id, build_name, weapon_id, artifact_id) SELECT c.id, 'Main Build', w.id, a.id FROM characters c, weapons w, artifacts a WHERE c.name = 'Hu Tao' AND w.name = 'Staff of Homa' AND a.set_name = 'Crimson Witch of Flames';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Xingqiu' WHERE c.name = 'Hu Tao' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Zhongli' WHERE c.name = 'Hu Tao' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Yelan' WHERE c.name = 'Hu Tao' AND b.build_name = 'Main Build';
INSERT INTO builds (character_id, build_name, weapon_id, artifact_id) SELECT c.id, 'Main Build', w.id, a.id FROM characters c, weapons w, artifacts a WHERE c.name = 'Zhongli' AND w.name = 'Favonius Lance' AND a.set_name = 'Tenacity of the Millelith';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Hu Tao' WHERE c.name = 'Zhongli' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Xingqiu' WHERE c.name = 'Zhongli' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Bennett' WHERE c.name = 'Zhongli' AND b.build_name = 'Main Build';
INSERT INTO builds (character_id, build_name, weapon_id, artifact_id) SELECT c.id, 'Main Build', w.id, a.id FROM characters c, weapons w, artifacts a WHERE c.name = 'Raiden Shogun' AND w.name = 'Engulfing Lightning' AND a.set_name = 'Emblem of Severed Fate';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Kamisato Ayaka' WHERE c.name = 'Raiden Shogun' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Kaedehara Kazuha' WHERE c.name = 'Raiden Shogun' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Bennett' WHERE c.name = 'Raiden Shogun' AND b.build_name = 'Main Build';
INSERT INTO builds (character_id, build_name, weapon_id, artifact_id) SELECT c.id, 'Main Build', w.id, a.id FROM characters c, weapons w, artifacts a WHERE c.name = 'Kamisato Ayaka' AND w.name = 'Mistsplitter Reforged' AND a.set_name = 'Blizzard Strayer';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Kaedehara Kazuha' WHERE c.name = 'Kamisato Ayaka' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Shenhe' WHERE c.name = 'Kamisato Ayaka' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Sangonomiya Kokomi' WHERE c.name = 'Kamisato Ayaka' AND b.build_name = 'Main Build';
INSERT INTO builds (character_id, build_name, weapon_id, artifact_id) SELECT c.id, 'Main Build', w.id, a.id FROM characters c, weapons w, artifacts a WHERE c.name = 'Ganyu' AND w.name = 'Amos'' Bow' AND a.set_name = 'Wanderer''s Troupe';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Mona' WHERE c.name = 'Ganyu' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Venti' WHERE c.name = 'Ganyu' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Diona' WHERE c.name = 'Ganyu' AND b.build_name = 'Main Build';
INSERT INTO builds (character_id, build_name, weapon_id, artifact_id) SELECT c.id, 'Main Build', w.id, a.id FROM characters c, weapons w, artifacts a WHERE c.name = 'Xingqiu' AND w.name = 'Sacrificial Sword' AND a.set_name = 'Noblesse Oblige';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Hu Tao' WHERE c.name = 'Xingqiu' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Zhongli' WHERE c.name = 'Xingqiu' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Bennett' WHERE c.name = 'Xingqiu' AND b.build_name = 'Main Build';
INSERT INTO builds (character_id, build_name, weapon_id, artifact_id) SELECT c.id, 'Main Build', w.id, a.id FROM characters c, weapons w, artifacts a WHERE c.name = 'Bennett' AND w.name = 'Aquila Favonia' AND a.set_name = 'Noblesse Oblige';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Hu Tao' WHERE c.name = 'Bennett' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Xingqiu' WHERE c.name = 'Bennett' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Zhongli' WHERE c.name = 'Bennett' AND b.build_name = 'Main Build';
INSERT INTO builds (character_id, build_name, weapon_id, artifact_id) SELECT c.id, 'Main Build', w.id, a.id FROM characters c, weapons w, artifacts a WHERE c.name = 'Nahida' AND w.name = 'Everlasting Moonglow' AND a.set_name = 'Deepwood Memories';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Alhaitham' WHERE c.name = 'Nahida' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Yelan' WHERE c.name = 'Nahida' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Kuki Shinobu' WHERE c.name = 'Nahida' AND b.build_name = 'Main Build';
INSERT INTO builds (character_id, build_name, weapon_id, artifact_id) SELECT c.id, 'Main Build', w.id, a.id FROM characters c, weapons w, artifacts a WHERE c.name = 'Alhaitham' AND w.name = 'Primordial Jade Cutter' AND a.set_name = 'Gladiator''s Finale';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Nahida' WHERE c.name = 'Alhaitham' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Yelan' WHERE c.name = 'Alhaitham' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Kuki Shinobu' WHERE c.name = 'Alhaitham' AND b.build_name = 'Main Build';
INSERT INTO builds (character_id, build_name, weapon_id, artifact_id) SELECT c.id, 'Main Build', w.id, a.id FROM characters c, weapons w, artifacts a WHERE c.name = 'Furina' AND w.name = 'Aquila Favonia' AND a.set_name = 'Noblesse Oblige';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Neuvillette' WHERE c.name = 'Furina' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Kaedehara Kazuha' WHERE c.name = 'Furina' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Bennett' WHERE c.name = 'Furina' AND b.build_name = 'Main Build';
INSERT INTO builds (character_id, build_name, weapon_id, artifact_id) SELECT c.id, 'Main Build', w.id, a.id FROM characters c, weapons w, artifacts a WHERE c.name = 'Neuvillette' AND w.name = 'Prototype Amber' AND a.set_name = 'Marechaussee Hunter';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Furina' WHERE c.name = 'Neuvillette' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Kaedehara Kazuha' WHERE c.name = 'Neuvillette' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Xingqiu' WHERE c.name = 'Neuvillette' AND b.build_name = 'Main Build';
INSERT INTO builds (character_id, build_name, weapon_id, artifact_id) SELECT c.id, 'Main Build', w.id, a.id FROM characters c, weapons w, artifacts a WHERE c.name = 'Arlecchino' AND w.name = 'Crimson Moon''s Semblance' AND a.set_name = 'Gladiator''s Finale';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Bennett' WHERE c.name = 'Arlecchino' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Xiangling' WHERE c.name = 'Arlecchino' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Zhongli' WHERE c.name = 'Arlecchino' AND b.build_name = 'Main Build';
INSERT INTO builds (character_id, build_name, weapon_id, artifact_id) SELECT c.id, 'Main Build', w.id, a.id FROM characters c, weapons w, artifacts a WHERE c.name = 'Mavuika' AND w.name = 'Beacon of the Reed Sea' AND a.set_name = 'Gladiator''s Finale';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Citlali' WHERE c.name = 'Mavuika' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Xilonen' WHERE c.name = 'Mavuika' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Furina' WHERE c.name = 'Mavuika' AND b.build_name = 'Main Build';
INSERT INTO builds (character_id, build_name, weapon_id, artifact_id) SELECT c.id, 'Main Build', w.id, a.id FROM characters c, weapons w, artifacts a WHERE c.name = 'Kinich' AND w.name = 'Redhorn Stonethresher' AND a.set_name = 'Gladiator''s Finale';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Kachina' WHERE c.name = 'Kinich' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Xilonen' WHERE c.name = 'Kinich' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Furina' WHERE c.name = 'Kinich' AND b.build_name = 'Main Build';
INSERT INTO builds (character_id, build_name, weapon_id, artifact_id) SELECT c.id, 'Main Build', w.id, a.id FROM characters c, weapons w, artifacts a WHERE c.name = 'Yoimiya' AND w.name = 'Thundering Pulse' AND a.set_name = 'Crimson Witch of Flames';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Bennett' WHERE c.name = 'Yoimiya' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Kaedehara Kazuha' WHERE c.name = 'Yoimiya' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Sangonomiya Kokomi' WHERE c.name = 'Yoimiya' AND b.build_name = 'Main Build';
INSERT INTO builds (character_id, build_name, weapon_id, artifact_id) SELECT c.id, 'Main Build', w.id, a.id FROM characters c, weapons w, artifacts a WHERE c.name = 'Tighnari' AND w.name = 'Hunter''s Path' AND a.set_name = 'Wanderer''s Troupe';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Nahida' WHERE c.name = 'Tighnari' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Kuki Shinobu' WHERE c.name = 'Tighnari' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Zhongli' WHERE c.name = 'Tighnari' AND b.build_name = 'Main Build';
INSERT INTO builds (character_id, build_name, weapon_id, artifact_id) SELECT c.id, 'Main Build', w.id, a.id FROM characters c, weapons w, artifacts a WHERE c.name = 'Wriothesley' AND w.name = 'Cashflow Supervision' AND a.set_name = 'Marechaussee Hunter';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Furina' WHERE c.name = 'Wriothesley' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Kaedehara Kazuha' WHERE c.name = 'Wriothesley' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Xingqiu' WHERE c.name = 'Wriothesley' AND b.build_name = 'Main Build';
INSERT INTO builds (character_id, build_name, weapon_id, artifact_id) SELECT c.id, 'Main Build', w.id, a.id FROM characters c, weapons w, artifacts a WHERE c.name = 'Sigewinne' AND w.name = 'Sacrificial Bow' AND a.set_name = 'Noblesse Oblige';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Neuvillette' WHERE c.name = 'Sigewinne' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Furina' WHERE c.name = 'Sigewinne' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Kaedehara Kazuha' WHERE c.name = 'Sigewinne' AND b.build_name = 'Main Build';
INSERT INTO builds (character_id, build_name, weapon_id, artifact_id) SELECT c.id, 'Main Build', w.id, a.id FROM characters c, weapons w, artifacts a WHERE c.name = 'Nilou' AND w.name = 'Key of Khaj-Nisut' AND a.set_name = 'Noblesse Oblige';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Nahida' WHERE c.name = 'Nilou' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Xingqiu' WHERE c.name = 'Nilou' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Kuki Shinobu' WHERE c.name = 'Nilou' AND b.build_name = 'Main Build';
INSERT INTO builds (character_id, build_name, weapon_id, artifact_id) SELECT c.id, 'Main Build', w.id, a.id FROM characters c, weapons w, artifacts a WHERE c.name = 'Yelan' AND w.name = 'Aqua Simulacra' AND a.set_name = 'Emblem of Severed Fate';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Alhaitham' WHERE c.name = 'Yelan' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Nahida' WHERE c.name = 'Yelan' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Kuki Shinobu' WHERE c.name = 'Yelan' AND b.build_name = 'Main Build';
INSERT INTO builds (character_id, build_name, weapon_id, artifact_id) SELECT c.id, 'Main Build', w.id, a.id FROM characters c, weapons w, artifacts a WHERE c.name = 'Xiao' AND w.name = 'Staff of Homa' AND a.set_name = 'Marechaussee Hunter';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Faruzan' WHERE c.name = 'Xiao' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Bennett' WHERE c.name = 'Xiao' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Zhongli' WHERE c.name = 'Xiao' AND b.build_name = 'Main Build';
INSERT INTO builds (character_id, build_name, weapon_id, artifact_id) SELECT c.id, 'Main Build', w.id, a.id FROM characters c, weapons w, artifacts a WHERE c.name = 'Kamisato Ayato' AND w.name = 'Haran Geppaku Futsu' AND a.set_name = 'Heart of Depth';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Yun Jin' WHERE c.name = 'Kamisato Ayato' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Sayu' WHERE c.name = 'Kamisato Ayato' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Shenhe' WHERE c.name = 'Kamisato Ayato' AND b.build_name = 'Main Build';
INSERT INTO builds (character_id, build_name, weapon_id, artifact_id) SELECT c.id, 'Main Build', w.id, a.id FROM characters c, weapons w, artifacts a WHERE c.name = 'Eula' AND w.name = 'Song of Broken Pines' AND a.set_name = 'Noblesse Oblige';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Kaedehara Kazuha' WHERE c.name = 'Eula' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Sucrose' WHERE c.name = 'Eula' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Bennett' WHERE c.name = 'Eula' AND b.build_name = 'Main Build';
INSERT INTO builds (character_id, build_name, weapon_id, artifact_id) SELECT c.id, 'Main Build', w.id, a.id FROM characters c, weapons w, artifacts a WHERE c.name = 'Diluc' AND w.name = 'Wolf''s Gravestone' AND a.set_name = 'Crimson Witch of Flames';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Bennett' WHERE c.name = 'Diluc' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Kaedehara Kazuha' WHERE c.name = 'Diluc' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Xingqiu' WHERE c.name = 'Diluc' AND b.build_name = 'Main Build';
INSERT INTO builds (character_id, build_name, weapon_id, artifact_id) SELECT c.id, 'Main Build', w.id, a.id FROM characters c, weapons w, artifacts a WHERE c.name = 'Venti' AND w.name = 'Skyward Harp' AND a.set_name = 'Viridescent Venerer';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Xiangling' WHERE c.name = 'Venti' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Xingqiu' WHERE c.name = 'Venti' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Bennett' WHERE c.name = 'Venti' AND b.build_name = 'Main Build';
INSERT INTO builds (character_id, build_name, weapon_id, artifact_id) SELECT c.id, 'Main Build', w.id, a.id FROM characters c, weapons w, artifacts a WHERE c.name = 'Ningguang' AND w.name = 'Skyward Atlas' AND a.set_name = 'Archaic Petra';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Xingqiu' WHERE c.name = 'Ningguang' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Zhongli' WHERE c.name = 'Ningguang' AND b.build_name = 'Main Build';
INSERT INTO build_team_members (build_id, character_id) SELECT b.id, tc.id FROM builds b JOIN characters c ON c.id = b.character_id JOIN characters tc ON tc.name = 'Bennett' WHERE c.name = 'Ningguang' AND b.build_name = 'Main Build';
