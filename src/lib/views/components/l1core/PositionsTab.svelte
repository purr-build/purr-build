<script lang="ts">
	import LoadableState from './LoadableState.svelte';
	import SortIcon from './SortIcon.svelte';

	type PositionSortKey =
		| 'coin'
		| 'size'
		| 'positionValue'
		| 'entryPrice'
		| 'markPrice'
		| 'pnl'
		| 'liqPrice'
		| 'margin'
		| 'funding';
	type Loadable<T> = { loading: boolean; error: string | null; data: T | null };
	type PositionTableRow = {
		key: string;
		coin: string;
		size: number | null;
		positionValue: number | null;
		entryPrice: number | null;
		markPrice: number | null;
		pnlDollars: number | null;
		pnlPercent: number | null;
		liquidationPrice: number | null;
		margin: number | null;
		marginType: 'Isolated' | 'Cross' | null;
		funding: number | null;
	};
	type Props = {
		ctx: {
			positions: Loadable<unknown[]>;
			positionTableRows: () => PositionTableRow[];
			setPositionSort: (key: PositionSortKey) => void;
			positionSortIndicator: (key: PositionSortKey) => 'chevron-up' | 'chevron-down' | null;
			formatTokenAmount: (value: number | null) => string;
			formatUsd: (value: number | null) => string;
			formatPrice: (value: number | null) => string;
			formatLiquidationPrice: (value: number | null) => string;
			formatMargin: (value: number | null, type: PositionTableRow['marginType']) => string;
			formatSignedUsd: (value: number | null) => string;
			formatSignedPercent: (value: number | null) => string;
			pnlClass: (value: number | null) => string;
			sizeClass: (value: number | null) => string;
		};
	};

	let { ctx }: Props = $props();
</script>

<LoadableState
	loading={ctx.positions.loading}
	error={ctx.positions.error}
	hasData={ctx.positions.data !== null}
/>
{#if ctx.positions.data}
	{#if ctx.positions.data.length === 0}
		<p class="p-4 text-sm text-base-content/60">No open positions.</p>
	{:else}
		<div class="overflow-x-auto">
			<table class="table table-xs">
				<thead>
					<tr class="text-[10px] text-base-content/50 uppercase">
						<th>
							<button
								type="button"
								class="btn h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
								onclick={() => ctx.setPositionSort('coin')}
							>
								Coin <SortIcon name={ctx.positionSortIndicator('coin')} />
							</button>
						</th>
						<th class="text-right">
							<button
								type="button"
								class="btn ml-auto h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
								onclick={() => ctx.setPositionSort('size')}
							>
								Size <SortIcon name={ctx.positionSortIndicator('size')} />
							</button>
						</th>
						<th class="text-right">
							<button
								type="button"
								class="btn ml-auto h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
								onclick={() => ctx.setPositionSort('positionValue')}
							>
								Position value
								<SortIcon name={ctx.positionSortIndicator('positionValue')} />
							</button>
						</th>
						<th class="text-right">
							<button
								type="button"
								class="btn ml-auto h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
								onclick={() => ctx.setPositionSort('entryPrice')}
							>
								Entry price
								<SortIcon name={ctx.positionSortIndicator('entryPrice')} />
							</button>
						</th>
						<th class="text-right">
							<button
								type="button"
								class="btn ml-auto h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
								onclick={() => ctx.setPositionSort('markPrice')}
							>
								Mark price
								<SortIcon name={ctx.positionSortIndicator('markPrice')} />
							</button>
						</th>
						<th class="text-right">
							<button
								type="button"
								class="btn ml-auto h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
								onclick={() => ctx.setPositionSort('pnl')}
							>
								PnL $ (%)
								<SortIcon name={ctx.positionSortIndicator('pnl')} />
							</button>
						</th>
						<th class="text-right">
							<button
								type="button"
								class="btn ml-auto h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
								onclick={() => ctx.setPositionSort('liqPrice')}
							>
								Liq price
								<SortIcon name={ctx.positionSortIndicator('liqPrice')} />
							</button>
						</th>
						<th class="text-right">
							<button
								type="button"
								class="btn ml-auto h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
								onclick={() => ctx.setPositionSort('margin')}
							>
								Margin
								<SortIcon name={ctx.positionSortIndicator('margin')} />
							</button>
						</th>
						<th class="text-right">
							<button
								type="button"
								class="btn ml-auto h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
								onclick={() => ctx.setPositionSort('funding')}
							>
								Funding
								<SortIcon name={ctx.positionSortIndicator('funding')} />
							</button>
						</th>
					</tr>
				</thead>
				<tbody>
					{#each ctx.positionTableRows() as row (row.key)}
						<tr>
							<td class="max-w-44">
								<div class="truncate text-sm font-medium" title={row.coin}>{row.coin}</div>
							</td>
							<td class="text-right font-mono {ctx.sizeClass(row.size)}">
								{ctx.formatTokenAmount(row.size)}
							</td>
							<td class="text-right font-mono">{ctx.formatUsd(row.positionValue)}</td>
							<td class="text-right font-mono">{ctx.formatPrice(row.entryPrice)}</td>
							<td class="text-right font-mono">{ctx.formatPrice(row.markPrice)}</td>
							<td class="text-right font-mono {ctx.pnlClass(row.pnlDollars)}">
								{ctx.formatSignedUsd(row.pnlDollars)}
								<span class="text-[10px] opacity-70">
									({ctx.formatSignedPercent(row.pnlPercent)})
								</span>
							</td>
							<td class="text-right font-mono">
								{ctx.formatLiquidationPrice(row.liquidationPrice)}
							</td>
							<td class="text-right font-mono">{ctx.formatMargin(row.margin, row.marginType)}</td>
							<td class="text-right font-mono {ctx.pnlClass(row.funding)}">
								{ctx.formatSignedUsd(row.funding)}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
{/if}
