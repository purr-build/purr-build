import type { Component } from 'svelte';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyComponent = Component<any>;

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

let counter = 0;

class ViewStackStore {
	entries = $state<ViewEntry[]>([]);
	focusedId = $state<string | null>(null);
	lastClosedId = $state<string | null>(null);
	closeNonce = $state(0);
	draggingId = $state<string | null>(null);
	dropTargetId = $state<string | null>(null);
	dropPlacement = $state<'before' | 'after' | null>(null);

	open(spec: ViewSpec): string {
		const id = spec.id ?? this.nextId();
		const existing = this.entries.findIndex((e) => e.id === id);
		const next: ViewEntry = {
			id,
			title: spec.title,
			subtitle: spec.subtitle,
			component: spec.component,
			props: spec.props ?? {},
			parentId: spec.parentId
		};
		if (existing !== -1) {
			this.entries = [
				...this.entries.slice(0, existing),
				next,
				...this.entries.slice(existing + 1)
			];
		} else {
			this.entries = [...this.entries, next];
		}
		this.focusedId = id;
		return id;
	}

	openAfter(parentId: string, spec: ViewSpec): string {
		const idx = this.entries.findIndex((e) => e.id === parentId);
		if (idx === -1) return this.open(spec);
		const id = spec.id ?? this.nextId();
		const next: ViewEntry = {
			id,
			title: spec.title,
			subtitle: spec.subtitle,
			component: spec.component,
			props: spec.props ?? {},
			parentId
		};
		this.entries = [...this.entries.slice(0, idx + 1), next, ...this.entries.slice(idx + 1)];
		this.focusedId = id;
		return id;
	}

	updateProps(id: string, props: Record<string, unknown>) {
		const idx = this.entries.findIndex((e) => e.id === id);
		if (idx === -1) return;

		const entry = this.entries[idx];
		this.entries = [
			...this.entries.slice(0, idx),
			{
				...entry,
				props: {
					...entry.props,
					...props
				}
			},
			...this.entries.slice(idx + 1)
		];
	}

	move(draggedId: string, targetId: string, placement: 'before' | 'after') {
		if (draggedId === targetId) return;

		const moving = this.entries.find((entry) => entry.id === draggedId);
		if (!moving || !this.entries.some((entry) => entry.id === targetId)) return;

		const withoutMoving = this.entries.filter((entry) => entry.id !== draggedId);
		const targetIndex = withoutMoving.findIndex((entry) => entry.id === targetId);
		if (targetIndex === -1) return;

		const insertIndex = placement === 'after' ? targetIndex + 1 : targetIndex;
		this.entries = [
			...withoutMoving.slice(0, insertIndex),
			moving,
			...withoutMoving.slice(insertIndex)
		];
		this.focusedId = draggedId;
	}

	close(id: string) {
		const idx = this.entries.findIndex((e) => e.id === id);
		if (idx === -1) return;
		const closing = this.descendantIds(id);
		this.entries = this.entries.filter((entry) => !closing[entry.id]);
		if (!this.entries.some((entry) => entry.id === this.focusedId)) {
			this.focusedId = this.entries.at(Math.max(0, idx - 1))?.id ?? this.entries.at(-1)?.id ?? null;
		}
		this.lastClosedId = id;
		this.closeNonce += 1;
	}

	focus(id: string) {
		if (this.entries.some((e) => e.id === id)) this.focusedId = id;
	}

	clear() {
		this.entries = [];
		this.focusedId = null;
		this.clearDrag();
	}

	startDrag(id: string) {
		if (!this.entries.some((entry) => entry.id === id)) return;
		this.draggingId = id;
		this.dropTargetId = null;
		this.dropPlacement = null;
	}

	previewDrop(targetId: string, placement: 'before' | 'after') {
		if (!this.draggingId || this.draggingId === targetId) {
			this.dropTargetId = null;
			this.dropPlacement = null;
			return;
		}
		this.dropTargetId = targetId;
		this.dropPlacement = placement;
	}

	clearDrag() {
		this.draggingId = null;
		this.dropTargetId = null;
		this.dropPlacement = null;
	}

	private descendantIds(id: string) {
		const closing: Record<string, true> = { [id]: true };
		let changed = true;
		while (changed) {
			changed = false;
			for (const entry of this.entries) {
				if (!entry.parentId || closing[entry.id] || !closing[entry.parentId]) continue;
				closing[entry.id] = true;
				changed = true;
			}
		}
		return closing;
	}

	private nextId() {
		let id = '';
		do {
			id = `v${++counter}`;
		} while (this.entries.some((entry) => entry.id === id));
		return id;
	}
}

export const views = new ViewStackStore();
