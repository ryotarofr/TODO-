-- Agent Orchestration Tables
-- Phase 1: LLM providers, workflows, agents, executions, messages

-- 1. LLM Providers
CREATE TABLE IF NOT EXISTS llm_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(200) NOT NULL,
    api_base_url VARCHAR(500),
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_llm_providers_updated_at
    BEFORE UPDATE ON llm_providers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Seed Anthropic provider
INSERT INTO llm_providers (name, display_name, api_base_url)
VALUES ('anthropic', 'Anthropic', 'https://api.anthropic.com')
ON CONFLICT (name) DO NOTHING;

-- 2. Workflows
CREATE TABLE IF NOT EXISTS workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_workflows_updated_at
    BEFORE UPDATE ON workflows
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_workflows_user_id ON workflows(user_id);

-- 3. Agents
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    llm_provider_id UUID NOT NULL REFERENCES llm_providers(id),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    system_prompt TEXT,
    model VARCHAR(100) NOT NULL DEFAULT 'claude-sonnet-4-5-20250929',
    temperature DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    max_tokens INTEGER NOT NULL DEFAULT 1024,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_agents_updated_at
    BEFORE UPDATE ON agents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_agents_workflow_id ON agents(workflow_id);
CREATE INDEX idx_agents_llm_provider_id ON agents(llm_provider_id);

-- 4. Workflow Runs
CREATE TABLE IF NOT EXISTS workflow_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled')),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_workflow_runs_updated_at
    BEFORE UPDATE ON workflow_runs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_workflow_runs_workflow_id ON workflow_runs(workflow_id);
CREATE INDEX idx_workflow_runs_status ON workflow_runs(status);

-- 5. Agent Executions
CREATE TABLE IF NOT EXISTS agent_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    workflow_run_id UUID REFERENCES workflow_runs(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'completed', 'failed')),
    input_text TEXT,
    output_text TEXT,
    token_usage JSONB,
    duration_ms BIGINT,
    error_message TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_agent_executions_updated_at
    BEFORE UPDATE ON agent_executions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_agent_executions_agent_id ON agent_executions(agent_id);
CREATE INDEX idx_agent_executions_workflow_run_id ON agent_executions(workflow_run_id);
CREATE INDEX idx_agent_executions_status ON agent_executions(status);

-- 6. Agent Messages
CREATE TABLE IF NOT EXISTS agent_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    execution_id UUID NOT NULL REFERENCES agent_executions(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('system', 'user', 'assistant')),
    content TEXT NOT NULL,
    sequence_order INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER update_agent_messages_updated_at
    BEFORE UPDATE ON agent_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_agent_messages_execution_id ON agent_messages(execution_id);
CREATE INDEX idx_agent_messages_sequence ON agent_messages(execution_id, sequence_order);
