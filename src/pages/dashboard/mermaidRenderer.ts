import mermaid from "mermaid";

let initialized = false;
let renderCounter = 0;

/** Mermaidを初期化（初回のみ） */
export function initMermaid(): void {
	if (initialized) return;
	mermaid.initialize({
		startOnLoad: false,
		theme: "default",
		securityLevel: "strict",
		er: {
			useMaxWidth: true,
			layoutDirection: "TB",
		},
	});
	initialized = true;
}

/**
 * MermaidコードをSVG文字列にレンダリングする。
 * 成功時はSVG HTML、失敗時はエラー表示HTMLを返す。
 */
export async function renderMermaidToSvg(
	code: string,
	containerId: string,
): Promise<string> {
	initMermaid();
	try {
		// Mermaid.render は同一IDの再利用でエラーになるため、一意なIDを使用
		renderCounter++;
		const uniqueId = `${containerId}-${renderCounter}`;
		const { svg } = await mermaid.render(uniqueId, code);
		return svg;
	} catch (err) {
		const msg =
			err instanceof Error ? err.message : String(err);
		return `<div class="diagram-error">ダイアグラム描画エラー: ${escapeHtml(msg)}</div>`;
	}
}

/** AI出力からMermaidコードフェンスを除去 */
export function extractMermaidCode(text: string): string {
	const fenceMatch = text.match(/```mermaid\s*\n([\s\S]*?)```/);
	if (fenceMatch) return fenceMatch[1].trim();
	const genericMatch = text.match(/```\s*\n([\s\S]*?)```/);
	if (genericMatch) return genericMatch[1].trim();
	return text.trim();
}

/** ER図のデフォルトテンプレート */
export const DEFAULT_ER_DIAGRAM = `erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE_ITEM : contains
    PRODUCT ||--o{ LINE_ITEM : "ordered in"
    CUSTOMER {
        string name
        string email
    }
    ORDER {
        int id
        date created_at
    }
    LINE_ITEM {
        int quantity
        float price
    }
    PRODUCT {
        string name
        float price
    }`;

/**
 * グリッド内の未描画ダイアグラムを一括描画する。
 * GridStackのwidget追加/更新後に呼び出す。
 */
export async function renderDiagramsInGrid(
	gridRef: HTMLDivElement,
): Promise<void> {
	const containers = gridRef.querySelectorAll("[data-diagram-id]");
	for (const container of containers) {
		// 既に描画済みならスキップ
		if (container.querySelector("svg")) continue;

		const widgetId = container.getAttribute("data-diagram-id") ?? "";
		const widgetRoot = gridRef.querySelector(
			`[data-widget-id="${widgetId}"][data-widget-subtype="diagram"]`,
		);
		const code = widgetRoot?.getAttribute("data-diagram-code") ?? "";
		if (!code) {
			container.innerHTML =
				'<div class="diagram-placeholder">ダイアグラムコードが未設定です</div>';
			continue;
		}

		const svgHtml = await renderMermaidToSvg(code, `mermaid-${widgetId}`);
		container.innerHTML = svgHtml;
	}
}

function escapeHtml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}
