<script lang="ts">
	import CopyAddress from '$lib/components/CopyAddress.svelte';
	import HeroIcon from '$lib/components/HeroIcon.svelte';
	import TableScroll from '$lib/components/TableScroll.svelte';
	import CurlDetails from './CurlDetails.svelte';
	import LoadableState from './LoadableState.svelte';
	import SortIcon from './SortIcon.svelte';

	type Props = {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		ctx: any;
	};

	let { ctx }: Props = $props();

	function updateName(event: Event) {
		ctx.setAgentNameInput((event.currentTarget as HTMLInputElement).value);
	}

	function updateImportName(event: Event) {
		ctx.setAgentImportNameInput((event.currentTarget as HTMLInputElement).value);
	}

	function updateImportPrivateKey(event: Event) {
		ctx.setAgentImportPrivateKeyInput((event.currentTarget as HTMLInputElement).value);
	}

	function updateValidDays(event: Event) {
		ctx.setAgentValidDays((event.currentTarget as HTMLInputElement).value);
	}

	function updateStorageAck(event: Event) {
		ctx.setAgentStorageAck((event.currentTarget as HTMLInputElement).checked);
	}

	function importDialogController(node: HTMLDialogElement) {
		$effect(() => {
			if (ctx.agentImportModalOpen && !node.open) node.showModal();
			else if (!ctx.agentImportModalOpen && node.open) node.close();
		});
	}
</script>

