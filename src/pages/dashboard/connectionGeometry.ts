import type { Connection, Direction, PipelineEdge } from "./types";

export function controlOffset(distance: number, curvature = 0.25): number {
	return distance >= 0 ? 0.5 * distance : curvature * 25 * Math.sqrt(-distance);
}

export function controlPoint(
	x: number,
	y: number,
	dir: Direction,
	otherX: number,
	otherY: number,
	curvature = 0.25,
): { x: number; y: number } {
	const dx = otherX - x;
	const dy = otherY - y;
	switch (dir) {
		case "right":
			return { x: x + controlOffset(dx, curvature), y };
		case "left":
			return { x: x - controlOffset(-dx, curvature), y };
		case "bottom":
			return { x, y: y + controlOffset(dy, curvature) };
		case "top":
			return { x, y: y - controlOffset(-dy, curvature) };
	}
}

export function connectionPath(c: Connection): string {
	const cp1 = controlPoint(c.fromX, c.fromY, c.fromDir, c.toX, c.toY);
	const cp2 = controlPoint(c.toX, c.toY, c.toDir, c.fromX, c.fromY);
	return `M${c.fromX},${c.fromY} C${cp1.x},${cp1.y} ${cp2.x},${cp2.y} ${c.toX},${c.toY}`;
}

export function exitAnchor(
	self: { l: number; t: number; w: number; h: number },
	other: { l: number; t: number; w: number; h: number },
): { x: number; y: number; dir: Direction } {
	const sCx = self.l + self.w / 2;
	const sCy = self.t + self.h / 2;
	const oCx = other.l + other.w / 2;
	const oCy = other.t + other.h / 2;
	const dx = oCx - sCx;
	const dy = oCy - sCy;
	if (Math.abs(dx) * self.h >= Math.abs(dy) * self.w) {
		// 水平方向に出る
		return dx >= 0
			? { x: self.l + self.w, y: sCy, dir: "right" }
			: { x: self.l, y: sCy, dir: "left" };
	}
	// 垂直方向に出る
	return dy >= 0
		? { x: sCx, y: self.t + self.h, dir: "bottom" }
		: { x: sCx, y: self.t, dir: "top" };
}

export function contentRect(
	item: HTMLElement,
	origin: DOMRect,
): { l: number; t: number; w: number; h: number } {
	const content = item.querySelector(".grid-stack-item-content") ?? item;
	const r = content.getBoundingClientRect();
	return {
		l: r.left - origin.left,
		t: r.top - origin.top,
		w: r.width,
		h: r.height,
	};
}

export function computeConnections(gridRef: HTMLDivElement): Connection[] {
	const area = gridRef.parentElement;
	if (!area) return [];
	const origin = area.getBoundingClientRect();
	const aiPanels = gridRef.querySelectorAll('[data-widget-type="ai"]');
	const result: Connection[] = [];
	for (const aiRoot of aiPanels) {
		const linkedStr = aiRoot.getAttribute("data-ai-linked") ?? "";
		if (!linkedStr) continue;
		const linkedIds = linkedStr
			.split(",")
			.map(Number)
			.filter((n) => !Number.isNaN(n) && n > 0);
		if (linkedIds.length === 0) continue;

		const aiItem = (aiRoot as HTMLElement).closest(
			".grid-stack-item",
		) as HTMLElement | null;
		if (!aiItem) continue;
		const aRect = contentRect(aiItem, origin);

		const headerEl = aiRoot.querySelector(".widget-header") as HTMLElement;
		const color = headerEl?.style.color ?? "#6a1b9a";

		for (const targetId of linkedIds) {
			const targetRoot = gridRef.querySelector(
				`[data-widget-id="${targetId}"]`,
			);
			if (!targetRoot) continue;
			const targetItem = (targetRoot as HTMLElement).closest(
				".grid-stack-item",
			) as HTMLElement | null;
			if (!targetItem) continue;
			const bRect = contentRect(targetItem, origin);
			const from = exitAnchor(aRect, bRect);
			const to = exitAnchor(bRect, aRect);
			result.push({
				fromX: from.x,
				fromY: from.y,
				fromDir: from.dir,
				toX: to.x,
				toY: to.y,
				toDir: to.dir,
				color,
			});
		}
	}
	return result;
}

/**
 * PipelineEdge[]から有向接続線を計算。
 * sourceは出力ポート（右側）から、targetは入力ポート（左側）へ接続。
 */
export function computeDirectedConnections(
	gridRef: HTMLDivElement,
	edges: PipelineEdge[],
): Connection[] {
	const area = gridRef.parentElement;
	if (!area) return [];
	const origin = area.getBoundingClientRect();
	const result: Connection[] = [];

	for (const edge of edges) {
		const sourceRoot = gridRef.querySelector(
			`[data-widget-id="${edge.sourceWidgetId}"]`,
		);
		const targetRoot = gridRef.querySelector(
			`[data-widget-id="${edge.targetWidgetId}"]`,
		);
		if (!sourceRoot || !targetRoot) continue;

		const sourceItem = (sourceRoot as HTMLElement).closest(
			".grid-stack-item",
		) as HTMLElement | null;
		const targetItem = (targetRoot as HTMLElement).closest(
			".grid-stack-item",
		) as HTMLElement | null;
		if (!sourceItem || !targetItem) continue;

		const sRect = contentRect(sourceItem, origin);
		const tRect = contentRect(targetItem, origin);

		// ポート位置: source右側中央、target左側中央
		const sourcePort = {
			x: sRect.l + sRect.w,
			y: sRect.t + sRect.h / 2,
			dir: "right" as Direction,
		};
		const targetPort = {
			x: tRect.l,
			y: tRect.t + tRect.h / 2,
			dir: "left" as Direction,
		};

		// sourceが右にない場合はスマートアンカーにフォールバック
		const dx = tRect.l - (sRect.l + sRect.w);
		let from: { x: number; y: number; dir: Direction };
		let to: { x: number; y: number; dir: Direction };

		if (dx >= -20) {
			// 標準: 右→左
			from = sourcePort;
			to = targetPort;
		} else {
			// targetがsourceの左にある: スマートアンカー使用
			from = exitAnchor(sRect, tRect);
			to = exitAnchor(tRect, sRect);
		}

		const headerEl = sourceRoot.querySelector(".widget-header") as HTMLElement;
		const color = headerEl?.style.color ?? "#6a1b9a";

		result.push({
			fromX: from.x,
			fromY: from.y,
			fromDir: from.dir,
			toX: to.x,
			toY: to.y,
			toDir: to.dir,
			color,
			edgeId: edge.id,
			isAutoChain: edge.autoChain,
		});
	}
	return result;
}
