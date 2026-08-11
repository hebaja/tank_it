-- Tank It! — initial Postgres schema
-- Mounted by docker-compose into the postgres container's /docker-entrypoint-initdb.d/
-- on first boot. Once the backend picks up EF Core migrations
-- (`dotnet ef migrations add InitialCreate`), this file becomes the reference/seed
-- baseline and migrations take over as the source of truth — keep them in sync.

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- gen_random_uuid()

-- ============================================================================
-- User Management (core)
-- ============================================================================

CREATE TABLE users (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username       VARCHAR(32) NOT NULL UNIQUE,
    email          VARCHAR(255) NOT NULL UNIQUE,
    password_hash  VARCHAR(255),              -- NULL for OAuth-only accounts
    display_name   VARCHAR(32) NOT NULL,
    avatar_url     TEXT,
    is_online      BOOLEAN NOT NULL DEFAULT false,
    last_seen_at   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Remote auth: OAuth 2.0 (Google / GitHub / 42) — buffer module
CREATE TABLE oauth_accounts (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider          VARCHAR(20) NOT NULL CHECK (provider IN ('google', 'github', 'fortytwo')),
    provider_user_id  VARCHAR(255) NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (provider, provider_user_id)
);
CREATE INDEX idx_oauth_accounts_user_id ON oauth_accounts(user_id);

-- JWT refresh tokens (session management for the SPA + SignalR clients)
CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(255) NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);

-- Friends + online status (part of standard User Management module)
CREATE TABLE friendships (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    addressee_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status        VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (requester_id <> addressee_id),
    UNIQUE (requester_id, addressee_id)
);
CREATE INDEX idx_friendships_addressee_status ON friendships(addressee_id, status);

-- ============================================================================
-- Gaming & UX / Championship mode (FT-N) — satisfies the Tournament system module
-- ============================================================================
-- A championship is a fixed-roster race to a target score (FT-N): first player
-- to reach target_score wins outright. target_score is set by player_count at
-- creation time (2p -> FT5, 3p -> FT7, 4p -> FT10) — stored explicitly rather
-- than derived, so the rule can be overridden per championship without a schema
-- change. See docs/GDD.md and docs/database-schema.md for the full scoring and
-- tie-break rules.

CREATE TABLE championships (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status        VARCHAR(12) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
    player_count  SMALLINT NOT NULL CHECK (player_count BETWEEN 2 AND 4), -- fixed roster size for every match in the series
    target_score  SMALLINT NOT NULL CHECK (target_score > 0),
    winner_id     UUID REFERENCES users(id) ON DELETE SET NULL,
    created_by    UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at    TIMESTAMPTZ,
    completed_at  TIMESTAMPTZ
);
CREATE INDEX idx_championships_status ON championships(status);

CREATE TABLE championship_participants (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    championship_id  UUID NOT NULL REFERENCES championships(id) ON DELETE CASCADE,
    user_id          UUID REFERENCES users(id) ON DELETE SET NULL, -- NULL = AI opponent
    is_ai            BOOLEAN NOT NULL DEFAULT false,
    tank_color       VARCHAR(10) NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (is_ai = true OR user_id IS NOT NULL)
);
CREATE INDEX idx_championship_participants_championship_id ON championship_participants(championship_id);
-- one seat per human player per championship (AI rows are exempt: user_id is NULL)
CREATE UNIQUE INDEX uq_championship_participants_user_per_championship
    ON championship_participants(championship_id, user_id) WHERE user_id IS NOT NULL;

-- ============================================================================
-- Gaming & UX / Game stats & match history (buffer module)
-- ============================================================================

CREATE TABLE matches (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status            VARCHAR(12) NOT NULL DEFAULT 'lobby' CHECK (status IN ('lobby', 'in_progress', 'completed', 'aborted')),
    map_seed          INTEGER NOT NULL,
    is_ranked         BOOLEAN NOT NULL DEFAULT true,
    player_count      SMALLINT NOT NULL CHECK (player_count BETWEEN 2 AND 4),
    winner_id         UUID REFERENCES users(id) ON DELETE SET NULL, -- NULL if AI won, draw, or aborted
    championship_id   UUID REFERENCES championships(id) ON DELETE CASCADE, -- NULL = standalone match
    sequence_number   SMALLINT, -- this match's order within its championship; NULL for standalone matches
    started_at        TIMESTAMPTZ,
    ended_at          TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- a championship match's roster size must match the series it belongs to
    CHECK (championship_id IS NULL OR sequence_number IS NOT NULL)
);
CREATE INDEX idx_matches_status ON matches(status);
CREATE INDEX idx_matches_championship_id ON matches(championship_id);
-- match order within a championship must be unique (no two matches share a sequence slot)
CREATE UNIQUE INDEX uq_matches_championship_sequence
    ON matches(championship_id, sequence_number) WHERE championship_id IS NOT NULL;

CREATE TABLE match_participants (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    match_id          UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    user_id           UUID REFERENCES users(id) ON DELETE SET NULL, -- NULL = AI opponent
    is_ai             BOOLEAN NOT NULL DEFAULT false,
    tank_color        VARCHAR(10) NOT NULL,
    placement         SMALLINT,          -- 1 = winner; NULL until the match ends
    points            SMALLINT,          -- match_count(match) - placement; NULL until the match ends.
                                          -- Used for both standalone stats and championship standings.
    shots_fired       INTEGER NOT NULL DEFAULT 0,
    hits              INTEGER NOT NULL DEFAULT 0,
    kills             INTEGER NOT NULL DEFAULT 0,
    survived_seconds  INTEGER,
    elo_delta         INTEGER,           -- NULL for AI participants / unranked matches
    CHECK (is_ai = true OR user_id IS NOT NULL)
);
CREATE INDEX idx_match_participants_match_id ON match_participants(match_id);
CREATE INDEX idx_match_participants_user_id ON match_participants(user_id);
-- one row per human player per match (AI rows are exempt: user_id is NULL)
CREATE UNIQUE INDEX uq_match_participants_user_per_match
    ON match_participants(match_id, user_id) WHERE user_id IS NOT NULL;

-- Denormalized aggregate for fast leaderboard/profile reads.
-- Updated by the backend in the same transaction that closes a match.
CREATE TABLE player_stats (
    user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    matches_played  INTEGER NOT NULL DEFAULT 0,
    wins            INTEGER NOT NULL DEFAULT 0,
    kills           INTEGER NOT NULL DEFAULT 0,
    deaths          INTEGER NOT NULL DEFAULT 0,
    elo_rating      INTEGER NOT NULL DEFAULT 1000,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_player_stats_elo ON player_stats(elo_rating DESC);

-- Note: Health check / status page module is stateless (a liveness endpoint hitting
-- this DB + backend process) and intentionally has no table here.
