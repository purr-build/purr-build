<script lang="ts">
	type PerpAsset = {
		name: string;
		szDecimals: number;
		maxLeverage: number;
		marginTableId: number;
		isDelisted?: boolean;
		marginMode?: string | null;
		onlyIsolated?: boolean;
		growthMode?: string | null;
		lastGrowthModeChangeTime?: string | null;
	};
	type PerpUniverseRow = {
		kind: 'perp';
		key: string;
		asset: PerpAsset;
		assetId: number;
		dex: string;
		dexLabel: string;
		collateralToken: number;
		oiCap: string | null;
		fundingMultiplier: string | null;
		fundingInterestRate: string | null;
	};
	type Props = {
		ctx: {
			rows: PerpUniverseRow[];
			topSpacerHeight: number;
			bottomSpacerHeight: number;
			formatInteger: (value: number | null | undefined) => string;
			formatDecimal: (value: string | number | null | undefined) => string;
			formatFundingRate: (value: string | null) => string;
			formatBoolean: (value: boolean | null | undefined) => string;
			formatDateLike: (value: string | null | undefined) => string;
			perpMarginLabel: (asset: PerpAsset) => string;
			perpMarginBadgeClass: (asset: PerpAsset) => string;
		};
	};

	let { ctx }: Props = $props();
</script>

<table class="table min-w-[124rem] table-md">
	<thead class="sticky top-0 z-10 bg-base-100">
		<tr class="text-[10px] text-base-content/50 uppercase">
			<th>Asset</th>
			<th>DEX</th>
			<th class="text-right">Asset ID</th>
			<th class="text-right">Sz dec</th>
			<th class="text-right">Max lev</th>
			<th class="text-right">Margin table</th>
			<th>Margin</th>
			<th>Margin mode</th>
			<th class="text-right">Only isolated</th>
			<th class="text-right">Delisted</th>
			<th>Growth mode</th>
			<th>Last growth change</th>
			<th class="text-right">OI cap</th>
			<th class="text-right">Funding mult</th>
			<th class="text-right">Funding</th>
			<th class="text-right">Collateral</th>
		</tr>
	</thead>
	<tbody>
		{#if ctx.topSpacerHeight > 0}
			<tr aria-hidden="true">
				<td colspan="16" class="p-0" style={`height: ${ctx.topSpacerHeight}px; border: 0;`}></td>
			</tr>
		{/if}
		{#each ctx.rows as row (row.key)}
			{#if row.kind === 'perp'}
				<tr class="h-12">
					<td class="max-w-40">
						<div class="truncate font-mono text-sm font-medium" title={row.asset.name}>
							{row.asset.name}
						</div>
					</td>
					<td class="max-w-52">
						<div class="truncate text-sm" title={row.dexLabel}>{row.dexLabel}</div>
						{#if row.dex}
							<div class="truncate font-mono text-[10px] text-base-content/45" title={row.dex}>
								{row.dex}
							</div>
						{/if}
					</td>
					<td class="text-right font-mono">{ctx.formatInteger(row.assetId)}</td>
					<td class="text-right font-mono">{ctx.formatInteger(row.asset.szDecimals)}</td>
					<td class="text-right font-mono">{ctx.formatInteger(row.asset.maxLeverage)}x</td>
					<td class="text-right font-mono">{ctx.formatInteger(row.asset.marginTableId)}</td>
					<td>
						<span class="badge badge-xs {ctx.perpMarginBadgeClass(row.asset)}">
							{ctx.perpMarginLabel(row.asset)}
						</span>
					</td>
					<td class="font-mono">{row.asset.marginMode ?? '-'}</td>
					<td class="text-right font-mono">{ctx.formatBoolean(row.asset.onlyIsolated)}</td>
					<td class="text-right font-mono">{ctx.formatBoolean(row.asset.isDelisted)}</td>
					<td class="font-mono">{row.asset.growthMode ?? '-'}</td>
					<td class="font-mono text-xs whitespace-nowrap">
						{ctx.formatDateLike(row.asset.lastGrowthModeChangeTime)}
					</td>
					<td class="text-right font-mono" title={row.oiCap ?? undefined}>
						{ctx.formatDecimal(row.oiCap)}
					</td>
					<td class="text-right font-mono" title={row.fundingMultiplier ?? undefined}>
						{ctx.formatDecimal(row.fundingMultiplier)}
					</td>
					<td class="text-right font-mono" title={row.fundingInterestRate ?? undefined}>
						{ctx.formatFundingRate(row.fundingInterestRate)}
					</td>
					<td class="text-right font-mono">{ctx.formatInteger(row.collateralToken)}</td>
				</tr>
			{/if}
		{/each}
		{#if ctx.bottomSpacerHeight > 0}
			<tr aria-hidden="true">
				<td colspan="16" class="p-0" style={`height: ${ctx.bottomSpacerHeight}px; border: 0;`}></td>
			</tr>
		{/if}
	</tbody>
</table>
