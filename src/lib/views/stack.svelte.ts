import type { Component } from 'svelte';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyComponent = Component<any>;

export type Orientation = 'horizontal' | 'vertical';

export type ViewSpec = {
	id?: string;
	title: string;
	subtitle?: string;
	component: AnyComponent;
	props?: Record<string, unknown>;
	parentId?: string;
};

export type ViewEntry = {
	id: string;
	title: string;
	subtitle?: string;
	component: AnyComponent;
	props: Record<string, unknown>;
	parentId?: string;
};

/** A single window inside a column. `weight` is its share of the column's cross axis. */
export type Slot = {
	entry: ViewEntry;
	weight: number;
};

/** A niri-style column. `size` is its share of the viewport along the scroll axis. */
export type Column = {
	id: string;
	size: number;
	slots: Slot[];
};

export type LayoutSnapshot = {
	orientation: Orientation;
	focusedId: string | null;
	columns: {
		id: string;
		size: number;
		slots: { id: string; weight: number }[];
	}[];
};

export const MAX_SLOTS_PER_COLUMN = 2;
export const DEFAULT_COLUMN_SIZE = 0.5;
const MIN_COLUMN_SIZE = 0.25;
const MAX_COLUMN_SIZE = 2;
const MIN_SLOT_WEIGHT = 0.15;

function clampColumnSize(size: number) {
	if (!Number.isFinite(size)) return DEFAULT_COLUMN_SIZE;
	return Math.min(MAX_COLUMN_SIZE, Math.max(MIN_COLUMN_SIZE, size));
}

function normalizeWeights(slots: Slot[]) {
	const total = slots.reduce((sum, slot) => sum + (slot.weight > 0 ? slot.weight : 0), 0);
	if (total <= 0) {
		const even = 1 / slots.length;
		for (const slot of slots) slot.weight = even;
		return;
	}
	for (const slot of slots) slot.weight = (slot.weight > 0 ? slot.weight : 0) / total;
}

let viewCounter = 0;
let columnCounter = 0;

class ViewStackStore {
	columns = $state<Column[]>([]);
	orientation = $state<Orientation>('horizontal');
	focusedId = $state<string | null>(null);
	lastClosedId = $state<string | null>(null);
	closeNonce = $state(0);

	/** Flat, reading order (column left→right, slot top→bottom) list of open views. */
	get entries(): ViewEntry[] {
		return this.columns.flatMap((column) => column.slots.map((slot) => slot.entry));
	}

	open(spec: ViewSpec, options: { columnId?: string } = {}): string {
		const id = spec.id ?? this.nextViewId();
		const entry = this.toEntry(id, spec);

		const located = this.locate(id);
		if (located) {
			located.column.slots[located.slotIndex].entry = entry;
			this.focusedId = id;
			return id;
		}

		const targetColumn = options.columnId
			? this.columns.find((column) => column.id === options.columnId)
			: undefined;
		if (targetColumn && targetColumn.slots.length < MAX_SLOTS_PER_COLUMN) {
			targetColumn.slots.push({ entry, weight: 1 });
			normalizeWeights(targetColumn.slots);
		} else {
			this.insertColumnAfter(this.columnIndexOf(this.focusedId), entry);
		}

		this.focusedId = id;
		return id;
	}

	openAfter(parentId: string, spec: ViewSpec): string {
		const id = spec.id ?? this.nextViewId();
		const located = this.locate(id);
		if (located) {
			located.column.slots[located.slotIndex].entry = this.toEntry(id, spec);
			this.focusedId = id;
			return id;
		}

		this.insertColumnAfter(this.columnIndexOf(parentId), this.toEntry(id, spec));
		this.focusedId = id;
		return id;
	}

	updateProps(id: string, props: Record<string, unknown>) {
		const located = this.locate(id);
		if (!located) return;
		const slot = located.column.slots[located.slotIndex];
		slot.entry = { ...slot.entry, props: { ...slot.entry.props, ...props } };
	}

	focus(id: string) {
		if (this.locate(id)) this.focusedId = id;
	}

	close(id: string) {
		const located = this.locate(id);
		if (!located) return;

		const { column, slotIndex } = located;
		column.slots.splice(slotIndex, 1);
		if (column.slots.length === 0) {
			this.columns = this.columns.filter((other) => other !== column);
		} else {
			normalizeWeights(column.slots);
		}

		if (!this.locate(this.focusedId)) {
			this.focusedId = this.entries.at(-1)?.id ?? null;
		}
		this.lastClosedId = id;
		this.closeNonce += 1;
	}

	clear() {
		this.columns = [];
		this.focusedId = null;
	}

	toggleOrientation() {
		this.orientation = this.orientation === 'horizontal' ? 'vertical' : 'horizontal';
	}

