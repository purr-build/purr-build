<script lang="ts">
	import { browser } from '$app/environment';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import { wallet } from '$lib/stores/wallet.svelte';
	import { HYPERLIQUID_NETWORKS, hyperliquidNetwork } from '$lib/hl/network.svelte';
	import purr from '$lib/assets/purr.svg';

	import CopyAddress from './CopyAddress.svelte';
	import ConnectWalletModal from './ConnectWalletModal.svelte';

	const THEME_STORAGE_KEY = 'purrbuild:theme';
	const UI_THEMES = [
		{ id: 'dim', label: 'Dim' },
		{ id: 'silk', label: 'Silk' },
		{ id: 'nord', label: 'Nord' },
		{ id: 'business', label: 'Business' }
	] as const;

	type UiTheme = (typeof UI_THEMES)[number]['id'];

	let modalOpen = $state(false);
	let selectedTheme = $state<UiTheme>('dim');

	function isUiTheme(value: string | null | undefined): value is UiTheme {
		return UI_THEMES.some((theme) => theme.id === value);
	}

	function applyTheme(theme: UiTheme, persist = true) {
		selectedTheme = theme;
		if (!browser) return;

		document.documentElement.dataset.theme = theme;
		if (persist) localStorage.setItem(THEME_STORAGE_KEY, theme);
	}

	onMount(() => {
		const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
		const documentTheme = document.documentElement.dataset.theme;
		const initialTheme = isUiTheme(storedTheme)
			? storedTheme
			: isUiTheme(documentTheme)
				? documentTheme
				: 'dim';

		applyTheme(initialTheme, false);
	});
</script>

<header
	class="navbar sticky top-0 z-30 min-h-14 bg-base-100/85 px-3 py-0 shadow-sm shadow-neutral/5 backdrop-blur-xl sm:px-6"
>
	<div class="navbar-start min-w-0">
		<a
			href={resolve('/')}
			class="flex min-w-0 items-center gap-2.5 text-base font-semibold tracking-tight"
		>
			<span class="grid size-8 shrink-0 place-items-center rounded-lg bg-base-200/70">
				<img src={purr} alt="purr" class="block size-5 object-contain" />
			</span>
			<span class="truncate leading-none">purr.build</span>
		</a>
	</div>

	<div class="navbar-end min-w-0 gap-2">
		<a href={resolve('/api-sandbox')} class="btn hidden btn-ghost btn-sm md:inline-flex">
			API sandbox
		</a>

		<select
			class="select hidden w-28 select-ghost bg-base-200/70 select-xs md:inline-flex"
			aria-label="UI theme"
			bind:value={selectedTheme}
			onchange={() => applyTheme(selectedTheme)}
		>
			{#each UI_THEMES as theme (theme.id)}
				<option value={theme.id}>{theme.label}</option>
			{/each}
		</select>

		<div class="flex min-w-0 items-center gap-2">
			<div
				class="join rounded-lg bg-base-200/70 p-0.5"
				role="group"
				aria-label="Hyperliquid network"
			>
				{#each Object.values(HYPERLIQUID_NETWORKS) as option (option.id)}
					<button
						class="btn join-item border-0 btn-xs sm:btn-sm"
						class:btn-primary={hyperliquidNetwork.current === option.id}
						class:btn-ghost={hyperliquidNetwork.current !== option.id}
						aria-pressed={hyperliquidNetwork.current === option.id}
						onclick={() => hyperliquidNetwork.set(option.id)}
					>
						{option.label}
					</button>
				{/each}
			</div>
			{#if wallet.current}
				<div class="dropdown dropdown-end">
					<button class="btn flex items-center gap-2 normal-case btn-ghost btn-sm">
						{#if wallet.current.providerIcon}
							<img src={wallet.current.providerIcon} alt="" class="size-4 rounded" />
						{:else}
							<span
								class="size-2 rounded-full {wallet.current.source === 'injected'
									? 'bg-success'
									: 'bg-warning'}"
								aria-hidden="true"
							></span>
						{/if}
						{wallet.short}
					</button>
					<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
					<ul
						tabindex="0"
						class="dropdown-content menu z-40 mt-2 w-56 rounded-lg bg-base-100/95 p-2 shadow-xl shadow-neutral/20 backdrop-blur-xl"
					>
						<li class="menu-title">
							<span class="text-[10px] tracking-wider uppercase">
								{wallet.current.source === 'injected'
									? (wallet.current.providerName ?? 'Injected wallet')
									: 'Manual (read-only)'}
							</span>
						</li>
						<li>
							<CopyAddress
								address={wallet.current.address}
								label="Copy address"
								notification="Wallet address copied"
								buttonClass="w-full px-2 py-1.5 text-left text-sm"
							/>
						</li>
						<li><button onclick={() => wallet.disconnect()}>Disconnect</button></li>
					</ul>
				</div>
			{:else}
				<button class="btn btn-sm btn-primary" onclick={() => (modalOpen = true)}>
					Connect wallet
				</button>
			{/if}
		</div>
	</div>
</header>

<ConnectWalletModal open={modalOpen} onClose={() => (modalOpen = false)} />
