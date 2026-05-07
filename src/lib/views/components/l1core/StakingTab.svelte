<script lang="ts">
	import CopyAddress from '$lib/components/CopyAddress.svelte';
	import LoadableState from './LoadableState.svelte';

	type Props = {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		ctx: any;
	};

	let { ctx }: Props = $props();
</script>

<div class="space-y-3 p-2">
	<LoadableState
		loading={ctx.userStaking.loading}
		error={ctx.userStaking.error}
		hasData={ctx.userStaking.data !== null}
	/>
	{#if ctx.userStaking.data && ctx.stakingOverview}
		<div class="flex items-center justify-between gap-2 px-1">
			<h3 class="text-xs font-semibold text-base-content/70 uppercase">Staking</h3>
			{#if ctx.stakingOverview.nextUnlock}
				<span class="text-[11px] text-base-content/50">
					Next unlock {ctx.fmtTs(ctx.stakingOverview.nextUnlock)}
				</span>
			{/if}
		</div>

		<div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
			<div class="rounded-lg border border-base-300 bg-base-100 p-3">
				<p class="text-[10px] font-medium text-base-content/50 uppercase">Delegated</p>
				<p class="mt-1 font-mono text-sm">{ctx.formatHypeAmount(ctx.stakingOverview.delegated)}</p>
			</div>
			<div class="rounded-lg border border-base-300 bg-base-100 p-3">
				<p class="text-[10px] font-medium text-base-content/50 uppercase">Undelegated</p>
				<p class="mt-1 font-mono text-sm">
					{ctx.formatHypeAmount(ctx.stakingOverview.undelegated)}
				</p>
			</div>
			<div class="rounded-lg border border-base-300 bg-base-100 p-3">
				<p class="text-[10px] font-medium text-base-content/50 uppercase">Pending withdrawal</p>
				<p class="mt-1 font-mono text-sm">{ctx.formatHypeAmount(ctx.stakingOverview.pending)}</p>
				<p class="mt-1 text-[11px] text-base-content/50">
					{ctx.formatInteger(ctx.stakingOverview.nPendingWithdrawals)} / 5 queued
				</p>
			</div>
			<div class="rounded-lg border border-base-300 bg-base-100 p-3">
				<p class="text-[10px] font-medium text-base-content/50 uppercase">Total staking balance</p>
				<p class="mt-1 font-mono text-sm">{ctx.formatHypeAmount(ctx.stakingOverview.total)}</p>
			</div>
			<div class="rounded-lg border border-base-300 bg-base-100 p-3">
				<p class="text-[10px] font-medium text-base-content/50 uppercase">Validators</p>
				<p class="mt-1 font-mono text-sm">{ctx.formatInteger(ctx.stakingOverview.nValidators)}</p>
				<p class="mt-1 text-[11px] text-base-content/50">
					{ctx.formatInteger(ctx.stakingOverview.nLockedDelegations)} locked
				</p>
			</div>
			<div class="rounded-lg border border-base-300 bg-base-100 p-3">
				<p class="text-[10px] font-medium text-base-content/50 uppercase">Rewards</p>
				<p class="mt-1 font-mono text-sm">
					{ctx.formatHypeAmount(ctx.stakingOverview.totalRewards)}
				</p>
				<p class="mt-1 text-[11px] text-base-content/50">
					{ctx.stakingRewardSummary.latestTime
						? ctx.fmtTs(ctx.stakingRewardSummary.latestTime)
						: 'No rewards'}
				</p>
			</div>
			<div class="rounded-lg border border-base-300 bg-base-100 p-3">
				<p class="text-[10px] font-medium text-base-content/50 uppercase">Staking discount</p>
				<p class="mt-1 font-mono text-sm">
					{ctx.formatFractionPercent(ctx.stakingOverview.activeStakingDiscount)}
				</p>
				<p class="mt-1 text-[11px] text-base-content/50">
					{ctx.formatBps(ctx.stakingOverview.activeStakingTierBps)} of max supply
				</p>
			</div>
			<div class="rounded-lg border border-base-300 bg-base-100 p-3">
				<p class="text-[10px] font-medium text-base-content/50 uppercase">Staking link</p>
				{#if ctx.userFees.data?.stakingLink}
					<p class="mt-1 text-sm">{ctx.stakingLinkLabel(ctx.userFees.data.stakingLink.type)}</p>
					<CopyAddress
						address={ctx.userFees.data.stakingLink.stakingUser}
						buttonClass="mt-1 h-auto min-h-0 px-0 py-0 font-mono text-xs text-base-content/70 hover:text-base-content"
					/>
				{:else}
					<p class="mt-1 text-sm text-base-content/50">None</p>
				{/if}
			</div>
		</div>

		{#if !ctx.stakingOverview.hasActivity}
			<div role="alert" class="alert alert-soft text-xs">
				<span>No staking activity.</span>
			</div>
		{:else}
			{#if ctx.stakingDelegationRows.length > 0}
				<div class="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
					<table class="table table-xs">
						<thead>
							<tr class="text-[10px] text-base-content/50 uppercase">
								<th>Validator</th>
								<th class="text-right">Amount</th>
								<th>Status</th>
								<th>Lock</th>
								<th class="text-right">30d APR</th>
								<th class="text-right">Commission</th>
								<th class="text-right">7d uptime</th>
							</tr>
						</thead>
						<tbody>
							{#each ctx.stakingDelegationRows as row (row.validator)}
								<tr>
									<td class="max-w-48">
										<div
											class="truncate text-sm font-medium"
											title={row.validatorName ?? row.validator}
										>
											{row.validatorName ?? ctx.short(row.validator)}
										</div>
										<CopyAddress
											address={row.validator}
											label={ctx.short(row.validator)}
											notification="Validator address copied"
											buttonClass="h-auto min-h-0 px-0 py-0 font-mono text-[11px] text-base-content/50 hover:text-base-content"
										/>
									</td>
									<td class="text-right font-mono">{ctx.formatHypeAmount(row.amountValue)}</td>
									<td>
										<span class="badge badge-xs {ctx.stakingValidatorStatusClass(row)}">
											{ctx.stakingValidatorStatus(row)}
										</span>
									</td>
									<td>
										<div class="text-xs">
											{ctx.stakingDelegationLockLabel(row.lockedUntilTimestamp)}
										</div>
										<div class="text-[10px] whitespace-nowrap text-base-content/50">
											{row.lockedUntilTimestamp > Date.now()
												? ctx.fmtTs(row.lockedUntilTimestamp)
												: 'Available'}
										</div>
									</td>
									<td class="text-right font-mono">{ctx.formatFractionPercent(row.monthApr)}</td>
									<td class="text-right font-mono">{ctx.formatFractionPercent(row.commission)}</td>
									<td class="text-right font-mono">{ctx.formatFractionPercent(row.weekUptime)}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}

			{#if ctx.stakingRewardSummary.total > 0}
				<div class="grid gap-2 sm:grid-cols-3">
					<div class="rounded-lg border border-base-300 bg-base-100 p-3">
						<p class="text-[10px] font-medium text-base-content/50 uppercase">Delegation rewards</p>
						<p class="mt-1 font-mono text-sm">
							{ctx.formatHypeAmount(ctx.stakingRewardSummary.delegation)}
						</p>
					</div>
					<div class="rounded-lg border border-base-300 bg-base-100 p-3">
						<p class="text-[10px] font-medium text-base-content/50 uppercase">Commission rewards</p>
						<p class="mt-1 font-mono text-sm">
							{ctx.formatHypeAmount(ctx.stakingRewardSummary.commission)}
						</p>
					</div>
					<div class="rounded-lg border border-base-300 bg-base-100 p-3">
						<p class="text-[10px] font-medium text-base-content/50 uppercase">Total rewards</p>
						<p class="mt-1 font-mono text-sm">
							{ctx.formatHypeAmount(ctx.stakingRewardSummary.total)}
						</p>
					</div>
				</div>
			{/if}

			{#if ctx.stakingRewardRows.length > 0}
				<div class="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
					<table class="table table-xs">
						<thead>
							<tr class="text-[10px] text-base-content/50 uppercase">
								<th>Reward time</th>
								<th>Source</th>
								<th class="text-right">Amount</th>
							</tr>
						</thead>
						<tbody>
							{#each ctx.stakingRewardRows as row, index (`${row.time}:${row.source}:${index}`)}
								<tr>
									<td class="text-[11px] whitespace-nowrap">{ctx.fmtTs(row.time)}</td>
									<td class="capitalize">{row.source}</td>
									<td class="text-right font-mono"
										>{ctx.formatHypeAmount(ctx.toNumber(row.totalAmount))}</td
									>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}

			{#if ctx.stakingHistoryRows.length > 0}
				<div class="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
					<table class="table table-xs">
						<thead>
							<tr class="text-[10px] text-base-content/50 uppercase">
								<th>Event time</th>
								<th>Action</th>
								<th class="text-right">Amount</th>
								<th>Validator</th>
								<th>Tx</th>
							</tr>
						</thead>
						<tbody>
							{#each ctx.stakingHistoryRows as row (`${row.hash}:${row.time}`)}
								{@const validator = ctx.stakingHistoryValidator(row)}
								<tr>
									<td class="text-[11px] whitespace-nowrap">{ctx.fmtTs(row.time)}</td>
									<td>
										<span class="badge badge-xs {ctx.stakingHistoryBadgeClass(row)}">
											{ctx.stakingHistoryAction(row)}
										</span>
									</td>
									<td class="text-right font-mono"
										>{ctx.formatHypeAmount(ctx.stakingHistoryAmount(row))}</td
									>
									<td class="whitespace-nowrap">
										{#if validator}
											<CopyAddress
												address={validator}
												label={ctx.short(validator)}
												notification="Validator address copied"
											/>
										{:else}
											<span class="text-base-content/40">—</span>
										{/if}
									</td>
									<td class="whitespace-nowrap">
										<CopyAddress
											address={row.hash}
											label={ctx.short(row.hash)}
											notification="Transaction hash copied"
										/>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		{/if}
	{/if}
</div>
