<script lang="ts">
	import HeroIcon from '$lib/components/HeroIcon.svelte';

	type Option = {
		label: string;
		description?: string;
		run: () => void;
	};

	type Props = {
		open: boolean;
		options: Option[];
		onClose: () => void;
	};

	let { open, options, onClose }: Props = $props();

	let highlightedIndex = $state(0);

	function dialogController(node: HTMLDialogElement) {
		$effect(() => {
			if (open && !node.open) node.showModal();
			else if (!open && node.open) node.close();
		});
	}

	function select(option: Option) {
		option.run();
		onClose();
	}

	function handleKeydown(event: KeyboardEvent) {
		if (options.length === 0) return;
		switch (event.key) {
			case 'ArrowDown':
				highlightedIndex = (highlightedIndex + 1) % options.length;
				break;
			case 'ArrowUp':
				highlightedIndex = (highlightedIndex - 1 + options.length) % options.length;
				break;
			case 'Enter':
				select(options[highlightedIndex]);
				break;
			default:
				return;
		}
		event.preventDefault();
	}
</script>

<dialog
	{@attach dialogController}
	class="modal"
	onclose={onClose}
	onkeydown={handleKeydown}
	ontoggle={(event) => {
		if (event.currentTarget.open) highlightedIndex = 0;
	}}
>
	<div class="modal-box max-w-md">
		<div class="flex items-center justify-between">
			<h3 class="text-lg font-bold">Add widget</h3>
			<form method="dialog">
				<button class="btn btn-circle btn-ghost btn-sm" aria-label="Close">
					<HeroIcon name="x-mark" />
				</button>
			</form>
		</div>

		<ul class="mt-5 grid gap-2">
			{#each options as option, index (option.label)}
				<li>
					<button
						type="button"
						class="flex w-full flex-col items-start gap-0.5 rounded-lg border px-3 py-2 text-left transition-colors {index ===
						highlightedIndex
							? 'border-primary bg-base-200/60'
							: 'border-base-300'}"
						onmouseenter={() => (highlightedIndex = index)}
						onclick={() => select(option)}
					>
						<span class="text-sm font-semibold">{option.label}</span>
						{#if option.description}
							<span class="text-xs text-base-content/60">{option.description}</span>
						{/if}
					</button>
				</li>
			{/each}
		</ul>
	</div>
	<form method="dialog" class="modal-backdrop">
		<button aria-label="Close">close</button>
	</form>
</dialog>
