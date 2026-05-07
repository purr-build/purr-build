import {
	ExchangeClient,
	HttpTransport,
	InfoClient,
	SubscriptionClient,
	WebSocketTransport
} from '@nktkas/hyperliquid';
import type { AbstractWallet } from '@nktkas/hyperliquid/signing';
import {
	HYPERLIQUID_NETWORKS,
	hyperliquidNetwork,
	type HyperliquidNetwork
} from './network.svelte';

type HyperliquidClients = {
	transport: WebSocketTransport;
	info: InfoClient;
	subscriptions: SubscriptionClient;
};

type HyperliquidHttpClients = {
	transport: HttpTransport;
	info: InfoClient;
};

export type RecordedExchangeRequest = {
	endpoint: 'info' | 'exchange' | 'explorer';
	url: string;
	payload: unknown;
	isTestnet: boolean;
};

export const HYPERLIQUID_L1_SIGNATURE_CHAIN_ID = '0x539' as const;

function createClients(network: HyperliquidNetwork): HyperliquidClients {
	const transport = new WebSocketTransport({
		isTestnet: HYPERLIQUID_NETWORKS[network].isTestnet
	});

	return {
		transport,
		info: new InfoClient({ transport }),
		subscriptions: new SubscriptionClient({ transport })
	};
}

const clients = new Map<HyperliquidNetwork, HyperliquidClients>();
const httpClients = new Map<HyperliquidNetwork, HyperliquidHttpClients>();

export function getHyperliquidClients(network = hyperliquidNetwork.current) {
	const existing = clients.get(network);
	if (existing) return existing;

	const next = createClients(network);
	clients.set(network, next);
	return next;
}

export function getInfoClient(network = hyperliquidNetwork.current) {
	return getHyperliquidClients(network).info;
}

export function getSubscriptionClient(network = hyperliquidNetwork.current) {
	return getHyperliquidClients(network).subscriptions;
}

function createHttpClients(network: HyperliquidNetwork): HyperliquidHttpClients {
	const transport = new HttpTransport({
		isTestnet: HYPERLIQUID_NETWORKS[network].isTestnet
	});

	return {
		transport,
		info: new InfoClient({ transport })
	};
}

export function getHttpClients(network = hyperliquidNetwork.current) {
	const existing = httpClients.get(network);
	if (existing) return existing;

	const next = createHttpClients(network);
	httpClients.set(network, next);
	return next;
}

export function getHttpInfoClient(network = hyperliquidNetwork.current) {
	return getHttpClients(network).info;
}

class RecordingHttpTransport extends HttpTransport {
	constructor(
		options: ConstructorParameters<typeof HttpTransport>[0],
		private readonly onRequest?: (request: RecordedExchangeRequest) => void
	) {
		super(options);
	}

	override request<T>(
		endpoint: 'info' | 'exchange' | 'explorer',
		payload: unknown,
		signal?: AbortSignal
	): Promise<T> {
		this.onRequest?.({
			endpoint,
			url: new URL(endpoint, endpoint === 'explorer' ? this.rpcUrl : this.apiUrl).toString(),
			payload,
			isTestnet: this.isTestnet
		});
		return super.request<T>(endpoint, payload, signal);
	}
}

export function getExchangeClient(
	wallet: AbstractWallet,
	network = hyperliquidNetwork.current,
	onRequest?: (request: RecordedExchangeRequest) => void
) {
	return new ExchangeClient({
		transport: new RecordingHttpTransport(
			{
				isTestnet: HYPERLIQUID_NETWORKS[network].isTestnet
			},
			onRequest
		),
		signatureChainId: HYPERLIQUID_L1_SIGNATURE_CHAIN_ID,
		wallet
	});
}
