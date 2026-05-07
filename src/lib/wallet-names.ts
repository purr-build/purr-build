export const TRACKED_WALLET_NAME_MAX_LENGTH = 64;

export function normalizeTrackedWalletName(value: unknown) {
	if (typeof value !== 'string') return null;

	const normalized = value.trim().replace(/\s+/g, ' ');
	if (!normalized) return null;

	return normalized.slice(0, TRACKED_WALLET_NAME_MAX_LENGTH);
}
