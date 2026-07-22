<script lang="ts">
	import type { SpotDeployParameters } from '@nktkas/hyperliquid/api/exchange';
	import type { SpotDeployStateResponse, SpotMetaResponse } from '@nktkas/hyperliquid/api/info';
	import type { AbstractWallet } from '@nktkas/hyperliquid/signing';
	import { formatPrice, formatSize } from '@nktkas/hyperliquid/utils';
	import { formatUnits, getAddress, isAddress, parseUnits, type Address } from 'viem';
	import HeroIcon from '$lib/components/HeroIcon.svelte';
	import {
		getExchangeClient,
		getHttpInfoClient,
		HYPERLIQUID_L1_SIGNATURE_CHAIN_ID,
		type RecordedExchangeRequest
	} from '$lib/hl/clients.js';
	import { hyperliquidNetwork, type HyperliquidNetwork } from '$lib/hl/network.svelte';
	import { HYPERLIQUID_L1_ADD_ETHEREUM_CHAIN_PARAMETER } from '$lib/hl/wallet-chains.js';
	import { wallet } from '$lib/stores/wallet.svelte';
	import View from '../View.svelte';
	import ViewTabs from './ViewTabs.svelte';
	import CurlDetails from './l1core/CurlDetails.svelte';

	type Props = {
		viewId: string;
	};
	type Hip1Tab = 'deployments' | 'deploy';
	type Hip1Action = 'registerToken' | 'userGenesis' | 'genesis' | 'registerSpot' | 'hyperliquidity';
	type TokenDeployState = SpotDeployStateResponse['states'][number];
	type GenesisAllocationKind = 'user' | 'anchor' | 'hyperliquidity';
	type GenesisAllocationRow = {
		id: number;
		kind: GenesisAllocationKind;
		target: string;
		amount: string;
	};
	type Hip1Data = {
		deploy: SpotDeployStateResponse;
		spotMeta: SpotMetaResponse;
		hypeAvailable: number;
		perpsWithdrawable: number;
	};

	let { viewId }: Props = $props();

	const TABS = [
		{ id: 'deployments', label: 'Deployments' },
		{ id: 'deploy', label: 'Deploy' }
	] as const;
	const DEPLOY_STEPS = [
		{ id: 1, label: 'Register token' },
		{ id: 2, label: 'Allocate genesis' },
		{ id: 3, label: 'Finalize genesis' },
		{ id: 4, label: 'Register spot' },
		{ id: 5, label: 'Initialize liquidity' }
	] as const;
	const HYPERLIQUIDITY_USER = '0xffffffffffffffffffffffffffffffffffffffff' as const;
	const HYPE_WEI_DECIMALS = 8;
	const MAX_UINT_64 = 18_446_744_073_709_551_615n;
	const MAX_GENESIS_BALANCE_WEI = MAX_UINT_64 / 2n;
	const PX_GAP = 0.003;
	const MAX_N_ORDERS = 4_000;
	const MAX_MARKET_CAP_END = 100_000_000_000;
	const MIN_MARKET_CAP_END = 1_000_000_000;
	const MAX_MARKET_CAP_START = 10_000_000;
	const MIN_TOTAL_GENESIS_LOTS = 100_000_000;
	const HYPERLIQUID_L1_CHAIN_ID = Number(BigInt(HYPERLIQUID_L1_SIGNATURE_CHAIN_ID));

	let activeTab = $state<Hip1Tab>('deployments');
	let loading = $state(false);
	let error = $state<string | null>(null);
	let data = $state<Hip1Data | null>(null);
	let loadedAt = $state<number | null>(null);
	let loadGeneration = 0;
	let selectedDeployment = $state('');
	let actionLoading = $state<Hip1Action | null>(null);
	let chainSwitching = $state(false);
	let actionError = $state<string | null>(null);
	let actionNotice = $state<string | null>(null);
	let actionCurl = $state<string | null>(null);

	let tokenNameInput = $state('');
	let tokenFullNameInput = $state('');
	let szDecimalsInput = $state('2');
	let weiDecimalsInput = $state('8');
	let maxGasInput = $state('');
	let allocationRows = $state<GenesisAllocationRow[]>([]);
	let nextAllocationRowId = 0;
	let noHyperliquidityInput = $state(false);
	let startPxInput = $state('');
	let orderSzInput = $state('');
	let nOrdersInput = $state('100');
	let nSeededLevelsInput = $state('0');
	let lastFormDeployment = '';

	const integerFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 });
	const decimalFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 8 });

	let activeAddress = $derived(wallet.current?.address ?? null);
	let canSignWithConnectedWallet = $derived(
		wallet.current?.source === 'injected' && wallet.canSign
	);
	let deploymentStates = $derived(data?.deploy.states ?? []);
	let selectedTokenState = $derived(
		deploymentStates.find((state) => String(state.token) === selectedDeployment) ?? null
	);
	let auction = $derived(data?.deploy.gasAuction ?? null);
	let currentDeploymentStep = $derived(deploymentStep(selectedTokenState));
	let selectedHyperliquidityBalance = $derived(
		selectedTokenState ? hyperliquidityBalance(selectedTokenState) : '0'
	);
	let hasHyperliquidityAllocation = $derived(Number(selectedHyperliquidityBalance) > 0);
	let seededUsdcEstimate = $derived(
		estimateSeededUsdc(startPxInput, orderSzInput, nSeededLevelsInput)
	);
	let tabItems = $derived(
		TABS.map((tab) => ({
			id: tab.id,
			label: tab.label,
			count: tab.id === 'deployments' ? (data?.deploy.states.length ?? null) : null
		}))
	);

	function selectTab(tab: Hip1Tab) {
		activeTab = tab;
	}

	async function loadHip1(
		address: Address,
		network: HyperliquidNetwork,
		generation = ++loadGeneration
	) {
		loading = true;
		error = null;

		try {
			const info = getHttpInfoClient(network);
			const [deploy, spotMeta, spotState, perpsState] = await Promise.all([
				info.spotDeployState({ user: address }),
				info.spotMeta(),
				info.spotClearinghouseState({ user: address }),
				info.clearinghouseState({ user: address })
			]);
			if (generation !== loadGeneration) return null;

			const hype = spotState.balances.find((balance) => balance.coin === 'HYPE');
			data = {
				deploy,
				spotMeta,
				hypeAvailable: hype ? Math.max(0, Number(hype.total) - Number(hype.hold)) : 0,
				perpsWithdrawable: Number(perpsState.withdrawable)
			};
			loadedAt = Date.now();
			return deploy;
		} catch (err) {
			if (generation !== loadGeneration) return null;
			error = err instanceof Error ? err.message : 'Failed to load HIP-1 deployment state.';
			return null;
		} finally {
			if (generation === loadGeneration) loading = false;
		}
	}

	function refreshHip1() {
		if (!activeAddress) return;
		void loadHip1(activeAddress, hyperliquidNetwork.current, ++loadGeneration);
	}

	function continueDeployment(state: TokenDeployState) {
		selectedDeployment = String(state.token);
		activeTab = 'deploy';
	}

	function deploymentStep(state: TokenDeployState | null) {
		if (!state) return 1;
		if (state.maxSupply === null) return 2;
		if (state.spots.length === 0) return 4;
		return 5;
	}

	function deploymentStatus(state: TokenDeployState) {
		if (state.maxSupply === null) {
			return BigInt(state.totalGenesisBalanceWei) > 0n
				? 'Ready to finalize genesis'
				: 'Awaiting genesis allocations';
		}
		if (state.spots.length === 0) return 'Genesis finalized';
		return 'Ready to initialize liquidity';
	}

	function stepBadgeClass(step: number) {
		if (currentDeploymentStep > step) return 'badge-success';
		if (currentDeploymentStep === step) return 'badge-primary';
		return 'badge-ghost';
	}

	function formatAddress(address: string | null) {
		if (!address || !isAddress(address)) return '-';
		const normalized = getAddress(address);
		return `${normalized.slice(0, 6)}...${normalized.slice(-4)}`;
	}

	function formatDateTime(value: number | null) {
		return value == null ? '-' : new Date(value).toLocaleString();
	}

	function formatInteger(value: number | null | undefined) {
		return value == null ? '-' : integerFormatter.format(value);
	}

	function formatDecimal(value: string | number | null | undefined) {
		if (value == null || value === '') return '-';
		const number = Number(value);
		return Number.isFinite(number) ? decimalFormatter.format(number) : String(value);
	}

	function formatGas(value: string | null | undefined) {
		return value == null ? '-' : `${formatDecimal(value)} HYPE`;
	}

	function auctionEndsAt(status: SpotDeployStateResponse['gasAuction']) {
		return (status.startTimeSeconds + status.durationSeconds) * 1_000;
	}

	function auctionRemainingSeconds(status: SpotDeployStateResponse['gasAuction']) {
		return Math.max(0, Math.floor((auctionEndsAt(status) - Date.now()) / 1_000));
	}

	function auctionProgress(status: SpotDeployStateResponse['gasAuction']) {
		const elapsed = Date.now() / 1_000 - status.startTimeSeconds;
		if (status.durationSeconds <= 0) return 100;
		return Math.min(100, Math.max(0, (elapsed / status.durationSeconds) * 100));
	}

	function formatDuration(seconds: number) {
		const clamped = Math.max(0, Math.floor(seconds));
		const hours = Math.floor(clamped / 3_600);
		const minutes = Math.floor((clamped % 3_600) / 60);
		return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
	}

	function formatSupplyWei(value: string, weiDecimals: number) {
		return compactDecimalString(formatUnits(BigInt(value), weiDecimals));
	}

	function tokenSupply(state: TokenDeployState) {
		return state.maxSupply ?? formatSupplyWei(state.totalGenesisBalanceWei, state.spec.weiDecimals);
	}

	function hyperliquidityBalance(state: TokenDeployState) {
		const userBalance = state.userGenesisBalances.find(
			([address]) => address.toLowerCase() === HYPERLIQUIDITY_USER
		)?.[1];
		return userBalance && Number(userBalance) > 0
			? userBalance
			: state.hyperliquidityGenesisBalance;
	}

	function compactDecimalString(value: string) {
		return (
			value
				.trim()
				.replace(/^0+(?=\d)/, '')
				.replace(/\.0*$|(\.\d+?)0+$/, '$1')
				.replace(/^\./, '0.') || '0'
		);
	}

	function requireUnsignedInteger(value: string, label: string, min = 0, max?: number) {
		const trimmed = value.trim();
		if (!/^\d+$/.test(trimmed)) throw new Error(`${label} must be a whole number.`);
		const parsed = Number(trimmed);
		if (!Number.isSafeInteger(parsed) || parsed < min || (max !== undefined && parsed > max)) {
			const range = max === undefined ? `at least ${min}` : `between ${min} and ${max}`;
			throw new Error(`${label} must be ${range}.`);
		}
		return parsed;
	}

	function requireDecimal(value: string, label: string, decimals?: number) {
		const trimmed = value.trim();
		if (!/^\d+(\.\d+)?$/.test(trimmed)) throw new Error(`${label} must be a decimal.`);
		const [, fraction = ''] = trimmed.split('.');
		if (decimals !== undefined && fraction.length > decimals) {
			throw new Error(`${label} can have at most ${decimals} decimal places.`);
		}
		if (Number(trimmed) <= 0) throw new Error(`${label} must be greater than zero.`);
		return compactDecimalString(trimmed);
	}

	function amountToWei(value: string, decimals: number, label: string) {
		const amount = requireDecimal(value, label, decimals);
		const wei = parseUnits(amount, decimals);
		if (wei <= 0n) throw new Error(`${label} must be greater than zero.`);
		return wei;
	}

	function allocationAmountToWei(value: string, decimals: number, label: string) {
		const trimmed = value.trim();
		if (!/^\d+(\.\d+)?$/.test(trimmed)) {
			throw new Error(`${label} must be a non-negative decimal.`);
		}
		const [, fraction = ''] = trimmed.split('.');
		if (fraction.length > decimals) {
			throw new Error(`${label} can have at most ${decimals} decimal places.`);
		}
		return parseUnits(compactDecimalString(trimmed), decimals);
	}

	function maxGasWei() {
		const currentGas = auction?.currentGas;
		const maxGas = maxGasInput.trim() || currentGas;
		if (!maxGas) throw new Error('The token deployment auction is not currently active.');
		const wei = amountToWei(maxGas, HYPE_WEI_DECIMALS, 'Maximum gas');
		if (wei > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Maximum gas is too large.');
		if (currentGas && wei < parseUnits(currentGas, HYPE_WEI_DECIMALS)) {
			throw new Error(`Maximum gas must cover the current auction price of ${currentGas} HYPE.`);
		}
		if (currentGas && data && data.hypeAvailable < Number(currentGas)) {
			throw new Error(
				`The connected wallet needs at least ${currentGas} available HYPE in its spot balance.`
			);
		}
		return Number(wei);
	}

	async function requireConnectedWallet(action: string) {
		const signingWallet = wallet.getSigningWallet();
		if (!signingWallet || wallet.current?.source !== 'injected') {
			throw new Error(`Connect an injected root wallet to ${action}.`);
		}

		const chainId = await signingWallet.getChainId();
		if (chainId !== HYPERLIQUID_L1_CHAIN_ID) {
			chainSwitching = true;
			try {
				await wallet.switchChain({
					chainId: HYPERLIQUID_L1_SIGNATURE_CHAIN_ID,
					addEthereumChainParameter: HYPERLIQUID_L1_ADD_ETHEREUM_CHAIN_PARAMETER
				});
			} finally {
				chainSwitching = false;
			}
		}

		if ((await signingWallet.getChainId()) !== HYPERLIQUID_L1_CHAIN_ID) {
			throw new Error(`Switch the connected wallet to Hyperliquid L1 to ${action}.`);
		}
		return signingWallet as AbstractWallet;
	}

	function recordActionRequest(request: RecordedExchangeRequest) {
		if (request.endpoint !== 'exchange') return;
		actionCurl = requestToCurl(request);
	}

	function requestToCurl(request: RecordedExchangeRequest) {
		return [
			`curl -X POST ${shellQuote(request.url)}`,
			`  -H ${shellQuote('Content-Type: application/json')}`,
			`  --data-raw ${shellQuote(JSON.stringify(request.payload))}`
		].join(' \\\n');
	}

	function shellQuote(value: string) {
		return `'${value.replaceAll("'", "'\\''")}'`;
	}

	async function runDeployAction(action: Hip1Action, label: string, params: SpotDeployParameters) {
		const address = activeAddress;
		const network = hyperliquidNetwork.current;
		if (!address || actionLoading) return null;

		actionError = null;
		actionNotice = null;
		actionCurl = null;
		actionLoading = action;
		try {
			const signingWallet = await requireConnectedWallet(label.toLowerCase());
			await getExchangeClient(signingWallet, network, recordActionRequest).spotDeploy(params);
			actionNotice = `${label} submitted successfully.`;
			return await loadHip1(address, network, ++loadGeneration);
		} catch (err) {
			actionError = err instanceof Error ? err.message : `${label} failed.`;
			return null;
		} finally {
			actionLoading = null;
		}
	}

	async function registerToken(event: SubmitEvent) {
		event.preventDefault();
		try {
			const name = tokenNameInput.trim();
			if (!name || name.length > 6) throw new Error('Token ticker must contain 1 to 6 characters.');
			const szDecimals = requireUnsignedInteger(szDecimalsInput, 'Size decimals', 0);
			const weiDecimals = requireUnsignedInteger(weiDecimalsInput, 'Wei decimals', 0);
			if (szDecimals + 5 > weiDecimals) {
				throw new Error('Wei decimals must be at least size decimals + 5.');
			}
			const fullName = tokenFullNameInput.trim();
			const previousTokens = new Set(deploymentStates.map((state) => state.token));
			const result = await runDeployAction('registerToken', 'Token registration', {
				registerToken2: {
					spec: { name, szDecimals, weiDecimals },
					maxGas: maxGasWei(),
					...(fullName ? { fullName } : {})
				}
			});
			const created = result?.states.find((state) => !previousTokens.has(state.token));
			if (created) selectedDeployment = String(created.token);
		} catch (err) {
			actionError = err instanceof Error ? err.message : 'Token registration failed.';
		}
	}

	function addAllocation(kind: GenesisAllocationKind) {
		allocationRows.push({
			id: ++nextAllocationRowId,
			kind,
			target: kind === 'user' ? (activeAddress ?? '') : '',
			amount: ''
		});
	}

	function removeAllocation(id: number) {
		allocationRows = allocationRows.filter((row) => row.id !== id);
	}

	function allocationBatch(state: TokenDeployState) {
		if (allocationRows.length === 0) throw new Error('Add at least one genesis allocation.');
		const userAndWei: [Address, string][] = [];
		const existingTokenAndWei: [number, string][] = [];
		let batchTotalWei = 0n;

		for (const [index, row] of allocationRows.entries()) {
			const label = `Allocation ${index + 1}`;
			const amountWei = allocationAmountToWei(
				row.amount,
				state.spec.weiDecimals,
				`${label} amount`
			);
			batchTotalWei += amountWei;

			if (row.kind === 'user') {
				if (!isAddress(row.target)) throw new Error(`${label} needs a valid user address.`);
				if (row.target.toLowerCase() === HYPERLIQUIDITY_USER) {
					throw new Error('Use the Hyperliquidity allocation type for its reserved address.');
				}
				userAndWei.push([row.target.toLowerCase() as Address, amountWei.toString()]);
			} else if (row.kind === 'hyperliquidity') {
				userAndWei.push([HYPERLIQUIDITY_USER, amountWei.toString()]);
			} else {
				const token = requireUnsignedInteger(row.target, `${label} anchor token`, 0);
				const minimumAnchorWei = parseUnits('100000', state.spec.weiDecimals);
				if (amountWei > 0n && amountWei < minimumAnchorWei) {
					throw new Error('An anchor-token allocation must be at least 100,000 new tokens.');
				}
				existingTokenAndWei.push([token, amountWei.toString()]);
			}
		}

		const totalWei = BigInt(state.totalGenesisBalanceWei) + batchTotalWei;
		if (totalWei > MAX_GENESIS_BALANCE_WEI) {
			throw new Error('Total genesis supply is too large.');
		}
		return { userAndWei, existingTokenAndWei };
	}

	async function submitGenesisAllocations() {
		const state = selectedTokenState;
		if (!state || state.maxSupply !== null) return;
		actionError = null;
		try {
			const batch = allocationBatch(state);
			const result = await runDeployAction('userGenesis', 'Genesis allocations', {
				userGenesis: { token: state.token, ...batch }
			});
			if (result) allocationRows = [];
		} catch (err) {
			actionError = err instanceof Error ? err.message : 'Genesis allocations failed.';
		}
	}

	async function finalizeGenesis() {
		const state = selectedTokenState;
		if (!state || state.maxSupply !== null) return;
		actionError = null;
		try {
			const maxSupplyWei = BigInt(state.totalGenesisBalanceWei);
			if (maxSupplyWei <= 0n) throw new Error('Allocate the genesis supply before finalizing it.');
			if (maxSupplyWei > MAX_UINT_64) throw new Error('Maximum supply is too large.');
			const hyperliquidityAllocated = Number(hyperliquidityBalance(state)) > 0;
			if (noHyperliquidityInput && hyperliquidityAllocated) {
				throw new Error('Hyperliquidity cannot be disabled after supply has been allocated to it.');
			}
			if (!noHyperliquidityInput && !hyperliquidityAllocated) {
				throw new Error('Add a Hyperliquidity allocation or select “No Hyperliquidity”.');
			}
			if (hyperliquidityAllocated) validatedHyperliquidity(state);
			await runDeployAction('genesis', 'Genesis finalization', {
				genesis: {
					token: state.token,
					maxSupply: maxSupplyWei.toString(),
					...(noHyperliquidityInput ? { noHyperliquidity: true as const } : {})
				}
			});
		} catch (err) {
			actionError = err instanceof Error ? err.message : 'Genesis finalization failed.';
		}
	}

	async function registerSpot() {
		const state = selectedTokenState;
		if (!state || state.maxSupply === null || state.spots.length > 0) return;
		await runDeployAction('registerSpot', 'USDC spot registration', {
			registerSpot: { tokens: [state.token, 0] }
		});
	}

	function validatedHyperliquidity(state: TokenDeployState) {
		const startPx = requireDecimal(startPxInput, 'Starting price');
		const orderSz = requireDecimal(orderSzInput, 'Order size', state.spec.szDecimals);
		const formattedStartPx = formatPrice(startPx, state.spec.szDecimals, 'spot');
		const formattedOrderSz = formatSize(orderSz, state.spec.szDecimals);
		if (formattedStartPx !== startPx) {
			throw new Error(`Starting price must follow spot tick rules; try ${formattedStartPx}.`);
		}
		if (formattedOrderSz !== orderSz) {
			throw new Error(`Order size must follow the token lot size; try ${formattedOrderSz}.`);
		}

		const nOrders = requireUnsignedInteger(nOrdersInput, 'Number of orders', 10, MAX_N_ORDERS);
		const nSeededLevels = requireUnsignedInteger(
			nSeededLevelsInput,
			'Number of seeded levels',
			0,
			nOrders
		);
		const startPxNumber = Number(startPx);
		const orderSzNumber = Number(orderSz);
		const totalSupply = Number(
			state.maxSupply ?? formatSupplyWei(state.totalGenesisBalanceWei, state.spec.weiDecimals)
		);
		if (!Number.isFinite(totalSupply) || totalSupply <= 0) {
			throw new Error('Token maximum supply is invalid.');
		}
		if (startPxNumber * orderSzNumber < 1) {
			throw new Error('The first order must be worth at least 1 USDC.');
		}

		const pxRange = Math.ceil(Math.pow(1 + PX_GAP, nOrders));
		const endPx = startPxNumber * pxRange;
		if (pxRange > 1_000_000 || endPx * orderSzNumber * 1e9 > Number(MAX_UINT_64)) {
			throw new Error('The Hyperliquidity range is too large.');
		}
		if (totalSupply * Math.pow(10, state.spec.szDecimals) < MIN_TOTAL_GENESIS_LOTS) {
			throw new Error(`Total genesis supply must contain at least ${MIN_TOTAL_GENESIS_LOTS} lots.`);
		}
		const endMarketCap = totalSupply * endPx;
		if (endMarketCap > MAX_MARKET_CAP_END) {
			throw new Error('End-of-range market cap must be below 100B USDC.');
		}
		if (endMarketCap < MIN_MARKET_CAP_END) {
			throw new Error('End-of-range market cap must be above 1B USDC.');
		}
		if (totalSupply * startPxNumber > MAX_MARKET_CAP_START) {
			throw new Error('Starting market cap must be below 10M USDC.');
		}
		if ((orderSzNumber * nOrders) / totalSupply <= 0.01) {
			throw new Error('Hyperliquidity must contain more than 1% of total supply.');
		}

		const availableWei = parseUnits(hyperliquidityBalance(state), state.spec.weiDecimals);
		const requiredAskWei =
			parseUnits(orderSz, state.spec.weiDecimals) * BigInt(nOrders - nSeededLevels);
		if (requiredAskWei > availableWei) {
			throw new Error('The Hyperliquidity allocation does not cover all initial ask levels.');
		}
		const requiredUsdc = estimateSeededUsdc(startPx, orderSz, String(nSeededLevels));
		if (data && requiredUsdc > data.perpsWithdrawable) {
			throw new Error(
				`Seeded levels need about ${formatDecimal(requiredUsdc)} USDC in the perps balance.`
			);
		}

		return { startPx, orderSz, nOrders, nSeededLevels };
	}

	function estimateSeededUsdc(startPx: string, orderSz: string, seededLevels: string) {
		const px = Number(startPx);
		const size = Number(orderSz);
		const levels = Number(seededLevels);
		if (
			!Number.isFinite(px) ||
			!Number.isFinite(size) ||
			!Number.isInteger(levels) ||
			levels <= 0
		) {
			return 0;
		}
		return px * size * ((Math.pow(1 + PX_GAP, levels) - 1) / PX_GAP);
	}

	async function registerHyperliquidity() {
		const state = selectedTokenState;
		const spot = state?.spots[0];
		if (!state || state.maxSupply === null || spot === undefined) return;
		actionError = null;
		try {
			if (!hasHyperliquidityAllocation) {
				await runDeployAction('hyperliquidity', 'Deployment completion', {
					registerHyperliquidity: { spot, startPx: '1', orderSz: '1', nOrders: 0 }
				});
				return;
			}
			const params = validatedHyperliquidity(state);
			await runDeployAction('hyperliquidity', 'Hyperliquidity initialization', {
				registerHyperliquidity: { spot, ...params }
			});
		} catch (err) {
			actionError = err instanceof Error ? err.message : 'Hyperliquidity initialization failed.';
		}
	}

	$effect(() => {
		const address = activeAddress;
		const network = hyperliquidNetwork.current;
		const generation = ++loadGeneration;

		actionError = null;
		actionNotice = null;
		actionCurl = null;
		selectedDeployment = '';
		if (!address) {
			loading = false;
			error = null;
			data = null;
			loadedAt = null;
			return;
		}
		data = null;
		loadedAt = null;
		void loadHip1(address, network, generation);
	});

	$effect(() => {
		const states = deploymentStates;
		if (selectedDeployment === 'new') return;
		if (states.some((state) => String(state.token) === selectedDeployment)) return;
		selectedDeployment = states[0] ? String(states[0].token) : 'new';
	});

	$effect(() => {
		const formDeployment = selectedDeployment;
		if (!formDeployment || formDeployment === lastFormDeployment) return;
		lastFormDeployment = formDeployment;
		allocationRows = [];
		noHyperliquidityInput = false;
		startPxInput = '';
		orderSzInput = '';
		nOrdersInput = '100';
		nSeededLevelsInput = '0';
	});
</script>

<View {viewId} title="HIP-1">
	{#snippet subtitleContent()}
		<span>{hyperliquidNetwork.config.label}</span>
		{#if activeAddress}
			<span>/</span>
			<span class="font-mono">{formatAddress(activeAddress)}</span>
		{/if}
		{#if loadedAt}
			<span>/</span>
			<span>{formatDateTime(loadedAt)}</span>
		{/if}
	{/snippet}

	{#snippet actions()}
		<button
			class="btn btn-ghost btn-xs"
			aria-label="Refresh HIP-1"
			disabled={loading || actionLoading !== null || !activeAddress}
			onclick={refreshHip1}
		>
			{#if loading}
				<span class="loading loading-xs loading-spinner"></span>
			{:else}
				<HeroIcon name="arrow-path" />
			{/if}
		</button>
	{/snippet}

	<div class="space-y-3 p-3">
		<ViewTabs
			tabs={tabItems}
			active={activeTab}
			onSelect={selectTab}
			countStyle="plain"
			showZeroCounts
		/>

		{#if error}
			<div role="alert" class="alert alert-soft text-xs alert-error">
				<span>{error}</span>
			</div>
		{/if}

		{#if activeTab === 'deployments'}
			{#if !activeAddress}
				<p class="p-2 text-sm text-base-content/60">Connect or select an address.</p>
			{:else if loading && !data}
				<div class="flex items-center justify-center py-8">
					<span class="loading loading-sm loading-spinner"></span>
				</div>
			{:else if data}
				<div class="grid gap-2 sm:grid-cols-3">
					<div class="rounded-lg border border-base-300 bg-base-100 p-3">
						<div class="text-xs text-base-content/50 uppercase">In progress</div>
						<div class="mt-1 font-mono text-2xl font-semibold">
							{formatInteger(data.deploy.states.length)}
						</div>
					</div>
					<div class="rounded-lg border border-base-300 bg-base-100 p-3">
						<div class="text-xs text-base-content/50 uppercase">Current auction gas</div>
						<div class="mt-1 font-mono text-lg font-semibold">
							{formatGas(data.deploy.gasAuction.currentGas)}
						</div>
					</div>
					<div class="rounded-lg border border-base-300 bg-base-100 p-3">
						<div class="text-xs text-base-content/50 uppercase">Available spot HYPE</div>
						<div class="mt-1 font-mono text-lg font-semibold">
							{formatDecimal(data.hypeAvailable)}
						</div>
					</div>
				</div>

				{#if data.deploy.states.length === 0}
					<div class="rounded-lg border border-base-300 bg-base-100 p-4">
						<p class="text-sm font-medium">No HIP-1 deployments in progress</p>
						<p class="mt-1 text-xs text-base-content/60">
							Completed deployments leave this queue after the required Hyperliquidity step.
						</p>
						<button
							class="btn mt-3 btn-sm btn-primary"
							onclick={() => {
								selectedDeployment = 'new';
								activeTab = 'deploy';
							}}
						>
							Deploy token
						</button>
					</div>
				{:else}
					{#each data.deploy.states as state (state.token)}
						<section class="rounded-lg border border-base-300 bg-base-100 p-3">
							<div class="flex flex-wrap items-start justify-between gap-3">
								<div class="min-w-0">
									<div class="flex flex-wrap items-center gap-2">
										<h3 class="font-mono text-sm font-semibold">{state.spec.name}</h3>
										<span class="badge font-mono badge-sm">token #{state.token}</span>
									</div>
									<p class="mt-1 text-xs text-base-content/60">{deploymentStatus(state)}</p>
								</div>
								<button class="btn shrink-0 btn-sm" onclick={() => continueDeployment(state)}>
									Continue
									<HeroIcon name="arrow-right" />
								</button>
							</div>
							<div class="mt-3 grid gap-2 text-xs sm:grid-cols-4">
								<div>
									<div class="text-base-content/45">Supply allocated</div>
									<div class="mt-0.5 font-mono">{formatDecimal(tokenSupply(state))}</div>
								</div>
								<div>
									<div class="text-base-content/45">Size decimals</div>
									<div class="mt-0.5 font-mono">{state.spec.szDecimals}</div>
								</div>
								<div>
									<div class="text-base-content/45">Wei decimals</div>
									<div class="mt-0.5 font-mono">{state.spec.weiDecimals}</div>
								</div>
								<div>
									<div class="text-base-content/45">Spot index</div>
									<div class="mt-0.5 font-mono">{state.spots[0] ?? '-'}</div>
								</div>
							</div>
						</section>
					{/each}
				{/if}
			{/if}
		{:else}
			<div class="space-y-3">
				{#if actionError}
					<div role="alert" class="alert alert-soft text-xs alert-error">
						<span>{actionError}</span>
					</div>
				{/if}
				{#if actionNotice}
					<div role="status" class="alert alert-soft text-xs alert-success">
						<span>{actionNotice}</span>
					</div>
				{/if}

				<div class="rounded-lg border border-base-300 bg-base-100 p-3">
					<div class="flex flex-wrap items-start justify-between gap-3">
						<div>
							<div class="text-xs font-semibold text-base-content/60 uppercase">Signer</div>
							<p class="mt-1 font-mono text-sm break-all">
								{activeAddress ?? 'No wallet connected'}
							</p>
						</div>
						<span
							class="badge badge-sm {canSignWithConnectedWallet
								? 'badge-success'
								: 'badge-warning'}"
						>
							{canSignWithConnectedWallet ? 'Ready to sign' : 'Signing unavailable'}
						</span>
					</div>
					{#if !canSignWithConnectedWallet}
						<p class="mt-2 text-xs text-warning">
							Connect this address with an injected wallet before submitting a stage.
						</p>
					{/if}
				</div>

				{#if deploymentStates.length > 0}
					<label class="form-control rounded-lg border border-base-300 bg-base-100 p-3">
						<span class="label pb-1 text-xs text-base-content/60">Deployment</span>
						<select class="select w-full select-sm" bind:value={selectedDeployment}>
							{#each deploymentStates as state (state.token)}
								<option value={String(state.token)}>
									{state.spec.name} / token #{state.token} / {deploymentStatus(state)}
								</option>
							{/each}
							<option value="new">Register a new token</option>
						</select>
					</label>
				{/if}

				<div class="grid grid-cols-5 gap-1 rounded-lg border border-base-300 bg-base-100 p-3">
					{#each DEPLOY_STEPS as step (step.id)}
						<div class="min-w-0 text-center">
							<span class="badge badge-sm {stepBadgeClass(step.id)}">{step.id}</span>
							<div class="mt-1 truncate text-[10px] text-base-content/55" title={step.label}>
								{step.label}
							</div>
						</div>
					{/each}
				</div>

				{#if !selectedTokenState}
					<form class="space-y-3" onsubmit={registerToken}>
						<div class="rounded-lg border border-warning/40 bg-warning/5 p-3">
							<p class="text-sm font-medium">Test the exact deployment on testnet first</p>
							<p class="mt-1 text-xs leading-5 text-base-content/65">
								Registration locks the token specification and burns the auction gas. Later mistakes
								can leave a deployment stuck, and gas cannot be refunded.
							</p>
						</div>

						<div class="rounded-lg border border-base-300 bg-base-100 p-3">
							<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
								<div class="text-xs font-semibold text-base-content/60 uppercase">
									Token auction
								</div>
								<span
									class="badge badge-sm {auction?.currentGas ? 'badge-warning' : 'badge-ghost'}"
								>
									{auction?.currentGas ? 'Active' : 'Unavailable'}
								</span>
							</div>
							{#if auction}
								<div class="grid gap-2 sm:grid-cols-3">
									<div>
										<div class="text-xs text-base-content/45">Current gas</div>
										<div class="mt-0.5 font-mono text-sm font-medium">
											{formatGas(auction.currentGas)}
										</div>
									</div>
									<div>
										<div class="text-xs text-base-content/45">Available spot HYPE</div>
										<div class="mt-0.5 font-mono text-sm font-medium">
											{formatDecimal(data?.hypeAvailable)}
										</div>
									</div>
									<div>
										<div class="text-xs text-base-content/45">Remaining</div>
										<div class="mt-0.5 font-mono text-sm">
											{formatDuration(auctionRemainingSeconds(auction))}
										</div>
									</div>
								</div>
								<progress
									class="progress mt-3 h-1.5 w-full progress-warning"
									value={auctionProgress(auction)}
									max="100"
								></progress>
								<div class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-base-content/55">
									<span>Start {formatGas(auction.startGas)}</span>
									<span>Ends {formatDateTime(auctionEndsAt(auction))}</span>
								</div>
							{:else}
								<p class="text-xs text-base-content/60">Auction status is not loaded.</p>
							{/if}
						</div>

						<div class="rounded-lg border border-base-300 bg-base-100 p-3">
							<div class="mb-3 text-xs font-semibold text-base-content/60 uppercase">Token</div>
							<div class="grid gap-3 md:grid-cols-2">
								<label class="form-control">
									<span class="label pb-1 text-xs text-base-content/60">Ticker</span>
									<input
										class="input input-sm w-full font-mono"
										bind:value={tokenNameInput}
										maxlength="6"
										placeholder="TOKEN"
									/>
								</label>
								<label class="form-control">
									<span class="label pb-1 text-xs text-base-content/60">Full name</span>
									<input
										class="input input-sm w-full"
										bind:value={tokenFullNameInput}
										placeholder="Optional"
									/>
								</label>
								<label class="form-control">
									<span class="label pb-1 text-xs text-base-content/60">Size decimals</span>
									<input
										class="input input-sm w-full font-mono"
										bind:value={szDecimalsInput}
										inputmode="numeric"
									/>
									<span class="mt-1 text-[10px] text-base-content/45"
										>Non-negative whole number</span
									>
								</label>
								<label class="form-control">
									<span class="label pb-1 text-xs text-base-content/60">Wei decimals</span>
									<input
										class="input input-sm w-full font-mono"
										bind:value={weiDecimalsInput}
										inputmode="numeric"
									/>
									<span class="mt-1 text-[10px] text-base-content/45">
										Must be at least size decimals + 5
									</span>
								</label>
								<label class="form-control md:col-span-2">
									<span class="label pb-1 text-xs text-base-content/60">Maximum gas (HYPE)</span>
									<input
										class="input input-sm w-full font-mono"
										bind:value={maxGasInput}
										inputmode="decimal"
										placeholder={auction?.currentGas ?? 'Auction unavailable'}
									/>
									<span class="mt-1 text-[10px] text-base-content/45">
										Leave blank to cap the transaction at the currently loaded auction price.
									</span>
								</label>
							</div>
						</div>

						<div class="flex justify-end">
							<button
								type="submit"
								class="btn btn-sm btn-primary"
								disabled={!canSignWithConnectedWallet ||
									actionLoading !== null ||
									!auction?.currentGas}
							>
								{#if actionLoading === 'registerToken' || chainSwitching}
									<span class="loading loading-xs loading-spinner"></span>
								{/if}
								Register token
							</button>
						</div>
					</form>
				{:else}
					<div class="rounded-lg border border-base-300 bg-base-100 p-3">
						<div class="flex flex-wrap items-center justify-between gap-2">
							<div>
								<div class="flex flex-wrap items-center gap-2">
									<h3 class="font-mono text-base font-semibold">{selectedTokenState.spec.name}</h3>
									<span class="badge font-mono badge-sm">token #{selectedTokenState.token}</span>
								</div>
								<p class="mt-1 text-xs text-base-content/60">
									{selectedTokenState.fullName || 'No full name'} / sz {selectedTokenState.spec
										.szDecimals} / wei {selectedTokenState.spec.weiDecimals}
								</p>
							</div>
							<span class="badge badge-sm">{deploymentStatus(selectedTokenState)}</span>
						</div>
					</div>

					{#if selectedTokenState.maxSupply === null}
						<div class="rounded-lg border border-base-300 bg-base-100 p-3">
							<div class="mb-3 flex flex-wrap items-start justify-between gap-2">
								<div>
									<div class="text-xs font-semibold text-base-content/60 uppercase">
										2. Genesis allocations
									</div>
									<p class="mt-1 text-xs text-base-content/60">
										Amounts are entered in {selectedTokenState.spec.name}, then submitted to the
										protocol in wei. You can submit multiple batches before finalizing; submitted
										allocations cannot be removed.
									</p>
								</div>
								<span class="badge font-mono badge-sm">
									{formatDecimal(tokenSupply(selectedTokenState))} allocated
								</span>
							</div>

							{#if selectedTokenState.userGenesisBalances.length > 0 || selectedTokenState.existingTokenGenesisBalances.length > 0}
								<div class="mb-3 space-y-1 rounded-lg bg-base-200/50 p-2 text-xs">
									{#each selectedTokenState.userGenesisBalances as [address, amount] (`${address}:${amount}`)}
										{#if Number(amount) > 0}
											<div class="flex justify-between gap-3">
												<span class="truncate font-mono">
													{address.toLowerCase() === HYPERLIQUIDITY_USER
														? 'Hyperliquidity'
														: formatAddress(address)}
												</span>
												<span class="shrink-0 font-mono">{formatDecimal(amount)}</span>
											</div>
										{/if}
									{/each}
									{#each selectedTokenState.existingTokenGenesisBalances as [token, amount] (`${token}:${amount}`)}
										{#if Number(amount) > 0}
											<div class="flex justify-between gap-3">
												<span>Anchor token #{token}</span>
												<span class="shrink-0 font-mono">{formatDecimal(amount)}</span>
											</div>
										{/if}
									{/each}
								</div>
							{/if}

							<div class="space-y-2">
								{#each allocationRows as row, index (row.id)}
									<div
										class="grid gap-2 rounded-lg border border-base-300 p-2 md:grid-cols-[9rem_minmax(0,1fr)_minmax(8rem,0.7fr)_auto]"
									>
										<label class="form-control">
											<span class="label pb-1 text-[10px] text-base-content/50">Type</span>
											<select class="select w-full select-sm" bind:value={row.kind}>
												<option value="user">User</option>
												<option value="anchor">Anchor token</option>
												<option value="hyperliquidity">Hyperliquidity</option>
											</select>
										</label>
										<label class="form-control">
											<span class="label pb-1 text-[10px] text-base-content/50">Recipient</span>
											{#if row.kind === 'user'}
												<input
													class="input input-sm w-full font-mono"
													bind:value={row.target}
													placeholder="0x..."
												/>
											{:else if row.kind === 'anchor'}
												<select class="select w-full select-sm" bind:value={row.target}>
													<option value="">Select existing token</option>
													{#each data?.spotMeta.tokens ?? [] as token (token.index)}
														<option value={String(token.index)}
															>{token.name} / #{token.index}</option
														>
													{/each}
												</select>
											{:else}
												<div
													class="input input-sm flex w-full items-center font-mono text-xs text-base-content/55"
												>
													Reserved system address
												</div>
											{/if}
										</label>
										<label class="form-control">
											<span class="label pb-1 text-[10px] text-base-content/50">
												Amount ({selectedTokenState.spec.name})
											</span>
											<input
												class="input input-sm w-full font-mono"
												bind:value={row.amount}
												inputmode="decimal"
												placeholder="Zero or positive"
											/>
										</label>
										<button
											type="button"
											class="btn btn-square self-end btn-ghost btn-sm"
											aria-label="Remove allocation {index + 1}"
											onclick={() => removeAllocation(row.id)}
										>
											<HeroIcon name="x-mark" />
										</button>
									</div>
								{/each}
							</div>

							<div class="mt-3 flex flex-wrap items-center justify-between gap-2">
								<div class="flex flex-wrap gap-1">
									<button type="button" class="btn btn-xs" onclick={() => addAllocation('user')}
										>+ User</button
									>
									<button type="button" class="btn btn-xs" onclick={() => addAllocation('anchor')}
										>+ Anchor</button
									>
									<button
										type="button"
										class="btn btn-xs"
										onclick={() => addAllocation('hyperliquidity')}
									>
										+ Hyperliquidity
									</button>
								</div>
								<button
									type="button"
									class="btn btn-sm"
									disabled={!canSignWithConnectedWallet ||
										allocationRows.length === 0 ||
										actionLoading !== null}
									onclick={submitGenesisAllocations}
								>
									{#if actionLoading === 'userGenesis'}
										<span class="loading loading-xs loading-spinner"></span>
									{/if}
									Submit allocation batch
								</button>
							</div>
						</div>

						<div class="rounded-lg border border-base-300 bg-base-100 p-3">
							<div class="text-xs font-semibold text-base-content/60 uppercase">
								3. Finalize genesis
							</div>
							<p class="mt-1 text-xs leading-5 text-base-content/60">
								The capped maximum supply will be
								<span class="font-mono text-base-content">
									{formatDecimal(tokenSupply(selectedTokenState))}
									{selectedTokenState.spec.name}
								</span>, exactly matching all submitted allocations. This cannot be changed
								afterward.
							</p>
							<label class="mt-3 flex items-center justify-between gap-3 text-sm">
								<span>
									No Hyperliquidity
									<span class="block text-xs text-base-content/50"
										>Only valid when no supply was allocated to it.</span
									>
								</span>
								<input
									type="checkbox"
									class="toggle toggle-sm"
									bind:checked={noHyperliquidityInput}
									disabled={hasHyperliquidityAllocation}
								/>
							</label>

							{#if hasHyperliquidityAllocation}
								<div class="mt-3 border-t border-base-300 pt-3">
									<p class="mb-3 text-xs leading-5 text-base-content/60">
										Plan step 5 now. Before genesis is submitted, these parameters are checked
										against the supply and Hyperliquidity allocation.
									</p>
									<div class="grid gap-3 md:grid-cols-2">
										<label class="form-control">
											<span class="label pb-1 text-xs text-base-content/60"
												>Starting price (USDC)</span
											>
											<input
												class="input input-sm w-full font-mono"
												bind:value={startPxInput}
												inputmode="decimal"
											/>
										</label>
										<label class="form-control">
											<span class="label pb-1 text-xs text-base-content/60">Order size</span>
											<input
												class="input input-sm w-full font-mono"
												bind:value={orderSzInput}
												inputmode="decimal"
											/>
										</label>
										<label class="form-control">
											<span class="label pb-1 text-xs text-base-content/60">Number of orders</span>
											<input
												class="input input-sm w-full font-mono"
												bind:value={nOrdersInput}
												inputmode="numeric"
											/>
										</label>
										<label class="form-control">
											<span class="label pb-1 text-xs text-base-content/60">USDC-seeded levels</span
											>
											<input
												class="input input-sm w-full font-mono"
												bind:value={nSeededLevelsInput}
												inputmode="numeric"
											/>
										</label>
									</div>
									<div class="mt-3 grid gap-2 rounded-lg bg-base-200/50 p-2 text-xs sm:grid-cols-3">
										<div>
											<div class="text-base-content/45">Token allocation</div>
											<div class="mt-0.5 font-mono">
												{formatDecimal(selectedHyperliquidityBalance)}
											</div>
										</div>
										<div>
											<div class="text-base-content/45">Estimated seeded USDC</div>
											<div class="mt-0.5 font-mono">{formatDecimal(seededUsdcEstimate)}</div>
										</div>
										<div>
											<div class="text-base-content/45">Withdrawable perps USDC</div>
											<div class="mt-0.5 font-mono">{formatDecimal(data?.perpsWithdrawable)}</div>
										</div>
									</div>
								</div>
							{/if}

							<div class="mt-3 flex justify-end">
								<button
									type="button"
									class="btn btn-sm btn-primary"
									disabled={!canSignWithConnectedWallet ||
										BigInt(selectedTokenState.totalGenesisBalanceWei) === 0n ||
										actionLoading !== null}
									onclick={finalizeGenesis}
								>
									{#if actionLoading === 'genesis'}
										<span class="loading loading-xs loading-spinner"></span>
									{/if}
									Finalize genesis
								</button>
							</div>
						</div>
					{:else if selectedTokenState.spots.length === 0}
						<div class="rounded-lg border border-base-300 bg-base-100 p-3">
							<div class="text-xs font-semibold text-base-content/60 uppercase">
								4. Register spot pair
							</div>
							<p class="mt-1 text-xs leading-5 text-base-content/60">
								Create the required {selectedTokenState.spec.name}/USDC order book using token #0 as
								the quote.
							</p>
							<div class="mt-3 flex justify-end">
								<button
									type="button"
									class="btn btn-sm btn-primary"
									disabled={!canSignWithConnectedWallet || actionLoading !== null}
									onclick={registerSpot}
								>
									{#if actionLoading === 'registerSpot'}
										<span class="loading loading-xs loading-spinner"></span>
									{/if}
									Register {selectedTokenState.spec.name}/USDC
								</button>
							</div>
						</div>
					{:else}
						<div class="rounded-lg border border-base-300 bg-base-100 p-3">
							<div class="mb-3 flex flex-wrap items-start justify-between gap-2">
								<div>
									<div class="text-xs font-semibold text-base-content/60 uppercase">
										5. Initialize Hyperliquidity
									</div>
									<p class="mt-1 text-xs text-base-content/60">
										This final call is required even when Hyperliquidity was disabled during
										genesis.
									</p>
								</div>
								<span class="badge font-mono badge-sm">spot #{selectedTokenState.spots[0]}</span>
							</div>

							{#if hasHyperliquidityAllocation}
								<div class="grid gap-3 md:grid-cols-2">
									<label class="form-control">
										<span class="label pb-1 text-xs text-base-content/60"
											>Starting price (USDC)</span
										>
										<input
											class="input input-sm w-full font-mono"
											bind:value={startPxInput}
											inputmode="decimal"
										/>
									</label>
									<label class="form-control">
										<span class="label pb-1 text-xs text-base-content/60">Order size</span>
										<input
											class="input input-sm w-full font-mono"
											bind:value={orderSzInput}
											inputmode="decimal"
										/>
									</label>
									<label class="form-control">
										<span class="label pb-1 text-xs text-base-content/60">Number of orders</span>
										<input
											class="input input-sm w-full font-mono"
											bind:value={nOrdersInput}
											inputmode="numeric"
										/>
										<span class="mt-1 text-[10px] text-base-content/45">10 to 4,000</span>
									</label>
									<label class="form-control">
										<span class="label pb-1 text-xs text-base-content/60">USDC-seeded levels</span>
										<input
											class="input input-sm w-full font-mono"
											bind:value={nSeededLevelsInput}
											inputmode="numeric"
										/>
									</label>
								</div>
								<div class="mt-3 grid gap-2 rounded-lg bg-base-200/50 p-2 text-xs sm:grid-cols-3">
									<div>
										<div class="text-base-content/45">Token allocation</div>
										<div class="mt-0.5 font-mono">
											{formatDecimal(selectedHyperliquidityBalance)}
										</div>
									</div>
									<div>
										<div class="text-base-content/45">Estimated seeded USDC</div>
										<div class="mt-0.5 font-mono">{formatDecimal(seededUsdcEstimate)}</div>
									</div>
									<div>
										<div class="text-base-content/45">Withdrawable perps USDC</div>
										<div class="mt-0.5 font-mono">{formatDecimal(data?.perpsWithdrawable)}</div>
									</div>
								</div>
							{:else}
								<div class="rounded-lg bg-base-200/50 p-3 text-xs text-base-content/65">
									Genesis disabled Hyperliquidity. The final call will use zero orders and no seeded
									levels.
								</div>
							{/if}

							<div class="mt-3 flex justify-end">
								<button
									type="button"
									class="btn btn-sm btn-primary"
									disabled={!canSignWithConnectedWallet || actionLoading !== null}
									onclick={registerHyperliquidity}
								>
									{#if actionLoading === 'hyperliquidity'}
										<span class="loading loading-xs loading-spinner"></span>
									{/if}
									{hasHyperliquidityAllocation
										? 'Initialize Hyperliquidity'
										: 'Complete deployment'}
								</button>
							</div>
						</div>
					{/if}
				{/if}

				<CurlDetails curl={actionCurl} />
			</div>
		{/if}
	</div>
</View>
