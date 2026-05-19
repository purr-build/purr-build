import { browser } from '$app/environment';
import {
	createPublicClient,
	defineChain,
	formatUnits,
	getAddress,
	http,
	isAddress,
	parseAbi,
	type Address
} from 'viem';
import type { HyperliquidNetwork } from './network.svelte';
import {
	HYPEREVM_MULTICALL3_ADDRESS,
	HYPEREVM_NETWORKS,
	type HyperEvmKnownToken
} from './hyperevm.js';

const TRACKED_TOKEN_STORAGE_PREFIX = 'purrbuild:hyperevm:tracked-tokens:';
const DEFAULT_TOKEN_DECIMALS = 18;

const ERC20_ABI = parseAbi([
	'function balanceOf(address account) view returns (uint256)',
	'function decimals() view returns (uint8)',
	'function name() view returns (string)',
	'function symbol() view returns (string)'
]);

type MulticallResult =
	| { status: 'success'; result: unknown }
	| { status: 'failure'; error: unknown };

type MutableToken = {
	address: Address;
	symbol: string | null;
	name: string | null;
	decimals: number | null;
	explorerRawBalance: bigint | null;
	rawBalance: bigint | null;
	tracked: boolean;
	discovered: boolean;
	error: string | null;
};

type ExplorerTokenBalance = {
	token?: {
		address?: unknown;
		address_hash?: unknown;
		decimals?: unknown;
		name?: unknown;
		symbol?: unknown;
		type?: unknown;
	};
	value?: unknown;
};

export type HyperEvmBalanceRow = {
	kind: 'native' | 'erc20';
	key: string;
	symbol: string;
	name: string | null;
	contractAddress: Address | null;
	decimals: number;
	rawBalance: bigint | null;
	formattedBalance: string;
	tracked: boolean;
	discovered: boolean;
	source: 'native' | 'discovered' | 'tracked' | 'tracked+discovered';
	error: string | null;
};

export type HyperEvmBalances = {
	address: Address;
	network: HyperliquidNetwork;
	chainId: number;
	blockNumber: bigint | null;
	loadedAt: number;
	native: HyperEvmBalanceRow;
	tokens: HyperEvmBalanceRow[];
	discoveryError: string | null;
};

function createHyperEvmPublicClient(network: HyperliquidNetwork) {
	const config = HYPEREVM_NETWORKS[network];
	const nativeCurrency = config.addEthereumChainParameter.nativeCurrency ?? {
		name: 'HYPE',
		symbol: 'HYPE',
		decimals: 18
	};

	return createPublicClient({
		chain: defineChain({
			id: config.chainId,
			name: config.chainName,
			nativeCurrency,
			rpcUrls: {
				default: { http: [config.rpcUrl] }
			},
			blockExplorers: {
				default: {
					name: 'HyperScan',
					url: config.explorerUrl
				}
			},
			contracts: {
				multicall3: {
					address: HYPEREVM_MULTICALL3_ADDRESS,
					blockCreated: 0
				}
			}
		}),
		transport: http(config.rpcUrl)
	});
}

type HyperEvmPublicClient = ReturnType<typeof createHyperEvmPublicClient>;

const publicClients = new Map<HyperliquidNetwork, HyperEvmPublicClient>();

export function getHyperEvmPublicClient(network: HyperliquidNetwork) {
	const existing = publicClients.get(network);
	if (existing) return existing;

	const next = createHyperEvmPublicClient(network);
	publicClients.set(network, next);
	return next;
}

export function loadTrackedHyperEvmTokens(network: HyperliquidNetwork) {
	if (!browser) return [];
	try {
		const raw = localStorage.getItem(trackedTokenStorageKey(network));
		if (!raw) return [];
		return normalizeAddressList(JSON.parse(raw));
	} catch {
		return [];
	}
}

