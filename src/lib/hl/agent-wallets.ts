import { browser } from '$app/environment';
import type { Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import type { HyperliquidNetwork } from './network.svelte';

export type SavedAgentWallet = {
	address: `0x${string}`;
	name: string;
	privateKey: `0x${string}`;
	createdAt: number;
	validUntil: number;
};

const AGENT_STORAGE_PREFIX = 'purrbuild:agent-wallets';
const DAY_MS = 24 * 60 * 60 * 1000;
export const AGENT_WALLET_DEFAULT_VALID_DAYS = 90;
export const AGENT_WALLET_MAX_VALID_DAYS = 180;

export function agentWalletStorageKey(user: Address, network: HyperliquidNetwork) {
	return `${AGENT_STORAGE_PREFIX}:${network}:${user.toLowerCase()}`;
}

function isHexAddress(value: unknown): value is `0x${string}` {
	return typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value);
}

function isPrivateKey(value: unknown): value is `0x${string}` {
	return typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value);
}

export function sanitizeAgentWalletName(value: string) {
	return value.trim().replace(/\s+/g, '-').slice(0, 16);
}

export function clampAgentWalletValidDays(value: number | string) {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return AGENT_WALLET_DEFAULT_VALID_DAYS;
	return Math.min(AGENT_WALLET_MAX_VALID_DAYS, Math.max(1, Math.floor(parsed)));
}

export function normalizeAgentPrivateKeyInput(value: string) {
	const trimmed = value.trim();
	const withPrefix = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;
	if (!isPrivateKey(withPrefix)) {
		throw new Error('Enter a valid 32-byte private key.');
	}
	return withPrefix;
}

export function savedAgentWalletFromPrivateKey(
	value: string,
	options: { name?: string | null; validDays?: number | string; createdAt?: number } = {}
) {
	const privateKey = normalizeAgentPrivateKeyInput(value);
	const account = privateKeyToAccount(privateKey);
	const createdAt = options.createdAt ?? Date.now();
	const validDays = clampAgentWalletValidDays(options.validDays ?? AGENT_WALLET_DEFAULT_VALID_DAYS);
	const name =
		sanitizeAgentWalletName(options.name ?? '') || `imported-${account.address.slice(2, 8)}`;

	return {
		address: account.address,
		name,
		privateKey,
		createdAt,
		validUntil: createdAt + validDays * DAY_MS
	} satisfies SavedAgentWallet;
}

export function loadSavedAgentWallets(user: Address, network: HyperliquidNetwork) {
	if (!browser) return [];
	try {
		const raw = localStorage.getItem(agentWalletStorageKey(user, network));
		if (!raw) return [];
		const parsed = JSON.parse(raw) as Partial<SavedAgentWallet>[];
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((item): item is SavedAgentWallet => {
			return (
				isHexAddress(item.address) &&
				isPrivateKey(item.privateKey) &&
				typeof item.name === 'string' &&
				typeof item.createdAt === 'number' &&
				typeof item.validUntil === 'number'
			);
		});
	} catch {
		return [];
	}
}

export function saveSavedAgentWallets(
	user: Address,
	network: HyperliquidNetwork,
	rows: SavedAgentWallet[]
) {
	if (!browser) return;
	localStorage.setItem(agentWalletStorageKey(user, network), JSON.stringify(rows));
}

export function upsertSavedAgentWallet(
	user: Address,
	network: HyperliquidNetwork,
	next: SavedAgentWallet
) {
	const rows = [
		next,
		...loadSavedAgentWallets(user, network).filter(
			(row) => row.address.toLowerCase() !== next.address.toLowerCase()
		)
	];
	saveSavedAgentWallets(user, network, rows);
	return rows;
}
