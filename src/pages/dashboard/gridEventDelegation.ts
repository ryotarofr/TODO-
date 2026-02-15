import type { GridStack } from "gridstack";
import {
	approveOrchestration,
	executeAgent,
	orchestrateAgent,
	rejectOrchestration,
} from "../../utils/agent";
import {
	buildFolderOutput,
	buildTreeHtml,
	DEFAULT_EXCLUDE_PATTERNS,
	openFolderPicker,
	readDirRecursive,
	readFolderContents,
} from "./folderReader";
import {
	buildAugmentedPrompt,
	collectUpstreamOutputs,
	getPanelOutput,
} from "./pipelineEngine";
import type { PipelineEdge } from "./types";

export interface GridEventHandlers {
	handleEditWidget: (widgetId: number) => void;
	getPipelineEdges: () => PipelineEdge[];
	getPanelOutputs: () => Record<number, string>;
	setPanelOutput: (widgetId: number, output: string) => void;
}

/**
 * グリッド上のウィジェットアクション用クリックイベント委譲を設定する。
 * リスナーを解除するクリーンアップ関数を返す。
 */
export function setupGridEventDelegation(
	gridRef: HTMLDivElement,
	grid: GridStack,
	handlers: GridEventHandlers,
): () => void {
	const ac = new AbortController();

	gridRef.addEventListener(
		"click",
		(e) => {
			const target = e.target as HTMLElement;

			// 0. AI実行ボタン
			const execBtn = target.closest(
				"[data-action='ai-execute']",
			) as HTMLElement | null;
			if (execBtn) {
				handleAiExecute(execBtn, gridRef, e, handlers);
				return;
			}

			// 0b. オーケストレーションボタン
			const orchBtn = target.closest(
				"[data-action='ai-orchestrate']",
			) as HTMLElement | null;
			if (orchBtn) {
				handleOrchestrate(orchBtn, gridRef, e);
				return;
			}

			// 0c. 承認ボタン
			const approveBtn = target.closest(
				"[data-action='ai-approve']",
			) as HTMLElement | null;
			if (approveBtn) {
				handleApprove(approveBtn, gridRef, e);
				return;
			}

			// 0d. 却下ボタン
			const rejectBtn = target.closest(
				"[data-action='ai-reject']",
			) as HTMLElement | null;
			if (rejectBtn) {
				handleReject(rejectBtn, gridRef, e);
				return;
			}

			// 0e. フォルダ読み込みボタン
			const folderBtn = target.closest(
				"[data-action='folder-load']",
			) as HTMLElement | null;
			if (folderBtn) {
				handleFolderLoad(folderBtn, gridRef, e, handlers);
				return;
			}

			// 1. メニューボタンクリック -> ドロップダウン切替
			const menuBtn = target.closest(".widget-menu-btn");
			if (menuBtn) {
				const menu = menuBtn.closest(".widget-menu") as HTMLElement | null;
				// 他の開いているメニューをすべて閉じる
				gridRef.querySelectorAll(".widget-menu.open").forEach((m) => {
					if (m !== menu) m.classList.remove("open");
				});
				menu?.classList.toggle("open");
				e.stopPropagation();
				return;
			}

			// 2. メニュー項目クリック -> アクション実行
			const menuItem = target.closest(
				".widget-menu-item",
			) as HTMLElement | null;
			if (menuItem) {
				const menu = menuItem.closest(".widget-menu") as HTMLElement | null;
				const wid = Number(menu?.getAttribute("data-widget-id"));
				const action = menuItem.getAttribute("data-action");
				menu?.classList.remove("open");
				if (!Number.isNaN(wid) && wid > 0) {
					if (action === "edit") {
						handlers.handleEditWidget(wid);
					} else if (action === "delete") {
						const items = grid.getGridItems();
						const el = items.find((item) =>
							item.querySelector(`[data-widget-id="${wid}"]`),
						);
						if (el) grid.removeWidget(el);
					}
				}
				e.stopPropagation();
				return;
			}

			// 3. グリッド内の他の場所をクリック -> 開いているメニューをすべて閉じる
			gridRef.querySelectorAll(".widget-menu.open").forEach((m) => {
				m.classList.remove("open");
			});
		},
		{ signal: ac.signal },
	);

	// グリッド外クリック時にメニューを閉じる
	document.addEventListener(
		"click",
		() => {
			gridRef.querySelectorAll(".widget-menu.open").forEach((m) => {
				m.classList.remove("open");
			});
		},
		{ signal: ac.signal },
	);

	return () => ac.abort();
}

