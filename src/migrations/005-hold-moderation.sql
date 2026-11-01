-- cooldown_ms: a cooldown set for this hold only. NULL means the default (10 minutes, none for frivillig).
-- banned: the hold can't send messages.
ALTER TABLE holds
    ADD COLUMN cooldown_ms BIGINT NULL,
    ADD COLUMN banned BOOLEAN NOT NULL DEFAULT FALSE;
