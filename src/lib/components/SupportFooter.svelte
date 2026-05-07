<script lang="ts">
	import CopyAddress from './CopyAddress.svelte';

	const SUPPORT_ADDRESS = '0xBAE94193E11Fc2f6EDd9A3D8225955C2F2544850';
	const X_ICON_PATH =
		'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817-5.964 6.817H1.683l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z';
	const GITHUB_ICON_PATH =
		'M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.17c-3.34.73-4.04-1.42-4.04-1.42-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49.99.11-.78.42-1.3.76-1.6-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.12-.3-.54-1.52.12-3.18 0 0 1.01-.32 3.3 1.23A11.5 11.5 0 0 1 12 5.85c1.02.01 2.04.14 3 .4 2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.24 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.81 5.63-5.48 5.93.43.37.81 1.1.81 2.22v3.29c0 .32.22.69.83.58A12 12 0 0 0 12 .5';
</script>

<footer
	class="flex min-h-8 flex-wrap items-center justify-center gap-x-3 gap-y-1 px-1 text-center text-xs text-base-content/50"
>
	<span class="whitespace-nowrap">Support us:</span>
	<CopyAddress
		address={SUPPORT_ADDRESS}
		label={SUPPORT_ADDRESS}
		notification="Support address copied"
		buttonClass="min-w-0 max-w-full break-all px-0 py-0 text-left font-mono text-[11px] text-base-content/60 hover:text-base-content"
	/>
	<div class="flex items-center gap-1">
		<a
			class="btn btn-circle btn-ghost btn-xs"
			href="https://x.com/purrbuild"
			target="_blank"
			rel="noreferrer noopener"
			aria-label="Open purr.build on X"
			title="X"
		>
			<svg class="size-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
				<path d={X_ICON_PATH} />
			</svg>
		</a>
		<a
			class="btn btn-circle btn-ghost btn-xs"
			href="https://github.com/purr-build"
			target="_blank"
			rel="noreferrer noopener"
			aria-label="Open purr.build on GitHub"
			title="GitHub"
		>
			<svg class="size-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
				<path d={GITHUB_ICON_PATH} />
			</svg>
		</a>
	</div>
</footer>
