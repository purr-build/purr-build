<script lang="ts">
	import CopyAddress from '$lib/components/CopyAddress.svelte';
	import HeroIcon from '$lib/components/HeroIcon.svelte';
	import TableScroll from '$lib/components/TableScroll.svelte';
	import LoadableState from './LoadableState.svelte';

	type Loadable<T> = { loading: boolean; error: string | null; data: T | null };
	type LedgerTableRow = {
		key: string;
		time: number | null;
		hash: string | null;
		type: string;
		label: string;
		amount: string;
		amountValue: number | null;
		details: LedgerDetailItem[];
	};
	type LedgerDetailItem = {
		key: string;
		label: string;
		value: string;
		address: string | null;
	};
	type Props = {
		ctx: {
			ledgerUpdates: Loadable<unknown[]>;
			ledgerTableRows: () => LedgerTableRow[];
			ledgerCanLoadNewer: () => boolean;
			ledgerCanLoadOlder: () => boolean;
			ledgerRangeLabel: () => string;
			loadNewerLedgerUpdates: () => Promise<void>;
			loadOlderLedgerUpdates: () => Promise<void>;
			refreshLedgerUpdates: () => Promise<void>;
			fmtTs: (time: number) => string;
			pnlClass: (value: number | null) => string;
			short: (value: string) => string;
		};
	};

	let { ctx }: Props = $props();

	function badgeClass(value: number | null) {
		if (value == null || value === 0) return 'badge-ghost';
		return value > 0 ? 'badge-success' : 'badge-error';
	}

	function detailKey(row: LedgerTableRow, detail: LedgerDetailItem, index: number) {
		return `${row.key}:${detail.key}:${index}`;
	}

	function shouldShowRawType(row: LedgerTableRow) {
		return normalizedEventText(row.label) !== normalizedEventText(row.type);
	}

	function normalizedEventText(value: string) {
		return value.replace(/[^a-z0-9]/gi, '').toLowerCase();
	}
</script>

{#snippet paginationControls()}
	<div class="flex flex-wrap items-center justify-end gap-2">
		<span class="text-[11px] whitespace-nowrap text-base-content/50">
			{ctx.ledgerRangeLabel()}
		</span>
		<div class="join">
			<button
				type="button"
				class="btn join-item btn-ghost btn-xs"
				disabled={!ctx.ledgerCanLoadNewer() || ctx.ledgerUpdates.loading}
				aria-label="Load newer ledger updates"
				title="Load newer ledger updates"
				onclick={() => void ctx.loadNewerLedgerUpdates()}
			>
				<HeroIcon name="arrow-right" class="size-3 rotate-180" />
				<span>Newer</span>
			</button>
			<button
				type="button"
				class="btn join-item btn-ghost btn-xs"
				disabled={ctx.ledgerUpdates.loading}
				aria-label="Reload ledger updates"
				title="Reload ledger updates"
				onclick={() => void ctx.refreshLedgerUpdates()}
			>
				{#if ctx.ledgerUpdates.loading}
					<span class="loading loading-xs loading-spinner"></span>
				{:else}
					<HeroIcon name="arrow-path" class="size-3" />
				{/if}
			</button>
			<button
				type="button"
				class="btn join-item btn-ghost btn-xs"
				disabled={!ctx.ledgerCanLoadOlder() || ctx.ledgerUpdates.loading}
				aria-label="Load older ledger updates"
				title="Load older ledger updates"
				onclick={() => void ctx.loadOlderLedgerUpdates()}
			>
				<span>Older</span>
				<HeroIcon name="arrow-right" class="size-3" />
			</button>
		</div>
	</div>
{/snippet}

<div class="space-y-3 p-2">
	<LoadableState
		loading={ctx.ledgerUpdates.loading}
		error={ctx.ledgerUpdates.error}
		hasData={ctx.ledgerUpdates.data !== null}
	/>
	{#if ctx.ledgerUpdates.data}
		{@const rows = ctx.ledgerTableRows()}
		<div class="flex items-center justify-between gap-2 px-1">
			<h3 class="text-xs font-semibold text-base-content/70 uppercase">Ledger updates</h3>
			{@render paginationControls()}
		</div>

		{#if rows.length === 0}
			<div role="alert" class="alert alert-soft text-xs">
				<span>No non-funding ledger updates.</span>
			</div>
		{:else}
			<TableScroll class="rounded-lg border border-base-300 bg-base-100">
				<table class="table table-md">
					<thead>
						<tr class="text-[10px] text-base-content/50 uppercase">
							<th>Time</th>
							<th>Event</th>
							<th class="text-right">Amount</th>
							<th>Details</th>
							<th>Tx</th>
						</tr>
					</thead>
					<tbody>
						{#each rows as row (row.key)}
							<tr>
								<td class="text-[11px] whitespace-nowrap">
									{row.time == null ? '—' : ctx.fmtTs(row.time)}
								</td>
								<td class="min-w-40">
									<span class="badge badge-xs {badgeClass(row.amountValue)}">
										{row.label}
									</span>
									{#if shouldShowRawType(row)}
										<div class="mt-0.5 font-mono text-[10px] text-base-content/40">
											{row.type}
										</div>
									{/if}
								</td>
								<td class="text-right font-mono whitespace-nowrap {ctx.pnlClass(row.amountValue)}">
									{row.amount}
								</td>
								<td class="max-w-[42rem] min-w-[22rem]">
									{#if row.details.length === 0}
										<span class="text-base-content/40">—</span>
									{:else}
										<div class="flex flex-wrap gap-1.5">
											{#each row.details as detail, index (detailKey(row, detail, index))}
												<span
													class="inline-flex max-w-full items-center gap-1 rounded-md border border-base-300 bg-base-200/35 px-1.5 py-0.5 text-[11px]"
												>
													<span class="shrink-0 text-base-content/45">{detail.label}</span>
													{#if detail.address}
														<CopyAddress
															address={detail.address}
															label={ctx.short(detail.address)}
															notification={`${detail.label} copied`}
															buttonClass="h-auto min-h-0 px-0 py-0 font-mono text-[11px] text-base-content/75 hover:text-base-content"
														/>
													{:else}
														<span
															class="truncate font-mono text-base-content/75"
															title={detail.value}
														>
															{detail.value}
														</span>
													{/if}
												</span>
											{/each}
										</div>
									{/if}
								</td>
								<td class="whitespace-nowrap">
									<CopyAddress
										address={row.hash}
										label={row.hash ? ctx.short(row.hash) : undefined}
										notification="Transaction hash copied"
										emptyLabel="—"
									/>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</TableScroll>

			<div class="px-1">
				{@render paginationControls()}
			</div>
		{/if}
	{/if}
</div>
