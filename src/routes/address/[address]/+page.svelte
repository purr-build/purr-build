<script lang="ts">
	import { page } from '$app/state';
	import { getAddress, isAddress } from 'viem';
	import L1CoreView from '$lib/views/components/L1CoreView.svelte';

	const rawAddress = $derived(page.params.address ?? '');
	const inspectedAddress = $derived(isAddress(rawAddress) ? getAddress(rawAddress) : null);
	const pageTitle = $derived(
		inspectedAddress
			? `${shortAddress(inspectedAddress)} | purr.build`
			: 'Invalid address | purr.build'
	);

	function shortAddress(address: string) {
		return `${address.slice(0, 6)}...${address.slice(-4)}`;
	}
</script>

<svelte:head>
	<title>{pageTitle}</title>
</svelte:head>

<div class="h-[calc(100svh-3.5rem-1.5rem)] min-w-0">
	{#if inspectedAddress}
		<L1CoreView
			viewId="address-l1-core"
			address={inspectedAddress}
			closeable={false}
			movable={false}
			fullWidth={true}
			editable={false}
		/>
	{:else}
		<section
			class="flex h-full w-full items-center justify-center rounded-lg bg-base-100/95 p-4 shadow-sm shadow-neutral/10"
		>
			<div class="w-full max-w-md rounded-lg border border-base-300 bg-base-100 p-5">
				<h1 class="text-base font-semibold">Invalid address</h1>
				<p class="mt-2 text-sm break-all text-base-content/60">
					{rawAddress || 'Missing address'} is not a valid EVM address.
				</p>
			</div>
		</section>
	{/if}
</div>
