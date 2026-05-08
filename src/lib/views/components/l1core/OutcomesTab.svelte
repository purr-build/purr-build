<script lang="ts">
	import CopyAddress from '$lib/components/CopyAddress.svelte';
	import TableScroll from '$lib/components/TableScroll.svelte';
	import LoadableState from './LoadableState.svelte';
	import SortIcon from './SortIcon.svelte';

	type OutcomeSortKey =
		| 'market'
		| 'side'
		| 'coin'
		| 'total'
		| 'markPrice'
		| 'usdcValue'
		| 'pnl'
		| 'contract';
	type Loadable<T> = { loading: boolean; error: string | null; data: T | null };
	type OutcomeTableRow = {
		key: string;
		market: string;
		side: string;
		coin: string;
		total: number | null;
		markPrice: number | null;
		usdcValue: number | null;
		pnlDollars: number | null;
		pnlPercent: number | null;
		contractAddress: string | null;
	};
	type Props = {
		ctx: {
			outcomes: Loadable<unknown[]>;
			outcomeTableRows: () => OutcomeTableRow[];
			setOutcomeSort: (key: OutcomeSortKey) => void;
			outcomeSortIndicator: (key: OutcomeSortKey) => 'chevron-up' | 'chevron-down' | null;
			formatTokenAmount: (value: number | null) => string;
			formatPrice: (value: number | null) => string;
			formatUsd: (value: number | null) => string;
			formatSignedUsd: (value: number | null) => string;
			formatSignedPercent: (value: number | null) => string;
			pnlClass: (value: number | null) => string;
		};
	};

	let { ctx }: Props = $props();
</script>

<LoadableState
	loading={ctx.outcomes.loading}
	error={ctx.outcomes.error}
	hasData={ctx.outcomes.data !== null}
/>
{#if ctx.outcomes.data}
	{#if ctx.outcomes.data.length === 0}
		<p class="p-4 text-sm text-base-content/60">No outcome positions.</p>
	{:else}
		<TableScroll>
			<table class="table table-md">
				<thead>
					<tr class="text-[10px] text-base-content/50 uppercase">
						<th>
							<button
								type="button"
								class="btn h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
								onclick={() => ctx.setOutcomeSort('market')}
							>
								Market
								<SortIcon name={ctx.outcomeSortIndicator('market')} />
							</button>
						</th>
						<th>
							<button
								type="button"
								class="btn h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
								onclick={() => ctx.setOutcomeSort('side')}
							>
								Side <SortIcon name={ctx.outcomeSortIndicator('side')} />
							</button>
						</th>
						<th>
							<button
								type="button"
								class="btn h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
								onclick={() => ctx.setOutcomeSort('coin')}
							>
								Coin <SortIcon name={ctx.outcomeSortIndicator('coin')} />
							</button>
						</th>
						<th class="text-right">
							<button
								type="button"
								class="btn ml-auto h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
								onclick={() => ctx.setOutcomeSort('total')}
							>
								Total
								<SortIcon name={ctx.outcomeSortIndicator('total')} />
							</button>
						</th>
						<th class="text-right">
							<button
								type="button"
								class="btn ml-auto h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
								onclick={() => ctx.setOutcomeSort('markPrice')}
							>
								Mark price
								<SortIcon name={ctx.outcomeSortIndicator('markPrice')} />
							</button>
						</th>
						<th class="text-right">
							<button
								type="button"
								class="btn ml-auto h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
								onclick={() => ctx.setOutcomeSort('usdcValue')}
							>
								USDC value
								<SortIcon name={ctx.outcomeSortIndicator('usdcValue')} />
							</button>
						</th>
						<th class="text-right">
							<button
								type="button"
								class="btn ml-auto h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
								onclick={() => ctx.setOutcomeSort('pnl')}
							>
								PnL $ (%)
								<SortIcon name={ctx.outcomeSortIndicator('pnl')} />
							</button>
						</th>
						<th>
							<button
								type="button"
								class="btn h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
								onclick={() => ctx.setOutcomeSort('contract')}
							>
								Contract address
								<SortIcon name={ctx.outcomeSortIndicator('contract')} />
							</button>
						</th>
					</tr>
				</thead>
				<tbody>
					{#each ctx.outcomeTableRows() as row (row.key)}
						<tr>
							<td class="max-w-72">
								<div class="truncate text-sm font-medium" title={row.market}>
									{row.market}
								</div>
							</td>
							<td class="whitespace-nowrap">{row.side}</td>
							<td class="max-w-44">
								<div class="truncate font-mono text-xs" title={row.coin}>{row.coin}</div>
							</td>
							<td class="text-right font-mono">{ctx.formatTokenAmount(row.total)}</td>
							<td class="text-right font-mono">{ctx.formatPrice(row.markPrice)}</td>
							<td class="text-right font-mono">{ctx.formatUsd(row.usdcValue)}</td>
							<td class="text-right font-mono {ctx.pnlClass(row.pnlDollars)}">
								{ctx.formatSignedUsd(row.pnlDollars)}
								<span class="text-[10px] opacity-70">
									({ctx.formatSignedPercent(row.pnlPercent)})
								</span>
							</td>
							<td class="whitespace-nowrap">
								<CopyAddress address={row.contractAddress} />
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</TableScroll>
	{/if}
{/if}
