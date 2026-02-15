/**
 * コマンドパレット検索エンジン
 * - 現在のダッシュボード: DOM上のウィジェット data-* 属性とテキスト内容から検索
 * - 他ダッシュボード: localStorage の保存済みレイアウトHTMLをパースして検索
 * - ドキュメント: NavItemsContext 経由で全文検索
 */

import type { WidgetType } from "./types";

/** 検索可能なフィールド1件 */
export interface SearchableField {
	/** null = 現在のダッシュボード */
	dashboardId: string | null;
	dashboardName: string;
	widgetId: number;
	widgetType: WidgetType | "document";
	title: string;
	fieldName: string;
	fieldKey: string;
	text: string;
}

/** 検索結果1件 */
export interface SearchResult {
	dashboardId: string | null;
	dashboardName: string;
	widgetId: number;
	widgetType: WidgetType | "document";
	title: string;
	fieldName: string;
	fieldKey: string;
	matchSnippet: string;
}

const MAX_RESULTS = 30;

// --- 現在のダッシュボード (DOM ベース) ---

/**
 * 現在表示中のダッシュボードの DOM 要素をスキャンし、検索用配列を構築する。
 */
export function buildLocalIndex(
	gridRef: HTMLDivElement,
	dashboardName: string,
): SearchableField[] {
	const fields: SearchableField[] = [];
	const seen = new Set<number>();

	for (const el of gridRef.querySelectorAll("[data-widget-id]")) {
		const wType = el.getAttribute("data-widget-type");
		if (!wType) continue;

		const widgetId = Number(el.getAttribute("data-widget-id"));
		if (Number.isNaN(widgetId) || widgetId <= 0) continue;
		if (seen.has(widgetId)) continue;
		seen.add(widgetId);

		const widgetType = wType as WidgetType;
		const headerSpan = el.querySelector(".widget-header span:first-child");
		const title = headerSpan?.textContent ?? `Widget #${widgetId}`;

		const base = {
			dashboardId: null as string | null,
			dashboardName,
			widgetId,
			widgetType,
			title,
		};

		fields.push({ ...base, fieldName: "タイトル", fieldKey: "title", text: title });

		switch (widgetType) {
			case "text": {
				const body = el.querySelector(".widget-body") as HTMLElement | null;
				const bodyText = body?.innerText ?? "";
				if (bodyText.trim())
					fields.push({ ...base, fieldName: "テキスト本文", fieldKey: "textBody", text: bodyText });
				break;
			}
			case "ai": {
				const prompt = el.getAttribute("data-ai-prompt") ?? "";
				const sysPrompt = el.getAttribute("data-ai-system-prompt") ?? "";
				if (prompt.trim())
					fields.push({ ...base, fieldName: "AIプロンプト", fieldKey: "aiPrompt", text: prompt });
				if (sysPrompt.trim())
					fields.push({ ...base, fieldName: "システムプロンプト", fieldKey: "aiSystemPrompt", text: sysPrompt });
				const outEl = gridRef.querySelector(`[data-output-id="${widgetId}"]`);
				const outText = outEl?.textContent ?? "";
				if (outText.trim())
					fields.push({ ...base, fieldName: "AI出力", fieldKey: "aiOutput", text: outText });
				break;
			}
			case "folder": {
				const folderPath = el.getAttribute("data-folder-path") ?? "";
				if (folderPath.trim())
					fields.push({ ...base, fieldName: "フォルダパス", fieldKey: "folderPath", text: folderPath });
				const folderOut = gridRef.querySelector(`[data-output-id="${widgetId}"]`);
				const folderOutText = folderOut?.textContent ?? "";
				if (folderOutText.trim())
					fields.push({ ...base, fieldName: "フォルダ出力", fieldKey: "folderOutput", text: folderOutText });
				break;
			}
			case "visual": {
				const subtype = el.getAttribute("data-widget-subtype");
				if (subtype === "diagram") {
					const diagramCode = el.getAttribute("data-diagram-code") ?? "";
					if (diagramCode.trim())
						fields.push({ ...base, fieldName: "ダイアグラムコード", fieldKey: "diagramCode", text: diagramCode });
					const diagOut = gridRef.querySelector(`[data-output-id="${widgetId}"]`);
					const diagOutText = diagOut?.textContent ?? "";
					if (diagOutText.trim())
						fields.push({ ...base, fieldName: "ダイアグラム出力", fieldKey: "diagramOutput", text: diagOutText });
				} else {
					const body = el.querySelector(".widget-body") as HTMLElement | null;
					const bodyText = body?.innerText ?? "";
					if (bodyText.trim())
						fields.push({ ...base, fieldName: "コンテンツ", fieldKey: "textBody", text: bodyText });
				}
				break;
			}
		}
	}

	return fields;
}