export function saveTrackedHyperEvmTokens(network: HyperliquidNetwork, tokens: readonly string[]) {
	const normalized = normalizeAddressList(tokens);
	if (!browser) return normalized;
	try {
		localStorage.setItem(trackedTokenStorageKey(network), JSON.stringify(normalized));
	} catch {
		// The view can still use the in-memory list for this session.
	}
	return normalized;
}

export function addTrackedHyperEvmToken(network: HyperliquidNetwork, token: string) {
	return saveTrackedHyperEvmTokens(network, [...loadTrackedHyperEvmTokens(network), token]);
}

export function removeTrackedHyperEvmToken(network: HyperliquidNetwork, token: string) {
	const normalized = normalizeAddress(token);
	if (!normalized) return loadTrackedHyperEvmTokens(network);
	return saveTrackedHyperEvmTokens(
		network,
		loadTrackedHyperEvmTokens(network).filter(
			(address) => address.toLowerCase() !== normalized.toLowerCase()
		)
	);
}

export async function fetchHyperEvmBalances(
	address: Address,
	network: HyperliquidNetwork,
	trackedTokens: readonly string[] = []
): Promise<HyperEvmBalances> {
	const config = HYPEREVM_NETWORKS[network];
	const client = getHyperEvmPublicClient(network);
	const tracked = normalizeAddressList(trackedTokens);
	const tokenMap = new Map<string, MutableToken>();
	let discoveryError: string | null = null;

	try {
		for (const token of await fetchExplorerTokenBalances(address, network)) {
			upsertToken(tokenMap, token.address, {
				symbol: token.symbol,
				name: token.name,
				decimals: token.decimals,
				explorerRawBalance: token.rawBalance,
				discovered: true
			});
		}
	} catch (err) {
		discoveryError = err instanceof Error ? err.message : 'Could not discover ERC-20 balances.';
	}

	for (const token of config.knownTokens) {
		if (tracked.some((address) => address.toLowerCase() === token.address.toLowerCase())) {
			upsertKnownToken(tokenMap, token);
		}
	}

	for (const token of tracked) {
		upsertToken(tokenMap, token, { tracked: true });
	}

	const [nativeBalance, blockNumber] = await Promise.all([
		client.getBalance({ address }),
		client.getBlockNumber().catch(() => null)
	]);
	const tokens = [...tokenMap.values()];

	await hydrateTokenMetadata(client, tokens);
	await hydrateTokenBalances(client, address, tokens);

	return {
		address,
		network,
		chainId: config.chainId,
		blockNumber,
		loadedAt: Date.now(),
		native: nativeBalanceRow(nativeBalance),
		tokens: tokens
			.map(tokenBalanceRow)
			.filter((row) => row.tracked || row.discovered || (row.rawBalance ?? 0n) > 0n)
			.sort(compareTokenRows),
		discoveryError
	};
}

export function formatHyperEvmTokenAmount(rawBalance: bigint | null, decimals: number) {
	if (rawBalance === null) return '—';
	return compactDecimalString(formatUnits(rawBalance, decimals));
}

function trackedTokenStorageKey(network: HyperliquidNetwork) {
	return `${TRACKED_TOKEN_STORAGE_PREFIX}${network}`;
}

function normalizeAddressList(values: unknown): Address[] {
	if (!Array.isArray(values)) return [];
	const seen: Record<string, true> = {};
	const normalized: Address[] = [];
	for (const value of values) {
		const address = normalizeAddress(value);
		if (!address) continue;
		const key = address.toLowerCase();
		if (seen[key]) continue;
		seen[key] = true;
		normalized.push(address);
	}
	return normalized;
}

function normalizeAddress(value: unknown): Address | null {
	return typeof value === 'string' && isAddress(value) ? getAddress(value) : null;
}

async function fetchExplorerTokenBalances(address: Address, network: HyperliquidNetwork) {
	const response = await fetch(
		`${HYPEREVM_NETWORKS[network].explorerApiUrl}/addresses/${address}/token-balances`,
		{
			headers: { accept: 'application/json' }
		}
	);
	if (!response.ok) {
		throw new Error(`Explorer returned HTTP ${response.status}.`);
	}

	const payload = await response.json();
	if (!Array.isArray(payload)) {
		throw new Error('Explorer returned an invalid token balance response.');
	}

	return payload
		.map(parseExplorerTokenBalance)
		.filter(
			(token): token is NonNullable<ReturnType<typeof parseExplorerTokenBalance>> => token !== null
		);
}

