import { getAddress, type Address } from 'viem';
import type { AddEthereumChainParameter } from '$lib/stores/wallet.svelte';
import type { HyperliquidNetwork } from './network.svelte';

export type HyperEvmKnownToken = {
	symbol: string;
	name: string;
	address: Address;
	decimals: number;
};

export type HyperEvmNetworkConfig = {
	id: HyperliquidNetwork;
	label: string;
	chainName: string;
	chainId: number;
	chainIdHex: `0x${string}`;
	rpcUrl: string;
	explorerUrl: string;
	explorerApiUrl: string;
	addEthereumChainParameter: AddEthereumChainParameter;
	knownTokens: readonly HyperEvmKnownToken[];
};

export const HYPEREVM_MULTICALL3_ADDRESS = getAddress('0xcA11bde05977b3631167028862bE2a173976CA11');

export const HYPEREVM_NETWORKS = {
	mainnet: {
		id: 'mainnet',
		label: 'HyperEVM',
		chainName: 'Hyperliquid',
		chainId: 999,
		chainIdHex: '0x3e7',
		rpcUrl: 'https://rpc.hyperliquid.xyz/evm',
		explorerUrl: 'https://www.hyperscan.com',
		explorerApiUrl: 'https://www.hyperscan.com/api/v2',
		addEthereumChainParameter: {
			chainId: '0x3e7',
			chainName: 'Hyperliquid',
			nativeCurrency: {
				name: 'HYPE',
				symbol: 'HYPE',
				decimals: 18
			},
			rpcUrls: ['https://rpc.hyperliquid.xyz/evm'],
			blockExplorerUrls: [
				'https://www.hyperscan.com',
				'https://hyperevmscan.io/',
				'https://purrsec.com/'
			]
		},
		knownTokens: [
			{
				symbol: 'USDC',
				name: 'USDC',
				address: getAddress('0xb88339CB7199b77E23DB6E890353E22632Ba630f'),
				decimals: 6
			}
		]
	},
	testnet: {
		id: 'testnet',
		label: 'HyperEVM Testnet',
		chainName: 'Hyperliquid Testnet',
		chainId: 998,
		chainIdHex: '0x3e6',
		rpcUrl: 'https://rpc.hyperliquid-testnet.xyz/evm',
		explorerUrl: 'https://testnet.hyperscan.com',
		explorerApiUrl: 'https://testnet.hyperscan.com/api/v2',
		addEthereumChainParameter: {
			chainId: '0x3e6',
			chainName: 'Hyperliquid Testnet',
			nativeCurrency: {
				name: 'HYPE',
				symbol: 'HYPE',
				decimals: 18
			},
			rpcUrls: ['https://rpc.hyperliquid-testnet.xyz/evm'],
			blockExplorerUrls: [
				'https://testnet.hyperscan.com',
				'https://app.hyperliquid-testnet.xyz/explorer'
			]
		},
		knownTokens: [
			{
				symbol: 'USDC',
				name: 'USDC',
				address: getAddress('0xd9CBEC81df392A88AEff575E962d149d57F4d6bc'),
				decimals: 6
			}
		]
	}
} satisfies Record<HyperliquidNetwork, HyperEvmNetworkConfig>;

export function hyperEvmConfig(network: HyperliquidNetwork) {
	return HYPEREVM_NETWORKS[network];
}

export function hyperEvmRpcUrl(network: HyperliquidNetwork) {
	return hyperEvmConfig(network).rpcUrl;
}

export function hyperEvmExplorerAddressUrl(network: HyperliquidNetwork, address: string) {
	return `${hyperEvmConfig(network).explorerUrl}/address/${address}`;
}

export function hyperEvmExplorerTokenUrl(network: HyperliquidNetwork, address: string) {
	return `${hyperEvmConfig(network).explorerUrl}/token/${address}`;
}
