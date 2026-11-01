-- Things that happen on the front page timer. Times are seconds remaining on the clock.
-- A point event (until_seconds NULL) fires once when the clock reaches at_seconds.
-- A range event fires every second while the clock is between until_seconds and at_seconds
-- (at_seconds NULL means "from the start").
CREATE TABLE events (
    id            BIGINT PRIMARY KEY AUTO_INCREMENT,
    action        VARCHAR(32) NOT NULL,
    at_seconds    BIGINT NULL,
    until_seconds BIGINT NULL
);

-- The behavior the page had before events were configurable.
INSERT INTO events (action, at_seconds, until_seconds) VALUES
    ('tick', NULL, 1),
    ('beep', 10, 1),
    ('fanfare', 0, NULL),
    ('confetti', 0, NULL);
