<script lang="ts">
	import HeroIcon from '$lib/components/HeroIcon.svelte';

	type Props = {
		name: 'chevron-up' | 'chevron-down' | null;
	};

	let { name }: Props = $props();
</script>

<span class="inline-flex w-2 justify-center align-middle">
	<HeroIcon {name} class="size-2.5" strokeWidth={3} />
</span>