<div class="space-y-3 p-2">
	{#if ctx.canSignForActiveAddress}
		<div class="rounded-lg border border-base-300 bg-base-100 p-3">
			<div class="grid gap-3 md:grid-cols-[minmax(0,1fr)_9rem_auto] md:items-end">
				<label class="form-control">
					<span class="label pb-1 text-xs text-base-content/60">Name</span>
					<input
						class="input input-sm w-full"
						maxlength="16"
						value={ctx.agentNameInput}
						placeholder="purrbuild"
						oninput={updateName}
					/>
				</label>
				<label class="form-control">
					<span class="label pb-1 text-xs text-base-content/60">Valid days</span>
					<input
						class="input input-sm w-full"
						type="number"
						min="1"
						max={ctx.AGENT_MAX_VALID_DAYS}
						value={ctx.agentValidDays}
						oninput={updateValidDays}
					/>
				</label>
				<button
					type="button"
					class="btn btn-sm btn-primary"
					disabled={ctx.agentActionLoading !== null || !ctx.agentStorageAck}
					onclick={ctx.addAgentWallet}
				>
					{#if ctx.agentActionLoading === 'add'}
						<span class="loading loading-xs loading-spinner"></span>
					{/if}
					Add agent
				</button>
			</div>
			<label class="mt-3 flex items-start gap-2 text-xs text-base-content/70">
				<input
					type="checkbox"
					class="checkbox mt-0.5 checkbox-xs"
					checked={ctx.agentStorageAck}
					onchange={updateStorageAck}
				/>
				<span>
					I understand the generated agent private key will be stored in this browser's
					localStorage.
					<button type="button" class="ml-1 link" onclick={ctx.openAgentImportModal}>
						Add private key manually
					</button>
				</span>
			</label>
		</div>
	{:else}
		<div role="alert" class="alert alert-soft text-xs alert-warning">
			<span>Connect this tracked address to manage agents.</span>
		</div>
	{/if}

	{#if ctx.agentActionError}
		<div role="alert" class="alert alert-soft text-xs alert-error">
			<span>{ctx.agentActionError}</span>
		</div>
	{/if}
	{#if ctx.agentActionNotice}
		<div role="status" class="alert alert-soft text-xs alert-success">
			<span>{ctx.agentActionNotice}</span>
		</div>
	{/if}
	<CurlDetails curl={ctx.agentCurl} />

	<LoadableState
		loading={ctx.agentWallets.loading}
		error={ctx.agentWallets.error}
		hasData={ctx.agentWallets.data !== null}
	/>
	{#if ctx.agentWallets.data}
		{#if ctx.agentTableRows().length === 0}
			<p class="p-2 text-sm text-base-content/60">No agent wallets.</p>
		{:else}
			<TableScroll>
				<table class="table table-md">
					<thead>
						<tr class="text-[10px] text-base-content/50 uppercase">
							<th>
								<button
									type="button"
									class="btn h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
									onclick={() => ctx.setAgentSort('name')}
								>
									Name <SortIcon name={ctx.agentSortIndicator('name')} />
								</button>
							</th>
							<th>
								<button
									type="button"
									class="btn h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
									onclick={() => ctx.setAgentSort('address')}
								>
									Address
									<SortIcon name={ctx.agentSortIndicator('address')} />
								</button>
							</th>
							<th>
								<button
									type="button"
									class="btn h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
									onclick={() => ctx.setAgentSort('validUntil')}
								>
									Valid until
									<SortIcon name={ctx.agentSortIndicator('validUntil')} />
								</button>
							</th>
							<th>
								<button
									type="button"
									class="btn h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
									onclick={() => ctx.setAgentSort('status')}
								>
									Status
									<SortIcon name={ctx.agentSortIndicator('status')} />
								</button>
							</th>
							<th>
								<button
									type="button"
									class="btn h-auto min-h-0 px-1 py-0 text-[10px] uppercase btn-ghost btn-xs"
									onclick={() => ctx.setAgentSort('localKey')}
								>
									Local key
									<SortIcon name={ctx.agentSortIndicator('localKey')} />
								</button>
							</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each ctx.agentTableRows() as row (row.key)}
							<tr>
								<td class="max-w-40">
									<div class="truncate text-sm font-medium" title={row.name}>{row.name}</div>
									{#if row.createdAt}
										<div class="text-[10px] text-base-content/50">
											Created {ctx.fmtTs(row.createdAt)}
										</div>
									{/if}
								</td>
								<td class="whitespace-nowrap">
									<CopyAddress address={row.address} notification="Agent address copied" />
								</td>
								<td class="text-[11px] whitespace-nowrap">
									{row.validUntil == null ? '—' : ctx.fmtTs(row.validUntil)}
								</td>
								<td>
									<span class="badge badge-xs {row.registered ? 'badge-success' : 'badge-warning'}">
										{row.registered ? 'Registered' : 'Local only'}
									</span>
								</td>
								<td class="whitespace-nowrap">
									{#if row.privateKey}
										<CopyAddress
											address={row.privateKey}
											label="Copy key"
											notification="Agent private key copied"
											buttonClass="btn h-auto min-h-0 px-2 py-0 text-xs btn-ghost btn-xs"
										/>
									{:else}
										<span class="text-base-content/40">—</span>
									{/if}
								</td>
								<td class="whitespace-nowrap">
									<button
										type="button"
										class="btn btn-outline btn-xs btn-error"
										disabled={ctx.agentActionLoading !== null ||
											(row.registered && (!ctx.canSignForActiveAddress || !row.approvalName))}
										onclick={() => ctx.removeAgentWallet(row)}
									>
										{#if ctx.agentActionLoading === row.address}
											<span class="loading loading-xs loading-spinner"></span>
										{/if}
										{row.registered ? 'Remove' : 'Forget'}
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</TableScroll>
		{/if}
	{/if}
</div>

<dialog {@attach importDialogController} class="modal" onclose={ctx.closeAgentImportModal}>
	<div class="modal-box max-w-md">
		<div class="flex items-center justify-between gap-3">
			<h3 class="text-lg font-bold">Add private key</h3>
			<form method="dialog">
				<button class="btn btn-circle btn-ghost btn-sm" aria-label="Close">
					<HeroIcon name="x-mark" />
				</button>
			</form>
		</div>

		<form class="mt-5 space-y-3" onsubmit={ctx.submitImportAgentWalletPrivateKey}>
			<label class="form-control">
				<span class="label pb-1 text-xs text-base-content/60">Private key</span>
				<input
					class="input input-sm w-full font-mono"
					type="password"
					value={ctx.agentImportPrivateKeyInput}
					placeholder="0x..."
					autocomplete="off"
					oninput={updateImportPrivateKey}
				/>
			</label>
			<label class="form-control">
				<span class="label pb-1 text-xs text-base-content/60">Name</span>
				<input
					class="input input-sm w-full"
					maxlength="16"
					value={ctx.agentImportNameInput}
					placeholder="Optional"
					oninput={updateImportName}
				/>
			</label>
			<button
				type="submit"
				class="btn w-full btn-primary"
				disabled={ctx.agentActionLoading !== null || !ctx.agentStorageAck}
			>
				{#if ctx.agentActionLoading === 'import'}
					<span class="loading loading-xs loading-spinner"></span>
				{/if}
				Add private key
			</button>
		</form>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button aria-label="Close">close</button>
	</form>
</dialog>
