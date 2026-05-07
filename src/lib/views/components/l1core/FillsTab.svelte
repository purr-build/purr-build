<script lang="ts">
	import CopyAddress from '$lib/components/CopyAddress.svelte';
	import LoadableState from './LoadableState.svelte';
	import SortIcon from './SortIcon.svelte';

	type FillSide = 'B' | 'A';
	type FillSortKey =
		| 'coin'
		| 'side'
		| 'size'
		| 'price'
		| 'value'
		| 'fee'
		| 'closedPnl'
		| 'liquidity'
		| 'time'
		| 'oid'
		| 'tid';
	type Loadable<T> = { loading: boolean; error: string | null; data: T | null };
	type FillTableRow = {
		key: string;
		coin: string;
		side: FillSide;
		size: number | null;
		price: number | null;
		value: number | null;
		fee: number | null;
		feeToken: string | null;
		closedPnl: number | null;
		liquidity: string;
		direction: string | null;
		time: number | null;
		oid: number | null;
		tid: number | null;
		hash: string | null;
	};
	type Props = {
		ctx: {
			fills: Loadable<unknown[]>;
			fillTableRows: () => FillTableRow[];
			setFillSort: (key: FillSortKey) => void;
			fillSortIndicator: (key: FillSortKey) => 'chevron-up' | 'chevron-down' | null;
			formatTokenAmount: (value: number | null) => string;
			formatPrice: (value: number | null) => string;
			formatUsd: (value: number | null) => string;
			formatSignedUsd: (value: number | null) => string;
			formatSignedTokenAmount: (value: number | null, token: string | null) => string;
			pnlClass: (value: number | null) => string;
			orderSideLabel: (side: FillSide) => string;
			orderSideClass: (side: FillSide) => string;
			fmtTs: (time: number) => string;
		};
	};

	let { ctx }: Props = $props();
</script>

<LoadableState
	loading={ctx.fills.loading}
	error={ctx.fills.error}
	hasData={ctx.fills.data !== null}
/>
{#if ctx.fills.data}
	{#if ctx.fills.data.length === 0}
		<p class="p-4 text-sm text-base-content/60">No fills.</p>
	{:else}
		<div class="overflow-x-auto">
			<table class="table table-xs">
				<thead>
					<tr class="text-[10px] text-base-content/50 uppercase">
						<th>
							<button
								type="button"
								class="btn h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
								onclick={() => ctx.setFillSort('coin')}
							>
								Coin <SortIcon name={ctx.fillSortIndicator('coin')} />
							</button>
						</th>
						<th>
							<button
								type="button"
								class="btn h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
								onclick={() => ctx.setFillSort('side')}
							>
								Side <SortIcon name={ctx.fillSortIndicator('side')} />
							</button>
						</th>
						<th class="text-right">
							<button
								type="button"
								class="btn ml-auto h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
								onclick={() => ctx.setFillSort('size')}
							>
								Size <SortIcon name={ctx.fillSortIndicator('size')} />
							</button>
						</th>
						<th class="text-right">
							<button
								type="button"
								class="btn ml-auto h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
								onclick={() => ctx.setFillSort('price')}
							>
								Price <SortIcon name={ctx.fillSortIndicator('price')} />
							</button>
						</th>
						<th class="text-right">
							<button
								type="button"
								class="btn ml-auto h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
								onclick={() => ctx.setFillSort('value')}
							>
								Value <SortIcon name={ctx.fillSortIndicator('value')} />
							</button>
						</th>
						<th class="text-right">
							<button
								type="button"
								class="btn ml-auto h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
								onclick={() => ctx.setFillSort('fee')}
							>
								Fee <SortIcon name={ctx.fillSortIndicator('fee')} />
							</button>
						</th>
						<th class="text-right">
							<button
								type="button"
								class="btn ml-auto h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
								onclick={() => ctx.setFillSort('closedPnl')}
							>
								Closed PnL
								<SortIcon name={ctx.fillSortIndicator('closedPnl')} />
							</button>
						</th>
						<th>
							<button
								type="button"
								class="btn h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
								onclick={() => ctx.setFillSort('liquidity')}
							>
								Liquidity
								<SortIcon name={ctx.fillSortIndicator('liquidity')} />
							</button>
						</th>
						<th>
							<button
								type="button"
								class="btn h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
								onclick={() => ctx.setFillSort('time')}
							>
								Time <SortIcon name={ctx.fillSortIndicator('time')} />
							</button>
						</th>
						<th class="text-right">
							<button
								type="button"
								class="btn ml-auto h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
								onclick={() => ctx.setFillSort('oid')}
							>
								OID <SortIcon name={ctx.fillSortIndicator('oid')} />
							</button>
						</th>
						<th class="text-right">
							<button
								type="button"
								class="btn ml-auto h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
								onclick={() => ctx.setFillSort('tid')}
							>
								TID <SortIcon name={ctx.fillSortIndicator('tid')} />
							</button>
						</th>
						<th>Tx</th>
					</tr>
				</thead>
				<tbody>
					{#each ctx.fillTableRows() as row (row.key)}
						<tr>
							<td class="max-w-44">
								<div class="truncate text-sm font-medium" title={row.coin}>{row.coin}</div>
								{#if row.direction}
									<div class="truncate text-[10px] text-base-content/50" title={row.direction}>
										{row.direction}
									</div>
								{/if}
							</td>
							<td>
								<span class="badge badge-xs {ctx.orderSideClass(row.side)}">
									{ctx.orderSideLabel(row.side)}
								</span>
							</td>
							<td class="text-right font-mono">{ctx.formatTokenAmount(row.size)}</td>
							<td class="text-right font-mono">{ctx.formatPrice(row.price)}</td>
							<td class="text-right font-mono">{ctx.formatUsd(row.value)}</td>
							<td class="text-right font-mono {ctx.pnlClass(row.fee == null ? null : -row.fee)}">
								{ctx.formatSignedTokenAmount(row.fee, row.feeToken)}
							</td>
							<td class="text-right font-mono {ctx.pnlClass(row.closedPnl)}">
								{ctx.formatSignedUsd(row.closedPnl)}
							</td>
							<td class="whitespace-nowrap">{row.liquidity}</td>
							<td class="text-[11px] whitespace-nowrap">
								{row.time == null ? '—' : ctx.fmtTs(row.time)}
							</td>
							<td class="text-right font-mono">{row.oid ?? '—'}</td>
							<td class="text-right font-mono">{row.tid ?? '—'}</td>
							<td class="whitespace-nowrap">
								<CopyAddress
									address={row.hash}
									notification="Transaction hash copied"
									emptyLabel="—"
								/>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
{/if}
