<script lang="ts">
	import type {
		AllPerpMetasResponse,
		OutcomeMetaResponse,
		PerpDexsResponse,
		SpotMetaResponse
	} from '@nktkas/hyperliquid';
	import type { Component } from 'svelte';
	import HeroIcon from '$lib/components/HeroIcon.svelte';
	import TableScroll from '$lib/components/TableScroll.svelte';
	import { getHttpInfoClient } from '$lib/hl/clients.js';
	import { hyperliquidNetwork, type HyperliquidNetwork } from '$lib/hl/network.svelte';
	import ViewTabs from './ViewTabs.svelte';
	import OutcomesTab from './asset-universe/OutcomesTab.svelte';
	import PerpsTab from './asset-universe/PerpsTab.svelte';
	import SpotTab from './asset-universe/SpotTab.svelte';
	import View from '../View.svelte';

	type Props = {
		viewId: string;
	};
	type UniverseTabComponent = Component<{ ctx: unknown }>;

	let { viewId }: Props = $props();

	const TABS = [
		{ id: 'perps', label: 'All DEXes', component: PerpsTab },
		{ id: 'spot', label: 'Spot', component: SpotTab },
		{ id: 'outcomes', label: 'Outcomes', component: OutcomesTab }
	] as const;

	type TabId = (typeof TABS)[number]['id'];
	type PerpMeta = AllPerpMetasResponse[number];
	type PerpAsset = PerpMeta['universe'][number];
	type SpotToken = SpotMetaResponse['tokens'][number];
	type SpotMarket = SpotMetaResponse['universe'][number];
	type Outcome = OutcomeMetaResponse['outcomes'][number];
	type OutcomeQuestion = OutcomeMetaResponse['questions'][number];
	type OutcomeSide = Outcome['sideSpecs'][number];
	type BaseUniverseRow = {
		key: string;
		search: string;
	};
	type PerpUniverseRow = BaseUniverseRow & {
		kind: 'perp';
		asset: PerpAsset;
		assetId: number;
		dex: string;
		dexLabel: string;
		collateralToken: number;
		oiCap: string | null;
		fundingMultiplier: string | null;
		fundingInterestRate: string | null;
	};
	type SpotUniverseRow = BaseUniverseRow & {
		kind: 'spot';
		token: SpotToken;
		markets: string[];
		primaryMarket: string | null;
	};
	type OutcomeUniverseRow = BaseUniverseRow & {
		kind: 'outcome';
		outcome: Outcome;
		side: OutcomeSide;
		marketName: string;
		description: string;
		encoding: number;
		settled: boolean;
		fallback: boolean;
	};
	type UniverseRow = PerpUniverseRow | SpotUniverseRow | OutcomeUniverseRow;
	type UniverseData = {
		perps: PerpUniverseRow[];
		spot: SpotUniverseRow[];
		outcomes: OutcomeUniverseRow[];
		spotMarketCount: number;
		outcomeMarketCount: number;
		outcomeQuestionCount: number;
	};

	const ROW_HEIGHT = 48;
	const OVERSCAN_ROWS = 8;

	let activeTab = $state<TabId>('perps');
	let query = $state('');
	let loading = $state(false);
	let error = $state<string | null>(null);
	let data = $state<UniverseData | null>(null);
	let loadedAt = $state<number | null>(null);
	let listNode = $state<HTMLDivElement | null>(null);
	let viewportHeight = $state(560);
	let scrollTop = $state(0);
	let listResetKey = '';
	let loadGeneration = 0;

	const integerFormatter = new Intl.NumberFormat(undefined, {
		maximumFractionDigits: 0
	});
	const decimalFormatter = new Intl.NumberFormat(undefined, {
		maximumFractionDigits: 8
	});
	const percentFormatter = new Intl.NumberFormat(undefined, {
		maximumFractionDigits: 4
	});

	let normalizedQuery = $derived(query.trim().toLowerCase());
	let activeRows = $derived(rowsForTab(activeTab));
	let filteredRows = $derived(filterRows(activeRows, normalizedQuery));
	let rawWindowStart = $derived(Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN_ROWS));
	let windowStart = $derived(Math.min(rawWindowStart, Math.max(0, filteredRows.length - 1)));
	let windowSize = $derived(Math.ceil(viewportHeight / ROW_HEIGHT) + OVERSCAN_ROWS * 2);
	let windowEnd = $derived(Math.min(filteredRows.length, windowStart + windowSize));
	let windowRows = $derived(filteredRows.slice(windowStart, windowEnd));
	let topSpacerHeight = $derived(windowStart * ROW_HEIGHT);
	let bottomSpacerHeight = $derived(Math.max(0, (filteredRows.length - windowEnd) * ROW_HEIGHT));
	let activeLabel = $derived(TABS.find((tab) => tab.id === activeTab)?.label ?? 'Assets');
	let visibleRange = $derived(
		filteredRows.length === 0
			? '0'
			: `${integerFormatter.format(windowStart + 1)}-${integerFormatter.format(windowEnd)}`
	);
	let tabItems = $derived(
		TABS.map((tab) => ({
			id: tab.id,
			label: tab.label,
			count: tabCount(tab.id)
		}))
	);
	let activeTabComponent = $derived(
		(TABS.find((tab) => tab.id === activeTab)?.component ??
			PerpsTab) as unknown as UniverseTabComponent
	);
	let ActiveUniverseTab = $derived(activeTabComponent);
	let activeTabContext = $derived({
		rows: windowRows,
		topSpacerHeight,
		bottomSpacerHeight,
		formatInteger,
		formatDecimal,
		formatFundingRate,
		perpMarginLabel,
		perpMarginBadgeClass,
		visibleMarkets,
		shortValue,
		outcomeStatusLabel,
		outcomeStatusBadgeClass
	});

	function selectTab(tab: TabId) {
		activeTab = tab;
	}

	function rowsForTab(tab: TabId): UniverseRow[] {
		if (!data) return [];
		if (tab === 'perps') return data.perps;
		if (tab === 'spot') return data.spot;
		return data.outcomes;
	}

	function filterRows(rows: UniverseRow[], needle: string) {
		if (!needle) return rows;
		return rows.filter((row) => row.search.includes(needle));
	}

	function tabCount(tab: TabId) {
		if (!data) return 0;
		if (tab === 'perps') return data.perps.length;
		if (tab === 'spot') return data.spot.length;
		return data.outcomes.length;
	}

	function rowSearch(parts: unknown[]) {
		return parts
			.filter((part) => part !== null && part !== undefined && part !== '')
			.join(' ')
			.toLowerCase();
	}

	function tupleRecord(rows: [string, string][] | undefined) {
		const next: Record<string, string> = {};
		for (const [key, value] of rows ?? []) next[key] = value;
		return next;
	}

	function buildPerpRows(dexs: PerpDexsResponse, metas: AllPerpMetasResponse) {
		const rows: PerpUniverseRow[] = [];
		for (let dexIndex = 0; dexIndex < metas.length; dexIndex += 1) {
			const dexMeta = dexs[dexIndex] ?? null;
			const dex = dexMeta?.name ?? '';
			const dexLabel = dex ? dexMeta?.fullName || dex : 'Main DEX';
			const meta = metas[dexIndex];
			const oiCapByAsset = tupleRecord(dexMeta?.assetToStreamingOiCap);
			const fundingMultiplierByAsset = tupleRecord(dexMeta?.assetToFundingMultiplier);
			const fundingInterestRateByAsset = tupleRecord(dexMeta?.assetToFundingInterestRate);

			for (let assetIndex = 0; assetIndex < meta.universe.length; assetIndex += 1) {
				const asset = meta.universe[assetIndex];
				const assetId = dex ? 100000 + dexIndex * 10000 + assetIndex : assetIndex;
				rows.push({
					kind: 'perp',
					key: `perp:${dex || 'main'}:${asset.name}:${assetIndex}`,
					search: rowSearch([
						'perp',
						asset.name,
						assetId,
						dex,
						dexLabel,
						asset.maxLeverage,
						asset.marginMode,
						asset.isDelisted ? 'delisted' : null,
						asset.onlyIsolated ? 'isolated' : null
					]),
					asset,
					assetId,
					dex,
					dexLabel,
					collateralToken: meta.collateralToken,
					oiCap: oiCapByAsset[asset.name] ?? null,
					fundingMultiplier: fundingMultiplierByAsset[asset.name] ?? null,
					fundingInterestRate: fundingInterestRateByAsset[asset.name] ?? null
				});
			}
		}
		return rows;
	}

	function buildSpotRows(meta: SpotMetaResponse) {
		const tokenByIndex: Partial<Record<number, SpotToken>> = {};
		const marketsByToken: Partial<Record<number, SpotMarket[]>> = {};
		for (const token of meta.tokens) tokenByIndex[token.index] = token;
		for (const market of meta.universe) {
			for (const tokenIndex of market.tokens) {
				const markets = marketsByToken[tokenIndex] ?? [];
				markets.push(market);
				marketsByToken[tokenIndex] = markets;
			}
		}

		return meta.tokens.map<SpotUniverseRow>((token) => {
			const markets = marketsByToken[token.index] ?? [];
			const marketLabels = markets.map((market) => spotMarketLabel(market, tokenByIndex));
			const primaryMarket =
				markets.find((market) => market.tokens[0] === token.index && market.isCanonical) ??
				markets.find((market) => market.tokens[0] === token.index) ??
				markets[0] ??
				null;
			const primaryMarketLabel = primaryMarket
				? spotMarketLabel(primaryMarket, tokenByIndex)
				: null;

			return {
				kind: 'spot',
				key: `spot:${token.index}:${token.tokenId}`,
				search: rowSearch([
					'spot',
					token.name,
					token.fullName,
					token.index,
					token.tokenId,
					token.evmContract?.address,
					token.isCanonical ? 'canonical' : null,
					...marketLabels
				]),
				token,
				markets: marketLabels,
				primaryMarket: primaryMarketLabel
			};
		});
	}

	function spotMarketLabel(market: SpotMarket, tokenByIndex: Partial<Record<number, SpotToken>>) {
		const base = tokenByIndex[market.tokens[0]]?.name ?? `#${market.tokens[0]}`;
		const quote = tokenByIndex[market.tokens[1]]?.name ?? `#${market.tokens[1]}`;
		const pair = `${base}/${quote}`;
		return market.name && market.name !== pair ? `${pair} (${market.name})` : pair;
	}

	function buildOutcomeRows(meta: OutcomeMetaResponse) {
		const questionByOutcome: Partial<Record<number, OutcomeQuestion>> = {};
		for (const question of meta.questions) {
			for (const outcomeId of question.namedOutcomes) questionByOutcome[outcomeId] = question;
			if (!questionByOutcome[question.fallbackOutcome]) {
				questionByOutcome[question.fallbackOutcome] = question;
			}
		}

		const rows: OutcomeUniverseRow[] = [];
		for (const outcome of meta.outcomes) {
			const question = questionByOutcome[outcome.outcome] ?? null;
			const marketName = question?.name ?? outcome.name;
			const description = question?.description || outcome.description;
			for (let sideIndex = 0; sideIndex < outcome.sideSpecs.length; sideIndex += 1) {
				const side = outcome.sideSpecs[sideIndex];
				const encoding = outcome.outcome * 10 + sideIndex;
				rows.push({
					kind: 'outcome',
					key: `outcome:${outcome.outcome}:${sideIndex}:${side.token ?? 'no-token'}`,
					search: rowSearch([
						'outcome',
						marketName,
						outcome.name,
						outcome.description,
						question?.description,
						side.name,
						side.token,
						encoding,
						question?.settledNamedOutcomes.includes(outcome.outcome) ? 'settled' : null,
						question?.fallbackOutcome === outcome.outcome ? 'fallback' : null
					]),
					outcome,
					side,
					marketName,
					description,
					encoding,
					settled: question?.settledNamedOutcomes.includes(outcome.outcome) ?? false,
					fallback: question?.fallbackOutcome === outcome.outcome
				});
			}
		}
		return rows;
	}

	async function loadUniverse(
		network: HyperliquidNetwork,
		generation: number,
		signal?: AbortSignal
	) {
		loading = true;
		error = null;

		try {
			const info = getHttpInfoClient(network);
			const [dexs, perpMetas, spotMeta, outcomeMeta] = await Promise.all([
				info.perpDexs(signal),
				info.allPerpMetas(signal),
				info.spotMeta(signal),
				info.outcomeMeta(signal)
			]);
			if (generation !== loadGeneration || signal?.aborted) return;

			data = {
				perps: buildPerpRows(dexs, perpMetas),
				spot: buildSpotRows(spotMeta),
				outcomes: buildOutcomeRows(outcomeMeta),
				spotMarketCount: spotMeta.universe.length,
				outcomeMarketCount: outcomeMeta.outcomes.length,
				outcomeQuestionCount: outcomeMeta.questions.length
			};
			loadedAt = Date.now();
		} catch (err) {
			if (generation !== loadGeneration || signal?.aborted) return;
			error = err instanceof Error ? err.message : 'Failed to load asset universe.';
		} finally {
			if (generation === loadGeneration && !signal?.aborted) loading = false;
		}
	}

	function refreshUniverse() {
		void loadUniverse(hyperliquidNetwork.current, ++loadGeneration);
	}

	function handleListScroll(event: Event) {
		scrollTop = (event.currentTarget as HTMLDivElement).scrollTop;
	}

	function visibleMarkets(markets: string[]) {
		if (markets.length <= 3) return markets.join(', ');
		return `${markets.slice(0, 3).join(', ')} +${integerFormatter.format(markets.length - 3)}`;
	}

	function formatInteger(value: number | null | undefined) {
		return value == null ? '-' : integerFormatter.format(value);
	}

	function formatDecimal(value: string | number | null | undefined) {
		if (value == null || value === '') return '-';
		const n = typeof value === 'number' ? value : Number(value);
		return Number.isFinite(n) ? decimalFormatter.format(n) : String(value);
	}

	function formatFundingRate(value: string | null) {
		if (!value) return '-';
		const rate = Number(value);
		return Number.isFinite(rate) ? `${percentFormatter.format(rate * 100)}%` : value;
	}

	function shortValue(value: string) {
		return value.length > 14 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;
	}

	function perpMarginLabel(asset: PerpAsset) {
		if (asset.isDelisted) return 'Delisted';
		if (asset.marginMode) return asset.marginMode;
		return asset.onlyIsolated ? 'Isolated' : 'Cross';
	}

	function perpMarginBadgeClass(asset: PerpAsset) {
		if (asset.isDelisted) return 'badge-error';
		if (asset.onlyIsolated || asset.marginMode) return 'badge-warning';
		return 'badge-ghost';
	}

	function outcomeStatusLabel(row: OutcomeUniverseRow) {
		if (row.settled) return 'Settled';
		if (row.fallback) return 'Fallback';
		return 'Open';
	}

	function outcomeStatusBadgeClass(row: OutcomeUniverseRow) {
		if (row.settled) return 'badge-neutral';
		if (row.fallback) return 'badge-ghost';
		return 'badge-success';
	}

	function formatDateTime(value: number | null) {
		return value == null ? '-' : new Date(value).toLocaleString();
	}

	$effect(() => {
		const network = hyperliquidNetwork.current;
		const controller = new AbortController();
		const generation = ++loadGeneration;
		void loadUniverse(network, generation, controller.signal);

		return () => {
			controller.abort();
		};
	});

	$effect(() => {
		const key = `${hyperliquidNetwork.current}:${activeTab}:${normalizedQuery}`;
		if (key === listResetKey) return;

		listResetKey = key;
		scrollTop = 0;
		if (listNode) listNode.scrollTop = 0;
	});
