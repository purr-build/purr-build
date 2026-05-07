<script lang="ts">
	type OutcomeUniverseRow = {
		kind: 'outcome';
		key: string;
		outcome: { name: string };
		side: { name: string; token?: number | null };
		marketName: string;
		description: string;
		encoding: number;
		settled: boolean;
		fallback: boolean;
	};
	type Props = {
		ctx: {
			rows: OutcomeUniverseRow[];
			topSpacerHeight: number;
			bottomSpacerHeight: number;
			formatInteger: (value: number | null | undefined) => string;
			outcomeStatusLabel: (row: OutcomeUniverseRow) => string;
			outcomeStatusBadgeClass: (row: OutcomeUniverseRow) => string;
		};
	};

	let { ctx }: Props = $props();
</script>

<table class="table min-w-[72rem] table-xs">
	<thead class="sticky top-0 z-10 bg-base-100">
		<tr class="text-[10px] text-base-content/50 uppercase">
			<th>Market</th>
			<th>Side</th>
			<th>Outcome</th>
			<th class="text-right">Encoding</th>
			<th class="text-right">Token</th>
			<th>Status</th>
			<th>Description</th>
		</tr>
	</thead>
	<tbody>
		{#if ctx.topSpacerHeight > 0}
			<tr aria-hidden="true">
				<td colspan="7" class="p-0" style={`height: ${ctx.topSpacerHeight}px; border: 0;`}></td>
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
					<td class="max-w-36">
						<div class="truncate" title={row.side.name}>{row.side.name}</div>
					</td>
					<td class="max-w-44">
						<div class="truncate" title={row.outcome.name}>{row.outcome.name}</div>
					</td>
					<td class="text-right font-mono">{ctx.formatInteger(row.encoding)}</td>
					<td class="text-right font-mono">{ctx.formatInteger(row.side.token)}</td>
					<td>
						<span class="badge badge-xs {ctx.outcomeStatusBadgeClass(row)}">
							{ctx.outcomeStatusLabel(row)}
						</span>
					</td>
					<td class="max-w-96">
						<div class="truncate text-xs text-base-content/65" title={row.description}>
							{row.description || '-'}
						</div>
					</td>
				</tr>
			{/if}
		{/each}
		{#if ctx.bottomSpacerHeight > 0}
			<tr aria-hidden="true">
				<td colspan="7" class="p-0" style={`height: ${ctx.bottomSpacerHeight}px; border: 0;`}></td>
			</tr>
		{/if}
	</tbody>
</table>
