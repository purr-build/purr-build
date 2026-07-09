export const HEATMAP_BUCKET_MS = 5_000;
export const HEATMAP_BUCKET_COUNT = 60;

export type NodeFill = {
	coin: string;
	px: string;
	sz: string;
	tid: number;
	time: number;
};

export type MarketVolume = {
	coin: string;
	dayVolume: number;
};

export type HeatmapRow = MarketVolume & {
	rank: number | null;
};

export function isNodeFill(value: unknown): value is NodeFill {
	if (!value || typeof value !== 'object') return false;
	const fill = value as Partial<NodeFill>;
	return (
		typeof fill.coin === 'string' &&
		fill.coin.length > 0 &&
		typeof fill.px === 'string' &&
		typeof fill.sz === 'string' &&
		typeof fill.tid === 'number' &&
		Number.isFinite(fill.tid) &&
		typeof fill.time === 'number' &&
		Number.isFinite(fill.time)
	);
}

export function fillNotional(fill: NodeFill) {
	const price = Number(fill.px);
	const size = Number(fill.sz);
	const notional = price * size;
	return Number.isFinite(notional) && notional > 0 ? notional : 0;
}

export function bucketStart(time: number) {
	return Math.floor(time / HEATMAP_BUCKET_MS) * HEATMAP_BUCKET_MS;
}

export function buildBucketStarts(time: number) {
	const latest = bucketStart(time);
	return Array.from(
		{ length: HEATMAP_BUCKET_COUNT },
		(_, index) => latest - (HEATMAP_BUCKET_COUNT - 1 - index) * HEATMAP_BUCKET_MS
	);
}

export function mergeMarketVolumes(rows: MarketVolume[]) {
	const volumeByCoin = new Map<string, number>();
	for (const row of rows) {
		const volume = Number.isFinite(row.dayVolume) && row.dayVolume > 0 ? row.dayVolume : 0;
		volumeByCoin.set(row.coin, Math.max(volume, volumeByCoin.get(row.coin) ?? 0));
	}

	return [...volumeByCoin]
		.map(([coin, dayVolume]) => ({ coin, dayVolume }))
		.sort((a, b) => b.dayVolume - a.dayVolume || a.coin.localeCompare(b.coin));
}

export function buildHeatmapRows(
	markets: MarketVolume[],
	volumeByBucket: Map<number, Map<string, number>>
) {
	const rows = markets.map<HeatmapRow>((market, index) => ({ ...market, rank: index + 1 }));
	const knownCoins = new Set(markets.map((market) => market.coin));
	const feedOnlyCoins = new Set<string>();

	for (const bucket of volumeByBucket.values()) {
		for (const coin of bucket.keys()) {
			if (!knownCoins.has(coin)) feedOnlyCoins.add(coin);
		}
	}

	for (const coin of [...feedOnlyCoins].sort((a, b) => a.localeCompare(b))) {
		rows.push({ coin, dayVolume: 0, rank: null });
	}

	return rows;
}

export function heatCeiling(
	volumeByBucket: Map<number, Map<string, number>>,
	bucketStarts: number[]
) {
	const values: number[] = [];
	for (const start of bucketStarts) {
		for (const volume of volumeByBucket.get(start)?.values() ?? []) {
			if (volume > 0) values.push(volume);
		}
	}
	if (values.length === 0) return 1;

	values.sort((a, b) => a - b);
	return Math.max(1, values[Math.floor((values.length - 1) * 0.95)] ?? 1);
}

export function heatLevel(volume: number, ceiling: number) {
	if (volume <= 0) return 0;
	const normalized = Math.log1p(volume) / Math.log1p(Math.max(1, ceiling));
	return Math.min(1, Math.max(0.14, normalized));
}