	setColumnSize(columnId: string, size: number) {
		const column = this.columns.find((other) => other.id === columnId);
		if (column) column.size = clampColumnSize(size);
	}

	/** Set the first slot's share of the column's cross axis; the second takes the rest. */
	setSplit(columnId: string, firstWeight: number) {
		const column = this.columns.find((other) => other.id === columnId);
		if (!column || column.slots.length < 2) return;
		const first = Math.min(1 - MIN_SLOT_WEIGHT, Math.max(MIN_SLOT_WEIGHT, firstWeight));
		column.slots[0].weight = first;
		column.slots[1].weight = 1 - first;
	}

	/** Move focus to the previous/next column, keeping the slot row when possible. */
	focusColumn(delta: -1 | 1) {
		const columnIndex = this.columnIndexOf(this.focusedId);
		if (columnIndex === -1) {
			this.focusedId = this.columns.at(delta === 1 ? 0 : -1)?.slots[0]?.entry.id ?? null;
			return;
		}
		const next = this.columns[columnIndex + delta];
		if (!next) return;
		const located = this.locate(this.focusedId);
		const slotIndex = located ? Math.min(located.slotIndex, next.slots.length - 1) : 0;
		this.focusedId = next.slots[Math.max(0, slotIndex)]?.entry.id ?? null;
	}

	/** Move focus to the previous/next slot within the focused column. */
	focusSlot(delta: -1 | 1) {
		const located = this.locate(this.focusedId);
		if (!located) return;
		const next = located.column.slots[located.slotIndex + delta];
		if (next) this.focusedId = next.entry.id;
	}

	snapshotLayout(): LayoutSnapshot {
		return {
			orientation: this.orientation,
			focusedId: this.focusedId,
			columns: this.columns.map((column) => ({
				id: column.id,
				size: column.size,
				slots: column.slots.map((slot) => ({ id: slot.entry.id, weight: slot.weight }))
			}))
		};
	}

	/** Regroup the currently open views into the saved column layout, by id. */
	applyLayout(layout: LayoutSnapshot) {
		const entriesById: Record<string, ViewEntry> = {};
		const order: string[] = [];
		for (const column of this.columns) {
			for (const slot of column.slots) {
				if (!(slot.entry.id in entriesById)) order.push(slot.entry.id);
				entriesById[slot.entry.id] = slot.entry;
			}
		}

		const used: Record<string, true> = {};
		const columns: Column[] = [];
		for (const column of layout.columns) {
			const slots: Slot[] = [];
			for (const slot of column.slots) {
				const entry = entriesById[slot.id];
				if (!entry || used[slot.id] || slots.length >= MAX_SLOTS_PER_COLUMN) continue;
				used[slot.id] = true;
				slots.push({ entry, weight: slot.weight > 0 ? slot.weight : 1 });
			}
			if (slots.length === 0) continue;
			normalizeWeights(slots);
			columns.push({ id: this.nextColumnId(), size: clampColumnSize(column.size), slots });
		}

		for (const id of order) {
			if (used[id]) continue;
			columns.push({
				id: this.nextColumnId(),
				size: DEFAULT_COLUMN_SIZE,
				slots: [{ entry: entriesById[id], weight: 1 }]
			});
		}

		this.columns = columns;
		this.orientation = layout.orientation === 'vertical' ? 'vertical' : 'horizontal';
		this.focusedId =
			layout.focusedId && this.locate(layout.focusedId)
				? layout.focusedId
				: (this.entries.at(-1)?.id ?? null);
	}

	private toEntry(id: string, spec: ViewSpec): ViewEntry {
		return {
			id,
			title: spec.title,
			subtitle: spec.subtitle,
			component: spec.component,
			props: spec.props ?? {},
			parentId: spec.parentId
		};
	}

	private insertColumnAfter(columnIndex: number, entry: ViewEntry) {
		const column: Column = {
			id: this.nextColumnId(),
			size: DEFAULT_COLUMN_SIZE,
			slots: [{ entry, weight: 1 }]
		};
		const at = columnIndex === -1 ? this.columns.length : columnIndex + 1;
		this.columns.splice(at, 0, column);
	}

	private columnIndexOf(viewId: string | null) {
		if (!viewId) return -1;
		return this.columns.findIndex((column) =>
			column.slots.some((slot) => slot.entry.id === viewId)
		);
	}

	private locate(viewId: string | null) {
		if (!viewId) return null;
		for (const column of this.columns) {
			const slotIndex = column.slots.findIndex((slot) => slot.entry.id === viewId);
			if (slotIndex !== -1) return { column, slotIndex };
		}
		return null;
	}

	private nextViewId() {
		let id = `v${++viewCounter}`;
		while (this.locate(id)) id = `v${++viewCounter}`;
		return id;
	}

	private nextColumnId() {
		return `c${++columnCounter}`;
	}
}

export const views = new ViewStackStore();