// --- 他ダッシュボード (localStorage ベース) ---

/** layoutJSONのアイテム型 (GridStack.save() の出力) */
interface LayoutItem {
	content?: string;
	[key: string]: unknown;
}

/**
 * 保存済みレイアウトHTMLをオフスクリーンDOMでパースし、フィールドを抽出する。
 * ブラウザの DOMParser を使用してHTMLをパースする。
 */
function parseLayoutHtml(
	dashboardId: string,
	dashboardName: string,
	layoutItems: LayoutItem[],
): SearchableField[] {
	const fields: SearchableField[] = [];
	const parser = new DOMParser();

	for (const item of layoutItems) {
		if (!item.content) continue;

		const doc = parser.parseFromString(item.content, "text/html");
		const el = doc.querySelector("[data-widget-type]");
		if (!el) continue;

		const widgetId = Number(el.getAttribute("data-widget-id"));
		if (Number.isNaN(widgetId) || widgetId <= 0) continue;

		const widgetType = el.getAttribute("data-widget-type") as WidgetType;
		const headerSpan = el.querySelector(".widget-header span:first-child");
		const title = headerSpan?.textContent ?? `Widget #${widgetId}`;

		const base = { dashboardId, dashboardName, widgetId, widgetType, title };

		fields.push({ ...base, fieldName: "タイトル", fieldKey: "title", text: title });

		switch (widgetType) {
			case "text": {
				const body = el.querySelector(".widget-body");
				const bodyText = body?.textContent ?? "";
				if (bodyText.trim())
					fields.push({ ...base, fieldName: "テキスト本文", fieldKey: "textBody", text: bodyText });
				break;
			}
			case "ai": {
				const prompt = el.getAttribute("data-ai-prompt") ?? "";
				const sysPrompt = el.getAttribute("data-ai-system-prompt") ?? "";
				if (prompt.trim())
					fields.push({ ...base, fieldName: "AIプロンプト", fieldKey: "aiPrompt", text: prompt });
				if (sysPrompt.trim())
					fields.push({ ...base, fieldName: "システムプロンプト", fieldKey: "aiSystemPrompt", text: sysPrompt });
				break;
			}
			case "folder": {
				const folderPath = el.getAttribute("data-folder-path") ?? "";
				if (folderPath.trim())
					fields.push({ ...base, fieldName: "フォルダパス", fieldKey: "folderPath", text: folderPath });
				break;
			}
			case "visual": {
				if (el.getAttribute("data-widget-subtype") === "diagram") {
					const diagramCode = el.getAttribute("data-diagram-code") ?? "";
					if (diagramCode.trim())
						fields.push({ ...base, fieldName: "ダイアグラムコード", fieldKey: "diagramCode", text: diagramCode });
				}
				break;
			}
		}
	}

	return fields;
}

/** NavItem の最小情報 (Sidebar 型への依存を避ける) */
export interface NavItemInfo {
	id: string;
	name: string;
	type?: "dashboard" | "file" | "document" | "folder";
}

