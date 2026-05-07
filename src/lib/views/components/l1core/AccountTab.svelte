<script lang="ts">
	import CopyAddress from '$lib/components/CopyAddress.svelte';
	import CurlDetails from './CurlDetails.svelte';
	import LoadableState from './LoadableState.svelte';

	type Props = {
		// The L1 container owns network streams and signing state; tabs receive a stable view-model.
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		ctx: any;
	};

	let { ctx }: Props = $props();

	function updateReserveWeight(event: Event) {
		ctx.setReserveWeightInput((event.currentTarget as HTMLInputElement).value);
	}
</script>

<div class="space-y-3 p-2">
	<LoadableState
		loading={ctx.accountTabLoading()}
		error={ctx.accountTabError()}
		hasData={ctx.accountTabHasData()}
	/>

	{#if ctx.userRole.data}
		<div class="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
			<table class="table table-xs">
				<tbody>
					<tr>
						<th class="w-44 text-[10px] text-base-content/50 uppercase">User role</th>
						<td class="text-right font-mono">
							{ctx.formatUserRole(ctx.userRole.data.role)}
						</td>
					</tr>
					{#if ctx.userRoleDetail}
						<tr>
							<th class="w-44 text-[10px] text-base-content/50 uppercase">
								{ctx.userRoleDetail.label}
							</th>
							<td class="text-right">
								<CopyAddress
									address={ctx.userRoleDetail.address}
									buttonClass="h-auto min-h-0 px-0 py-0 font-mono text-xs text-base-content/80 hover:text-base-content"
								/>
							</td>
						</tr>
					{/if}
				</tbody>
			</table>
		</div>
	{/if}

	{#if ctx.userFees.data && ctx.userFeesOverview}
		<div class="flex items-center justify-between gap-2 px-1">
			<h3 class="text-xs font-semibold text-base-content/70 uppercase">Fees</h3>
			{#if ctx.userFeesOverview.firstDate && ctx.userFeesOverview.lastDate}
				<span class="text-[11px] text-base-content/50">
					{ctx.userFeesOverview.firstDate} to {ctx.userFeesOverview.lastDate}
				</span>
			{/if}
		</div>

		<div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
			<div class="rounded-lg border border-base-300 bg-base-100 p-3">
				<p class="text-[10px] font-medium text-base-content/50 uppercase">Fee volume</p>
				<p class="mt-1 font-mono text-sm">{ctx.formatUsdcCost(ctx.userFeesOverview.totalVolume)}</p>
				<p class="mt-1 text-[11px] text-base-content/50">
					Exchange {ctx.formatUsdcCost(ctx.userFeesOverview.exchangeVolume)}
				</p>
			</div>
			<div class="rounded-lg border border-base-300 bg-base-100 p-3">
				<p class="text-[10px] font-medium text-base-content/50 uppercase">Perp taker</p>
				<p class="mt-1 font-mono text-sm">
					{ctx.formatFractionPercent(ctx.toNumber(ctx.userFees.data.userCrossRate))}
				</p>
				<p class="mt-1 text-[11px] text-base-content/50">
					Base {ctx.formatFractionPercent(ctx.toNumber(ctx.userFees.data.feeSchedule.cross))}
				</p>
			</div>
			<div class="rounded-lg border border-base-300 bg-base-100 p-3">
				<p class="text-[10px] font-medium text-base-content/50 uppercase">Perp maker</p>
				<p class="mt-1 font-mono text-sm">
					{ctx.formatFractionPercent(ctx.toNumber(ctx.userFees.data.userAddRate))}
				</p>
				<p class="mt-1 text-[11px] text-base-content/50">
					Base {ctx.formatFractionPercent(ctx.toNumber(ctx.userFees.data.feeSchedule.add))}
				</p>
			</div>
			<div class="rounded-lg border border-base-300 bg-base-100 p-3">
				<p class="text-[10px] font-medium text-base-content/50 uppercase">Spot taker</p>
				<p class="mt-1 font-mono text-sm">
					{ctx.formatFractionPercent(ctx.toNumber(ctx.userFees.data.userSpotCrossRate))}
				</p>
				<p class="mt-1 text-[11px] text-base-content/50">
					Base {ctx.formatFractionPercent(ctx.toNumber(ctx.userFees.data.feeSchedule.spotCross))}
				</p>
			</div>
			<div class="rounded-lg border border-base-300 bg-base-100 p-3">
				<p class="text-[10px] font-medium text-base-content/50 uppercase">Spot maker</p>
				<p class="mt-1 font-mono text-sm">
					{ctx.formatFractionPercent(ctx.toNumber(ctx.userFees.data.userSpotAddRate))}
				</p>
				<p class="mt-1 text-[11px] text-base-content/50">
					Base {ctx.formatFractionPercent(ctx.toNumber(ctx.userFees.data.feeSchedule.spotAdd))}
				</p>
			</div>
			<div class="rounded-lg border border-base-300 bg-base-100 p-3">
				<p class="text-[10px] font-medium text-base-content/50 uppercase">Referral discount</p>
				<p class="mt-1 font-mono text-sm">
					{ctx.formatFractionPercent(ctx.userFeesOverview.activeReferralDiscount)}
				</p>
				<p class="mt-1 text-[11px] text-base-content/50">
					Schedule {ctx.formatFractionPercent(
						ctx.toNumber(ctx.userFees.data.feeSchedule.referralDiscount)
					)}
				</p>
			</div>
			<div class="rounded-lg border border-base-300 bg-base-100 p-3">
				<p class="text-[10px] font-medium text-base-content/50 uppercase">Staking discount</p>
				<p class="mt-1 font-mono text-sm">
					{ctx.formatFractionPercent(ctx.userFeesOverview.activeStakingDiscount)}
				</p>
				<p class="mt-1 text-[11px] text-base-content/50">
					{ctx.formatBps(ctx.userFeesOverview.activeStakingTierBps)} of max supply
				</p>
			</div>
			<div class="rounded-lg border border-base-300 bg-base-100 p-3">
				<p class="text-[10px] font-medium text-base-content/50 uppercase">Fee trial</p>
				<p class="mt-1 font-mono text-sm">
					{ctx.formatUsdcCost(ctx.userFeesOverview.feeTrialEscrow)}
				</p>
				<p class="mt-1 text-[11px] text-base-content/50">
					{ctx.userFeesOverview.nextTrialAvailableTimestamp
						? ctx.fmtTs(ctx.userFeesOverview.nextTrialAvailableTimestamp)
						: 'No next trial'}
				</p>
			</div>
		</div>

		{#if ctx.userFeeVolumeRows.length > 0}
			<div class="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
				<table class="table table-xs">
					<thead>
						<tr class="text-[10px] text-base-content/50 uppercase">
							<th>Date</th>
							<th class="text-right">Taker volume</th>
							<th class="text-right">Maker volume</th>
							<th class="text-right">Exchange volume</th>
						</tr>
					</thead>
					<tbody>
						{#each ctx.userFeeVolumeRows as row (row.date)}
							<tr>
								<td class="whitespace-nowrap">{row.date}</td>
								<td class="text-right font-mono"
									>{ctx.formatUsdcCost(ctx.toNumber(row.userCross))}</td
								>
								<td class="text-right font-mono">{ctx.formatUsdcCost(ctx.toNumber(row.userAdd))}</td
								>
								<td class="text-right font-mono"
									>{ctx.formatUsdcCost(ctx.toNumber(row.exchange))}</td
								>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{/if}

	{#if ctx.userReferral.data && ctx.userReferralOverview}
		<div class="flex items-center justify-between gap-2 px-1">
			<h3 class="text-xs font-semibold text-base-content/70 uppercase">Referral</h3>
			<span class="text-[11px] text-base-content/50">
				{ctx.referrerStageLabel(ctx.userReferralOverview.referrerStage)}
			</span>
		</div>

		<div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
			<div class="rounded-lg border border-base-300 bg-base-100 p-3">
				<p class="text-[10px] font-medium text-base-content/50 uppercase">Referred by</p>
				{#if ctx.userReferral.data.referredBy}
					<p class="mt-1 font-mono text-sm">{ctx.userReferral.data.referredBy.code}</p>
					<CopyAddress
						address={ctx.userReferral.data.referredBy.referrer}
						buttonClass="mt-1 h-auto min-h-0 px-0 py-0 font-mono text-xs text-base-content/70 hover:text-base-content"
					/>
				{:else}
					<p class="mt-1 text-sm text-base-content/50">None</p>
				{/if}
			</div>
			<div class="rounded-lg border border-base-300 bg-base-100 p-3">
				<p class="text-[10px] font-medium text-base-content/50 uppercase">Referrer code</p>
				<p class="mt-1 font-mono text-sm">{ctx.userReferralOverview.referrerCode ?? '—'}</p>
				<p class="mt-1 text-[11px] text-base-content/50">
					{ctx.formatInteger(ctx.userReferralOverview.nReferrals)} referrals
				</p>
			</div>
			<div class="rounded-lg border border-base-300 bg-base-100 p-3">
				<p class="text-[10px] font-medium text-base-content/50 uppercase">Referral volume</p>
				<p class="mt-1 font-mono text-sm">{ctx.formatUsdcCost(ctx.userReferralOverview.cumVlm)}</p>
				{#if ctx.userReferralOverview.requiredVolume != null}
					<p class="mt-1 text-[11px] text-base-content/50">
						Required {ctx.formatUsdcCost(ctx.userReferralOverview.requiredVolume)}
					</p>
				{/if}
			</div>
			<div class="rounded-lg border border-base-300 bg-base-100 p-3">
				<p class="text-[10px] font-medium text-base-content/50 uppercase">Unclaimed rewards</p>
				<p class="mt-1 font-mono text-sm">
					{ctx.formatUsdcCost(ctx.userReferralOverview.unclaimedRewards)}
				</p>
			</div>
			<div class="rounded-lg border border-base-300 bg-base-100 p-3">
				<p class="text-[10px] font-medium text-base-content/50 uppercase">Claimed rewards</p>
				<p class="mt-1 font-mono text-sm">
					{ctx.formatUsdcCost(ctx.userReferralOverview.claimedRewards)}
				</p>
			</div>
			<div class="rounded-lg border border-base-300 bg-base-100 p-3">
				<p class="text-[10px] font-medium text-base-content/50 uppercase">Builder rewards</p>
				<p class="mt-1 font-mono text-sm">
					{ctx.formatUsdcCost(ctx.userReferralOverview.builderRewards)}
				</p>
			</div>
			<div class="rounded-lg border border-base-300 bg-base-100 p-3">
				<p class="text-[10px] font-medium text-base-content/50 uppercase">Reward history</p>
				<p class="mt-1 font-mono text-sm">
					{ctx.formatInteger(ctx.userReferralOverview.rewardHistoryCount)}
				</p>
			</div>
		</div>

		{#if ctx.userReferralRows.length > 0}
			<div class="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
				<table class="table table-xs">
					<thead>
						<tr class="text-[10px] text-base-content/50 uppercase">
							<th>Referred user</th>
							<th>Joined</th>
							<th class="text-right">Volume</th>
							<th class="text-right">User rewarded fees</th>
							<th class="text-right">Referrer rewards</th>
						</tr>
					</thead>
					<tbody>
						{#each ctx.userReferralRows as row (row.user)}
							<tr>
								<td>
									<CopyAddress
										address={row.user}
										buttonClass="h-auto min-h-0 px-0 py-0 font-mono text-xs text-base-content/80 hover:text-base-content"
									/>
								</td>
								<td class="text-[11px] whitespace-nowrap">{ctx.fmtTs(row.timeJoined)}</td>
								<td class="text-right font-mono">{ctx.formatUsdcCost(ctx.toNumber(row.cumVlm))}</td>
								<td class="text-right font-mono">
									{ctx.formatUsdcCost(ctx.toNumber(row.cumRewardedFeesSinceReferred))}
								</td>
								<td class="text-right font-mono">
									{ctx.formatUsdcCost(ctx.toNumber(row.cumFeesRewardedToReferrer))}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}

		{#if ctx.userReferralRewardRows.length > 0}
			<div class="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
				<table class="table table-xs">
					<thead>
						<tr class="text-[10px] text-base-content/50 uppercase">
							<th>Reward time</th>
							<th class="text-right">Earned</th>
							<th class="text-right">Volume</th>
							<th class="text-right">Referral volume</th>
						</tr>
					</thead>
					<tbody>
						{#each ctx.userReferralRewardRows as row, index (`${row.time}:${index}`)}
							<tr>
								<td class="text-[11px] whitespace-nowrap">{ctx.fmtTs(row.time)}</td>
								<td class="text-right font-mono">{ctx.formatUsdcCost(ctx.toNumber(row.earned))}</td>
								<td class="text-right font-mono">{ctx.formatUsdcCost(ctx.toNumber(row.vlm))}</td>
								<td class="text-right font-mono">
									{ctx.formatUsdcCost(ctx.toNumber(row.referralVlm))}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{/if}

	<LoadableState
		loading={ctx.accountRateLimit.loading}
		error={ctx.accountRateLimit.error}
		hasData={ctx.accountRateLimit.data !== null}
	/>
	{#if ctx.accountRateLimit.data}
		<div class="overflow-x-auto rounded-lg border border-base-300 bg-base-100">
			<table class="table table-xs">
				<tbody>
					<tr>
						<th class="w-44 text-[10px] text-base-content/50 uppercase">Cumulative volume</th>
						<td class="text-right font-mono">
							{ctx.formatUsd(ctx.toNumber(ctx.accountRateLimit.data.cumVlm))}
						</td>
					</tr>
					<tr>
						<th class="w-44 text-[10px] text-base-content/50 uppercase">Requests used</th>
						<td class="text-right font-mono">
							{ctx.formatInteger(ctx.accountRateLimit.data.nRequestsUsed)}
						</td>
					</tr>
					<tr>
						<th class="w-44 text-[10px] text-base-content/50 uppercase"> Request cap </th>
						<td class="text-right font-mono">
							{ctx.formatInteger(ctx.accountRateLimit.data.nRequestsCap)}
						</td>
					</tr>
					<tr>
						<th class="w-44 text-[10px] text-base-content/50 uppercase">Reserved surplus</th>
						<td class="text-right font-mono">
							{ctx.formatInteger(ctx.accountRateLimit.data.nRequestsSurplus)}
						</td>
					</tr>
				</tbody>
			</table>
		</div>
	{/if}

	{#if ctx.canSignForActiveAddress}
		<form
			class="rounded-lg border border-base-300 bg-base-100 p-3"
			onsubmit={ctx.submitReserveRequestWeight}
		>
			<div class="space-y-2">
				<div class="flex items-end gap-2">
					<label class="form-control min-w-0 flex-1">
						<span class="label pb-1 text-xs text-base-content/60">Reserve request weight</span>
						<input
							class="input input-sm w-full"
							type="number"
							min="1"
							step="1"
							value={ctx.reserveWeightInput}
							oninput={updateReserveWeight}
						/>
					</label>
					<button
						type="submit"
						class="btn shrink-0 btn-sm btn-primary"
						disabled={ctx.reserveActionLoading}
					>
						{#if ctx.reserveActionLoading}
							<span class="loading loading-xs loading-spinner"></span>
						{/if}
						Reserve
					</button>
				</div>
				<div class="grid gap-1 text-xs text-base-content/60 lg:grid-cols-2">
					<div>
						<span>Reservation price</span>
						<span class="font-mono text-base-content">
							{ctx.formatUsdcCost(ctx.reservePricePreview)}
						</span>
					</div>
					<div>
						<span>Rate</span>
						<span class="font-mono text-base-content">
							{ctx.formatUsdcCost(ctx.RESERVE_REQUEST_WEIGHT_PRICE_USDC)} / weight
						</span>
					</div>
				</div>
			</div>
		</form>
	{:else}
		<div role="alert" class="alert alert-soft text-xs alert-warning">
			<span>Connect an injected root wallet to reserve request weight.</span>
		</div>
	{/if}

	{#if ctx.reserveActionError}
		<div role="alert" class="alert alert-soft text-xs alert-error">
			<span>{ctx.reserveActionError}</span>
		</div>
	{/if}
	{#if ctx.reserveActionNotice}
		<div role="status" class="alert alert-soft text-xs alert-success">
			<span>{ctx.reserveActionNotice}</span>
		</div>
	{/if}
	<CurlDetails curl={ctx.reserveCurl} />
</div>
