CREATE TABLE messages (
    id      BIGINT PRIMARY KEY AUTO_INCREMENT,
    author  TEXT NOT NULL,
    text    TEXT NOT NULL,
    sent_at BIGINT NOT NULL,
    is_approved BOOLEAN NOT NULL
);

CREATE INDEX idx_messages_sent_at ON messages (sent_at);