function parseExplorerTokenBalance(row: ExplorerTokenBalance) {
	const token = row.token;
	if (!token) return null;
	if (token.type !== 'ERC-20') return null;

	const address = normalizeAddress(token.address_hash ?? token.address);
	const rawBalance = parseBigInt(row.value);
	if (!address || rawBalance === null) return null;

	return {
		address,
		symbol: stringOrNull(token.symbol),
		name: stringOrNull(token.name),
		decimals: parseDecimals(token.decimals),
		rawBalance
	};
}

function upsertKnownToken(tokens: Map<string, MutableToken>, token: HyperEvmKnownToken) {
	upsertToken(tokens, token.address, {
		symbol: token.symbol,
		name: token.name,
		decimals: token.decimals
	});
}

function upsertToken(
	tokens: Map<string, MutableToken>,
	address: Address,
	updates: Partial<Omit<MutableToken, 'address'>>
) {
	const key = address.toLowerCase();
	const existing = tokens.get(key);
	if (existing) {
		existing.symbol = updates.symbol ?? existing.symbol;
		existing.name = updates.name ?? existing.name;
		existing.decimals = updates.decimals ?? existing.decimals;
		existing.explorerRawBalance = updates.explorerRawBalance ?? existing.explorerRawBalance;
		existing.rawBalance = updates.rawBalance ?? existing.rawBalance;
		existing.tracked = updates.tracked ?? existing.tracked;
		existing.discovered = updates.discovered ?? existing.discovered;
		existing.error = updates.error ?? existing.error;
		return existing;
	}

	const next: MutableToken = {
		address,
		symbol: updates.symbol ?? null,
		name: updates.name ?? null,
		decimals: updates.decimals ?? null,
		explorerRawBalance: updates.explorerRawBalance ?? null,
		rawBalance: updates.rawBalance ?? null,
		tracked: updates.tracked ?? false,
		discovered: updates.discovered ?? false,
		error: updates.error ?? null
	};
	tokens.set(key, next);
	return next;
}

async function hydrateTokenMetadata(client: HyperEvmPublicClient, tokens: MutableToken[]) {
	type MetadataCall = {
		token: MutableToken;
		field: 'symbol' | 'name' | 'decimals';
		contract: {
			address: Address;
			abi: typeof ERC20_ABI;
			functionName: 'symbol' | 'name' | 'decimals';
		};
	};
	const calls: MetadataCall[] = [];

	for (const token of tokens) {
		if (!token.symbol) {
			calls.push({
				token,
				field: 'symbol',
				contract: { address: token.address, abi: ERC20_ABI, functionName: 'symbol' }
			});
		}
		if (!token.name) {
			calls.push({
				token,
				field: 'name',
				contract: { address: token.address, abi: ERC20_ABI, functionName: 'name' }
			});
		}
		if (token.decimals === null) {
			calls.push({
				token,
				field: 'decimals',
				contract: { address: token.address, abi: ERC20_ABI, functionName: 'decimals' }
			});
		}
	}

	if (calls.length === 0) return;

	const results = (await client.multicall({
		contracts: calls.map((call) => call.contract),
		allowFailure: true
	})) as MulticallResult[];

	for (let index = 0; index < results.length; index += 1) {
		const result = results[index];
		const call = calls[index];
		if (!call || result?.status !== 'success') continue;

		if (call.field === 'decimals') {
			const decimals = parseDecimals(result.result);
			if (decimals !== null) call.token.decimals = decimals;
		} else if (typeof result.result === 'string' && result.result.trim() !== '') {
			call.token[call.field] = result.result.trim();
		}
	}
}

