<script lang="ts">
	import type { Snippet } from 'svelte';
	import HeroIcon from '$lib/components/HeroIcon.svelte';
	import { views } from './stack.svelte';

	type Props = {
		viewId: string;
		title: string;
		subtitle?: string;
		subtitleContent?: Snippet;
		closeable?: boolean;
		movable?: boolean;
		fullWidth?: boolean;
		children: Snippet;
		actions?: Snippet;
	};

	let {
		viewId,
		title,
		subtitle,
		subtitleContent,
		closeable = true,
		movable = true,
		fullWidth = false,
		children,
		actions
	}: Props = $props();

	let focused = $derived(views.focusedId === viewId);
	let isDragging = $derived(views.draggingId === viewId);
	let showDropBefore = $derived(views.dropTargetId === viewId && views.dropPlacement === 'before');
	let showDropAfter = $derived(views.dropTargetId === viewId && views.dropPlacement === 'after');
	let layoutSize = $derived(viewLayoutSize());

	function viewLayoutSize() {
		if (fullWidth) return 'full';
		const count = views.entries.length;
		if (count <= 1) return 'single';
		if (count === 2) return 'half';
		return 'scroll';
	}

	function focusOnPointer() {
		if (!movable) return;
		if (!focused) views.focus(viewId);
	}

	function dropPlacement(event: DragEvent): 'before' | 'after' {
		const node = event.currentTarget;
		if (!(node instanceof HTMLElement)) return 'after';

		const rect = node.getBoundingClientRect();
		const parent = node.parentElement;
		const flexDirection = parent ? getComputedStyle(parent).flexDirection : 'column';
		const isHorizontal = flexDirection.startsWith('row');
		const pointerOffset = isHorizontal ? event.clientX - rect.left : event.clientY - rect.top;
		const midpoint = isHorizontal ? rect.width / 2 : rect.height / 2;
		return pointerOffset < midpoint ? 'before' : 'after';
	}

	function startDrag(event: DragEvent) {
		views.startDrag(viewId);
		event.dataTransfer?.setData('text/plain', viewId);
		if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
	}

	function handleDragOver(event: DragEvent) {
		if (!views.draggingId) return;
		if (views.draggingId === viewId) {
			views.previewDrop(viewId, 'after');
			return;
		}
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
		views.previewDrop(viewId, dropPlacement(event));
	}

	function handleDrop(event: DragEvent) {
		const draggedId = event.dataTransfer?.getData('text/plain') || views.draggingId;
		if (!draggedId || draggedId === viewId) {
			views.clearDrag();
			return;
		}

		event.preventDefault();
		views.move(draggedId, viewId, dropPlacement(event));
		views.clearDrag();
	}
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<section
	data-view-id={viewId}
	data-layout-size={layoutSize}
	class="relative flex w-full shrink-0 snap-start flex-col overflow-hidden rounded-lg bg-base-100/95 shadow-sm shadow-neutral/10 outline outline-1 outline-transparent transition-[box-shadow,outline-color] {fullWidth
		? 'h-full min-h-0 sm:h-full sm:min-h-0'
		: 'h-auto min-h-[75svh] sm:h-full sm:min-h-0'} {focused
		? 'shadow-md outline-primary/45'
		: ''} {isDragging ? 'opacity-60' : ''}"
	onpointerdown={focusOnPointer}
	ondragover={handleDragOver}
	ondrop={handleDrop}
>
	{#if showDropBefore}
		<div
			class="pointer-events-none absolute inset-x-3 top-0 z-20 h-0.5 rounded-full bg-primary sm:inset-y-3 sm:right-auto sm:left-0 sm:h-auto sm:w-0.5"
		></div>
	{/if}
	{#if showDropAfter}
		<div
			class="pointer-events-none absolute inset-x-3 bottom-0 z-20 h-0.5 rounded-full bg-primary sm:inset-y-3 sm:right-0 sm:left-auto sm:h-auto sm:w-0.5"
		></div>
	{/if}
	<header class="flex items-start justify-between gap-2 bg-base-100/80 px-4 py-3">
		<div class="min-w-0">
			<h2 class="truncate text-sm font-semibold">{title}</h2>
			{#if subtitleContent}
				<div class="flex items-center gap-1 truncate text-xs text-base-content/60">
					{@render subtitleContent()}
				</div>
			{:else if subtitle}
				<p class="truncate text-xs text-base-content/60">{subtitle}</p>
			{/if}
		</div>
		<div class="flex items-center gap-1">
			{#if movable}
				<button
					type="button"
					class="btn btn-circle cursor-grab btn-ghost btn-xs active:cursor-grabbing"
					aria-label="Move view"
					title="Drag to move"
					draggable="true"
					ondragstart={startDrag}
					ondragend={() => views.clearDrag()}
				>
					<HeroIcon name="bars-3" />
				</button>
			{/if}
			{#if actions}
				{@render actions()}
			{/if}
			{#if closeable}
				<button
					class="btn btn-circle btn-ghost btn-xs"
					aria-label="Close view"
					onclick={() => views.close(viewId)}
				>
					<HeroIcon name="x-mark" />
				</button>
			{/if}
		</div>
	</header>
	<div class="min-h-0 flex-1 overflow-y-auto">
		{@render children()}
	</div>
</section>

<style>
	@media (min-width: 40rem) {
		section[data-layout-size='full'],
		section[data-layout-size='single'] {
			width: 100%;
			min-width: 0;
		}

		section[data-layout-size='half'] {
			width: calc((100% - 0.75rem) / 2);
			min-width: 0;
		}

		section[data-layout-size='scroll'] {
			width: 30%;
			min-width: 30%;
			max-width: 30%;
		}
	}
</style>
