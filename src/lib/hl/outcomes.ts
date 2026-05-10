export const OUTCOME_ASSET_ID_OFFSET = 100_000_000;

export type OutcomeSideIndex = 0 | 1;

export function isOutcomeSideIndex(side: number): side is OutcomeSideIndex {
	return side === 0 || side === 1;
}

export function outcomeEncoding(outcome: number, side: number) {
	if (!Number.isSafeInteger(outcome) || outcome < 0 || !isOutcomeSideIndex(side)) return null;
	return 10 * outcome + side;
}

export function normalizeOutcomeEncoding(value: number | null | undefined) {
	if (value == null || !Number.isSafeInteger(value) || value < 0) return null;
	const encoding = value >= OUTCOME_ASSET_ID_OFFSET ? value - OUTCOME_ASSET_ID_OFFSET : value;
	if (!Number.isSafeInteger(encoding) || encoding < 0) return null;
	return isOutcomeSideIndex(encoding % 10) ? encoding : null;
}

export function parseOutcomeEncoding(value: string | number | null | undefined) {
	if (typeof value === 'number') return normalizeOutcomeEncoding(value);
	if (typeof value !== 'string') return null;

	const trimmed = value.trim();
	if (!trimmed) return null;
	const body = trimmed[0] === '#' || trimmed[0] === '+' ? trimmed.slice(1) : trimmed;
	if (!/^\d+$/.test(body)) return null;
	return normalizeOutcomeEncoding(Number(body));
}

export function outcomeSpotCoin(encoding: number) {
	const normalized = normalizeOutcomeEncoding(encoding);
	return normalized == null ? null : `#${normalized}`;
}

export function outcomeTokenName(encoding: number) {
	const normalized = normalizeOutcomeEncoding(encoding);
	return normalized == null ? null : `+${normalized}`;
}

export function outcomeAssetId(encoding: number) {
	const normalized = normalizeOutcomeEncoding(encoding);
	return normalized == null ? null : OUTCOME_ASSET_ID_OFFSET + normalized;
}

export function isOutcomeCoin(value: string | null | undefined) {
	const trimmed = value?.trim() ?? '';
	return (
		(trimmed.startsWith('#') || trimmed.startsWith('+')) && parseOutcomeEncoding(trimmed) !== null
	);
}

export function isOutcomeAssetId(value: string | number | null | undefined) {
	const numeric = typeof value === 'string' ? Number(value.trim()) : value;
	return (
		numeric != null &&
		Number.isSafeInteger(numeric) &&
		numeric >= OUTCOME_ASSET_ID_OFFSET &&
		normalizeOutcomeEncoding(numeric) !== null
	);
}