</script>

<View {viewId} title="Asset Universe">
	{#snippet subtitleContent()}
		<span>{hyperliquidNetwork.config.label}</span>
		{#if loadedAt}
			<span>/</span>
			<span>{formatDateTime(loadedAt)}</span>
		{/if}
	{/snippet}

	{#snippet actions()}
		<button
			class="btn btn-ghost btn-xs"
			aria-label="Refresh asset universe"
			disabled={loading}
			onclick={refreshUniverse}
		>
			{#if loading}
				<span class="loading loading-xs loading-spinner"></span>
			{:else}
				<HeroIcon name="arrow-path" />
			{/if}
		</button>
	{/snippet}

	<div class="flex h-full min-h-[65svh] flex-col">
		<div class="border-b border-base-300 bg-base-100 p-3">
			<ViewTabs
				tabs={tabItems}
				active={activeTab}
				onSelect={selectTab}
				countStyle="plain"
				showZeroCounts
			/>

			<div class="mt-3 flex flex-wrap items-center gap-2">
				<label class="input input-sm w-full min-w-0 flex-1 sm:min-w-52">
					<span class="text-base-content/45">Search</span>
					<input
						bind:value={query}
						type="search"
						autocomplete="off"
						placeholder="symbol, market, id"
					/>
				</label>
				{#if data}
					<div class="flex shrink-0 flex-wrap gap-1">
						{#if activeTab === 'spot'}
							<span class="badge badge-ghost badge-sm">
								{formatInteger(data.spotMarketCount)} markets
							</span>
						{:else if activeTab === 'outcomes'}
							<span class="badge badge-ghost badge-sm">
								{formatInteger(data.outcomeMarketCount)} markets
							</span>
							<span class="badge badge-ghost badge-sm">
								{formatInteger(data.outcomeQuestionCount)} questions
							</span>
						{/if}
						<span class="badge badge-ghost badge-sm">
							{visibleRange} / {formatInteger(filteredRows.length)}
						</span>
					</div>
				{/if}
			</div>
		</div>

		{#if error}
			<div class="p-3">
				<div role="alert" class="alert alert-soft text-xs alert-error">
					<span>{error}</span>
				</div>
			</div>
		{/if}

		{#if loading && !data}
			<div class="flex flex-1 items-center justify-center">
				<span class="loading loading-sm loading-spinner"></span>
			</div>
		{:else if !data}
			<p class="p-4 text-sm text-base-content/60">No universe data loaded.</p>
		{:else if filteredRows.length === 0}
			<p class="p-4 text-sm text-base-content/60">No {activeLabel.toLowerCase()} match.</p>
		{:else}
			<TableScroll
				bind:viewport={listNode}
				bind:clientHeight={viewportHeight}
				class="min-h-0 flex-1"
				fill
				onscroll={handleListScroll}
			>
				<ActiveUniverseTab ctx={activeTabContext} />
			</TableScroll>
		{/if}
	</div>
</View>
