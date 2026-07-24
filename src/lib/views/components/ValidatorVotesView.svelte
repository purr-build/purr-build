<script lang="ts">
	import ValidatorVotes from '$lib/components/ValidatorVotes.svelte';
	import { hyperliquidNetwork } from '$lib/hl/network.svelte';
	import View from '../View.svelte';

	type Props = {
		viewId: string;
	};

	let { viewId }: Props = $props();
</script>

<View {viewId} title="Validator Votes">
	{#snippet subtitleContent()}
		<span>L1 governance actions and validator participation</span>
	{/snippet}

	{#key hyperliquidNetwork.current}
		<ValidatorVotes network={hyperliquidNetwork.current} />
	{/key}
</View>
