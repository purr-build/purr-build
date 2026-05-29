<script lang="ts">
	import { views } from './stack.svelte';

	let containerEl: HTMLElement | undefined = $state();
	let containerWidth = $state(0);
	let containerHeight = $state(0);

	let horizontal = $derived(views.orientation === 'horizontal');
	let mainPx = $derived(horizontal ? containerWidth : containerHeight);
	let crossPx = $derived(horizontal ? containerHeight : containerWidth);

	type Drag =
		| { kind: 'column'; columnId: string; startSizePx: number; startPos: number }
		| { kind: 'split'; columnId: string; startFirstPx: number; startPos: number };
	let drag: Drag | null = null;

	function startColumnResize(event: PointerEvent, columnId: string) {
		event.preventDefault();
		event.stopPropagation();
		const column = views.columns.find((other) => other.id === columnId);
		if (!column || mainPx === 0) return;
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		drag = {
			kind: 'column',
			columnId,
			startSizePx: column.size * mainPx,
			startPos: horizontal ? event.clientX : event.clientY
		};
	}

	function startSplitResize(event: PointerEvent, columnId: string) {
		event.preventDefault();
		event.stopPropagation();
		const column = views.columns.find((other) => other.id === columnId);
		if (!column || column.slots.length < 2 || crossPx === 0) return;
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		drag = {
			kind: 'split',
			columnId,
			startFirstPx: column.slots[0].weight * crossPx,
			startPos: horizontal ? event.clientY : event.clientX
		};
	}

	function onPointerMove(event: PointerEvent) {
		if (!drag) return;
		if (drag.kind === 'column') {
			const delta = (horizontal ? event.clientX : event.clientY) - drag.startPos;
			views.setColumnSize(drag.columnId, (drag.startSizePx + delta) / mainPx);
		} else {
			const delta = (horizontal ? event.clientY : event.clientX) - drag.startPos;
			views.setSplit(drag.columnId, (drag.startFirstPx + delta) / crossPx);
		}
	}

	function endDrag(event: PointerEvent) {
		if (!drag) return;
		(event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
		drag = null;
	}

	// Scroll the focused window into view whenever focus changes.
	$effect(() => {
		const focusedId = views.focusedId;
		if (!focusedId || !containerEl) return;
		const el = containerEl.querySelector(`[data-view-id="${CSS.escape(focusedId)}"]`);
		el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
	});
</script>

<div
	bind:this={containerEl}
	bind:clientWidth={containerWidth}
	bind:clientHeight={containerHeight}
	class="flex h-full w-full gap-2 {horizontal
		? 'flex-row overflow-x-auto overflow-y-hidden'
		: 'flex-col overflow-x-hidden overflow-y-auto'}"
>
	{#each views.columns as column (column.id)}
		{@const sizePx = column.size * mainPx}
		<div
			class="relative flex flex-none {horizontal ? 'h-full flex-col' : 'w-full flex-row'} gap-2"
			style={horizontal ? `width:${sizePx}px` : `height:${sizePx}px`}
		>
			{#each column.slots as slot, slotIndex (slot.entry.id)}
				{@const Component = slot.entry.component}
				{@const focused = views.focusedId === slot.entry.id}
				{#if slotIndex > 0}
					<div
						class="group flex flex-none items-center justify-center {horizontal
							? '-my-1 h-2 cursor-row-resize'
							: '-mx-1 w-2 cursor-col-resize'}"
						onpointerdown={(event) => startSplitResize(event, column.id)}
						onpointermove={onPointerMove}
						onpointerup={endDrag}
						role="separator"
						aria-orientation={horizontal ? 'horizontal' : 'vertical'}
						aria-label="Resize windows"
					>
						<div
							class="rounded-full bg-base-content/15 transition-colors group-hover:bg-primary/60 {horizontal
								? 'h-1 w-10'
								: 'h-10 w-1'}"
						></div>
					</div>
				{/if}
				<div
					data-view-id={slot.entry.id}
					class="min-h-0 min-w-0 flex-1 overflow-hidden rounded-lg border-2 transition-colors {focused
						? 'border-primary'
						: 'border-transparent'}"
					style={`flex-grow:${slot.weight}`}
					onpointerdowncapture={() => views.focus(slot.entry.id)}
				>
					<Component viewId={slot.entry.id} {...slot.entry.props} />
				</div>
			{/each}

			<!-- Column resize handle: resizes the whole column and every window inside it. -->
			<div
				class="absolute z-10 {horizontal
					? 'top-0 -right-1 h-full w-2 cursor-col-resize'
					: '-bottom-1 left-0 h-2 w-full cursor-row-resize'} group flex items-center justify-center"
				onpointerdown={(event) => startColumnResize(event, column.id)}
				onpointermove={onPointerMove}
				onpointerup={endDrag}
				role="separator"
				aria-orientation={horizontal ? 'vertical' : 'horizontal'}
				aria-label="Resize column"
			>
				<div
					class="rounded-full bg-base-content/10 transition-colors group-hover:bg-primary/60 {horizontal
						? 'h-12 w-1'
						: 'h-1 w-12'}"
				></div>
			</div>
		</div>
	{/each}
</div>