function handleAiExecute(
	execBtn: HTMLElement,
	gridRef: HTMLDivElement,
	e: MouseEvent,
	handlers: GridEventHandlers,
) {
	const wid = Number(execBtn.getAttribute("data-widget-id"));
	if (!Number.isNaN(wid) && wid > 0) {
		const aiRoot = gridRef.querySelector(
			`[data-widget-id="${wid}"][data-widget-type="ai"]`,
		);
		const prompt = aiRoot?.getAttribute("data-ai-prompt") ?? "";
		const agentId = aiRoot?.getAttribute("data-ai-agent-id") ?? "";
		if (!agentId) {
			const badge = gridRef.querySelector(`[data-status-id="${wid}"]`);
			if (badge) {
				badge.className = "ai-status-badge ai-status-failed";
				badge.textContent = "未設定";
			}
			const outputArea = gridRef.querySelector(`[data-output-id="${wid}"]`);
			if (outputArea)
				outputArea.textContent =
					"先にエージェント設定を行ってください。パネルを編集して設定してください。";
			e.stopPropagation();
			return;
		}
		if (prompt) {
			// upstream出力を収集してプロンプトに注入
			const edges = handlers.getPipelineEdges();
			const currentOutputs = handlers.getPanelOutputs();

			// pipelineEdges + aiLinkedPanels を統合してupstreamを収集
			const pipelineSourceIds = new Set(
				edges
					.filter((edge) => edge.targetWidgetId === wid)
					.map((edge) => edge.sourceWidgetId),
			);
			const linkedStr = aiRoot?.getAttribute("data-ai-linked") ?? "";
			const linkedIds = linkedStr
				? linkedStr
						.split(",")
						.map(Number)
						.filter((n) => !Number.isNaN(n) && n > 0)
				: [];
			const mergedEdges: PipelineEdge[] = [...edges];
			for (const linkedId of linkedIds) {
				if (!pipelineSourceIds.has(linkedId)) {
					mergedEdges.push({
						id: `linked-${linkedId}-${wid}`,
						sourceWidgetId: linkedId,
						targetWidgetId: wid,
						autoChain: false,
					});
				}
			}

			// upstreamパネルの最新出力をDOMから再取得
			const freshOutputs = { ...currentOutputs };
			for (const edge of mergedEdges) {
				if (edge.targetWidgetId === wid) {
					const srcOutput = getPanelOutput(edge.sourceWidgetId, gridRef);
					if (srcOutput) {
						freshOutputs[edge.sourceWidgetId] = srcOutput;
						handlers.setPanelOutput(edge.sourceWidgetId, srcOutput);
					}
				}
			}

			const upstream = collectUpstreamOutputs(wid, mergedEdges, freshOutputs).map(
				(u) => {
					const srcRoot = gridRef.querySelector(
						`[data-widget-id="${u.widgetId}"]`,
					);
					const type = srcRoot?.getAttribute("data-widget-type") ?? "unknown";
					const typeLabels: Record<string, string> = {
						text: "テキスト Widget",
						visual: "ビジュアル Widget",
						ai: "AI連携 Widget",
						object: "オブジェクト Widget",
						folder: "フォルダ Widget",
					};
					return { ...u, label: typeLabels[type] ?? "Widget" };
				},
			);
			const augmentedPrompt = buildAugmentedPrompt(prompt, upstream);

			// ステータスバッジを更新
			const badge = gridRef.querySelector(`[data-status-id="${wid}"]`);
			if (badge) {
				badge.className = "ai-status-badge ai-status-running";
				badge.textContent = "実行中...";
			}
			const outputArea = gridRef.querySelector(`[data-output-id="${wid}"]`);
			if (outputArea) outputArea.textContent = "";

			executeAgent(agentId, augmentedPrompt)
				.then((execution) => {
					const badgeEl = gridRef.querySelector(`[data-status-id="${wid}"]`);
					const outEl = gridRef.querySelector(`[data-output-id="${wid}"]`);
					if (execution.status === "completed") {
						if (badgeEl) {
							badgeEl.className = "ai-status-badge ai-status-completed";
							badgeEl.textContent = "完了";
						}
						const outputText = execution.output_text ?? "";
						if (outEl) outEl.textContent = outputText;
						// 出力をキャッシュ
						handlers.setPanelOutput(wid, outputText);
					} else {
						if (badgeEl) {
							badgeEl.className = "ai-status-badge ai-status-failed";
							badgeEl.textContent = "失敗";
						}
						if (outEl)
							outEl.textContent = execution.error_message ?? "Unknown error";
					}
				})
				.catch((err) => {
					const badgeEl = gridRef.querySelector(`[data-status-id="${wid}"]`);
					const outEl = gridRef.querySelector(`[data-output-id="${wid}"]`);
					if (badgeEl) {
						badgeEl.className = "ai-status-badge ai-status-failed";
						badgeEl.textContent = "エラー";
					}
					if (outEl) outEl.textContent = String(err);
				});
		}
	}
	e.stopPropagation();
}

