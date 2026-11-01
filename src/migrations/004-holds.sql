-- The teams ("hold") and the one special "frivillig" group. Each has a code the members log in with.
-- last_sent_at (epoch ms) is when the hold last sent a message, for its shared cooldown.
CREATE TABLE holds (
    id           BIGINT PRIMARY KEY AUTO_INCREMENT,
    kind         VARCHAR(16) NOT NULL,
    hold_number  INT NULL,
    token        VARCHAR(16) NOT NULL UNIQUE,
    last_sent_at BIGINT NULL
);

-- Who a message came from, e.g. "Hold 5", "frivillig", "Ingen hold", "Admin". Stored as text so old
-- messages keep their label when the holds are generated again.
ALTER TABLE messages ADD COLUMN label VARCHAR(32) NOT NULL DEFAULT 'Ingen hold';
