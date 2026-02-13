ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

CREATE TABLE IF NOT EXISTS user_auth_providers (
    id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider         VARCHAR(50) NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_auth_providers_user_id ON user_auth_providers(user_id);

CREATE TRIGGER trigger_user_auth_providers_updated_at
    BEFORE UPDATE ON user_auth_providers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
