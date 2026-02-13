-- Orchestration runs table for multi-agent orchestration
CREATE TABLE orchestration_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    orchestrator_agent_id UUID NOT NULL REFERENCES agents(id),
    workflow_run_id UUID NOT NULL REFERENCES workflow_runs(id),
    execution_id UUID NOT NULL REFERENCES agent_executions(id),
    mode VARCHAR(20) NOT NULL CHECK (mode IN ('automatic', 'approval')),
    status VARCHAR(30) NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'awaiting_approval', 'completed', 'failed', 'rejected')),
    plan_json JSONB,
    messages_json JSONB,
    final_output TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-update updated_at
CREATE TRIGGER set_updated_at_orchestration_runs
    BEFORE UPDATE ON orchestration_runs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX idx_orchestration_runs_orchestrator_agent ON orchestration_runs(orchestrator_agent_id);
CREATE INDEX idx_orchestration_runs_status ON orchestration_runs(status);
