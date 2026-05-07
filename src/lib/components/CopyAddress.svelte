<script lang="ts">
	import { onDestroy } from 'svelte';

	type Props = {
		address: string | null | undefined;
		emptyLabel?: string;
		label?: string;
		notification?: string;
		title?: string;
		buttonClass?: string;
	};

	let {
		address,
		emptyLabel = '—',
		label,
		notification = 'Contract address copied',
		title,
		buttonClass = 'btn h-auto min-h-0 px-1 py-0 font-mono text-xs btn-ghost btn-xs'
	}: Props = $props();
	let copied = $state(false);
	let timeout: ReturnType<typeof setTimeout> | null = null;

	function shortValue(value: string) {
		return `${value.slice(0, 6)}…${value.slice(-4)}`;
	}

	async function copyValue() {
		if (!address) return;
		await navigator.clipboard?.writeText(address);
		copied = true;
		if (timeout) clearTimeout(timeout);
		timeout = setTimeout(() => {
			copied = false;
			timeout = null;
		}, 1800);
	}

	onDestroy(() => {
		if (timeout) clearTimeout(timeout);
	});
</script>

{#if address}
	<button type="button" class={buttonClass} title={title ?? `Copy ${address}`} onclick={copyValue}>
		{label ?? shortValue(address)}
	</button>
	{#if copied}
		<div
			class="pointer-events-none toast toast-end toast-top z-50"
			role="status"
			aria-live="polite"
		>
			<div class="alert alert-soft py-2 text-xs alert-success">
				<span>{notification}</span>
			</div>
		</div>
	{/if}
{:else}
	<span class="text-base-content/40">{emptyLabel}</span>
{/if}
