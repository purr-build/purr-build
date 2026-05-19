<script lang="ts">
	import { getAddress, isAddress, type Address } from 'viem';
	import HeroIcon from '$lib/components/HeroIcon.svelte';
	import { savedAgentWalletFromPrivateKey, type SavedAgentWallet } from '$lib/hl/agent-wallets.js';
	import { normalizeTrackedWalletName, TRACKED_WALLET_NAME_MAX_LENGTH } from '$lib/wallet-names.js';

	type Props = {
		open: boolean;
		currentAddress?: Address | null;
		title?: string;
		addCurrentLabel?: string;
		showAgentWallet?: boolean;
		onAdd: (address: Address, name: string | null, agentWallet: SavedAgentWallet | null) => void;
		onAddCurrent?: (name: string | null) => void;
		onClose: () => void;
	};

	let {
		open,
		currentAddress = null,
		title = 'Track wallet',
		addCurrentLabel = 'Add current address',
		showAgentWallet = true,
		onAdd,
		onAddCurrent,
		onClose
	}: Props = $props();

	let addressInput = $state('');
	let nameInput = $state('');
	let agentPrivateKeyInput = $state('');
	let agentStorageAck = $state(false);
	let error = $state<string | null>(null);
	let agentKeyPending = $derived(showAgentWallet && agentPrivateKeyInput.trim() !== '');

	function dialogController(node: HTMLDialogElement) {
		$effect(() => {
			if (open && !node.open) node.showModal();
			else if (!open && node.open) node.close();
		});
	}

	function close() {
		addressInput = '';
		nameInput = '';
		agentPrivateKeyInput = '';
		agentStorageAck = false;
		error = null;
		onClose();
	}

	function handleSubmit(event: SubmitEvent) {
		event.preventDefault();

		const trimmed = addressInput.trim();
		if (!isAddress(trimmed)) {
			error = 'Enter a valid EVM address.';
			return;
		}

		const name = normalizeTrackedWalletName(nameInput);
		let agentWallet: SavedAgentWallet | null = null;
		try {
			if (agentKeyPending) {
				if (!agentStorageAck) {
					throw new Error('Acknowledge local private-key storage before saving this agent.');
				}
				agentWallet = savedAgentWalletFromPrivateKey(agentPrivateKeyInput, { name });
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to save agent private key.';
			return;
		}

		onAdd(getAddress(trimmed), name, agentWallet);
		close();
	}

	function addCurrent() {
		if (!currentAddress || !onAddCurrent) return;
		onAddCurrent(normalizeTrackedWalletName(nameInput));
		close();
	}

	const short = (address: Address) => `${address.slice(0, 6)}…${address.slice(-4)}`;
</script>

<dialog {@attach dialogController} class="modal" onclose={close}>
	<div class="modal-box max-w-md">
		<div class="flex items-center justify-between">
			<h3 class="text-lg font-bold">{title}</h3>
			<form method="dialog">
				<button class="btn btn-circle btn-ghost btn-sm" aria-label="Close">
					<HeroIcon name="x-mark" />
				</button>
			</form>
		</div>

		<div class="mt-5 space-y-4">
			<label class="floating-label">
				<span>Name (Optional)</span>
				<input
					type="text"
					class="input-bordered input w-full text-sm"
					placeholder="Name (Optional)"
					bind:value={nameInput}
					maxlength={TRACKED_WALLET_NAME_MAX_LENGTH}
					autocomplete="off"
				/>
			</label>

			{#if currentAddress && onAddCurrent}
				<button class="btn w-full justify-between gap-3 btn-primary" onclick={addCurrent}>
					<span>{addCurrentLabel}</span>
					<span class="font-mono text-xs opacity-75">{short(currentAddress)}</span>
				</button>
				<div class="divider">OR</div>
			{/if}

			<form class="space-y-3" onsubmit={handleSubmit}>
				<label class="floating-label">
					<span>Address</span>
					<input
						type="text"
						class="input-bordered input w-full font-mono text-sm"
						placeholder="0x..."
						bind:value={addressInput}
						spellcheck="false"
						autocomplete="off"
					/>
				</label>
				{#if showAgentWallet}
					<label class="floating-label">
						<span>Agent private key (Optional)</span>
						<input
							type="password"
							class="input-bordered input w-full font-mono text-sm"
							placeholder="0x..."
							bind:value={agentPrivateKeyInput}
							spellcheck="false"
							autocomplete="off"
						/>
					</label>
					{#if agentKeyPending}
						<label class="flex items-start gap-2 text-xs text-base-content/70">
							<input
								type="checkbox"
								class="checkbox mt-0.5 checkbox-xs"
								bind:checked={agentStorageAck}
							/>
							<span>
								I understand this agent private key will be stored in this browser's localStorage.
							</span>
						</label>
					{/if}
				{/if}
				<button
					type="submit"
					class="btn w-full btn-outline"
					disabled={addressInput.trim() === '' || (agentKeyPending && !agentStorageAck)}
				>
					Continue
				</button>
			</form>
		</div>

		{#if error}
			<div role="alert" class="mt-4 alert alert-soft text-sm alert-error">
				<span>{error}</span>
			</div>
		{/if}
	</div>
	<form method="dialog" class="modal-backdrop">
		<button aria-label="Close">close</button>
	</form>
</dialog>
