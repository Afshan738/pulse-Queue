
CREATE TABLE users(
    id SERIAL PRIMARY KEY,
    api_key text not null unique,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE jobs (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER REFERENCES users(id),
    type        TEXT NOT NULL DEFAULT 'health-check',
    payload     JSONB NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending',
    result      JSONB,
    completed_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);