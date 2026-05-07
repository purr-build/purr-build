import { browser } from '$app/environment';

export type HyperliquidNetwork = 'mainnet' | 'testnet';

export type HyperliquidNetworkConfig = {
	id: HyperliquidNetwork;
	label: string;
	isTestnet: boolean;
};

export const HYPERLIQUID_NETWORKS = {
	mainnet: {
		id: 'mainnet',
		label: 'Mainnet',
		isTestnet: false
	},
	testnet: {
		id: 'testnet',
		label: 'Testnet',
		isTestnet: true
	}
} satisfies Record<HyperliquidNetwork, HyperliquidNetworkConfig>;

const STORAGE_KEY = 'purrbuild:hyperliquid-network';

function isHyperliquidNetwork(value: unknown): value is HyperliquidNetwork {
	return value === 'mainnet' || value === 'testnet';
}

function loadNetwork(): HyperliquidNetwork {
	if (!browser) return 'mainnet';
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		return isHyperliquidNetwork(stored) ? stored : 'mainnet';
	} catch {
		return 'mainnet';
	}
}

function persistNetwork(network: HyperliquidNetwork) {
	if (!browser) return;
	try {
		localStorage.setItem(STORAGE_KEY, network);
	} catch {
		// Ignore storage failures; the in-memory selection still updates.
	}
}

class HyperliquidNetworkStore {
	current = $state<HyperliquidNetwork>(loadNetwork());

	get config() {
		return HYPERLIQUID_NETWORKS[this.current];
	}

	hydrate() {
		this.current = loadNetwork();
	}

	set(network: HyperliquidNetwork) {
		if (network === this.current) {
			persistNetwork(network);
			return;
		}
		this.current = network;
		persistNetwork(network);
	}
}

export const hyperliquidNetwork = new HyperliquidNetworkStore();
