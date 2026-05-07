import { browser } from '$app/environment';
import { isAddress, getAddress, type Address } from 'viem';

export type WalletSource = 'injected' | 'manual';

export type EIP1193Provider = {
	request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
	on?: (event: string, handler: (...args: unknown[]) => void) => void;
	removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
};

export type EIP6963ProviderInfo = {
	uuid: string;
	name: string;
	icon: string;
	rdns: string;
};

export type DiscoveredProvider = {
	info: EIP6963ProviderInfo;
	provider: EIP1193Provider;
};

export type WalletState = {
	address: Address;
	source: WalletSource;
	providerRdns?: string;
	providerName?: string;
	providerIcon?: string;
};

type TypedDataPayload = {
	domain: Record<string, unknown>;
	types: Record<string, { name: string; type: string }[]>;
	primaryType: string;
	message: Record<string, unknown>;
};

export type SigningWallet = {
	signTypedData: (params: TypedDataPayload) => Promise<`0x${string}`>;
	getAddresses: () => Promise<`0x${string}`[]>;
	getChainId: () => Promise<number>;
};

export type AddEthereumChainParameter = {
	chainId: `0x${string}`;
	chainName: string;
	nativeCurrency?: {
		name: string;
		symbol: string;
		decimals: number;
	};
	rpcUrls?: readonly string[];
	blockExplorerUrls?: readonly string[];
};

export type SwitchWalletChainTarget = {
	chainId: `0x${string}`;
	addEthereumChainParameter?: AddEthereumChainParameter;
};

const STORAGE_KEY = 'purrbuild:wallet';

declare global {
	interface WindowEventMap {
		'eip6963:announceProvider': CustomEvent<DiscoveredProvider>;
	}
	interface Window {
		ethereum?: EIP1193Provider & { isMetaMask?: boolean };
	}
}

function load(): WalletState | null {
	if (!browser) return null;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as Partial<WalletState>;
		if (!parsed.address || !isAddress(parsed.address)) return null;
		if (parsed.source !== 'injected' && parsed.source !== 'manual') return null;
		return {
			address: getAddress(parsed.address),
			source: parsed.source,
			providerRdns: parsed.providerRdns,
			providerName: parsed.providerName,
			providerIcon: parsed.providerIcon
		};
	} catch {
		return null;
	}
}

function persist(state: WalletState | null) {
	if (!browser) return;
	if (state) localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
	else localStorage.removeItem(STORAGE_KEY);
}

class WalletStore {
	current = $state<WalletState | null>(load());
	connecting = $state<string | null>(null);
	error = $state<string | null>(null);
	providers = $state<DiscoveredProvider[]>([]);
	activeProvider = $state<EIP1193Provider | null>(null);

	get isConnected() {
		return this.current !== null;
	}

	get short() {
		const a = this.current?.address;
		return a ? `${a.slice(0, 6)}…${a.slice(-4)}` : '';
	}

	get canSign() {
		return this.getSigningProvider() !== null;
	}

	discover() {
		if (!browser) return () => {};
		const onAnnounce = (event: CustomEvent<DiscoveredProvider>) => {
			const detail = event.detail;
			if (this.providers.some((p) => p.info.uuid === detail.info.uuid)) return;
			this.providers = [...this.providers, detail];
			if (this.current?.source === 'injected' && this.current.providerRdns === detail.info.rdns) {
				this.activeProvider = detail.provider;
			}
		};
		window.addEventListener('eip6963:announceProvider', onAnnounce);
		window.dispatchEvent(new Event('eip6963:requestProvider'));
		return () => window.removeEventListener('eip6963:announceProvider', onAnnounce);
	}

	async connect(discovered: DiscoveredProvider) {
		this.error = null;
		this.connecting = discovered.info.uuid;
		try {
			const accounts = await this.requestAccounts(discovered.provider, {
				forcePermissionPrompt: true
			});
			const first = accounts?.[0];
			if (!first || !isAddress(first)) {
				this.error = `${discovered.info.name} returned no account.`;
				return;
			}
			this.set({
				address: getAddress(first),
				source: 'injected',
				providerRdns: discovered.info.rdns,
				providerName: discovered.info.name,
				providerIcon: discovered.info.icon
			});
			this.activeProvider = discovered.provider;
		} catch (err) {
			this.error = err instanceof Error ? err.message : `Failed to connect ${discovered.info.name}`;
		} finally {
			this.connecting = null;
		}
	}

	async connectLegacyInjected() {
		if (!browser) return;
		const eth = window.ethereum;
		if (!eth) {
			this.error = 'No injected wallet detected. Install one or use manual entry.';
			return;
		}
		this.error = null;
		this.connecting = 'legacy';
		try {
			const accounts = await this.requestAccounts(eth, { forcePermissionPrompt: true });
			const first = accounts?.[0];
			if (!first || !isAddress(first)) {
				this.error = 'Wallet returned no account.';
				return;
			}
			this.set({
				address: getAddress(first),
				source: 'injected',
				providerName: 'Injected wallet'
			});
			this.activeProvider = eth;
		} catch (err) {
			this.error = err instanceof Error ? err.message : 'Failed to connect wallet';
		} finally {
			this.connecting = null;
		}
	}

