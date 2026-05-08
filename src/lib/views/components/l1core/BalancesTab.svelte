<script lang="ts">
	import CopyAddress from '$lib/components/CopyAddress.svelte';
	import TableScroll from '$lib/components/TableScroll.svelte';
	import LoadableState from './LoadableState.svelte';
	import SortIcon from './SortIcon.svelte';

	type BalanceSortKey = 'coin' | 'total' | 'available' | 'usdcValue' | 'pnl' | 'contract';
	type BalanceTableRow = {
		key: string;
		coin: string;
		total: number | null;
		available: number | null;
		usdcValue: number | null;
		pnlDollars: number | null;
		pnlPercent: number | null;
		contractAddress: string | null;
	};
	type Props = {
		ctx: {
			balanceTabHasData: () => boolean;
			balanceTabHasRows: () => boolean;
			balanceTabLoading: () => boolean;
			balanceTabError: () => string;
			balanceTableRows: () => BalanceTableRow[];
			setBalanceSort: (key: BalanceSortKey) => void;
			balanceSortIndicator: (key: BalanceSortKey) => 'chevron-up' | 'chevron-down' | null;
			formatTokenAmount: (value: number | null) => string;
			formatUsd: (value: number | null) => string;
			formatSignedUsd: (value: number | null) => string;
			formatSignedPercent: (value: number | null) => string;
			pnlClass: (value: number | null) => string;
		};
	};

	let { ctx }: Props = $props();
</script>

<LoadableState
	loading={ctx.balanceTabLoading()}
	error={ctx.balanceTabError()}
	hasData={ctx.balanceTabHasData()}
/>
{#if ctx.balanceTabHasData()}
	{#if !ctx.balanceTabHasRows()}
		<p class="p-4 text-sm text-base-content/60">No balances.</p>
	{:else}
		<TableScroll>
			<table class="table table-md">
				<thead>
					<tr class="text-[10px] text-base-content/50 uppercase">
						<th>
							<button
								type="button"
								class="btn h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
								onclick={() => ctx.setBalanceSort('coin')}
							>
								Coin <SortIcon name={ctx.balanceSortIndicator('coin')} />
							</button>
						</th>
						<th class="text-right">
							<button
								type="button"
								class="btn ml-auto h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
								onclick={() => ctx.setBalanceSort('total')}
							>
								Total balance
								<SortIcon name={ctx.balanceSortIndicator('total')} />
							</button>
						</th>
						<th class="text-right">
							<button
								type="button"
								class="btn ml-auto h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
								onclick={() => ctx.setBalanceSort('available')}
							>
								Available balance
								<SortIcon name={ctx.balanceSortIndicator('available')} />
							</button>
						</th>
						<th class="text-right">
							<button
								type="button"
								class="btn ml-auto h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
								onclick={() => ctx.setBalanceSort('usdcValue')}
							>
								USDC value
								<SortIcon name={ctx.balanceSortIndicator('usdcValue')} />
							</button>
						</th>
						<th class="text-right">
							<button
								type="button"
								class="btn ml-auto h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
								onclick={() => ctx.setBalanceSort('pnl')}
							>
								PnL $ (%)
								<SortIcon name={ctx.balanceSortIndicator('pnl')} />
							</button>
						</th>
						<th>
							<button
								type="button"
								class="btn h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
								onclick={() => ctx.setBalanceSort('contract')}
							>
								Contract address
								<SortIcon name={ctx.balanceSortIndicator('contract')} />
							</button>
						</th>
					</tr>
				</thead>
				<tbody>
					{#each ctx.balanceTableRows() as row (row.key)}
						<tr>
							<td class="max-w-44">
								<div class="truncate text-sm font-medium" title={row.coin}>{row.coin}</div>
							</td>
							<td class="text-right font-mono">{ctx.formatTokenAmount(row.total)}</td>
							<td class="text-right font-mono">{ctx.formatTokenAmount(row.available)}</td>
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
