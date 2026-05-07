import { browser } from '$app/environment';
import type { Address } from 'viem';
import type { HyperliquidNetwork } from './network.svelte';

export type SavedAgentWallet = {
	address: `0x${string}`;
	name: string;
	privateKey: `0x${string}`;
	createdAt: number;
	validUntil: number;
};

const AGENT_STORAGE_PREFIX = 'purrbuild:agent-wallets';

export function agentWalletStorageKey(user: Address, network: HyperliquidNetwork) {
	return `${AGENT_STORAGE_PREFIX}:${network}:${user.toLowerCase()}`;
}

function isHexAddress(value: unknown): value is `0x${string}` {
	return typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value);
}

function isPrivateKey(value: unknown): value is `0x${string}` {
	return typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value);
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
