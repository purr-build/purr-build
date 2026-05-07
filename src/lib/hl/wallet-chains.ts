import type { AddEthereumChainParameter } from '$lib/stores/wallet.svelte';
import { HYPERLIQUID_L1_SIGNATURE_CHAIN_ID } from './clients.js';

export const HYPERLIQUID_L1_ADD_ETHEREUM_CHAIN_PARAMETER = {
	chainId: HYPERLIQUID_L1_SIGNATURE_CHAIN_ID,
	chainName: 'Hyperliquid L1 Signing',
	nativeCurrency: {
		name: 'HYPE',
		symbol: 'HYPE',
		decimals: 18
	},
	rpcUrls: ['http://127.0.0.1:8545'],
	blockExplorerUrls: ['https://app.hyperliquid.xyz/explorer']
} as const satisfies AddEthereumChainParameter;
