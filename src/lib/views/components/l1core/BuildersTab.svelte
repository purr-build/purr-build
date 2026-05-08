<script lang="ts">
	import CopyAddress from '$lib/components/CopyAddress.svelte';
	import TableScroll from '$lib/components/TableScroll.svelte';
	import CurlDetails from './CurlDetails.svelte';
	import LoadableState from './LoadableState.svelte';
	import SortIcon from './SortIcon.svelte';

	type Props = {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		ctx: any;
	};

	let { ctx }: Props = $props();

	function updateBuilderAddress(event: Event) {
		ctx.setBuilderAddressInput((event.currentTarget as HTMLInputElement).value);
	}

	function updateBuilderMaxFee(event: Event) {
		ctx.setBuilderMaxFeeRateInput((event.currentTarget as HTMLInputElement).value);
	}
</script>

<div class="space-y-3 p-2">
	{#if ctx.canSignForActiveAddress}
		<form
			class="rounded-lg border border-base-300 bg-base-100 p-3"
			onsubmit={ctx.submitApproveBuilder}
		>
			<div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_8rem_auto] md:items-end">
				<label class="form-control">
					<span class="label pb-1 text-xs text-base-content/60">Builder address</span>
					<input
						class="input input-sm w-full font-mono"
						value={ctx.builderAddressInput}
						placeholder="0x..."
						spellcheck="false"
						autocomplete="off"
						oninput={updateBuilderAddress}
					/>
				</label>
				<label class="form-control">
					<span class="label pb-1 text-xs text-base-content/60">Max fee</span>
					<input
						class="input input-sm w-full font-mono"
						value={ctx.builderMaxFeeRateInput}
						placeholder="0.01%"
						spellcheck="false"
						autocomplete="off"
						oninput={updateBuilderMaxFee}
					/>
				</label>
				<button type="submit" class="btn btn-sm btn-primary" disabled={ctx.builderActionLoading}>
					{#if ctx.builderActionLoading}
						<span class="loading loading-xs loading-spinner"></span>
					{/if}
					Approve
				</button>
			</div>
		</form>
	{:else}
		<div role="alert" class="alert alert-soft text-xs alert-warning">
			<span>Connect this tracked address to approve builders.</span>
		</div>
	{/if}

	{#if ctx.builderActionError}
		<div role="alert" class="alert alert-soft text-xs alert-error">
			<span>{ctx.builderActionError}</span>
		</div>
	{/if}
	{#if ctx.builderActionNotice}
		<div role="status" class="alert alert-soft text-xs alert-success">
			<span>{ctx.builderActionNotice}</span>
		</div>
	{/if}
	<CurlDetails curl={ctx.builderCurl} />

	<LoadableState
		loading={ctx.approvedBuilders.loading}
		error={ctx.approvedBuilders.error}
		hasData={ctx.approvedBuilders.data !== null}
	/>
	{#if ctx.approvedBuilders.data}
		{#if ctx.builderTableRows().length === 0}
			<p class="p-2 text-sm text-base-content/60">No approved builders.</p>
		{:else}
			<TableScroll>
				<table class="table table-md">
					<thead>
						<tr class="text-[10px] text-base-content/50 uppercase">
							<th>
								<button
									type="button"
									class="btn h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
									onclick={() => ctx.setBuilderSort('name')}
								>
									Builder name
									<SortIcon name={ctx.builderSortIndicator('name')} />
								</button>
							</th>
							<th>
								<button
									type="button"
									class="btn h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
									onclick={() => ctx.setBuilderSort('address')}
								>
									Builder address
									<SortIcon name={ctx.builderSortIndicator('address')} />
								</button>
							</th>
							<th class="text-right">
								<button
									type="button"
									class="btn ml-auto h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
									onclick={() => ctx.setBuilderSort('maxFee')}
								>
									Max fee
									<SortIcon name={ctx.builderSortIndicator('maxFee')} />
								</button>
							</th>
						</tr>
					</thead>
					<tbody>
						{#each ctx.builderTableRows() as row (row.key)}
							<tr>
								<td class="max-w-44">
									<div class="truncate text-sm font-medium" title={row.name ?? row.address}>
										{row.name ?? row.address}
									</div>
								</td>
								<td class="whitespace-nowrap">
									<CopyAddress address={row.address} notification="Builder address copied" />
								</td>
								<td class="text-right font-mono">{ctx.formatBuilderFee(row.maxFee)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</TableScroll>
		{/if}
	{/if}
</div>
