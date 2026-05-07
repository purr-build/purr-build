<script lang="ts">
	import HeroIcon from '$lib/components/HeroIcon.svelte';
	import View from './View.svelte';
	import { views } from './stack.svelte';
	import Self from './Panel.svelte';

	type Props = {
		viewId: string;
	};

	let { viewId }: Props = $props();

	let position = $derived(views.entries.findIndex((e) => e.id === viewId) + 1);

	function addRight() {
		views.openAfter(viewId, {
			title: 'Panel',
			component: Self,
			props: {}
		});
	}
</script>

<View {viewId} title="Panel {position}" subtitle="id: {viewId}">
	<div class="flex h-full flex-col items-center justify-center gap-3 p-6">
		<p class="text-center text-sm text-base-content/60">Empty panel.</p>
		<button class="btn btn-sm btn-primary" onclick={addRight}>
			Add panel to right
			<HeroIcon name="arrow-right" />
		</button>
	</div>
</View>
