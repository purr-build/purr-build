<script lang="ts" generics="T extends string">
	import { onMount, tick } from 'svelte';
	import HeroIcon from '$lib/components/HeroIcon.svelte';

	type TabSpec = {
		id: T;
		label: string;
		count?: number | null;
	};

	type Props = {
		tabs: readonly TabSpec[];
		active: T;
		onSelect: (id: T) => void;
		className?: string;
		countStyle?: 'parenthesized' | 'plain';
		showZeroCounts?: boolean;
	};

	let {
		tabs,
		active,
		onSelect,
		className = '',
		countStyle = 'parenthesized',
		showZeroCounts = false
	}: Props = $props();

	let tablist: HTMLDivElement | undefined = $state();
	let canScrollLeft = $state(false);
	let canScrollRight = $state(false);

	function updateScrollState() {
		if (!tablist) return;

		const maxScrollLeft = tablist.scrollWidth - tablist.clientWidth;
		canScrollLeft = tablist.scrollLeft > 1;
		canScrollRight = maxScrollLeft - tablist.scrollLeft > 1;
	}

	function scrollTabs(direction: -1 | 1) {
		if (!tablist) return;

		tablist.scrollBy({
			left: direction * Math.max(160, tablist.clientWidth * 0.75),
			behavior: 'smooth'
		});
	}

	function handleScroll() {
		updateScrollState();
	}

	function scrollStateFingerprint(tabItems: readonly TabSpec[], activeTab: T) {
		return `${activeTab}:${tabItems.map((tab) => `${tab.id}:${tab.label}:${tab.count ?? ''}`).join('|')}`;
	}

	function scheduleScrollStateUpdate(fingerprint: string) {
		void tick().then(() => {
			if (fingerprint === scrollStateFingerprint(tabs, active)) updateScrollState();
		});
	}

	$effect(() => {
		scheduleScrollStateUpdate(scrollStateFingerprint(tabs, active));
	});

	onMount(() => {
		if (!tablist) return;

		const resizeObserver = new ResizeObserver(updateScrollState);
		const mutationObserver = new MutationObserver(updateScrollState);
		resizeObserver.observe(tablist);
		mutationObserver.observe(tablist, {
			attributes: true,
			characterData: true,
			childList: true,
			subtree: true
		});
		window.addEventListener('resize', updateScrollState);
		updateScrollState();

		return () => {
			window.removeEventListener('resize', updateScrollState);
			mutationObserver.disconnect();
			resizeObserver.disconnect();
		};
	});
</script>

<div class="relative min-w-0 overflow-hidden {className}">
	<div
		bind:this={tablist}
		role="tablist"
		class="tabs-lift tabs flex-nowrap overflow-x-auto overscroll-x-contain tabs-md"
		onscroll={handleScroll}
	>
		{#each tabs as tab (tab.id)}
			<button
				role="tab"
				class="tab whitespace-nowrap"
				class:tab-active={active === tab.id}
				onclick={() => onSelect(tab.id)}
			>
				<span class="inline-flex items-center gap-1 whitespace-nowrap">
					<span>{tab.label}</span>
					{#if tab.count !== undefined && tab.count !== null && (showZeroCounts || tab.count > 0)}
						<span class="shrink-0 text-base-content/50">
							{countStyle === 'plain' ? tab.count : `(${tab.count})`}
						</span>
					{/if}
				</span>
			</button>
		{/each}
	</div>

	{#if canScrollLeft}
		<div
			class="pointer-events-none absolute inset-y-0 left-0 z-20 flex w-12 items-center justify-start bg-gradient-to-r from-base-100 via-base-100/80 to-transparent pl-1"
		>
			<button
				type="button"
				class="btn pointer-events-auto btn-circle border-base-300/70 bg-base-100/70 text-base-content/80 shadow-sm backdrop-blur-md btn-xs hover:bg-base-100"
				aria-label="Scroll tabs left"
				title="Scroll left"
				onclick={() => scrollTabs(-1)}
			>
				<HeroIcon name="arrow-right" class="size-3.5 rotate-180" />
			</button>
		</div>
	{/if}

	{#if canScrollRight}
		<div
			class="pointer-events-none absolute inset-y-0 right-0 z-20 flex w-12 items-center justify-end bg-gradient-to-l from-base-100 via-base-100/80 to-transparent pr-1"
		>
			<button
				type="button"
				class="btn pointer-events-auto btn-circle border-base-300/70 bg-base-100/70 text-base-content/80 shadow-sm backdrop-blur-md btn-xs hover:bg-base-100"
				aria-label="Scroll tabs right"
				title="Scroll right"
				onclick={() => scrollTabs(1)}
			>
				<HeroIcon name="arrow-right" class="size-3.5" />
			</button>
		</div>
	{/if}
</div>
