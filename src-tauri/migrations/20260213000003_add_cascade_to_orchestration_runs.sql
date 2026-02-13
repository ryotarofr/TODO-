-- Add ON DELETE CASCADE to orchestration_runs foreign keys

-- Drop existing constraints
ALTER TABLE orchestration_runs
    DROP CONSTRAINT IF EXISTS orchestration_runs_orchestrator_agent_id_fkey;
ALTER TABLE orchestration_runs
    DROP CONSTRAINT IF EXISTS orchestration_runs_workflow_run_id_fkey;
ALTER TABLE orchestration_runs
    DROP CONSTRAINT IF EXISTS orchestration_runs_execution_id_fkey;

-- Re-add with CASCADE
ALTER TABLE orchestration_runs
    ADD CONSTRAINT orchestration_runs_orchestrator_agent_id_fkey
    FOREIGN KEY (orchestrator_agent_id) REFERENCES agents(id) ON DELETE CASCADE;

ALTER TABLE orchestration_runs
    ADD CONSTRAINT orchestration_runs_workflow_run_id_fkey
    FOREIGN KEY (workflow_run_id) REFERENCES workflow_runs(id) ON DELETE CASCADE;

ALTER TABLE orchestration_runs
    ADD CONSTRAINT orchestration_runs_execution_id_fkey
    FOREIGN KEY (execution_id) REFERENCES agent_executions(id) ON DELETE CASCADE;
