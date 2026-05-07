<script lang="ts">
	import { views } from './stack.svelte';

	function scrollFocused(node: HTMLDivElement) {
		$effect(() => {
			const id = views.focusedId;
			if (!id) return;
			const el = node.querySelector(`[data-view-id="${id}"]`);
			if (el instanceof HTMLElement) {
				el.scrollIntoView({ behavior: 'smooth', inline: 'end', block: 'nearest' });
			}
		});
	}
</script>

<div
	{@attach scrollFocused}
	class="flex h-full flex-col gap-3 overflow-y-auto pb-2 sm:snap-x sm:snap-mandatory sm:flex-row sm:overflow-x-auto sm:overflow-y-hidden sm:pb-3"
>
	{#each views.entries as entry (entry.id)}
		{@const Comp = entry.component}
		<Comp viewId={entry.id} {...entry.props} />
	{/each}
</div>
