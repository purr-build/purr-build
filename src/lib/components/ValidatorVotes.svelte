<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import CopyAddress from '$lib/components/CopyAddress.svelte';
	import HeroIcon from '$lib/components/HeroIcon.svelte';
	import { getHttpInfoClient } from '$lib/hl/clients.js';
	import { HYPERLIQUID_NETWORKS, type HyperliquidNetwork } from '$lib/hl/network.svelte';

	type Props = {
		network: HyperliquidNetwork;
	};

	type ValidatorVote = {
		expireTime: number;
		action: Record<string, unknown>;
		votes: string[];
		quorumReached?: boolean;
	};

	type Settlement = {
		outcome: number | null;
		settleFraction: string | null;
		details: string | null;
		name: string | null;
		description: string | null;
		sideNames: string[];
	};

	let { network }: Props = $props();
	let validatorVotes = $state<ValidatorVote[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let lastLoadedAt = $state<number | null>(null);
	let requestGeneration = 0;
	let activeController: AbortController | null = null;

	let quorumCount = $derived(validatorVotes.filter((vote) => vote.quorumReached === true).length);
	let validatorCount = $derived(new Set(validatorVotes.flatMap((vote) => vote.votes)).size);

	function isRecord(value: unknown): value is Record<string, unknown> {
		return value !== null && typeof value === 'object' && !Array.isArray(value);
	}

	function normalizedVotes(value: unknown): ValidatorVote[] {
		if (!Array.isArray(value)) throw new Error('Validator votes returned an invalid response.');

		return value.map((entry) => {
			if (!isRecord(entry)) throw new Error('Validator votes returned an invalid record.');
			if (typeof entry.expireTime !== 'number' || !isRecord(entry.action)) {
				throw new Error('Validator votes returned an invalid record.');
			}
			if (!Array.isArray(entry.votes) || !entry.votes.every((vote) => typeof vote === 'string')) {
				throw new Error('Validator votes returned an invalid voter list.');
			}

			return {
				expireTime: entry.expireTime,
				action: entry.action,
				votes: entry.votes,
				...(typeof entry.quorumReached === 'boolean' ? { quorumReached: entry.quorumReached } : {})
			};
		});
	}

	async function loadValidatorVotes(clear = false) {
		const generation = ++requestGeneration;
		activeController?.abort();
		activeController = new AbortController();
		loading = true;
		error = null;
		if (clear) validatorVotes = [];

		try {
			const response: unknown = await getHttpInfoClient(network).validatorL1Votes(
				activeController.signal
			);
			if (generation !== requestGeneration) return;
			validatorVotes = normalizedVotes(response);
			lastLoadedAt = Date.now();
		} catch (err) {
			if (generation !== requestGeneration || activeController.signal.aborted) return;
			error = err instanceof Error ? err.message : 'Failed to load validator votes.';
		} finally {
			if (generation === requestGeneration) loading = false;
		}
	}

	function settlementFor(vote: ValidatorVote): Settlement | null {
		const oracleAction = vote.action.O;
		if (!isRecord(oracleAction) || !isRecord(oracleAction.settleOutcome)) return null;

		const settlement = oracleAction.settleOutcome;
		const nameAndDescription = Array.isArray(settlement.nameAndDescription)
			? settlement.nameAndDescription
			: [];
		const sideNames = Array.isArray(settlement.sideNames)
			? settlement.sideNames.filter((side): side is string => typeof side === 'string')
			: [];

		return {
			outcome: typeof settlement.outcome === 'number' ? settlement.outcome : null,
			settleFraction:
				typeof settlement.settleFraction === 'string' ? settlement.settleFraction : null,
			details: typeof settlement.details === 'string' ? settlement.details : null,
			name: typeof nameAndDescription[0] === 'string' ? nameAndDescription[0] : null,
			description: typeof nameAndDescription[1] === 'string' ? nameAndDescription[1] : null,
			sideNames
		};
	}

	function actionType(vote: ValidatorVote) {
		return Object.keys(vote.action)[0] ?? 'Unknown';
	}

	function actionValue(vote: ValidatorVote) {
		const value = vote.action[actionType(vote)];
		if (typeof value === 'string') return value;
		if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
			return value.join(', ');
		}
		return null;
	}

	function formatDateTime(value: number) {
		return new Intl.DateTimeFormat(undefined, {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(new Date(value));
	}

	function formatLoadedAt(value: number) {
		return new Intl.DateTimeFormat(undefined, { timeStyle: 'medium' }).format(new Date(value));
	}

	onMount(() => {
		void loadValidatorVotes(true);
	});

	onDestroy(() => {
		requestGeneration += 1;
		activeController?.abort();
	});
</script>

<div class="space-y-3 p-3">
	<div class="flex flex-wrap items-center justify-between gap-2 px-1">
		<div class="flex flex-wrap items-center gap-2 text-xs text-base-content/55">
			<span class="badge badge-ghost badge-sm">
				{HYPERLIQUID_NETWORKS[network].label}
			</span>
			{#if lastLoadedAt}
				<span>Updated {formatLoadedAt(lastLoadedAt)}</span>
			{/if}
		</div>
		<button
			class="btn btn-ghost btn-xs"
			aria-label="Refresh validator votes"
			disabled={loading}
			onclick={() => loadValidatorVotes()}
		>
			{#if loading}
				<span class="loading loading-xs loading-spinner"></span>
			{:else}
				<HeroIcon name="arrow-path" />
			{/if}
			Refresh
		</button>
	</div>

	{#if error}
		<div role="alert" class="alert alert-soft py-2 text-xs alert-error">
			<span>{error}</span>
		</div>
	{/if}

	{#if loading && validatorVotes.length === 0}
		<div class="flex items-center justify-center gap-2 py-12 text-sm text-base-content/55">
			<span class="loading loading-sm loading-spinner"></span>
			Loading validator votes…
		</div>
	{:else}
		<div class="grid grid-cols-3 gap-px overflow-hidden rounded-lg bg-base-200/70">
			<div class="bg-base-100 px-3 py-2.5">
				<div class="text-[10px] font-medium tracking-wider text-base-content/40 uppercase">
					Actions
				</div>
				<div class="mt-0.5 font-mono text-sm font-medium">{validatorVotes.length}</div>
			</div>
			<div class="bg-base-100 px-3 py-2.5">
				<div class="text-[10px] font-medium tracking-wider text-base-content/40 uppercase">
					Quorum
				</div>
				<div class="mt-0.5 font-mono text-sm font-medium">{quorumCount}</div>
			</div>
			<div class="bg-base-100 px-3 py-2.5">
				<div class="text-[10px] font-medium tracking-wider text-base-content/40 uppercase">
					Validators
				</div>
				<div class="mt-0.5 font-mono text-sm font-medium">{validatorCount}</div>
			</div>
		</div>

		{#if validatorVotes.length === 0}
			<div class="rounded-lg border border-base-300 bg-base-100 p-8 text-center">
				<p class="text-sm font-medium">No validator votes</p>
				<p class="mt-1 text-xs text-base-content/55">
					Hyperliquid returned no active L1 validator votes for
					{HYPERLIQUID_NETWORKS[network].label.toLowerCase()}.
				</p>
			</div>
		{:else}
			<div class="space-y-3">
				{#each validatorVotes as vote, index (`${vote.expireTime}-${index}`)}
					{@const settlement = settlementFor(vote)}
					<article class="rounded-lg border border-base-300 bg-base-100 p-3 sm:p-4">
						<div class="flex flex-wrap items-start justify-between gap-3">
							<div class="min-w-0">
								<div class="flex flex-wrap items-center gap-2">
									<span class="badge badge-ghost badge-xs">Action {actionType(vote)}</span>
									{#if settlement?.outcome !== null && settlement?.outcome !== undefined}
										<span class="font-mono text-[11px] text-base-content/50">
											Outcome #{settlement.outcome}
										</span>
									{/if}
								</div>
								<h2 class="mt-2 text-sm leading-5 font-semibold sm:text-base">
									{settlement?.name ?? `Validator action ${actionType(vote)}`}
								</h2>
							</div>
							{#if vote.quorumReached === true}
								<span class="badge badge-soft badge-sm badge-success">Quorum reached</span>
							{:else if vote.quorumReached === false}
								<span class="badge badge-soft badge-sm badge-warning">Awaiting quorum</span>
							{:else}
								<span class="badge badge-ghost badge-sm">Quorum not reported</span>
							{/if}
						</div>

						<div class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-base-content/50">
							<span>Expires {formatDateTime(vote.expireTime)}</span>
							<span>{vote.votes.length} validator {vote.votes.length === 1 ? 'vote' : 'votes'}</span
							>
							{#if settlement?.settleFraction}
								<span>Settle fraction {settlement.settleFraction}</span>
							{/if}
						</div>

						{#if settlement?.sideNames.length}
							<div class="mt-3 flex flex-wrap gap-1.5">
								{#each settlement.sideNames as side (side)}
									<span class="badge badge-outline badge-sm">{side}</span>
								{/each}
							</div>
						{/if}

						{#if settlement?.details}
							<p class="mt-3 text-xs leading-5 text-base-content/70">{settlement.details}</p>
						{:else if actionValue(vote)}
							<p class="mt-3 font-mono text-xs leading-5 break-words text-base-content/70">
								{actionValue(vote)}
							</p>
						{/if}

						<div class="mt-3 space-y-2 border-t border-base-300 pt-3">
							<details>
								<summary class="cursor-pointer text-xs font-medium text-base-content/65">
									Validator votes ({vote.votes.length})
								</summary>
								<div class="mt-2 grid gap-1 sm:grid-cols-2 xl:grid-cols-3">
									{#each vote.votes as address (address)}
										<CopyAddress
											{address}
											notification="Validator address copied"
											buttonClass="btn h-auto min-h-0 w-fit max-w-full justify-start px-1 py-1 font-mono text-[11px] btn-ghost btn-xs"
										/>
									{/each}
								</div>
							</details>

							{#if settlement?.description}
								<details>
									<summary class="cursor-pointer text-xs font-medium text-base-content/65">
										Market description
									</summary>
									<p class="mt-2 text-xs leading-5 text-base-content/60">
										{settlement.description}
									</p>
								</details>
							{/if}

							<details>
								<summary class="cursor-pointer text-xs font-medium text-base-content/65">
									Raw action
								</summary>
								<pre
									class="mt-2 max-h-80 overflow-auto rounded bg-base-200 p-2 text-[10px] leading-4">{JSON.stringify(
										vote.action,
										null,
										2
									)}</pre>
							</details>
						</div>
					</article>
				{/each}
			</div>
		{/if}
	{/if}
</div>
