<script lang="ts" generics="T extends string">
	type TabSpec = {
		id: T;
		label: string;
		count?: number | null;
	};

	type Props = {
		tabs: readonly TabSpec[];
		active: T;
		onSelect: (id: T) => void;
		className?: string;
		countStyle?: 'parenthesized' | 'plain';
		showZeroCounts?: boolean;
	};

	let {
		tabs,
		active,
		onSelect,
		className = '',
		countStyle = 'parenthesized',
		showZeroCounts = false
	}: Props = $props();
</script>

<div role="tablist" class="tabs-box tabs flex-nowrap overflow-x-auto bg-base-200 {className}">
	{#each tabs as tab (tab.id)}
		<button
			role="tab"
			class="tab text-xs whitespace-nowrap"
			class:tab-active={active === tab.id}
			onclick={() => onSelect(tab.id)}
		>
			<span class="inline-flex items-center gap-1 whitespace-nowrap">
				<span>{tab.label}</span>
				{#if tab.count !== undefined && tab.count !== null && (showZeroCounts || tab.count > 0)}
					<span class="shrink-0 text-base-content/50">
						{countStyle === 'plain' ? tab.count : `(${tab.count})`}
					</span>
				{/if}
			</span>
		</button>
	{/each}
</div>
