<script lang="ts">
	import { browser } from '$app/environment';
	import { getAddress, isAddress, type Address } from 'viem';
	import CopyAddress from '$lib/components/CopyAddress.svelte';
	import HeroIcon from '$lib/components/HeroIcon.svelte';
	import TableScroll from '$lib/components/TableScroll.svelte';
	import {
		addTrackedHyperEvmToken,
		fetchHyperEvmBalances,
		loadTrackedHyperEvmTokens,
		removeTrackedHyperEvmToken,
		type HyperEvmBalanceRow,
		type HyperEvmBalances
	} from '$lib/hl/hyperevm-balances.js';
	import {
		HYPEREVM_NETWORKS,
		hyperEvmExplorerAddressUrl,
		hyperEvmExplorerTokenUrl
	} from '$lib/hl/hyperevm.js';
	import { hyperliquidNetwork } from '$lib/hl/network.svelte';
	import { wallet } from '$lib/stores/wallet.svelte';
	import { normalizeTrackedWalletName, TRACKED_WALLET_NAME_MAX_LENGTH } from '$lib/wallet-names.js';
	import View from '../View.svelte';
	import { views } from '../stack.svelte';

	type Props = {
		viewId: string;
		address?: Address | string | null;
		name?: string | null;
		closeable?: boolean;
		movable?: boolean;
		fullWidth?: boolean;
		editable?: boolean;
	};

	let {
		viewId,
		address = null,
		name = null,
		closeable = true,
		movable = true,
		fullWidth = false,
		editable = true
	}: Props = $props();

	let trackedTokens = $state<Address[]>([]);
	let addTokenModalOpen = $state(false);
	let tokenAddressInput = $state('');
	let tokenEditorError = $state<string | null>(null);
	let trackedWalletModalOpen = $state(false);
	let trackedWalletNameInput = $state('');
	let trackedWalletAddressInput = $state('');
	let trackedWalletEditorError = $state<string | null>(null);
	let refreshSerial = 0;
	let refreshNonce = $state(0);
	let balances = $state<{
		loading: boolean;
		error: string | null;
		data: HyperEvmBalances | null;
	}>({ loading: false, error: null, data: null });

	const trackedAddress = $derived(
		typeof address === 'string' && isAddress(address) ? getAddress(address) : null
	);
	const activeAddress = $derived(trackedAddress ?? wallet.current?.address ?? null);
	const trackedWalletName = $derived(normalizeTrackedWalletName(name));
	const viewTitle = $derived(trackedWalletName ?? 'HyperEVM');
	const networkConfig = $derived(HYPEREVM_NETWORKS[hyperliquidNetwork.current]);
	const tokenRows = $derived(balances.data?.tokens ?? []);
	const knownTokens = $derived(networkConfig.knownTokens);

	function short(address: string) {
		return `${address.slice(0, 6)}…${address.slice(-4)}`;
	}

	function refresh() {
		refreshNonce = ++refreshSerial;
	}

	function openExternal(url: string) {
		window.open(url, '_blank', 'noopener,noreferrer');
	}

	function sourceLabel(row: HyperEvmBalanceRow) {
		if (row.source === 'native') return 'Native';
		if (row.source === 'tracked+discovered') return 'Tracked + discovered';
		if (row.source === 'tracked') return 'Tracked';
		return 'Discovered';
	}

	function isTrackedToken(address: string) {
		return trackedTokens.some((token) => token.toLowerCase() === address.toLowerCase());
	}

	function trackToken(address: string) {
		trackedTokens = addTrackedHyperEvmToken(hyperliquidNetwork.current, address);
		refresh();
	}

	function untrackToken(address: string) {
		trackedTokens = removeTrackedHyperEvmToken(hyperliquidNetwork.current, address);
		refresh();
	}

	function submitToken(event: SubmitEvent) {
		event.preventDefault();
		const trimmed = tokenAddressInput.trim();
		if (!isAddress(trimmed)) {
			tokenEditorError = 'Enter a valid ERC-20 contract address.';
			return;
		}

		trackToken(getAddress(trimmed));
		closeAddTokenDialog();
	}

	function openAddTokenDialog() {
		tokenAddressInput = '';
		tokenEditorError = null;
		addTokenModalOpen = true;
	}

	function closeAddTokenDialog() {
		addTokenModalOpen = false;
		tokenAddressInput = '';
		tokenEditorError = null;
	}

	function tokenDialogController(node: HTMLDialogElement) {
		$effect(() => {
			if (addTokenModalOpen && !node.open) node.showModal();
			else if (!addTokenModalOpen && node.open) node.close();
		});
	}

	function openTrackedWalletEditor() {
		if (!activeAddress) return;
		trackedWalletNameInput = trackedWalletName ?? '';
		trackedWalletAddressInput = activeAddress;
		trackedWalletEditorError = null;
		trackedWalletModalOpen = true;
	}

	function closeTrackedWalletEditor() {
		trackedWalletModalOpen = false;
		trackedWalletNameInput = '';
		trackedWalletAddressInput = '';
		trackedWalletEditorError = null;
	}

	function trackedWalletDialogController(node: HTMLDialogElement) {
		$effect(() => {
			if (trackedWalletModalOpen && !node.open) node.showModal();
			else if (!trackedWalletModalOpen && node.open) node.close();
		});
	}

	function saveTrackedWallet(event: SubmitEvent) {
		event.preventDefault();
		const trimmed = trackedWalletAddressInput.trim();
		if (!isAddress(trimmed)) {
			trackedWalletEditorError = 'Enter a valid EVM address.';
			return;
		}

		views.updateProps(viewId, {
			address: getAddress(trimmed),
			name: normalizeTrackedWalletName(trackedWalletNameInput)
		});
		closeTrackedWalletEditor();
	}

	$effect(() => {
		trackedTokens = loadTrackedHyperEvmTokens(hyperliquidNetwork.current);
	});

	$effect(() => {
		const user = activeAddress;
		const network = hyperliquidNetwork.current;
		const tokens = trackedTokens;
		const loadKey = `${user ?? 'disconnected'}:${network}:${refreshNonce}:${tokens.join(',')}`;
		if (!user || !loadKey) {
			balances.data = null;
			return;
		}

		let cancelled = false;
		balances.loading = true;
		balances.error = null;
		void fetchHyperEvmBalances(user, network, tokens)
			.then((next) => {
				if (cancelled) return;
				balances.data = next;
				balances.error = null;
			})
			.catch((err: unknown) => {
				if (cancelled) return;
				balances.error = err instanceof Error ? err.message : 'Could not load HyperEVM balances.';
			})
			.finally(() => {
				if (!cancelled) balances.loading = false;
			});

		return () => {
			cancelled = true;
		};
	});

	$effect(() => {
		const user = activeAddress;
		const network = hyperliquidNetwork.current;
		if (!browser || !user || !network) return;

		refresh();
		const interval = window.setInterval(refresh, 30_000);
		return () => window.clearInterval(interval);
	});
