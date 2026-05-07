<script lang="ts">
	import LoadableState from './LoadableState.svelte';

	type Props = {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		ctx: any;
	};

	let { ctx }: Props = $props();
</script>

<div class="space-y-3 p-2">
	<LoadableState
		loading={ctx.userLending.loading}
		error={ctx.userLending.error}
		hasData={ctx.userLending.data !== null}
	/>
	{#if ctx.userLending.data && ctx.lendingOverview}
		<div class="flex items-center justify-between gap-2 px-1">
			<h3 class="text-xs font-semibold text-base-content/70 uppercase">Lending</h3>
			<span class="text-[11px] text-base-content/50"> 30d interest window </span>
		</div>

		<div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
			<div class="rounded-lg border border-base-300 bg-base-100 p-3">
				<p class="text-[10px] font-medium text-base-content/50 uppercase">Health</p>
				<p class="mt-1 text-sm capitalize">
					<span
						class="badge badge-xs {ctx.lendingOverview.health === 'healthy'
							? 'badge-success'
							: 'badge-warning'}"
					>
						{ctx.lendingOverview.health}
					</span>
				</p>
				<p class="mt-1 text-[11px] text-base-content/50">
					Health factor {ctx.formatHealthFactor(ctx.lendingOverview.healthFactor)}
				</p>
			</div>
			<div class="rounded-lg border border-base-300 bg-base-100 p-3">
				<p class="text-[10px] font-medium text-base-content/50 uppercase">Mode</p>
				<p class="mt-1 text-sm">
					{ctx.accountAbstraction === 'portfolioMargin'
						? 'Portfolio margin'
						: ctx.accountAbstraction === 'unifiedAccount'
							? 'Unified account'
							: (ctx.accountAbstraction ?? 'Unknown')}
				</p>
				<p class="mt-1 text-[11px] text-base-content/50">Current user state only</p>
			</div>
			<div class="rounded-lg border border-base-300 bg-base-100 p-3">
				<p class="text-[10px] font-medium text-base-content/50 uppercase">Active tokens</p>
				<p class="mt-1 font-mono text-sm">{ctx.formatInteger(ctx.lendingOverview.activeTokens)}</p>
			</div>
			<div class="rounded-lg border border-base-300 bg-base-100 p-3">
				<p class="text-[10px] font-medium text-base-content/50 uppercase">Supplied tokens</p>
				<p class="mt-1 font-mono text-sm">{ctx.formatInteger(ctx.lendingOverview.supplyTokens)}</p>
			</div>
			<div class="rounded-lg border border-base-300 bg-base-100 p-3">
				<p class="text-[10px] font-medium text-base-content/50 uppercase">Borrowed tokens</p>
				<p class="mt-1 font-mono text-sm">{ctx.formatInteger(ctx.lendingOverview.borrowTokens)}</p>
			</div>
			<div class="rounded-lg border border-base-300 bg-base-100 p-3">
				<p class="text-[10px] font-medium text-base-content/50 uppercase">30d interest events</p>
				<p class="mt-1 font-mono text-sm">
					{ctx.formatInteger(ctx.lendingInterestSummary.netEvents)}
				</p>
				<p class="mt-1 text-[11px] text-base-content/50">
					{ctx.lendingInterestSummary.latestTime
						? ctx.fmtTs(ctx.lendingInterestSummary.latestTime)
						: 'No interest'}
				</p>
			</div>
			<div class="rounded-lg border border-base-300 bg-base-100 p-3">
				<p class="text-[10px] font-medium text-base-content/50 uppercase">Supply interest events</p>
				<p class="mt-1 font-mono text-sm">
					{ctx.formatInteger(ctx.lendingInterestSummary.supplyEvents)}
				</p>
			</div>
			<div class="rounded-lg border border-base-300 bg-base-100 p-3">
				<p class="text-[10px] font-medium text-base-content/50 uppercase">Borrow interest events</p>
				<p class="mt-1 font-mono text-sm">
					{ctx.formatInteger(ctx.lendingInterestSummary.borrowEvents)}
				</p>
			</div>
		</div>

		{#if ctx.lendingActiveRows.length === 0 && ctx.lendingInterestRows.length === 0}
			<div role="alert" class="alert alert-soft text-xs">
				<span>No borrow/lend activity.</span>
			</div>
		{/if}

		{#if ctx.lendingActiveRows.length > 0}
			<div class="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
				<table class="table table-xs">
					<thead>
						<tr class="text-[10px] text-base-content/50 uppercase">
							<th>Token</th>
							<th class="text-right">Supplied</th>
							<th class="text-right">Borrowed</th>
							<th class="text-right">Net token</th>
						</tr>
					</thead>
					<tbody>
						{#each ctx.lendingActiveRows as row (row.tokenId)}
							<tr>
								<td>
									<div class="text-sm font-medium">{row.tokenName}</div>
									<div class="text-[10px] text-base-content/50">Token {row.tokenId}</div>
								</td>
								<td class="text-right font-mono">
									{ctx.formatTokenValue(row.supplyValue, row.tokenName)}
									<div class="text-[10px] text-base-content/50">
										Basis {ctx.formatTokenAmount(row.supplyBasis)}
									</div>
								</td>
								<td class="text-right font-mono">
									{ctx.formatTokenValue(row.borrowValue, row.tokenName)}
									<div class="text-[10px] text-base-content/50">
										Basis {ctx.formatTokenAmount(row.borrowBasis)}
									</div>
								</td>
								<td class="text-right font-mono {ctx.pnlClass(row.netValue)}">
									{ctx.formatTokenValue(row.netValue, row.tokenName)}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}

		{#if ctx.lendingInterestRows.length > 0}
			<div class="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
				<table class="table table-xs">
					<thead>
						<tr class="text-[10px] text-base-content/50 uppercase">
							<th>Interest time</th>
							<th>Token</th>
							<th class="text-right">Supply interest</th>
							<th class="text-right">Borrow interest</th>
							<th class="text-right">Net token</th>
						</tr>
					</thead>
					<tbody>
						{#each ctx.lendingInterestRows as row, index (`${row.time}:${row.token}:${index}`)}
							{@const netInterest =
								(ctx.toNumber(row.supply) ?? 0) - (ctx.toNumber(row.borrow) ?? 0)}
							<tr>
								<td class="text-[11px] whitespace-nowrap">{ctx.fmtTs(row.time)}</td>
								<td>{row.token}</td>
								<td class="text-right font-mono">
									{ctx.formatTokenValue(ctx.toNumber(row.supply), row.token)}
								</td>
								<td class="text-right font-mono">
									{ctx.formatTokenValue(ctx.toNumber(row.borrow), row.token)}
								</td>
								<td class="text-right font-mono {ctx.pnlClass(netInterest)}">
									{ctx.formatTokenValue(netInterest, row.token)}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{/if}
</div>
