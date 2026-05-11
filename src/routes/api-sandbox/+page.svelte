<script lang="ts">
	import ApiSandbox from '$lib/components/ApiSandbox.svelte';
	import SupportFooter from '$lib/components/SupportFooter.svelte';
</script>

<svelte:head>
	<title>API Sandbox | purr.build</title>
	<meta
		name="description"
		content="Sign Hyperliquid exchange payloads and preview the resulting HTTP curl request."
	/>
</svelte:head>

<div class="flex min-h-[calc(100svh-3.5rem-1.5rem)] flex-col gap-3">
	<div class="min-h-0 flex-1 overflow-y-auto">
		<div class="mx-auto max-w-7xl">
			<ApiSandbox />
		</div>
	</div>
	<SupportFooter />
</div>
