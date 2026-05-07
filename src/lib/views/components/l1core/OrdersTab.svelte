<script lang="ts">
	import LoadableState from './LoadableState.svelte';
	import SortIcon from './SortIcon.svelte';

	type OrderSide = 'B' | 'A';
	type OrderSortKey =
		| 'coin'
		| 'side'
		| 'size'
		| 'origSize'
		| 'price'
		| 'value'
		| 'type'
		| 'tif'
		| 'reduceOnly'
		| 'time'
		| 'oid';
	type Loadable<T> = { loading: boolean; error: string | null; data: T | null };
	type OrderTableRow = {
		key: string;
		coin: string;
		side: OrderSide;
		size: number | null;
		origSize: number | null;
		price: number | null;
		value: number | null;
		type: string;
		tif: string | null;
		reduceOnly: boolean;
		time: number | null;
		oid: number | null;
	};
	type Props = {
		ctx: {
			orders: Loadable<unknown[]>;
			orderTableRows: () => OrderTableRow[];
			setOrderSort: (key: OrderSortKey) => void;
			orderSortIndicator: (key: OrderSortKey) => 'chevron-up' | 'chevron-down' | null;
			formatTokenAmount: (value: number | null) => string;
			formatPrice: (value: number | null) => string;
			formatUsd: (value: number | null) => string;
			formatOrderFlag: (value: boolean) => string;
			orderSideLabel: (side: OrderSide) => string;
			orderSideClass: (side: OrderSide) => string;
			fmtTs: (time: number) => string;
		};
	};

	let { ctx }: Props = $props();
</script>

<LoadableState
	loading={ctx.orders.loading}
	error={ctx.orders.error}
	hasData={ctx.orders.data !== null}
/>
{#if ctx.orders.data}
	{#if ctx.orders.data.length === 0}
		<p class="p-4 text-sm text-base-content/60">No open orders.</p>
	{:else}
		<div class="overflow-x-auto">
			<table class="table table-xs">
				<thead>
					<tr class="text-[10px] text-base-content/50 uppercase">
						<th>
							<button
								type="button"
								class="btn h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
								onclick={() => ctx.setOrderSort('coin')}
							>
								Coin <SortIcon name={ctx.orderSortIndicator('coin')} />
							</button>
						</th>
						<th>
							<button
								type="button"
								class="btn h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
								onclick={() => ctx.setOrderSort('side')}
							>
								Side <SortIcon name={ctx.orderSortIndicator('side')} />
							</button>
						</th>
						<th class="text-right">
							<button
								type="button"
								class="btn ml-auto h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
								onclick={() => ctx.setOrderSort('size')}
							>
								Size <SortIcon name={ctx.orderSortIndicator('size')} />
							</button>
						</th>
						<th class="text-right">
							<button
								type="button"
								class="btn ml-auto h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
								onclick={() => ctx.setOrderSort('origSize')}
							>
								Original size
								<SortIcon name={ctx.orderSortIndicator('origSize')} />
							</button>
						</th>
						<th class="text-right">
							<button
								type="button"
								class="btn ml-auto h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
								onclick={() => ctx.setOrderSort('price')}
							>
								Limit price
								<SortIcon name={ctx.orderSortIndicator('price')} />
							</button>
						</th>
						<th class="text-right">
							<button
								type="button"
								class="btn ml-auto h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
								onclick={() => ctx.setOrderSort('value')}
							>
								Value <SortIcon name={ctx.orderSortIndicator('value')} />
							</button>
						</th>
						<th>
							<button
								type="button"
								class="btn h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
								onclick={() => ctx.setOrderSort('type')}
							>
								Type <SortIcon name={ctx.orderSortIndicator('type')} />
							</button>
						</th>
						<th>
							<button
								type="button"
								class="btn h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
								onclick={() => ctx.setOrderSort('tif')}
							>
								TIF <SortIcon name={ctx.orderSortIndicator('tif')} />
							</button>
						</th>
						<th>
							<button
								type="button"
								class="btn h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
								onclick={() => ctx.setOrderSort('reduceOnly')}
							>
								Reduce only
								<SortIcon name={ctx.orderSortIndicator('reduceOnly')} />
							</button>
						</th>
						<th>
							<button
								type="button"
								class="btn h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
								onclick={() => ctx.setOrderSort('time')}
							>
								Time <SortIcon name={ctx.orderSortIndicator('time')} />
							</button>
						</th>
						<th class="text-right">
							<button
								type="button"
								class="btn ml-auto h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
								onclick={() => ctx.setOrderSort('oid')}
							>
								OID <SortIcon name={ctx.orderSortIndicator('oid')} />
							</button>
						</th>
					</tr>
				</thead>
				<tbody>
					{#each ctx.orderTableRows() as row (row.key)}
						<tr>
							<td class="max-w-44">
								<div class="truncate text-sm font-medium" title={row.coin}>{row.coin}</div>
							</td>
							<td>
								<span class="badge badge-xs {ctx.orderSideClass(row.side)}">
									{ctx.orderSideLabel(row.side)}
								</span>
							</td>
							<td class="text-right font-mono">{ctx.formatTokenAmount(row.size)}</td>
							<td class="text-right font-mono">{ctx.formatTokenAmount(row.origSize)}</td>
							<td class="text-right font-mono">{ctx.formatPrice(row.price)}</td>
							<td class="text-right font-mono">{ctx.formatUsd(row.value)}</td>
							<td class="whitespace-nowrap">{row.type}</td>
							<td class="whitespace-nowrap">{row.tif ?? '—'}</td>
							<td class="whitespace-nowrap">{ctx.formatOrderFlag(row.reduceOnly)}</td>
							<td class="text-[11px] whitespace-nowrap">
								{row.time == null ? '—' : ctx.fmtTs(row.time)}
							</td>
							<td class="text-right font-mono">{row.oid ?? '—'}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
{/if}
