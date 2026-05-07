<script lang="ts">
	type Props = {
		curl: string | null;
	};

	let { curl }: Props = $props();
</script>

{#if curl}
	<details class="collapse-arrow collapse rounded-lg border border-base-300 bg-base-100">
		<summary class="collapse-title min-h-0 px-3 py-2 text-xs font-medium">Show curl</summary>
		<div class="collapse-content px-3 pb-3">
			<pre
				class="max-h-72 overflow-auto rounded bg-base-200 p-3 text-[11px] whitespace-pre-wrap text-base-content/80"><code
					>{curl}</code
				></pre>
		</div>
	</details>
{/if}
