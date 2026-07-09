<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';
	import type { PerpDexsResponse } from '@nktkas/hyperliquid';
	import TableScroll from '$lib/components/TableScroll.svelte';
	import { getHttpInfoClient } from '$lib/hl/clients.js';
	import {
		HEATMAP_BUCKET_COUNT,
		HEATMAP_BUCKET_MS,
		bucketStart,
		buildBucketStarts,
		buildHeatmapRows,
		fillNotional,
		heatCeiling,
		heatLevel,
		isNodeFill,
		mergeMarketVolumes,
		type MarketVolume,
		type NodeFill
	} from '$lib/volume-heatmap.js';

	type ConnectionState = 'connecting' | 'connected' | 'reconnecting' | 'disconnected';
	type NodeFillsMessage = {
		channel?: unknown;
		data?: unknown;
	};

	const NODE_FILLS_URL = 'wss://explorer.purr.build';
	const ROW_HEIGHT = 34;
	const HEADER_HEIGHT = 40;
	const VISIBLE_ROWS = 20;
	const OVERSCAN_ROWS = 5;
	const RANK_REFRESH_MS = 5 * 60_000;

	let connectionState = $state<ConnectionState>('connecting');
	let connectionError = $state<string | null>(null);
	let clock = $state(Date.now());
	let marketVolumes = $state<MarketVolume[]>([]);
	let rankLoading = $state(true);
	let rankError = $state<string | null>(null);
	let rankLoadedAt = $state<number | null>(null);
	let volumeByBucket = $state(new SvelteMap<number, Map<string, number>>());
	let uniqueTrades = $state(0);
	let sessionVolume = $state(0);
	let lastFillAt = $state<number | null>(null);
	let viewport = $state<HTMLDivElement | null>(null);
	let viewportHeight = $state(HEADER_HEIGHT + ROW_HEIGHT * VISIBLE_ROWS);
	let scrollTop = $state(0);

	const seenTrades = new SvelteMap<string, number>();
	let pendingFills: NodeFill[] = [];
	let flushFrame: number | null = null;
	let initialHorizontalPositionSet = false;
	let rankGeneration = 0;

	const compactUsdFormatter = new Intl.NumberFormat(undefined, {
		style: 'currency',
		currency: 'USD',
		notation: 'compact',
		maximumFractionDigits: 1
	});
	const usdFormatter = new Intl.NumberFormat(undefined, {
		style: 'currency',
		currency: 'USD',
		maximumFractionDigits: 2
	});
	const integerFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
	const timeFormatter = new Intl.DateTimeFormat(undefined, {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false
	});

	let bucketStarts = $derived(buildBucketStarts(clock));
	let rows = $derived(buildHeatmapRows(marketVolumes, volumeByBucket));
	let scaleCeiling = $derived(heatCeiling(volumeByBucket, bucketStarts));
	let rawWindowStart = $derived(
		Math.max(0, Math.floor(Math.max(0, scrollTop - HEADER_HEIGHT) / ROW_HEIGHT) - OVERSCAN_ROWS)
	);
	let windowStart = $derived(Math.min(rawWindowStart, Math.max(0, rows.length - 1)));
	let windowSize = $derived(
		Math.ceil(Math.max(0, viewportHeight - HEADER_HEIGHT) / ROW_HEIGHT) + OVERSCAN_ROWS * 2
	);
	let windowEnd = $derived(Math.min(rows.length, windowStart + windowSize));
	let windowRows = $derived(rows.slice(windowStart, windowEnd));
	let topSpacerHeight = $derived(windowStart * ROW_HEIGHT);
	let bottomSpacerHeight = $derived(Math.max(0, (rows.length - windowEnd) * ROW_HEIGHT));
	let connectionLabel = $derived(
		connectionState === 'connected'
			? 'Live'
			: connectionState === 'reconnecting'
				? 'Reconnecting'
				: connectionState === 'connecting'
					? 'Connecting'
					: 'Offline'
	);

	function coinForPerp(dex: NonNullable<PerpDexsResponse[number]> | null, assetName: string) {
		if (!dex || assetName.includes(':')) return assetName;
		return `${dex.name}:${assetName}`;
	}

	async function loadMarketVolumes(signal: AbortSignal, generation: number) {
		rankLoading = true;
		rankError = null;

		try {
			const info = getHttpInfoClient('mainnet');
			const [dexs, spotResponse] = await Promise.all([
				info.perpDexs(signal),
				info.spotMetaAndAssetCtxs(signal)
			]);
			const perpResponses = await Promise.all(
				dexs.map((dex) => info.metaAndAssetCtxs(dex ? { dex: dex.name } : {}, signal))
			);
			if (signal.aborted || generation !== rankGeneration) return;

			const next: MarketVolume[] = [];
			for (let dexIndex = 0; dexIndex < perpResponses.length; dexIndex += 1) {
				const [meta, contexts] = perpResponses[dexIndex];
				const dex = dexs[dexIndex] ?? null;
				for (let assetIndex = 0; assetIndex < meta.universe.length; assetIndex += 1) {
					const asset = meta.universe[assetIndex];
					next.push({
						coin: coinForPerp(dex, asset.name),
						dayVolume: Number(contexts[assetIndex]?.dayNtlVlm ?? 0)
					});
				}
			}

			const [, spotContexts] = spotResponse;
			for (const context of spotContexts) {
				next.push({ coin: context.coin, dayVolume: Number(context.dayNtlVlm) });
			}

			marketVolumes = mergeMarketVolumes(next);
			rankLoadedAt = Date.now();
		} catch (error) {
			if (signal.aborted || generation !== rankGeneration) return;
			rankError = error instanceof Error ? error.message : 'Could not load 24h market volumes.';
		} finally {
			if (!signal.aborted && generation === rankGeneration) rankLoading = false;
		}
	}

	function queueFills(data: unknown) {
		const fills = Array.isArray(data) ? data : [data];
		for (const fill of fills) {
			if (isNodeFill(fill)) pendingFills.push(fill);
		}
		if (flushFrame === null) flushFrame = requestAnimationFrame(flushFills);
	}

	function flushFills() {
		flushFrame = null;
		if (pendingFills.length === 0) return;

		const nextBuckets = new SvelteMap(volumeByBucket);
		let latestTime = clock;
		let addedTrades = 0;
		let addedVolume = 0;

		for (const fill of pendingFills) {
			const tradeKey = `${fill.coin}:${fill.tid}`;
			if (seenTrades.has(tradeKey)) continue;

			const notional = fillNotional(fill);
			if (notional === 0) continue;
			seenTrades.set(tradeKey, fill.time);
			const start = bucketStart(fill.time);
			const coinVolumes = new SvelteMap(nextBuckets.get(start) ?? []);
			coinVolumes.set(fill.coin, (coinVolumes.get(fill.coin) ?? 0) + notional);
			nextBuckets.set(start, coinVolumes);
			latestTime = Math.max(latestTime, fill.time);
			addedTrades += 1;
			addedVolume += notional;
		}

		pendingFills = [];
		const earliest = bucketStart(latestTime) - (HEATMAP_BUCKET_COUNT - 1) * HEATMAP_BUCKET_MS;
		for (const start of nextBuckets.keys()) {
			if (start < earliest) nextBuckets.delete(start);
		}
		for (const [key, time] of seenTrades) {
			if (time < earliest) seenTrades.delete(key);
		}

		if (addedTrades > 0) {
			volumeByBucket = nextBuckets;
			uniqueTrades += addedTrades;
			sessionVolume += addedVolume;
			lastFillAt = latestTime;
			clock = Math.max(Date.now(), latestTime);
		}
	}

	function parseSocketMessage(event: MessageEvent) {
		try {
			const message = JSON.parse(String(event.data)) as NodeFillsMessage;
			if (message.channel === 'nodeFills') queueFills(message.data);
		} catch {
			// Ignore malformed frames and keep the live stream connected.
		}
	}

	function clearHeatmap() {
		pendingFills = [];
		seenTrades.clear();
		volumeByBucket = new SvelteMap();
		uniqueTrades = 0;
		sessionVolume = 0;
		lastFillAt = null;
	}

	function handleScroll(event: Event) {
		scrollTop = (event.currentTarget as HTMLDivElement).scrollTop;
	}

	function volumeAt(start: number, coin: string) {
		return volumeByBucket.get(start)?.get(coin) ?? 0;
	}

	function formatCompactUsd(value: number) {
		return compactUsdFormatter.format(value);
	}

	function formatUsd(value: number) {
		return usdFormatter.format(value);
	}

	function formatTime(value: number) {
		return timeFormatter.format(value);
	}

	function cellTitle(coin: string, start: number, volume: number) {
		return `${coin} · ${formatTime(start)}–${formatTime(start + HEATMAP_BUCKET_MS)} · ${formatUsd(volume)}`;
	}

	function rankTimestamp(value: number | null) {
		return value == null ? 'Waiting for volume rank' : `Rank updated ${formatTime(value)}`;
	}

	onMount(() => {
		let destroyed = false;
		let socket: WebSocket | null = null;
		let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
		let reconnectAttempt = 0;
		let rankController = new AbortController();

		function connect() {
			if (destroyed) return;
			connectionState = reconnectAttempt === 0 ? 'connecting' : 'reconnecting';
			connectionError = null;
			socket = new WebSocket(NODE_FILLS_URL);

			socket.onopen = () => {
				if (destroyed) return;
				reconnectAttempt = 0;
				connectionState = 'connected';
				socket?.send(JSON.stringify({ method: 'subscribe', subscription: { type: 'nodeFills' } }));
			};
			socket.onmessage = parseSocketMessage;
			socket.onerror = () => {
				if (!destroyed) connectionError = 'The node fill stream encountered a connection error.';
			};
			socket.onclose = () => {
				if (destroyed) return;
				connectionState = 'reconnecting';
				const delay = Math.min(15_000, 1_000 * 2 ** reconnectAttempt);
				reconnectAttempt += 1;
				reconnectTimer = setTimeout(connect, delay);
			};
		}

		function refreshRanks() {
			rankController.abort();
			rankController = new AbortController();
			void loadMarketVolumes(rankController.signal, ++rankGeneration);
		}

		void loadMarketVolumes(rankController.signal, ++rankGeneration);
		connect();
		const clockTimer = setInterval(() => (clock = Date.now()), 1_000);
		const rankTimer = setInterval(refreshRanks, RANK_REFRESH_MS);

		return () => {
			destroyed = true;
			rankController.abort();
			clearInterval(clockTimer);
			clearInterval(rankTimer);
			if (reconnectTimer) clearTimeout(reconnectTimer);
			if (flushFrame !== null) cancelAnimationFrame(flushFrame);
			flushFrame = null;
			socket?.close();
			connectionState = 'disconnected';
		};
	});

	$effect(() => {
		if (!viewport || initialHorizontalPositionSet || rows.length === 0) return;
		void tick().then(() => {
			if (!viewport || initialHorizontalPositionSet) return;
			viewport.scrollLeft = viewport.scrollWidth;
			initialHorizontalPositionSet = true;
		});
	});