</script>

<View {viewId} title={viewTitle} {closeable} {movable} {fullWidth}>
	{#snippet subtitleContent()}
		{#if trackedWalletName}
			<span>HyperEVM</span>
			<span>·</span>
		{/if}
		<span>{networkConfig.label}</span>
		{#if activeAddress}
			<span>·</span>
			<CopyAddress
				address={activeAddress}
				label={short(activeAddress)}
				notification="Wallet address copied"
				buttonClass="h-auto min-h-0 px-0 py-0 font-mono text-xs text-base-content/60 hover:text-base-content"
			/>
			{#if editable}
				<button
					type="button"
					class="btn h-auto min-h-0 px-0.5 py-0 text-xs btn-ghost btn-xs"
					aria-label="Edit tracked wallet"
					title="Edit tracked wallet"
					onclick={openTrackedWalletEditor}
				>
					<HeroIcon name="pencil-square" />
				</button>
			{/if}
		{:else}
			<span>· No wallet</span>
		{/if}
	{/snippet}

	{#snippet actions()}
		{#if activeAddress}
			<button
				type="button"
				class="btn btn-circle btn-ghost btn-xs"
				aria-label="Refresh HyperEVM balances"
				title="Refresh balances"
				disabled={balances.loading}
				onclick={refresh}
			>
				{#if balances.loading}
					<span class="loading loading-xs loading-spinner"></span>
				{:else}
					<HeroIcon name="arrow-path" />
				{/if}
			</button>
			<button
				type="button"
				class="btn btn-ghost btn-xs"
				aria-label="Track ERC-20 token"
				title="Track ERC-20 token"
				onclick={openAddTokenDialog}
			>
				Track token
			</button>
		{/if}
	{/snippet}

	<div class="space-y-3 p-3">
		{#if !activeAddress}
			<div role="alert" class="alert alert-soft text-xs alert-warning">
				<span>Connect or track an EVM address to inspect HyperEVM balances.</span>
			</div>
		{:else}
			<div class="grid gap-2 md:grid-cols-2">
				<div class="rounded-lg border border-base-300 bg-base-100 p-3">
					<p class="text-[10px] font-medium text-base-content/50 uppercase">Native HYPE</p>
					<p class="mt-1 font-mono text-lg">
						{balances.data?.native.formattedBalance ?? (balances.loading ? 'Loading…' : '—')}
					</p>
					<p class="mt-1 text-[11px] text-base-content/50">Gas token balance via eth_getBalance</p>
				</div>
				<div class="rounded-lg border border-base-300 bg-base-100 p-3">
					<p class="text-[10px] font-medium text-base-content/50 uppercase">Network</p>
					<p class="mt-1 font-mono text-sm">Chain {networkConfig.chainId}</p>
					<div class="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-base-content/50">
						<button
							type="button"
							class="link link-hover"
							onclick={() =>
								openExternal(hyperEvmExplorerAddressUrl(hyperliquidNetwork.current, activeAddress))}
						>
							Explorer
						</button>
						<span>·</span>
						<span>
							Block {balances.data?.blockNumber?.toLocaleString() ?? '—'}
						</span>
					</div>
				</div>
			</div>

			{#if balances.loading && !balances.data}
				<div class="flex items-center justify-center py-8">
					<span class="loading loading-sm loading-spinner"></span>
				</div>
			{/if}

			{#if balances.error}
				<div role="alert" class="alert alert-soft text-xs alert-error">
					<span>{balances.error}</span>
				</div>
			{/if}

			{#if balances.data?.discoveryError}
				<div role="alert" class="alert alert-soft text-xs alert-warning">
					<span>
						Explorer token discovery failed: {balances.data.discoveryError} Tracked tokens can still be
						refreshed through RPC.
					</span>
				</div>
			{/if}

			<div class="flex flex-wrap items-center justify-between gap-2 px-1">
				<div>
					<h3 class="text-xs font-semibold text-base-content/70 uppercase">ERC-20 balances</h3>
					<p class="text-[11px] text-base-content/50">
						Discovered with HyperScan, refreshed with HyperEVM multicall.
					</p>
				</div>
				<button class="btn btn-outline btn-xs" onclick={openAddTokenDialog}>Track token</button>
			</div>

			{#if tokenRows.length === 0 && !balances.loading}
				<div
					class="rounded-lg border border-dashed border-base-300 p-4 text-sm text-base-content/60"
				>
					No ERC-20 balances discovered. Track a token contract to keep checking it even when the
					balance is zero.
				</div>
			{:else if tokenRows.length > 0}
				<TableScroll>
					<table class="table table-md">
						<thead>
							<tr class="text-[10px] text-base-content/50 uppercase">
								<th>Token</th>
								<th class="text-right">Balance</th>
								<th>Source</th>
								<th>Contract</th>
								<th>Status</th>
								<th></th>
							</tr>
						</thead>
						<tbody>
							{#each tokenRows as row (row.key)}
								<tr>
									<td class="max-w-48">
										<div class="truncate text-sm font-medium" title={row.symbol}>{row.symbol}</div>
										{#if row.name && row.name !== row.symbol}
											<div class="truncate text-[11px] text-base-content/50" title={row.name}>
												{row.name}
											</div>
										{/if}
									</td>
									<td class="text-right font-mono">{row.formattedBalance}</td>
									<td class="text-[11px] whitespace-nowrap text-base-content/60">
										{sourceLabel(row)}
									</td>
									<td class="whitespace-nowrap">
										<CopyAddress address={row.contractAddress} />
									</td>
									<td class="max-w-56 text-[11px]">
										{#if row.error}
											<span class="text-warning" title={row.error}>RPC fallback used</span>
										{:else}
											<span class="text-success/80">OK</span>
										{/if}
									</td>
									<td class="text-right whitespace-nowrap">
										{#if row.contractAddress}
											<button
												type="button"
												class="btn h-auto min-h-0 px-1 py-0 text-xs btn-ghost btn-xs"
												onclick={() =>
													row.contractAddress &&
													openExternal(
														hyperEvmExplorerTokenUrl(
															hyperliquidNetwork.current,
															row.contractAddress
														)
													)}
											>
												Open
											</button>
											{#if row.tracked}
												<button
													type="button"
													class="btn h-auto min-h-0 px-1 py-0 text-xs btn-ghost btn-xs"
													onclick={() => row.contractAddress && untrackToken(row.contractAddress)}
												>
													Untrack
												</button>
											{:else}
												<button
													type="button"
													class="btn h-auto min-h-0 px-1 py-0 text-xs btn-ghost btn-xs"
													onclick={() => row.contractAddress && trackToken(row.contractAddress)}
												>
													Track
												</button>
											{/if}
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</TableScroll>
			{/if}
		{/if}
	</div>
</View>

<dialog {@attach tokenDialogController} class="modal" onclose={closeAddTokenDialog}>
	<div class="modal-box max-w-md">
		<div class="flex items-center justify-between">
			<h3 class="text-lg font-bold">Track HyperEVM token</h3>
			<form method="dialog">
				<button class="btn btn-circle btn-ghost btn-sm" aria-label="Close">
					<HeroIcon name="x-mark" />
				</button>
			</form>
		</div>
		<p class="mt-2 text-sm text-base-content/60">
			Add an ERC-20 contract to refresh it through HyperEVM RPC even when explorer discovery does
			not return it.
		</p>

		{#if knownTokens.length > 0}
			<div class="mt-4 flex flex-wrap gap-2">
				{#each knownTokens as token (token.address)}
					<button
						type="button"
						class="btn btn-outline btn-xs"
						disabled={isTrackedToken(token.address)}
						onclick={() => {
							trackToken(token.address);
							closeAddTokenDialog();
						}}
					>
						Track {token.symbol}
					</button>
				{/each}
			</div>
		{/if}

		<form class="mt-4 space-y-3" onsubmit={submitToken}>
			<label class="floating-label">
				<span>Token contract</span>
				<input
					type="text"
					class="input-bordered input w-full font-mono text-sm"
					placeholder="0x..."
					bind:value={tokenAddressInput}
					spellcheck="false"
					autocomplete="off"
				/>
			</label>
			<button
				type="submit"
				class="btn w-full btn-primary"
				disabled={tokenAddressInput.trim() === ''}
			>
				Track token
			</button>
		</form>

		{#if tokenEditorError}
			<div role="alert" class="mt-4 alert alert-soft text-sm alert-error">
				<span>{tokenEditorError}</span>
			</div>
		{/if}
	</div>
	<form method="dialog" class="modal-backdrop">
		<button aria-label="Close">close</button>
	</form>
</dialog>

<dialog {@attach trackedWalletDialogController} class="modal" onclose={closeTrackedWalletEditor}>
	<div class="modal-box max-w-md">
		<div class="flex items-center justify-between">
			<h3 class="text-lg font-bold">Edit HyperEVM wallet</h3>
			<form method="dialog">
				<button class="btn btn-circle btn-ghost btn-sm" aria-label="Close">
					<HeroIcon name="x-mark" />
				</button>
			</form>
		</div>

		<form class="mt-5 space-y-3" onsubmit={saveTrackedWallet}>
			<label class="floating-label">
				<span>Name (Optional)</span>
				<input
					type="text"
					class="input-bordered input w-full text-sm"
					placeholder="Optional"
					bind:value={trackedWalletNameInput}
					maxlength={TRACKED_WALLET_NAME_MAX_LENGTH}
					autocomplete="off"
				/>
			</label>
			<label class="floating-label">
				<span>Address</span>
				<input
					type="text"
					class="input-bordered input w-full font-mono text-sm"
					placeholder="0x..."
					bind:value={trackedWalletAddressInput}
					spellcheck="false"
					autocomplete="off"
				/>
			</label>
			<button type="submit" class="btn w-full btn-primary">Save</button>
		</form>

		{#if trackedWalletEditorError}
			<div role="alert" class="mt-4 alert alert-soft text-sm alert-error">
				<span>{trackedWalletEditorError}</span>
			</div>
		{/if}
	</div>
	<form method="dialog" class="modal-backdrop">
		<button aria-label="Close">close</button>
	</form>
</dialog>
