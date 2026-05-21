<script lang="ts">
	import { views } from './stack.svelte';
	import { mount, unmount, onDestroy } from 'svelte';
	import { GridStack, type GridStackWidget } from 'gridstack';
	import 'gridstack/dist/gridstack.css';
	import { SvelteMap } from 'svelte/reactivity';

	const STORAGE_KEY = 'purrbuild:gridstack-layout';

	function loadSavedPositions(): Map<string, GridStackWidget> {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) return new Map();
			const items = JSON.parse(raw) as GridStackWidget[];
			return new Map(items.filter((i) => i.id).map((i) => [i.id as string, i]));
		} catch {
			return new Map();
		}
	}

	function saveLayout() {
		if (!grid) return;
		const items = grid.save(false) as GridStackWidget[];
		localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
	}

	let gridEl: HTMLElement | undefined = $state();
	let grid: GridStack | undefined;
	const mounted = new SvelteMap<string, Record<string, unknown>>();
	const savedPositions = loadSavedPositions();

	$effect(() => {
		if (!gridEl) return;

		if (!grid) {
			grid = GridStack.init({ handle: 'header' }, gridEl);
			grid.on('change', saveLayout);
		}

		const currentIds = new Set(views.entries.map((e) => e.id));

		for (const [id, comp] of mounted) {
			if (!currentIds.has(id)) {
				unmount(comp);
				const widgetEl = gridEl.querySelector(`[gs-id="${id}"]`) as HTMLElement | null;
				if (widgetEl) grid.removeWidget(widgetEl);
				mounted.delete(id);
			}
		}

		for (const entry of views.entries) {
			if (mounted.has(entry.id)) continue;

			const saved = savedPositions.get(entry.id);
			const savedPos = saved ? { x: saved.x, y: saved.y, w: saved.w, h: saved.h } : {};

			// entry.gridPos wins for locked/minW/etc; saved pos wins for x/y/w/h
			const widget = grid.addWidget({ id: entry.id, w: 6, h: 4, ...entry.gridPos, ...savedPos });
			const contentEl = widget.querySelector('.grid-stack-item-content')!;

			const comp = mount(entry.component, {
				target: contentEl,
				props: { viewId: entry.id, ...entry.props }
			});

			mounted.set(entry.id, comp);
		}
	});

	onDestroy(() => {
		for (const [, comp] of mounted) unmount(comp);
		mounted.clear();
		grid?.destroy(false);
	});
</script>

<div class="grid-stack h-full" bind:this={gridEl}></div>
