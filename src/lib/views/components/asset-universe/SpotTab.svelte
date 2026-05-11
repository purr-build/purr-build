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
		evmContract?: {
			address?: `0x${string}` | null;
			evm_extra_wei_decimals?: number | null;
		} | null;
	};
	type SpotMarketSummary = {
		label: string;
		name: string;
		index: number;
		tokens: number[];
		isCanonical: boolean;
	};
	type SpotUniverseRow = {
		kind: 'spot';
		key: string;
		token: SpotToken;
		markets: string[];
		marketSummaries: SpotMarketSummary[];
	};
	type Props = {
		ctx: {
			rows: SpotUniverseRow[];
			topSpacerHeight: number;
			bottomSpacerHeight: number;
			formatInteger: (value: number | null | undefined) => string;
			formatDecimal: (value: string | number | null | undefined) => string;
			formatBoolean: (value: boolean | null | undefined) => string;
			visibleMarkets: (markets: string[]) => string;
			visibleValues: (values: (string | number | null | undefined)[], limit?: number) => string;
			shortValue: (value: string) => string;
		};
	};

	let { ctx }: Props = $props();

	function marketTitle(row: SpotUniverseRow) {
		return row.marketSummaries
			.map((market) => {
				const suffix = market.isCanonical ? ' canonical' : '';
				return `${market.label} #${market.index} [${market.tokens.join(', ')}]${suffix}`;
			})
			.join(', ');
	}

	function marketIndexes(row: SpotUniverseRow) {
		return row.marketSummaries.map((market) => market.index);
	}

	function marketTokenPairs(row: SpotUniverseRow) {
		return row.marketSummaries.map((market) => market.tokens.join('/'));
	}

	function canonicalMarkets(row: SpotUniverseRow) {
		return row.marketSummaries
			.filter((market) => market.isCanonical)
			.map((market) => `${market.label} #${market.index}`);
	}
</script>

<table class="table min-w-[126rem] table-md">
	<thead class="sticky top-0 z-10 bg-base-100">
		<tr class="text-[10px] text-base-content/50 uppercase">
			<th>Token</th>
			<th>Full name</th>
			<th class="text-right">Index</th>
			<th>Token ID</th>
			<th class="text-right">Token canonical</th>
			<th>Markets</th>
			<th>Market indexes</th>
			<th>Market tokens</th>
			<th>Market canonical</th>
			<th class="text-right">Size dec</th>
			<th class="text-right">Wei dec</th>
			<th class="text-right">EVM extra wei</th>
			<th class="text-right">Fee share</th>
			<th>Contract</th>
		</tr>
	</thead>
	<tbody>
		{#if ctx.topSpacerHeight > 0}
			<tr aria-hidden="true">
				<td colspan="14" class="p-0" style={`height: ${ctx.topSpacerHeight}px; border: 0;`}></td>
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
						<div class="truncate text-sm" title={row.token.fullName ?? undefined}>
							{row.token.fullName ?? '-'}
						</div>
					</td>
					<td class="text-right font-mono">{ctx.formatInteger(row.token.index)}</td>
					<td class="font-mono" title={row.token.tokenId}>{ctx.shortValue(row.token.tokenId)}</td>
					<td class="text-right font-mono">{ctx.formatBoolean(row.token.isCanonical)}</td>
					<td class="max-w-72">
						<div class="truncate" title={marketTitle(row) || undefined}>
							{row.markets.length === 0 ? '-' : ctx.visibleMarkets(row.markets)}
						</div>
					</td>
					<td class="font-mono" title={ctx.visibleValues(marketIndexes(row), 100)}>
						{ctx.visibleValues(marketIndexes(row))}
					</td>
					<td class="font-mono" title={ctx.visibleValues(marketTokenPairs(row), 100)}>
						{ctx.visibleValues(marketTokenPairs(row))}
					</td>
					<td class="max-w-56">
						<div class="truncate" title={ctx.visibleValues(canonicalMarkets(row), 100)}>
							{ctx.visibleValues(canonicalMarkets(row))}
						</div>
					</td>
					<td class="text-right font-mono">{ctx.formatInteger(row.token.szDecimals)}</td>
					<td class="text-right font-mono">{ctx.formatInteger(row.token.weiDecimals)}</td>
					<td class="text-right font-mono">
						{ctx.formatInteger(row.token.evmContract?.evm_extra_wei_decimals)}
					</td>
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
				<td colspan="14" class="p-0" style={`height: ${ctx.bottomSpacerHeight}px; border: 0;`}></td>
			</tr>
		{/if}
	</tbody>
</table>