</script>

<svelte:head>
	<title>Volume Heatmap | purr.build</title>
	<meta
		name="description"
		content="Live Hyperliquid notional volume heatmap aggregated into five-second buckets."
	/>
</svelte:head>

<div class="mx-auto flex w-full max-w-[1600px] flex-col gap-3">
	<section class="rounded-lg bg-base-100 shadow-sm shadow-neutral/5">
		<div
			class="flex flex-wrap items-start justify-between gap-3 border-b border-base-300 px-4 py-3"
		>
			<div>
				<div class="flex flex-wrap items-center gap-2">
					<h1 class="text-base font-semibold tracking-tight">Volume heatmap</h1>
					<span class="badge badge-ghost badge-sm">Mainnet</span>
					<span
						class="badge gap-1.5 badge-sm {connectionState === 'connected'
							? 'badge-success'
							: 'badge-warning'}"
					>
						<span
							class="size-1.5 rounded-full bg-current {connectionState === 'connected'
								? 'animate-pulse'
								: ''}"
						></span>
						{connectionLabel}
					</span>
				</div>
			</div>
			<button class="btn btn-ghost btn-xs" onclick={clearHeatmap} disabled={uniqueTrades === 0}>
				Clear
			</button>
		</div>

		<div class="grid grid-cols-2 gap-px bg-base-200/70 sm:grid-cols-4">
			<div class="bg-base-100 px-4 py-2.5">
				<div class="text-[10px] font-medium tracking-wider text-base-content/40 uppercase">
					Session volume
				</div>
				<div class="mt-0.5 font-mono text-sm font-medium">{formatCompactUsd(sessionVolume)}</div>
			</div>
			<div class="bg-base-100 px-4 py-2.5">
				<div class="text-[10px] font-medium tracking-wider text-base-content/40 uppercase">
					Unique trades
				</div>
				<div class="mt-0.5 font-mono text-sm font-medium">
					{integerFormatter.format(uniqueTrades)}
				</div>
			</div>
			<div class="bg-base-100 px-4 py-2.5">
				<div class="text-[10px] font-medium tracking-wider text-base-content/40 uppercase">
					Markets ranked
				</div>
				<div class="mt-0.5 flex items-center gap-2 font-mono text-sm font-medium">
					{integerFormatter.format(marketVolumes.length)}
					{#if rankLoading}<span class="loading loading-xs loading-spinner"></span>{/if}
				</div>
			</div>
			<div class="bg-base-100 px-4 py-2.5">
				<div class="text-[10px] font-medium tracking-wider text-base-content/40 uppercase">
					Latest fill
				</div>
				<div class="mt-0.5 font-mono text-sm font-medium">
					{lastFillAt == null ? '—' : formatTime(lastFillAt)}
				</div>
			</div>
		</div>
	</section>

	{#if connectionError || rankError}
		<div role="alert" class="alert alert-soft py-2 text-xs alert-warning">
			<span>{connectionError ?? rankError}</span>
		</div>
	{/if}

	<section class="min-h-0 overflow-hidden rounded-lg bg-base-100 shadow-sm shadow-neutral/5">
		<div
			class="flex flex-wrap items-center justify-between gap-2 border-b border-base-300 px-4 py-2 text-[11px] text-base-content/50"
		>
			<div class="flex items-center gap-3">
				<span>{rankTimestamp(rankLoadedAt)}</span>
				<span>Sorted by Hyperliquid 24h notional volume</span>
			</div>
			<div class="flex items-center gap-2" aria-label="Volume intensity legend">
				<span>Less</span>
				{#each [0.12, 0.28, 0.48, 0.72, 1] as level (level)}
					<span class="legend-cell" style={`--heat: ${level}`}></span>
				{/each}
				<span>More</span>
			</div>
		</div>

		{#if rows.length === 0 && rankLoading}
			<div class="grid h-52 place-items-center">
				<div class="flex items-center gap-2 text-sm text-base-content/55">
					<span class="loading loading-sm loading-spinner"></span>
					Loading market ranks…
				</div>
			</div>
		{:else if rows.length === 0}
			<p class="p-6 text-sm text-base-content/55">Waiting for the first market fill.</p>
		{:else}
			<TableScroll
				bind:viewport
				bind:clientHeight={viewportHeight}
				maxHeight={`min(${HEADER_HEIGHT + ROW_HEIGHT * VISIBLE_ROWS}px, calc(100svh - 15rem))`}
				onscroll={handleScroll}
			>
				<table class="heatmap-table border-separate border-spacing-0">
					<colgroup>
						<col class="coin-column" />
						{#each bucketStarts as start (start)}
							<col class="bucket-column" />
						{/each}
					</colgroup>
					<thead>
						<tr>
							<th class="coin-heading" scope="col">
								<span>Coin</span>
								<span>24h volume</span>
							</th>
							{#each bucketStarts as start, index (start)}
								<th
									class="time-heading"
									class:latest-column={index === bucketStarts.length - 1}
									scope="col"
									title={formatTime(start)}
								>
									{#if index % 6 === 0}
										<span>{formatTime(start)}</span>
									{/if}
								</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#if topSpacerHeight > 0}
							<tr aria-hidden="true">
								<td
									colspan={HEATMAP_BUCKET_COUNT + 1}
									class="spacer-cell"
									style={`height: ${topSpacerHeight}px`}
								></td>
							</tr>
						{/if}
						{#each windowRows as row, index (row.coin)}
							<tr class="heatmap-row" class:striped={(windowStart + index) % 2 === 1}>
								<th class="coin-cell" scope="row" title={row.coin}>
									<span class="rank">{row.rank ?? '•'}</span>
									<span class="coin-name">{row.coin}</span>
									<span class="day-volume">
										{row.rank === null ? 'new' : formatCompactUsd(row.dayVolume)}
									</span>
								</th>
								{#each bucketStarts as start, bucketIndex (start)}
									{@const volume = volumeAt(start, row.coin)}
									<td
										class="heat-cell"
										class:latest-column={bucketIndex === bucketStarts.length - 1}
										class:has-volume={volume > 0}
										style={`--heat: ${heatLevel(volume, scaleCeiling)}`}
										title={cellTitle(row.coin, start, volume)}
										aria-label={cellTitle(row.coin, start, volume)}
									></td>
								{/each}
							</tr>
						{/each}
						{#if bottomSpacerHeight > 0}
							<tr aria-hidden="true">
								<td
									colspan={HEATMAP_BUCKET_COUNT + 1}
									class="spacer-cell"
									style={`height: ${bottomSpacerHeight}px`}
								></td>
							</tr>
						{/if}
					</tbody>
				</table>
			</TableScroll>
		{/if}
	</section>
</div>

<style>
	.heatmap-table {
		table-layout: fixed;
		width: calc(184px + 32px * 60);
		min-width: calc(184px + 32px * 60);
		font-variant-numeric: tabular-nums;
	}

	.coin-column {
		width: 184px;
	}

	.bucket-column {
		width: 32px;
	}

	.coin-heading,
	.time-heading {
		height: 40px;
		background: color-mix(in oklab, var(--color-base-100) 94%, var(--color-base-200));
		border-bottom: 1px solid color-mix(in oklab, var(--color-base-content) 7%, transparent);
	}

	.coin-heading {
		position: sticky;
		left: 0;
		z-index: 30;
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 184px;
		padding: 0 10px;
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: color-mix(in oklab, var(--color-base-content) 45%, transparent);
		box-shadow: 1px 0 color-mix(in oklab, var(--color-base-content) 7%, transparent);
	}

	.time-heading {
		position: relative;
		padding: 0;
		border-left: 1px solid color-mix(in oklab, var(--color-base-content) 4%, transparent);
	}

	.time-heading span {
		position: absolute;
		bottom: 7px;
		left: 4px;
		z-index: 1;
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 9px;
		font-weight: 500;
		white-space: nowrap;
		color: color-mix(in oklab, var(--color-base-content) 42%, transparent);
	}

	.heatmap-row {
		height: 34px;
		background: var(--color-base-100);
	}

	.heatmap-row.striped {
		background: color-mix(in oklab, var(--color-base-200) 36%, var(--color-base-100));
	}

	.coin-cell {
		position: sticky;
		left: 0;
		z-index: 12;
		height: 34px;
		padding: 0 9px;
		background: inherit;
		box-shadow: 1px 0 color-mix(in oklab, var(--color-base-content) 7%, transparent);
	}

	.coin-cell > :global(*) {
		pointer-events: none;
	}

	.coin-cell {
		display: grid;
		grid-template-columns: 24px minmax(0, 1fr) auto;
		align-items: center;
		gap: 5px;
	}

	.rank {
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 9px;
		font-weight: 400;
		color: color-mix(in oklab, var(--color-base-content) 35%, transparent);
	}

	.coin-name {
		overflow: hidden;
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 11px;
		font-weight: 600;
		text-align: left;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.day-volume {
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 9px;
		font-weight: 400;
		color: color-mix(in oklab, var(--color-base-content) 48%, transparent);
	}

	.heat-cell {
		height: 34px;
		padding: 0;
		background: color-mix(in oklab, var(--color-base-200) 34%, transparent);
		border-bottom: 1px solid color-mix(in oklab, var(--color-base-content) 3%, transparent);
		border-left: 1px solid color-mix(in oklab, var(--color-base-content) 4%, transparent);
	}

	.heat-cell.has-volume,
	.legend-cell {
		background: color-mix(
			in oklab,
			var(--color-primary) calc(var(--heat) * 86%),
			color-mix(in oklab, var(--color-base-200) 44%, transparent)
		);
	}

	.heat-cell.has-volume {
		box-shadow: inset 0 0 0 1px
			color-mix(in oklab, var(--color-primary-content) calc(var(--heat) * 8%), transparent);
	}

	.latest-column {
		border-right: 1px solid color-mix(in oklab, var(--color-primary) 45%, transparent);
	}

	.legend-cell {
		display: inline-block;
		width: 14px;
		height: 10px;
		border-radius: 2px;
	}

	.spacer-cell {
		padding: 0;
		border: 0;
	}
</style>
