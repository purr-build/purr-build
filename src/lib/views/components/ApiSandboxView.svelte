<script lang="ts">
	import ApiSandbox from '$lib/components/ApiSandbox.svelte';
	import View from '../View.svelte';

	type Props = {
		viewId: string;
	};

	let { viewId }: Props = $props();
</script>

<View {viewId} title="API Sandbox">
	{#snippet subtitleContent()}
		<span>Sign and preview exchange requests</span>
	{/snippet}

	<div class="p-3">
		<ApiSandbox />
	</div>
</View>
