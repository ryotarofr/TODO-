import type {
	VisualSubTypeDef,
	WidgetDef,
	WorkflowTemplateDef,
} from "./types";

export const WIDGET_DEFS: WidgetDef[] = [
	{
		type: "text",
		label: "テキスト",
		description: "テキストエディタ付きパネル",
		colorClass: "type-text",
		defaultW: 16,
		defaultH: 11,
	},
	{
		type: "visual",
		label: "ビジュアルデータ",
		description: "チャート・テーブルなどの可視化パネル",
		colorClass: "type-visual",
		defaultW: 16,
		defaultH: 16,
	},
	{
		type: "ai",
		label: "AI連携",
		description: "AI機能と連携するパネル",
		colorClass: "type-ai",
		defaultW: 16,
		defaultH: 11,
	},
	{
		type: "object",
		label: "オブジェクト",
		description: "オブジェクトを配置するパネル",
		colorClass: "type-object",
		defaultW: 12,
		defaultH: 11,
	},
	{
		type: "folder",
		label: "フォルダ",
		description: "ローカルフォルダを参照するパネル",
		colorClass: "type-folder",
		defaultW: 16,
		defaultH: 16,
	},
];

export const VISUAL_SUBTYPES: VisualSubTypeDef[] = [
	{ type: "chart", label: "チャート", description: "グラフで可視化" },
	{ type: "table", label: "テーブル", description: "表形式で表示" },
	{
		type: "diagram",
		label: "ダイアグラム",
		description: "ER図・フロー図で可視化",
	},
];

export const COLOR_PRESETS = [
	{ label: "Coral", value: "#eb5e41" },
	{ label: "Green", value: "#2e7d32" },
	{ label: "Blue", value: "#1565c0" },
	{ label: "Orange", value: "#e65100" },
	{ label: "Purple", value: "#6a1b9a" },
	{ label: "Teal", value: "#00695c" },
	{ label: "Gray", value: "#546e7a" },
];

export const DRAFTS_STORAGE_KEY = "panel-drafts";

export const WORKFLOW_TEMPLATES: WorkflowTemplateDef[] = [
	{
		id: "folder-summary",
		label: "フォルダをAIで要約",
		description:
			"フォルダを選択し、AIが内容を自動で要約します",
		panels: [
			{
				type: "folder",
				title: "フォルダ",
				color: "#795548",
				w: 16,
				h: 16,
				needsFolderPath: true,
			},
			{
				type: "ai",
				title: "AI要約",
				color: "#6a1b9a",
				w: 16,
				h: 11,
				aiPrompt:
					"以下のフォルダ内容を日本語で要約してください。重要なファイルとその目的、プロジェクト構造を説明してください。",
				aiMaxTokens: 4096,
				needsAgent: true,
			},
		],
		edges: [{ sourceIndex: 0, targetIndex: 1 }],
	},
	{
		id: "er-diagram",
		label: "ER図を自動生成",
		description:
			"フォルダを選択し、AIがソースコードからER図を自動生成します",
		panels: [
			{
				type: "folder",
				title: "フォルダ",
				color: "#795548",
				w: 14,
				h: 14,
				needsFolderPath: true,
			},
			{
				type: "ai",
				title: "AI ER分析",
				color: "#6a1b9a",
				w: 14,
				h: 11,
				aiPrompt:
					"以下のソースコードからデータモデル（エンティティとリレーション）を分析し、Mermaid erDiagram形式で出力してください。```mermaid で囲んで出力してください。",
				aiSystemPrompt:
					"あなたはデータモデリングの専門家です。ソースコードを分析してER図をMermaid形式で出力します。",
				aiMaxTokens: 4096,
				needsAgent: true,
			},
			{
				type: "visual",
				visualSubType: "diagram",
				title: "ER Diagram",
				color: "#2e7d32",
				w: 20,
				h: 16,
				diagramCode: "",
			},
		],
		edges: [
			{ sourceIndex: 0, targetIndex: 1 },
			{ sourceIndex: 1, targetIndex: 2 },
		],
	},
];