/**
 * 全ダッシュボード・ドキュメントの検索用インデックスを構築する。
 * 現在のダッシュボードは除外する（別途 buildLocalIndex で構築するため）。
 */
export function buildGlobalIndex(
	navItems: NavItemInfo[],
	currentDashboardId: string,
	getDocumentContent: (id: string) => string,
): SearchableField[] {
	const fields: SearchableField[] = [];

	for (const item of navItems) {
		if (item.id === currentDashboardId) continue;

		const itemType = item.type ?? "dashboard";

		if (itemType === "dashboard" || !item.type) {
			// ダッシュボードレイアウトを localStorage から取得
			const key = `dashboard-layout-${item.id}`;
			const raw = localStorage.getItem(key);
			if (!raw) continue;
			try {
				const layout = JSON.parse(raw) as LayoutItem[];
				fields.push(...parseLayoutHtml(item.id, item.name, layout));
			} catch {
				// invalid JSON — skip
			}
		} else if (itemType === "document") {
			// ドキュメント内容を検索
			const content = getDocumentContent(item.id);
			if (!content.trim()) continue;

			// HTMLタグを除去してプレーンテキスト化
			const plainText = content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
			if (!plainText) continue;

			fields.push({
				dashboardId: item.id,
				dashboardName: item.name,
				widgetId: 0,
				widgetType: "document",
				title: item.name,
				fieldName: "ドキュメント",
				fieldKey: "documentBody",
				text: plainText,
			});
		}
		// file, folder タイプはスキップ
	}

	return fields;
}

// --- 検索 ---

/**
 * インデックスに対してクエリで部分一致検索する。
 * 大文字小文字を区別せず、最大 MAX_RESULTS 件を返す。
 */
export function searchIndex(
	index: SearchableField[],
	query: string,
): SearchResult[] {
	const trimmed = query.trim();
	if (!trimmed) return [];

	const lowerQuery = trimmed.toLowerCase();
	const results: SearchResult[] = [];

	for (const field of index) {
		const lowerText = field.text.toLowerCase();
		const matchIdx = lowerText.indexOf(lowerQuery);
		if (matchIdx === -1) continue;

		const snippetStart = Math.max(0, matchIdx - 40);
		const snippetEnd = Math.min(field.text.length, matchIdx + trimmed.length + 40);
		let snippet = field.text.slice(snippetStart, snippetEnd).trim();
		if (snippetStart > 0) snippet = `...${snippet}`;
		if (snippetEnd < field.text.length) snippet = `${snippet}...`;

		results.push({
			dashboardId: field.dashboardId,
			dashboardName: field.dashboardName,
			widgetId: field.widgetId,
			widgetType: field.widgetType,
			title: field.title,
			fieldName: field.fieldName,
			fieldKey: field.fieldKey,
			matchSnippet: snippet,
		});

		if (results.length >= MAX_RESULTS) break;
	}

	return results;
}

// --- ハイライト ---

/**
 * 指定ウィジェットの .grid-stack-item へスムーズスクロールし、
 * 紫パルスアニメーションで一時ハイライトする。
 */
export function scrollToAndHighlight(
	gridRef: HTMLDivElement,
	widgetId: number,
): void {
	const widgetRoot = gridRef.querySelector(
		`[data-widget-id="${widgetId}"][data-widget-type]`,
	);
	if (!widgetRoot) return;

	const gridItem = widgetRoot.closest(".grid-stack-item") as HTMLElement | null;
	if (!gridItem) return;

	gridItem.scrollIntoView({ behavior: "smooth", block: "center" });
	gridItem.classList.add("search-highlight");

	const onEnd = () => {
		gridItem.classList.remove("search-highlight");
		gridItem.removeEventListener("animationend", onEnd);
	};
	gridItem.addEventListener("animationend", onEnd);

	setTimeout(() => gridItem.classList.remove("search-highlight"), 2000);
}
