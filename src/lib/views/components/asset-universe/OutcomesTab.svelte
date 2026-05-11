<script lang="ts">
	type OutcomeUniverseRow = {
		kind: 'outcome';
		key: string;
		outcome: { outcome: number; name: string; description: string };
		question: {
			question: number;
			name: string;
			description: string;
			fallbackOutcome: number;
			namedOutcomes: number[];
			settledNamedOutcomes: number[];
		} | null;
		side: { name: string; token?: number | null };
		marketName: string;
		encoding: number;
		spotCoin: string;
		tokenName: string;
		assetId: number;
		settled: boolean;
		fallback: boolean;
	};
	type Props = {
		ctx: {
			rows: OutcomeUniverseRow[];
			topSpacerHeight: number;
			bottomSpacerHeight: number;
			formatInteger: (value: number | null | undefined) => string;
			visibleValues: (values: (string | number | null | undefined)[], limit?: number) => string;
			outcomeStatusLabel: (row: OutcomeUniverseRow) => string;
			outcomeStatusBadgeClass: (row: OutcomeUniverseRow) => string;
		};
	};

	let { ctx }: Props = $props();
</script>

<table class="table min-w-[148rem] table-md">
	<thead class="sticky top-0 z-10 bg-base-100">
		<tr class="text-[10px] text-base-content/50 uppercase">
			<th>Market</th>
			<th class="text-right">Question ID</th>
			<th class="text-right">Outcome ID</th>
			<th>Side</th>
			<th class="text-right">Side token</th>
			<th>Outcome</th>
			<th class="text-right">Coin</th>
			<th class="text-right">Encoding</th>
			<th class="text-right">Token name</th>
			<th class="text-right">Asset ID</th>
			<th>Status</th>
			<th class="text-right">Fallback outcome</th>
			<th>Named outcomes</th>
			<th>Settled outcomes</th>
			<th>Question description</th>
			<th>Outcome description</th>
		</tr>
	</thead>
	<tbody>
		{#if ctx.topSpacerHeight > 0}
			<tr aria-hidden="true">
				<td colspan="16" class="p-0" style={`height: ${ctx.topSpacerHeight}px; border: 0;`}></td>
			</tr>
		{/if}
		{#each ctx.rows as row (row.key)}
			{#if row.kind === 'outcome'}
				<tr class="h-12">
					<td class="max-w-72">
						<div class="truncate text-sm font-medium" title={row.marketName}>
							{row.marketName}
						</div>
					</td>
					<td class="text-right font-mono">{ctx.formatInteger(row.question?.question)}</td>
					<td class="text-right font-mono">{ctx.formatInteger(row.outcome.outcome)}</td>
					<td class="max-w-36">
						<div class="truncate" title={row.side.name}>{row.side.name}</div>
					</td>
					<td class="text-right font-mono">{ctx.formatInteger(row.side.token)}</td>
					<td class="max-w-44">
						<div class="truncate" title={row.outcome.name}>{row.outcome.name}</div>
					</td>
					<td class="text-right font-mono">{row.spotCoin}</td>
					<td class="text-right font-mono">{ctx.formatInteger(row.encoding)}</td>
					<td class="text-right font-mono">{row.tokenName}</td>
					<td class="text-right font-mono">{ctx.formatInteger(row.assetId)}</td>
					<td>
						<span class="badge badge-xs {ctx.outcomeStatusBadgeClass(row)}">
							{ctx.outcomeStatusLabel(row)}
						</span>
					</td>
					<td class="max-w-96">
						<div class="text-right font-mono">
							{ctx.formatInteger(row.question?.fallbackOutcome)}
						</div>
					</td>
					<td class="max-w-48">
						<div
							class="truncate font-mono text-xs"
							title={ctx.visibleValues(row.question?.namedOutcomes ?? [], 100)}
						>
							{ctx.visibleValues(row.question?.namedOutcomes ?? [])}
						</div>
					</td>
					<td class="max-w-48">
						<div
							class="truncate font-mono text-xs"
							title={ctx.visibleValues(row.question?.settledNamedOutcomes ?? [], 100)}
						>
							{ctx.visibleValues(row.question?.settledNamedOutcomes ?? [])}
						</div>
					</td>
					<td class="max-w-96">
						<div class="truncate text-xs text-base-content/65" title={row.question?.description}>
							{row.question?.description || '-'}
						</div>
					</td>
					<td class="max-w-96">
						<div class="truncate text-xs text-base-content/65" title={row.outcome.description}>
							{row.outcome.description || '-'}
						</div>
					</td>
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
