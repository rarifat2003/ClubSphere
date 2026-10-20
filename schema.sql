users-- ClubSphere database schema (RegionX football club system)
-- Run once:  mysql -u root -p < schema.sql
-- WARNING: drops and recreates all tables.

CREATE DATABASE IF NOT EXISTS clubsphere;
USE clubsphere;

DROP VIEW  IF EXISTS v_player_goals;
DROP TABLE IF EXISTS player_matches;
DROP TABLE IF EXISTS finance;
DROP TABLE IF EXISTS matches;
DROP TABLE IF EXISTS squad;
DROP TABLE IF EXISTS players;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS clubs;

-- 1. Clubs
CREATE TABLE clubs (
  club_id    INT AUTO_INCREMENT PRIMARY KEY,
  club_name  VARCHAR(100) NOT NULL UNIQUE,
  region     VARCHAR(50)  NOT NULL DEFAULT 'RegionX',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Users = club owners (each belongs to one club)
CREATE TABLE users (
  user_id  INT AUTO_INCREMENT PRIMARY KEY,
  club_id  INT NOT NULL,
  name     VARCHAR(100) NOT NULL,
  email    VARCHAR(150) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  FOREIGN KEY (club_id) REFERENCES clubs(club_id) ON DELETE CASCADE
);

-- 3. Players: the shared regional pool (not owned by any club)
CREATE TABLE players (
  player_id INT AUTO_INCREMENT PRIMARY KEY,
  name      VARCHAR(100) NOT NULL,
  position  ENUM('Goalkeeper','Defender','Midfielder','Forward') NOT NULL,
  rating    INT NOT NULL,
  region    VARCHAR(50) NOT NULL DEFAULT 'RegionX',
  CONSTRAINT chk_rating CHECK (rating BETWEEN 1 AND 100),
  UNIQUE (name, region)            -- one player record per name in the region
);

-- 4. Squad: which club has signed which player.
--    player_id is the PRIMARY KEY, so a player can be in only ONE squad at a time.
CREATE TABLE squad (
  player_id   INT PRIMARY KEY,
  club_id     INT NOT NULL,
  signed_date DATE NOT NULL,
  fee         DECIMAL(12,2) NOT NULL DEFAULT 0,   -- signing fee paid for this player
  CONSTRAINT chk_fee CHECK (fee >= 0),
  FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE,
  FOREIGN KEY (club_id)   REFERENCES clubs(club_id)     ON DELETE CASCADE
);

-- 5. Matches (goals are NULL until the match is played)
CREATE TABLE matches (
  match_id      INT AUTO_INCREMENT PRIMARY KEY,
  club_id       INT NOT NULL,
  opponent      VARCHAR(100) NOT NULL,
  match_date    DATE NOT NULL,
  venue         VARCHAR(100),
  goals_for     INT NULL,
  goals_against INT NULL,
  CONSTRAINT chk_goals CHECK (
    (goals_for IS NULL AND goals_against IS NULL) OR
    (goals_for >= 0 AND goals_against >= 0)
  ),
  FOREIGN KEY (club_id) REFERENCES clubs(club_id) ON DELETE CASCADE
);

-- 6. player_matches: goals a player scored in a match (many-to-many)
CREATE TABLE player_matches (
  player_id INT NOT NULL,
  match_id  INT NOT NULL,
  goals     INT NOT NULL DEFAULT 0,
  PRIMARY KEY (player_id, match_id),              -- composite key
  CONSTRAINT chk_pm_goals CHECK (goals >= 0),
  FOREIGN KEY (player_id) REFERENCES players(player_id) ON DELETE CASCADE,
  FOREIGN KEY (match_id)  REFERENCES matches(match_id)  ON DELETE CASCADE
);

-- 7. Finance
CREATE TABLE finance (
  txn_id      INT AUTO_INCREMENT PRIMARY KEY,
  club_id     INT NOT NULL,
  type        ENUM('income','expense') NOT NULL,
  category    VARCHAR(50) NOT NULL,
  amount      DECIMAL(12,2) NOT NULL,
  description VARCHAR(255),
  txn_date    DATE NOT NULL,
  CONSTRAINT chk_amount CHECK (amount > 0),
  FOREIGN KEY (club_id) REFERENCES clubs(club_id) ON DELETE CASCADE
);

-- 8. View: goal totals per player (LEFT JOIN + GROUP BY)
CREATE VIEW v_player_goals AS
SELECT p.player_id,
       p.name,
       p.position,
       COUNT(pm.match_id)           AS matches_played,
       COALESCE(SUM(pm.goals), 0)   AS total_goals
FROM players p
LEFT JOIN player_matches pm ON pm.player_id = p.player_id
GROUP BY p.player_id, p.name, p.position;

-- 9. Predefined RegionX player pool
INSERT INTO players (name, position, rating, region) VALUES
('Arif Hossain',    'Goalkeeper', 74, 'RegionX'),
('Tanvir Rahman',   'Goalkeeper', 69, 'RegionX'),
('Nasir Uddin',     'Defender',   72, 'RegionX'),
('Rakib Hasan',     'Defender',   70, 'RegionX'),
('Imran Khan',      'Defender',   76, 'RegionX'),
('Sajib Mia',       'Defender',   67, 'RegionX'),
('Farhan Ahmed',    'Defender',   73, 'RegionX'),
('Kamal Sheikh',    'Defender',   65, 'RegionX'),
('Jubayer Alam',    'Midfielder', 78, 'RegionX'),
('Shakil Islam',    'Midfielder', 75, 'RegionX'),
('Omar Faruk',      'Midfielder', 71, 'RegionX'),
('Hasan Mahmud',    'Midfielder', 80, 'RegionX'),
('Riyad Karim',     'Midfielder', 68, 'RegionX'),
('Sohel Rana',      'Midfielder', 66, 'RegionX'),
('Tariq Aziz',      'Forward',    82, 'RegionX'),
('Mahin Chowdhury', 'Forward',    77, 'RegionX'),
('Zahid Hasan',     'Forward',    79, 'RegionX'),
('Nayeem Sarker',   'Forward',    72, 'RegionX'),
('Anik Das',        'Forward',    70, 'RegionX'),
('Babu Mollah',     'Forward',    64, 'RegionX');