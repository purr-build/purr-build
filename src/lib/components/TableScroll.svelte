<script lang="ts">
	import { onMount, tick, type Snippet } from 'svelte';
	import HeroIcon from './HeroIcon.svelte';

	type Props = {
		children: Snippet;
		class?: string;
		scrollerClass?: string;
		maxHeight?: string;
		fill?: boolean;
		viewport?: HTMLDivElement | null;
		clientHeight?: number;
		onscroll?: (event: Event) => void;
	};

	let {
		children,
		class: className = '',
		scrollerClass = '',
		maxHeight = 'min(36rem, calc(100svh - 14rem))',
		fill = false,
		viewport = $bindable(),
		clientHeight = $bindable(0),
		onscroll
	}: Props = $props();

	let scroller: HTMLDivElement | undefined = $state();
	let canScrollLeft = $state(false);
	let canScrollRight = $state(false);

	function updateScrollState() {
		if (!scroller) return;

		const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth;
		const nextClientHeight = scroller.clientHeight;
		canScrollLeft = scroller.scrollLeft > 1;
		canScrollRight = maxScrollLeft - scroller.scrollLeft > 1;
		if (clientHeight !== nextClientHeight) clientHeight = nextClientHeight;
	}

	function handleScroll(event: Event) {
		updateScrollState();
		onscroll?.(event);
	}

	function scrollHorizontal(direction: -1 | 1) {
		if (!scroller) return;

		scroller.scrollBy({
			left: direction * Math.max(240, scroller.clientWidth * 0.75),
			behavior: 'smooth'
		});
	}

	$effect(() => {
		if (!scroller) return;
		if (viewport !== scroller) viewport = scroller;
		tick().then(updateScrollState);
	});

	onMount(() => {
		if (!scroller) return;

		let observedChild: Element | null = null;
		const resizeObserver = new ResizeObserver(() => updateScrollState());
		const observeChild = () => {
			const child = scroller?.firstElementChild ?? null;
			if (child === observedChild) return;
			if (observedChild) resizeObserver.unobserve(observedChild);
			observedChild = child;
			if (observedChild) resizeObserver.observe(observedChild);
		};
		const mutationObserver = new MutationObserver(() => {
			observeChild();
			updateScrollState();
		});

		resizeObserver.observe(scroller);
		observeChild();
		mutationObserver.observe(scroller, { childList: true });
		window.addEventListener('resize', updateScrollState);
		updateScrollState();

		return () => {
			window.removeEventListener('resize', updateScrollState);
			mutationObserver.disconnect();
			resizeObserver.disconnect();
		};
	});
</script>

<div class="table-scroll relative min-h-0 overflow-hidden {fill ? 'flex-1' : ''} {className}">
	<div
		bind:this={scroller}
		class="table-scroll-viewport min-h-0 overflow-auto overscroll-contain {fill
			? 'h-full'
			: ''} {scrollerClass}"
		style={fill ? undefined : `max-height: ${maxHeight}`}
		onscroll={handleScroll}
	>
		{@render children()}
	</div>

	{#if canScrollLeft}
		<div
			class="pointer-events-none absolute inset-y-0 left-0 z-20 flex w-14 items-center justify-start bg-gradient-to-r from-base-100 via-base-100/80 to-transparent pl-1"
		>
			<button
				type="button"
				class="btn pointer-events-auto btn-circle border-base-300/70 bg-base-100/70 text-base-content/80 shadow-sm backdrop-blur-md btn-xs hover:bg-base-100"
				aria-label="Scroll table left"
				title="Scroll left"
				onclick={() => scrollHorizontal(-1)}
			>
				<HeroIcon name="arrow-right" class="size-3.5 rotate-180" />
			</button>
		</div>
	{/if}

	{#if canScrollRight}
		<div
			class="pointer-events-none absolute inset-y-0 right-0 z-20 flex w-14 items-center justify-end bg-gradient-to-l from-base-100 via-base-100/80 to-transparent pr-1"
		>
			<button
				type="button"
				class="btn pointer-events-auto btn-circle border-base-300/70 bg-base-100/70 text-base-content/80 shadow-sm backdrop-blur-md btn-xs hover:bg-base-100"
				aria-label="Scroll table right"
				title="Scroll right"
				onclick={() => scrollHorizontal(1)}
			>
				<HeroIcon name="arrow-right" class="size-3.5" />
			</button>
		</div>
	{/if}
</div>

<style>
	.table-scroll-viewport {
		scrollbar-gutter: stable;
	}

	.table-scroll-viewport :global(thead) {
		position: sticky;
		top: 0;
		z-index: 10;
	}
</style>
