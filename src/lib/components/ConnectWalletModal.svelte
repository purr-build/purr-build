<script lang="ts">
	import HeroIcon from '$lib/components/HeroIcon.svelte';
	import { wallet } from '$lib/stores/wallet.svelte';

	type Props = {
		open: boolean;
		onClose: () => void;
	};

	let { open, onClose }: Props = $props();

	let manualAddress = $state('');

	function dialogController(node: HTMLDialogElement) {
		$effect(() => {
			if (open && !node.open) node.showModal();
			else if (!open && node.open) node.close();
		});

		$effect(() => {
			return wallet.discover();
		});
	}

	async function pick(provider: (typeof wallet.providers)[number]) {
		await wallet.connect(provider);
		if (wallet.current) {
			manualAddress = '';
			onClose();
		}
	}

	async function pickLegacy() {
		await wallet.connectLegacyInjected();
		if (wallet.current) {
			manualAddress = '';
			onClose();
		}
	}

	function handleManualSubmit(event: SubmitEvent) {
		event.preventDefault();
		if (wallet.setManual(manualAddress)) {
			manualAddress = '';
			onClose();
		}
	}
</script>

<dialog {@attach dialogController} class="modal" onclose={onClose}>
	<div class="modal-box max-w-md">
		<div class="flex items-center justify-between">
			<h3 class="text-lg font-bold">Connect wallet</h3>
			<form method="dialog">
				<button class="btn btn-circle btn-ghost btn-sm" aria-label="Close">
					<HeroIcon name="x-mark" />
				</button>
			</form>
		</div>

		<div class="mt-5 space-y-4">
			{#if wallet.providers.length > 0}
				<ul class="space-y-2">
					{#each wallet.providers as p (p.info.uuid)}
						<li>
							<button
								class="btn w-full justify-start gap-3 normal-case"
								disabled={wallet.connecting !== null}
								onclick={() => pick(p)}
							>
								<img src={p.info.icon} alt="" class="size-6 rounded" />
								<span class="flex-1 text-left">{p.info.name}</span>
								{#if wallet.connecting === p.info.uuid}
									<span class="loading loading-sm loading-spinner"></span>
								{/if}
							</button>
						</li>
					{/each}
				</ul>
			{:else}
				<button
					class="btn w-full btn-primary"
					disabled={wallet.connecting !== null}
					onclick={pickLegacy}
				>
					{#if wallet.connecting === 'legacy'}
						<span class="loading loading-sm loading-spinner"></span>
					{/if}
					Connect injected wallet
				</button>
				<p class="text-center text-xs text-base-content/60">
					No EIP-6963 wallets detected. Install
					<a class="link" href="https://metamask.io" target="_blank" rel="noreferrer">MetaMask</a>,
					<a class="link" href="https://rabby.io" target="_blank" rel="noreferrer">Rabby</a>, or
					<a class="link" href="https://www.coinbase.com/wallet" target="_blank" rel="noreferrer">
						Coinbase Wallet
					</a>.
				</p>
			{/if}

			<div class="divider">OR</div>

			<form class="space-y-2" onsubmit={handleManualSubmit}>
				<label class="floating-label">
					<span>Address</span>
					<input
						type="text"
						class="input-bordered input w-full font-mono text-sm"
						placeholder="0x..."
						bind:value={manualAddress}
						spellcheck="false"
						autocomplete="off"
					/>
				</label>
				<button
					type="submit"
					class="btn w-full btn-outline"
					disabled={manualAddress.trim().length === 0}
				>
					Use address (read-only)
				</button>
			</form>

			{#if wallet.error}
				<div role="alert" class="alert alert-soft text-sm alert-error">
					<span>{wallet.error}</span>
				</div>
			{/if}
		</div>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button aria-label="Close">close</button>
	</form>
</dialog>
