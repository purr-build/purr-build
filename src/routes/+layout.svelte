<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import './layout.css';
	import Header from '$lib/components/Header.svelte';
	import { hyperliquidNetwork } from '$lib/hl/network.svelte';
	import { wallet } from '$lib/stores/wallet.svelte';

	const { children } = $props();
	let appliedHloa = $state<string | null>(null);

	onMount(() => {
		wallet.hydrate();
		hyperliquidNetwork.hydrate();
	});

	$effect(() => {
		const hloa = page.url.searchParams.get('hloa')?.trim();
		if (!hloa || hloa === appliedHloa) return;

		appliedHloa = hloa;
		if (!wallet.hasStoredWallet() && (!wallet.current || wallet.current.source === 'manual')) {
			wallet.setManual(hloa, { persist: false });
		}
	});

	$effect(() => {
		if (!browser || wallet.current?.source !== 'injected' || !page.url.searchParams.has('hloa')) {
			return;
		}

		const next = new URL(page.url);
		next.searchParams.delete('hloa');
		window.history.replaceState(
			window.history.state,
			'',
			`${next.pathname}${next.search}${next.hash}`
		);
	});
</script>

<svelte:head>
	<title>purr.build</title>
	<meta name="description" content="Tools for building on Hyperliquid." />
</svelte:head>

<div class="min-h-screen bg-base-200 text-base-content">
	<Header />
	<main class="px-3 py-3">
		{@render children()}
	</main>
</div>
