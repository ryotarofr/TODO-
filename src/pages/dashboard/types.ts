export type WidgetType = "text" | "visual" | "ai" | "object" | "folder";
export type VisualSubType = "chart" | "table" | "diagram";

export interface WidgetDef {
	type: WidgetType;
	label: string;
	description: string;
	colorClass: string;
	defaultW: number;
	defaultH: number;
}

export interface VisualSubTypeDef {
	type: VisualSubType;
	label: string;
	description: string;
}

export interface PanelDraft {
	id: string;
	type: WidgetType;
	visualSubType: VisualSubType;
	title: string;
	color: string;
	w: number;
	h: number;
	textBody: string;
	aiPrompt: string;
	aiLinkedPanels: number[];
	aiAgentId: string;
	aiSystemPrompt: string;
	aiModel: string;
	aiTemperature: number;
	aiMaxTokens: number;
	aiProviderId: string;
	aiOrchestrationMode: string;
	folderPath: string;
	folderMaxDepth: number;
	folderExcludePatterns: string;
	diagramCode: string;
	savedAt: string;
}

export interface PanelConfig {
	type: WidgetType;
	visualSubType: VisualSubType;
	title: string;
	color: string;
	w: number;
	h: number;
	textBody: string;
	aiPrompt: string;
	aiLinkedPanels: number[];
	aiAgentId: string;
	aiSystemPrompt: string;
	aiModel: string;
	aiTemperature: number;
	aiMaxTokens: number;
	aiProviderId: string;
	aiOrchestrationMode: string;
	folderPath: string;
	folderMaxDepth: number;
	folderExcludePatterns: string;
	diagramCode: string;
}

export type Direction = "left" | "right" | "top" | "bottom";

export interface Connection {
	fromX: number;
	fromY: number;
	fromDir: Direction;
	toX: number;
	toY: number;
	toDir: Direction;
	color: string;
	edgeId?: string;
	isAutoChain?: boolean;
}

/** パネル間のデータフローを表す有向エッジ */
export interface PipelineEdge {
	id: string; // "edge-{sourceId}-{targetId}"
	sourceWidgetId: number; // 出力を提供するパネル
	targetWidgetId: number; // 出力を受け取るパネル
	autoChain: boolean; // source完了時にtargetを自動実行するか
}

/** ワークフローテンプレートのパネル定義 */
export interface WorkflowTemplatePanelDef {
	type: WidgetType;
	visualSubType?: VisualSubType;
	title: string;
	color: string;
	w: number;
	h: number;
	aiPrompt?: string;
	aiSystemPrompt?: string;
	aiMaxTokens?: number;
	diagramCode?: string;
	needsFolderPath?: boolean;
	needsAgent?: boolean;
}

/** ワークフローテンプレート定義 */
export interface WorkflowTemplateDef {
	id: string;
	label: string;
	description: string;
	panels: WorkflowTemplatePanelDef[];
	edges: { sourceIndex: number; targetIndex: number }[];
}

/** パイプライン全体の実行状態 */
export type PipelineStatus =
	| "idle"
	| "running"
	| "completed"
	| "failed"
	| "stopped";
