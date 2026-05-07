<script lang="ts">
	export type HeroIconName =
		| 'arrow-down-tray'
		| 'arrow-path'
		| 'arrow-right'
		| 'bars-3'
		| 'chevron-down'
		| 'chevron-up'
		| 'pencil-square'
		| 'x-mark';

	type Props = {
		name: HeroIconName | null | undefined;
		class?: string;
		strokeWidth?: number;
	};

	let { name, class: className = 'size-4', strokeWidth = 1.5 }: Props = $props();

	const paths: Record<HeroIconName, string> = {
		'arrow-down-tray':
			'M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3',
		'arrow-path':
			'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99',
		'arrow-right': 'M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3',
		'bars-3': 'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5',
		'chevron-down': 'm19.5 8.25-7.5 7.5-7.5-7.5',
		'chevron-up': 'm4.5 15.75 7.5-7.5 7.5 7.5',
		'pencil-square':
			'm16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10',
		'x-mark': 'M6 18 18 6M6 6l12 12'
	};
</script>

{#if name}
	<svg
		class={className}
		fill="none"
		focusable="false"
		aria-hidden="true"
		viewBox="0 0 24 24"
		stroke-width={strokeWidth}
		stroke="currentColor"
	>
		<path stroke-linecap="round" stroke-linejoin="round" d={paths[name]} />
	</svg>
{/if}
