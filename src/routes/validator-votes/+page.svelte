<script lang="ts">
	import SupportFooter from '$lib/components/SupportFooter.svelte';
	import ValidatorVotes from '$lib/components/ValidatorVotes.svelte';
	import { hyperliquidNetwork } from '$lib/hl/network.svelte';
</script>

<svelte:head>
	<title>Validator Votes | purr.build</title>
	<meta
		name="description"
		content="Inspect active Hyperliquid L1 validator votes, governance actions, and quorum status."
	/>
</svelte:head>

<div class="flex min-h-[calc(100svh-3.5rem-1.5rem)] flex-col gap-3">
	<section
		class="mx-auto w-full max-w-7xl flex-1 rounded-lg bg-base-100 shadow-sm shadow-neutral/5"
	>
		<header class="border-b border-base-300 px-4 py-3">
			<h1 class="text-base font-semibold tracking-tight">Validator votes</h1>
			<p class="mt-0.5 text-xs text-base-content/55">
				Active L1 governance actions and the validators voting for them.
			</p>
		</header>
		{#key hyperliquidNetwork.current}
			<ValidatorVotes network={hyperliquidNetwork.current} />
		{/key}
	</section>
	<SupportFooter />
</div>