	setManual(address: string, options: { persist?: boolean } = {}) {
		this.error = null;
		const trimmed = address.trim();
		if (!isAddress(trimmed)) {
			this.error = 'Not a valid EVM address.';
			return false;
		}
		this.activeProvider = null;
		this.set({ address: getAddress(trimmed), source: 'manual' }, options);
		return true;
	}

	disconnect() {
		this.set(null);
		this.error = null;
		this.activeProvider = null;
	}

	hydrate() {
		const stored = load();
		if (stored) this.current = stored;
		else if (browser && !this.current) this.current = null;
	}

	hasStoredWallet() {
		return load() !== null;
	}

	getSigningWallet(): SigningWallet | null {
		const provider = this.getSigningProvider();
		const address = this.current?.address;
		if (!provider || !address) return null;

		const getAddresses = async () => {
			const accounts = await this.requestAccounts(provider);
			const current = address.toLowerCase();
			if (!accounts.some((account) => account.toLowerCase() === current)) {
				throw new Error('Connected browser wallet does not match the selected address.');
			}

			return [
				current as `0x${string}`,
				...accounts
					.filter((account) => account.toLowerCase() !== current)
					.map((account) => account as `0x${string}`)
			];
		};

		return {
			getAddresses,
			getChainId: async () => {
				const chainId = await provider.request({ method: 'eth_chainId' });
				if (typeof chainId === 'number') return chainId;
				if (typeof chainId === 'string') return Number(BigInt(chainId));
				throw new Error('Wallet returned an invalid chain id.');
			},
			signTypedData: async (params) => {
				await getAddresses();
				const signature = await provider.request({
					method: 'eth_signTypedData_v4',
					params: [address, JSON.stringify(params)]
				});
				if (typeof signature !== 'string' || !signature.startsWith('0x')) {
					throw new Error('Wallet returned an invalid signature.');
				}
				return signature as `0x${string}`;
			}
		};
	}

	async switchChain(target: SwitchWalletChainTarget) {
		this.error = null;
		const provider = this.getSigningProvider();
		if (!provider || this.current?.source !== 'injected') {
			throw new Error('Connect an injected wallet to switch chains.');
		}

		try {
			await provider.request({
				method: 'wallet_switchEthereumChain',
				params: [{ chainId: target.chainId }]
			});
		} catch (err) {
			if (target.addEthereumChainParameter && isUnknownChainError(err)) {
				await provider.request({
					method: 'wallet_addEthereumChain',
					params: [target.addEthereumChainParameter]
				});
				await provider.request({
					method: 'wallet_switchEthereumChain',
					params: [{ chainId: target.chainId }]
				});
				return;
			}
			throw normalizeProviderError(err);
		}
	}

	private set(state: WalletState | null, options: { persist?: boolean } = {}) {
		this.current = state;
		if (options.persist !== false) persist(state);
	}

	private getSigningProvider() {
		if (this.current?.source !== 'injected') return null;
		return this.activeProvider ?? (browser ? (window.ethereum ?? null) : null);
	}

	private async requestAccounts(
		provider: EIP1193Provider,
		options: { forcePermissionPrompt?: boolean } = {}
	) {
		if (options.forcePermissionPrompt) {
			await requestAccountPermissions(provider);
			return normalizeAccounts(await provider.request({ method: 'eth_requestAccounts' }));
		}

		let accounts = normalizeAccounts(await provider.request({ method: 'eth_accounts' }));
		if (accounts.length === 0) {
			accounts = normalizeAccounts(await provider.request({ method: 'eth_requestAccounts' }));
		}
		return accounts;
	}
}

export const wallet = new WalletStore();

function normalizeAccounts(value: unknown) {
	if (!Array.isArray(value)) return [];
	return value.filter(
		(account): account is string => typeof account === 'string' && isAddress(account)
	);
}

async function requestAccountPermissions(provider: EIP1193Provider) {
	try {
		await provider.request({
			method: 'wallet_requestPermissions',
			params: [{ eth_accounts: {} }]
		});
	} catch (err) {
		if (isUnsupportedPermissionRequest(err)) return;
		throw normalizeProviderError(err);
	}
}

function providerErrorCode(err: unknown) {
	if (!err || typeof err !== 'object' || !('code' in err)) return null;
	const code = (err as { code?: unknown }).code;
	return typeof code === 'number' || typeof code === 'string' ? code : null;
}

function providerErrorMessage(err: unknown) {
	if (!err || typeof err !== 'object' || !('message' in err)) return null;
	const message = (err as { message?: unknown }).message;
	return typeof message === 'string' ? message : null;
}

function isUnknownChainError(err: unknown) {
	const code = providerErrorCode(err);
	if (code === 4902) return true;

	const message = providerErrorMessage(err)?.toLowerCase() ?? '';
	return (
		message.includes('unrecognized chain') ||
		message.includes('unknown chain') ||
		message.includes('not added')
	);
}

function isUnsupportedPermissionRequest(err: unknown) {
	const code = providerErrorCode(err);
	if (code === -32601 || code === 4200) return true;

	const message = providerErrorMessage(err)?.toLowerCase() ?? '';
	return (
		message.includes('wallet_requestpermissions') &&
		(message.includes('not supported') ||
			message.includes('unsupported') ||
			message.includes('method not found') ||
			message.includes('unrecognized method'))
	);
}

function normalizeProviderError(err: unknown) {
	if (err instanceof Error) return err;
	const message = providerErrorMessage(err);
	return new Error(message ?? 'Wallet request failed.');
}
