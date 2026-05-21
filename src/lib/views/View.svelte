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
		children,
		actions
	}: Props = $props();
</script>

<section
	class="flex h-full w-full flex-col overflow-hidden rounded-lg bg-base-100/95 shadow-sm shadow-neutral/10 outline outline-transparent transition-[box-shadow,outline-color]"
>
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