async function hydrateTokenBalances(
	client: HyperEvmPublicClient,
	address: Address,
	tokens: MutableToken[]
) {
	if (tokens.length === 0) return;

	const results = (await client.multicall({
		contracts: tokens.map((token) => ({
			address: token.address,
			abi: ERC20_ABI,
			functionName: 'balanceOf',
			args: [address]
		})),
		allowFailure: true
	})) as MulticallResult[];

	for (let index = 0; index < tokens.length; index += 1) {
		const token = tokens[index];
		const result = results[index];
		if (!token) continue;

		if (result?.status === 'success' && typeof result.result === 'bigint') {
			token.rawBalance = result.result;
			token.error = null;
			continue;
		}

		if (token.explorerRawBalance !== null) {
			token.rawBalance = token.explorerRawBalance;
			token.error = result?.status === 'failure' ? errorMessage(result.error) : null;
		} else {
			token.rawBalance = null;
			token.error =
				result?.status === 'failure' ? errorMessage(result.error) : 'Balance call failed.';
		}
	}
}

function nativeBalanceRow(rawBalance: bigint): HyperEvmBalanceRow {
	return {
		kind: 'native',
		key: 'native:HYPE',
		symbol: 'HYPE',
		name: 'Native HYPE',
		contractAddress: null,
		decimals: 18,
		rawBalance,
		formattedBalance: formatHyperEvmTokenAmount(rawBalance, 18),
		tracked: false,
		discovered: true,
		source: 'native',
		error: null
	};
}

function tokenBalanceRow(token: MutableToken): HyperEvmBalanceRow {
	const decimals = token.decimals ?? DEFAULT_TOKEN_DECIMALS;
	return {
		kind: 'erc20',
		key: `erc20:${token.address.toLowerCase()}`,
		symbol: token.symbol ?? shortAddress(token.address),
		name: token.name,
		contractAddress: token.address,
		decimals,
		rawBalance: token.rawBalance,
		formattedBalance: formatHyperEvmTokenAmount(token.rawBalance, decimals),
		tracked: token.tracked,
		discovered: token.discovered,
		source:
			token.tracked && token.discovered
				? 'tracked+discovered'
				: token.tracked
					? 'tracked'
					: 'discovered',
		error: token.error
	};
}

function compareTokenRows(a: HyperEvmBalanceRow, b: HyperEvmBalanceRow) {
	if (a.tracked !== b.tracked) return a.tracked ? -1 : 1;
	return (
		a.symbol.localeCompare(b.symbol) ||
		(a.contractAddress ?? '').localeCompare(b.contractAddress ?? '')
	);
}

function compactDecimalString(value: string) {
	const [whole, fraction = ''] = value.split('.');
	const trimmedFraction = fraction.replace(/0+$/, '');
	if (!trimmedFraction) return whole;

	if (whole !== '0') return `${whole}.${trimmedFraction.slice(0, 8)}`;

	const firstSignificant = trimmedFraction.search(/[1-9]/);
	if (firstSignificant === -1) return whole;
	const visibleDecimals = Math.min(trimmedFraction.length, Math.max(8, firstSignificant + 4));
	return `${whole}.${trimmedFraction.slice(0, visibleDecimals)}`;
}

function stringOrNull(value: unknown) {
	return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

function parseDecimals(value: unknown) {
	const parsed = typeof value === 'bigint' ? Number(value) : Number(value);
	return Number.isInteger(parsed) && parsed >= 0 && parsed <= 255 ? parsed : null;
}

function parseBigInt(value: unknown) {
	if (typeof value === 'bigint') return value;
	if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return BigInt(value);
	if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);
	return null;
}

function shortAddress(address: string) {
	return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function errorMessage(err: unknown) {
	if (err instanceof Error) return err.message;
	if (err && typeof err === 'object' && 'shortMessage' in err) {
		const message = (err as { shortMessage?: unknown }).shortMessage;
		if (typeof message === 'string') return message;
	}
	return 'RPC call failed.';
}
