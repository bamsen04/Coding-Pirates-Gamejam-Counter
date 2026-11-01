CREATE TABLE enrollment_tokens (
    token      VARCHAR(64) PRIMARY KEY,
    expires_at BIGINT NOT NULL
);

CREATE INDEX idx_enrollment_tokens_expires_at ON enrollment_tokens (expires_at);

CREATE TABLE admin_passkeys (
    id            BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id       CHAR(36) NOT NULL,
    credential_id VARCHAR(512) NOT NULL UNIQUE,
    public_key    TEXT NOT NULL,
    counter       BIGINT NOT NULL DEFAULT 0,
    transports    JSON NOT NULL DEFAULT (JSON_ARRAY())
);
