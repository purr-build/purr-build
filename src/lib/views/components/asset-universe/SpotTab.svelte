<script lang="ts">
	import CopyAddress from '$lib/components/CopyAddress.svelte';

	type SpotToken = {
		name: string;
		fullName: string | null;
		index: number;
		tokenId: string;
		isCanonical: boolean;
		szDecimals: number;
		weiDecimals: number;
		deployerTradingFeeShare: string;
		evmContract?: { address?: `0x${string}` | null } | null;
	};
	type SpotUniverseRow = {
		kind: 'spot';
		key: string;
		token: SpotToken;
		markets: string[];
		primaryMarket: string | null;
	};
	type Props = {
		ctx: {
			rows: SpotUniverseRow[];
			topSpacerHeight: number;
			bottomSpacerHeight: number;
			formatInteger: (value: number | null | undefined) => string;
			formatDecimal: (value: string | number | null | undefined) => string;
			visibleMarkets: (markets: string[]) => string;
			shortValue: (value: string) => string;
		};
	};

	let { ctx }: Props = $props();
</script>

<table class="table min-w-[72rem] table-md">
	<thead class="sticky top-0 z-10 bg-base-100">
		<tr class="text-[10px] text-base-content/50 uppercase">
			<th>Token</th>
			<th>Name</th>
			<th class="text-right">Index</th>
			<th>Token ID</th>
			<th>Markets</th>
			<th class="text-right">Size dec</th>
			<th class="text-right">Wei dec</th>
			<th class="text-right">Fee share</th>
			<th>Contract</th>
		</tr>
	</thead>
	<tbody>
		{#if ctx.topSpacerHeight > 0}
			<tr aria-hidden="true">
				<td colspan="9" class="p-0" style={`height: ${ctx.topSpacerHeight}px; border: 0;`}></td>
			</tr>
		{/if}
		{#each ctx.rows as row (row.key)}
			{#if row.kind === 'spot'}
				<tr class="h-12">
					<td class="max-w-36">
						<div class="flex min-w-0 items-center gap-2">
							<div class="truncate font-mono text-sm font-medium" title={row.token.name}>
								{row.token.name}
							</div>
							{#if row.token.isCanonical}
								<span class="badge badge-xs badge-success">canonical</span>
							{/if}
						</div>
					</td>
					<td class="max-w-52">
						<div
							class="truncate text-sm"
							title={row.token.fullName ?? row.primaryMarket ?? 'Spot token'}
						>
							{row.token.fullName ?? row.primaryMarket ?? 'Spot token'}
						</div>
					</td>
					<td class="text-right font-mono">{ctx.formatInteger(row.token.index)}</td>
					<td class="font-mono" title={row.token.tokenId}>{ctx.shortValue(row.token.tokenId)}</td>
					<td class="max-w-72">
						<div class="truncate" title={row.markets.join(', ') || undefined}>
							{row.markets.length === 0 ? '-' : ctx.visibleMarkets(row.markets)}
						</div>
					</td>
					<td class="text-right font-mono">{ctx.formatInteger(row.token.szDecimals)}</td>
					<td class="text-right font-mono">{ctx.formatInteger(row.token.weiDecimals)}</td>
					<td class="text-right font-mono">
						{ctx.formatDecimal(row.token.deployerTradingFeeShare)}
					</td>
					<td class="whitespace-nowrap">
						<CopyAddress address={row.token.evmContract?.address} />
					</td>
				</tr>
			{/if}
		{/each}
		{#if ctx.bottomSpacerHeight > 0}
			<tr aria-hidden="true">
				<td colspan="9" class="p-0" style={`height: ${ctx.bottomSpacerHeight}px; border: 0;`}></td>
			</tr>
		{/if}
	</tbody>
</table>