function handleOrchestrate(
	orchBtn: HTMLElement,
	gridRef: HTMLDivElement,
	e: MouseEvent,
) {
	const wid = Number(orchBtn.getAttribute("data-widget-id"));
	if (!Number.isNaN(wid) && wid > 0) {
		const aiRoot = gridRef.querySelector(
			`[data-widget-id="${wid}"][data-widget-type="ai"]`,
		);
		const prompt = aiRoot?.getAttribute("data-ai-prompt") ?? "";
		const agentId = aiRoot?.getAttribute("data-ai-agent-id") ?? "";
		const orchMode =
			aiRoot?.getAttribute("data-ai-orchestration-mode") ?? "automatic";
		if (!agentId) {
			const badge = gridRef.querySelector(`[data-status-id="${wid}"]`);
			if (badge) {
				badge.className = "ai-status-badge ai-status-failed";
				badge.textContent = "未設定";
			}
			e.stopPropagation();
			return;
		}
		if (prompt) {
			const badge = gridRef.querySelector(`[data-status-id="${wid}"]`);
			if (badge) {
				badge.className = "ai-status-badge ai-status-running";
				badge.textContent = "オーケストレーション中...";
			}
			const outputArea = gridRef.querySelector(`[data-output-id="${wid}"]`);
			if (outputArea) outputArea.textContent = "";

			orchestrateAgent(agentId, prompt, orchMode)
				.then((run) => {
					console.log("[dashboard] Orchestration started:", run.id);
					// 承認/却下用にrun IDを保存
					aiRoot?.setAttribute("data-orchestration-run-id", run.id);
				})
				.catch((err) => {
					const badgeEl = gridRef.querySelector(`[data-status-id="${wid}"]`);
					if (badgeEl) {
						badgeEl.className = "ai-status-badge ai-status-failed";
						badgeEl.textContent = "エラー";
					}
					const outEl = gridRef.querySelector(`[data-output-id="${wid}"]`);
					if (outEl) outEl.textContent = String(err);
				});
		}
	}
	e.stopPropagation();
}

function handleApprove(
	approveBtn: HTMLElement,
	gridRef: HTMLDivElement,
	e: MouseEvent,
) {
	const wid = Number(approveBtn.getAttribute("data-widget-id"));
	if (!Number.isNaN(wid) && wid > 0) {
		const aiRoot = gridRef.querySelector(
			`[data-widget-id="${wid}"][data-widget-type="ai"]`,
		);
		const runId = aiRoot?.getAttribute("data-orchestration-run-id") ?? "";
		if (runId) {
			const badge = gridRef.querySelector(`[data-status-id="${wid}"]`);
			if (badge) {
				badge.className = "ai-status-badge ai-status-running";
				badge.textContent = "実行中...";
			}
			const planArea = gridRef.querySelector(
				`[data-plan-id="${wid}"]`,
			) as HTMLElement | null;
			if (planArea) planArea.style.display = "none";

			approveOrchestration(runId).catch((err) => {
				const badgeEl = gridRef.querySelector(`[data-status-id="${wid}"]`);
				if (badgeEl) {
					badgeEl.className = "ai-status-badge ai-status-failed";
					badgeEl.textContent = "エラー";
				}
				const outEl = gridRef.querySelector(`[data-output-id="${wid}"]`);
				if (outEl) outEl.textContent = String(err);
			});
		}
	}
	e.stopPropagation();
}

