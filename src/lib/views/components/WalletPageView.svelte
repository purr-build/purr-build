<script lang="ts">
	import { page } from '$app/state';
	import { getAddress, isAddress, type Address } from 'viem';
	import L1CoreView from './L1CoreView.svelte';

	type Props = {
		paramName?: string;
		viewIdPrefix?: string;
	};
	type ParsedWallets = {
		valid: Address[];
		invalid: string[];
	};

	let { paramName = 'address', viewIdPrefix = 'wallet' }: Props = $props();

	let rawAddress = $derived((page.params as Record<string, string | undefined>)[paramName] ?? '');
	let walletInputs = $derived(walletInputsForPage(rawAddress, page.url.searchParams));
	let parsedWallets = $derived(parseWalletInputs(walletInputs));
	let wallets = $derived(parsedWallets.valid);
	let initialTab = $derived(page.url.hash);
	let pageTitle = $derived(titleForWallets(wallets, parsedWallets.invalid));

	function walletInputsForPage(pathAddress: string, searchParams: URLSearchParams) {
		const queryWallets = [...searchParams.getAll('wallet'), ...searchParams.getAll('wallets')]
			.map((value) => value.trim())
			.filter(Boolean);
		return queryWallets.length > 0 ? queryWallets : pathAddress ? [pathAddress] : [];
	}

	function parseWalletInputs(values: string[]): ParsedWallets {
		const seen: Record<string, true> = {};
		const valid: Address[] = [];
		const invalid: string[] = [];

		for (const value of values) {
			const trimmed = value.trim();
			if (!trimmed) continue;
			if (!isAddress(trimmed)) {
				invalid.push(trimmed);
				continue;
			}

			const address = getAddress(trimmed);
			const key = address.toLowerCase();
			if (seen[key]) continue;
			seen[key] = true;
			valid.push(address);
		}

		return { valid, invalid };
	}

	function titleForWallets(valid: Address[], invalid: string[]) {
		if (valid.length === 1) return `${shortAddress(valid[0])} | purr.build`;
		if (valid.length > 1) return `${valid.length} wallets | purr.build`;
		return invalid.length > 0 ? 'Invalid wallet | purr.build' : 'Wallet | purr.build';
	}

	function shortAddress(address: string) {
		return `${address.slice(0, 6)}...${address.slice(-4)}`;
	}

	function viewIdForWallet(address: Address, index: number) {
		return `${viewIdPrefix}-${address.toLowerCase()}-${index}`;
	}
</script>

<svelte:head>
	<title>{pageTitle}</title>
</svelte:head>

<div class="h-[calc(100svh-3.5rem-1.5rem)] min-w-0">
	{#if wallets.length > 0}
		<div class="flex h-full min-w-0 flex-col gap-2">
			{#if parsedWallets.invalid.length > 0}
				<div role="alert" class="alert alert-soft text-xs alert-warning">
					<span>
						Ignored invalid wallet{parsedWallets.invalid.length === 1 ? '' : 's'}:
						{parsedWallets.invalid.join(', ')}
					</span>
				</div>
			{/if}

			<div
				class="min-h-0 flex-1 {wallets.length > 1
					? 'grid min-w-0 gap-3 lg:grid-cols-2'
					: 'min-w-0'}"
			>
				{#each wallets as wallet, index (wallet)}
					<div class="h-full min-h-0 min-w-0">
						<L1CoreView
							viewId={viewIdForWallet(wallet, index)}
							address={wallet}
							name={wallets.length > 1 ? shortAddress(wallet) : null}
							closeable={false}
							movable={false}
							fullWidth={true}
							editable={false}
							{initialTab}
							syncTabHash={true}
						/>
					</div>
				{/each}
			</div>
		</div>
	{:else}
		<section
			class="flex h-full w-full items-center justify-center rounded-lg bg-base-100/95 p-4 shadow-sm shadow-neutral/10"
		>
			<div class="w-full max-w-md rounded-lg border border-base-300 bg-base-100 p-5">
				<h1 class="text-base font-semibold">Invalid wallet</h1>
				<p class="mt-2 text-sm break-all text-base-content/60">
					{walletInputs.join(', ') || 'Missing wallet'} is not a valid EVM address.
				</p>
			</div>
		</section>
	{/if}
</div>
