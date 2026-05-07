<script lang="ts">
	type Props = {
		loading: boolean;
		error: string | null;
		hasData?: boolean;
	};

	let { loading, error, hasData = false }: Props = $props();
</script>

{#if loading && !hasData}
	<div class="flex items-center justify-center py-8">
		<span class="loading loading-sm loading-spinner"></span>
	</div>
{:else if error}
	<div class="px-3 py-2">
		<div role="alert" class="alert alert-soft text-xs alert-error">
			<span>{error}</span>
		</div>
	</div>
{/if}