async function handleFolderLoad(
	folderBtn: HTMLElement,
	gridRef: HTMLDivElement,
	e: MouseEvent,
	handlers: GridEventHandlers,
) {
	const wid = Number(folderBtn.getAttribute("data-widget-id"));
	if (Number.isNaN(wid) || wid <= 0) return;
	e.stopPropagation();

	const folderRoot = gridRef.querySelector(
		`[data-widget-id="${wid}"][data-widget-type="folder"]`,
	);
	if (!folderRoot) return;

	let folderPath = folderRoot.getAttribute("data-folder-path") ?? "";
	const maxDepth = Number(
		folderRoot.getAttribute("data-folder-max-depth") ?? "3",
	);
	const excludeStr = folderRoot.getAttribute("data-folder-exclude") ?? "";
	const excludePatterns =
		excludeStr.trim().length > 0
			? excludeStr.split("\n").filter((s) => s.trim().length > 0)
			: DEFAULT_EXCLUDE_PATTERNS;

	// パスが空の場合はフォルダ選択ダイアログを開く
	if (!folderPath) {
		const picked = await openFolderPicker();
		if (!picked) return;
		folderPath = picked;
		folderRoot.setAttribute("data-folder-path", folderPath);
		// パスラベルを更新
		const pathLabel = folderRoot.querySelector(".folder-path-label");
		if (pathLabel) pathLabel.textContent = folderPath;
	}

	// 読み込みボタンをローディング表示に
	const btn = folderBtn as HTMLButtonElement;
	const originalText = btn.textContent;
	btn.textContent = "読み込み中...";
	btn.disabled = true;

	try {
		const entries = await readDirRecursive(folderPath, {
			maxDepth,
			excludePatterns,
			maxFiles: 200,
		});

		// ツリーHTMLを生成して挿入
		const treeHtml = buildTreeHtml(entries);
		const treeArea = gridRef.querySelector(`[data-folder-tree-id="${wid}"]`);
		if (treeArea) treeArea.innerHTML = treeHtml;

		// ファイル内容を読み込み
		const contents = await readFolderContents(entries);
		console.log(
			`[dashboard] folder #${wid}: ${contents.length} file contents loaded`,
		);

		// パイプライン用出力テキストを生成してキャッシュ
		const outputText = buildFolderOutput(folderPath, entries, contents);
		console.log(
			`[dashboard] folder #${wid}: output text length = ${outputText.length}`,
		);
		const outEl = gridRef.querySelector(`[data-output-id="${wid}"]`);
		if (outEl) outEl.textContent = outputText;

		// パイプライン用出力を登録
		handlers.setPanelOutput(wid, outputText);
	} catch (err) {
		const treeArea = gridRef.querySelector(`[data-folder-tree-id="${wid}"]`);
		if (treeArea)
			treeArea.innerHTML = `<div class="folder-error">読み込みエラー: ${String(err)}</div>`;
	} finally {
		btn.textContent = originalText;
		btn.disabled = false;
	}
}

function handleReject(
	rejectBtn: HTMLElement,
	gridRef: HTMLDivElement,
	e: MouseEvent,
) {
	const wid = Number(rejectBtn.getAttribute("data-widget-id"));
	if (!Number.isNaN(wid) && wid > 0) {
		const aiRoot = gridRef.querySelector(
			`[data-widget-id="${wid}"][data-widget-type="ai"]`,
		);
		const runId = aiRoot?.getAttribute("data-orchestration-run-id") ?? "";
		if (runId) {
			const badge = gridRef.querySelector(`[data-status-id="${wid}"]`);
			if (badge) {
				badge.className = "ai-status-badge ai-status-failed";
				badge.textContent = "却下";
			}
			const planArea = gridRef.querySelector(
				`[data-plan-id="${wid}"]`,
			) as HTMLElement | null;
			if (planArea) planArea.style.display = "none";

			rejectOrchestration(runId).catch((err) => {
				console.error("Failed to reject:", err);
			});
		}
	}
	e.stopPropagation();
}
