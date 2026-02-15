import { hasCycle } from "./pipelineEngine";
import type { PipelineEdge } from "./types";

export interface PortDragCallbacks {
	getEdges: () => PipelineEdge[];
	addEdge: (edge: PipelineEdge) => void;
	getAllWidgetIds: () => number[];
}

/**
 * ポートのドラッグ&ドロップによるエッジ作成をセットアップ。
 * 出力ポートからドラッグ開始 → カーソルに追従するSVG線を描画 → 入力ポート上でドロップ → 新規エッジ作成
 */
export function setupPortDragHandler(
	gridRef: HTMLDivElement,
	svgOverlay: SVGSVGElement,
	callbacks: PortDragCallbacks,
): () => void {
	const ac = new AbortController();
	let dragging = false;
	let sourceWidgetId = -1;
	let dragLine: SVGLineElement | null = null;
	let startX = 0;
	let startY = 0;

	const getOrigin = () => {
		const area = gridRef.parentElement;
		return area?.getBoundingClientRect() ?? { left: 0, top: 0 };
	};

	gridRef.addEventListener(
		"mousedown",
		(e) => {
			const target = e.target as HTMLElement;
			if (
				!target.classList.contains("widget-port-output") ||
				target.getAttribute("data-port") !== "output"
			)
				return;

			e.preventDefault();
			e.stopPropagation();

			sourceWidgetId = Number(target.getAttribute("data-widget-id"));
			if (Number.isNaN(sourceWidgetId) || sourceWidgetId <= 0) return;

			dragging = true;
			const origin = getOrigin();
			const portRect = target.getBoundingClientRect();
			startX = portRect.left + portRect.width / 2 - origin.left;
			startY = portRect.top + portRect.height / 2 - origin.top;

			// ドラッグ中のSVG線を作成
			dragLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
			dragLine.setAttribute("x1", String(startX));
			dragLine.setAttribute("y1", String(startY));
			dragLine.setAttribute("x2", String(startX));
			dragLine.setAttribute("y2", String(startY));
			dragLine.setAttribute("class", "pipeline-drag-line");
			svgOverlay.appendChild(dragLine);
		},
		{ signal: ac.signal },
	);

	document.addEventListener(
		"mousemove",
		(e) => {
			if (!dragging || !dragLine) return;
			const origin = getOrigin();
			const x = e.clientX - origin.left;
			const y = e.clientY - origin.top;
			dragLine.setAttribute("x2", String(x));
			dragLine.setAttribute("y2", String(y));

			// 入力ポートのホバーハイライト
			const inputPorts = gridRef.querySelectorAll(".widget-port-input");
			for (const port of inputPorts) {
				const rect = (port as HTMLElement).getBoundingClientRect();
				const px = e.clientX;
				const py = e.clientY;
				const inRange =
					px >= rect.left - 10 &&
					px <= rect.right + 10 &&
					py >= rect.top - 10 &&
					py <= rect.bottom + 10;
				(port as HTMLElement).classList.toggle("widget-port-hover", inRange);
			}
		},
		{ signal: ac.signal },
	);

	document.addEventListener(
		"mouseup",
		(e) => {
			if (!dragging) return;
			dragging = false;

			// ドラッグ線を削除
			if (dragLine) {
				dragLine.remove();
				dragLine = null;
			}

			// ホバーハイライトを除去
			const inputPorts = gridRef.querySelectorAll(".widget-port-input");
			for (const port of inputPorts) {
				(port as HTMLElement).classList.remove("widget-port-hover");
			}

			// ドロップ先の入力ポートを検索
			const target = document.elementFromPoint(
				e.clientX,
				e.clientY,
			) as HTMLElement | null;
			if (
				!target?.classList.contains("widget-port-input") ||
				target.getAttribute("data-port") !== "input"
			)
				return;

			const targetWidgetId = Number(target.getAttribute("data-widget-id"));
			if (
				Number.isNaN(targetWidgetId) ||
				targetWidgetId <= 0 ||
				targetWidgetId === sourceWidgetId
			)
				return;

			// 既存エッジ重複チェック
			const edges = callbacks.getEdges();
			const edgeId = `edge-${sourceWidgetId}-${targetWidgetId}`;
			if (edges.some((e) => e.id === edgeId)) return;

			// サイクル検出
			const testEdge: PipelineEdge = {
				id: edgeId,
				sourceWidgetId,
				targetWidgetId,
				autoChain: false,
			};
			const testEdges = [...edges, testEdge];
			const allIds = callbacks.getAllWidgetIds();
			if (hasCycle(testEdges, allIds)) {
				// サイクル拒否: 赤フラッシュ
				target.classList.add("widget-port-reject");
				setTimeout(() => target.classList.remove("widget-port-reject"), 600);
				return;
			}

			callbacks.addEdge(testEdge);
		},
		{ signal: ac.signal },
	);

	return () => ac.abort();
}
