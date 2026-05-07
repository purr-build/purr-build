<script lang="ts">
	import type { AllPerpMetasResponse, PerpDexsResponse } from '@nktkas/hyperliquid';
	import type { PerpDeployParameters } from '@nktkas/hyperliquid/api/exchange';
	import type {
		ExtraAgentsResponse,
		PerpDeployAuctionStatusResponse
	} from '@nktkas/hyperliquid/api/info';
	import { getAddress, isAddress, type Address } from 'viem';
	import { privateKeyToAccount } from 'viem/accounts';
	import CopyAddress from '$lib/components/CopyAddress.svelte';
	import HeroIcon from '$lib/components/HeroIcon.svelte';
	import {
		getExchangeClient,
		getHttpInfoClient,
		type RecordedExchangeRequest
	} from '$lib/hl/clients.js';
	import { loadSavedAgentWallets, type SavedAgentWallet } from '$lib/hl/agent-wallets.js';
	import { hyperliquidNetwork, type HyperliquidNetwork } from '$lib/hl/network.svelte';
	import { wallet } from '$lib/stores/wallet.svelte';
	import ViewTabs from './ViewTabs.svelte';
	import CurlDetails from './l1core/CurlDetails.svelte';
	import View from '../View.svelte';

	type Props = {
		viewId: string;
	};
	type Loadable<T> = { loading: boolean; error: string | null; data: T | null };
	type PerpDex = NonNullable<PerpDexsResponse[number]>;
	type PerpMeta = AllPerpMetasResponse[number];
	type PerpAsset = PerpMeta['universe'][number];
	type AgentWallet = ExtraAgentsResponse[number];
	type AgentOption = SavedAgentWallet & {
		registered: boolean;
		registeredName: string | null;
		registeredValidUntil: number | null;
		expired: boolean;
		usable: boolean;
	};
	type Hip3AssetRow = {
		key: string;
		asset: PerpAsset;
		assetId: number;
		oiCap: string | null;
		fundingMultiplier: string | null;
		fundingInterestRate: string | null;
	};
	type Hip3DexRow = {
		key: string;
		index: number;
		dex: PerpDex;
		meta: PerpMeta | null;
		assets: Hip3AssetRow[];
	};
	type Hip3Data = {
		dexs: Hip3DexRow[];
		totalDexs: number;
		totalAssets: number;
	};
	type ControlSymbolRow = Hip3AssetRow & {
		dexName: string;
		dexFullName: string;
		coin: string;
	};
	type RegisterAsset2Parameters = Extract<PerpDeployParameters, { registerAsset2: unknown }>;
	type SetFundingMultipliersParameters = Extract<
		PerpDeployParameters,
		{ setFundingMultipliers: unknown }
	>;
	type SetFundingInterestRatesParameters = Extract<
		PerpDeployParameters,
		{ setFundingInterestRates: unknown }
	>;
	type SetOpenInterestCapsParameters = Extract<
		PerpDeployParameters,
		{ setOpenInterestCaps: unknown }
	>;
	type SetGrowthModesParameters = Extract<PerpDeployParameters, { setGrowthModes: unknown }>;
	type HaltTradingParameters = Extract<PerpDeployParameters, { haltTrading: unknown }>;
	type ControlAction =
		| 'fundingMultiplier'
		| 'fundingInterestRate'
		| 'openInterestCap'
		| 'growthMode'
		| 'trading';
	type Hip3Tab = 'deployments' | 'deploy' | 'controls';
	type DeployTarget = 'existing' | 'new';
	type MarginMode = 'strictIsolated' | 'noCross';

	let { viewId }: Props = $props();

	const TABS = [
		{ id: 'deployments', label: 'Deployments' },
		{ id: 'deploy', label: 'Deploy' },
		{ id: 'controls', label: 'Controls' }
	] as const;

	let activeTab = $state<Hip3Tab>('deployments');
	let loading = $state(false);
	let error = $state<string | null>(null);
	let data = $state<Hip3Data | null>(null);
	let loadedAt = $state<number | null>(null);
	let loadGeneration = 0;
	let agentWallets = $state<Loadable<AgentWallet[]>>({ loading: false, error: null, data: null });
	let auctionStatus = $state<Loadable<PerpDeployAuctionStatusResponse>>({
		loading: false,
		error: null,
		data: null
	});
	let savedAgentWallets = $state<SavedAgentWallet[]>([]);
	let selectedAgentAddress = $state('');
	let agentWalletGeneration = 0;
	let auctionGeneration = 0;
	let deployTarget = $state<DeployTarget>('existing');
	let existingDexName = $state('');
	let newDexName = $state('');
	let newDexFullName = $state('');
	let newDexCollateralToken = $state('0');
	let newDexOracleUpdater = $state('');
	let tickerInput = $state('');
	let oraclePxInput = $state('');
	let szDecimalsInput = $state('4');
	let marginTableIdInput = $state('20');
	let marginMode = $state<MarginMode>('strictIsolated');
	let maxGasInput = $state('');
	let deployLoading = $state(false);
	let deployError = $state<string | null>(null);
	let deployNotice = $state<string | null>(null);
	let deployCurl = $state<string | null>(null);
	let selectedControlSymbolKey = $state('');
	let fundingMultiplierInput = $state('1');
	let fundingInterestRateInput = $state('0');
	let openInterestCapInput = $state('');
	let growthModeInput = $state(false);
	let tradingHaltedInput = $state(false);
	let controlLoading = $state<ControlAction | null>(null);
	let controlError = $state<string | null>(null);
	let controlNotice = $state<string | null>(null);
	let controlCurl = $state<string | null>(null);

	const integerFormatter = new Intl.NumberFormat(undefined, {
		maximumFractionDigits: 0
	});
	const decimalFormatter = new Intl.NumberFormat(undefined, {
		maximumFractionDigits: 8
	});
	const percentFormatter = new Intl.NumberFormat(undefined, {
		maximumFractionDigits: 4
	});

	let activeAddress = $derived(wallet.current?.address ?? null);
	let ownedDexRows = $derived(data?.dexs ?? []);
	let selectedDexRow = $derived(
		ownedDexRows.find((row) => row.dex.name === existingDexName) ?? null
	);
	let selectedDexAssetCount = $derived(
		deployTarget === 'existing' ? (selectedDexRow?.assets.length ?? 0) : 0
	);
	let freeDeploymentsRemaining = $derived(Math.max(0, 3 - selectedDexAssetCount));
	let auctionNeeded = $derived(deployTarget === 'existing' && selectedDexAssetCount >= 3);
	let controlSymbols = $derived(buildControlSymbols(ownedDexRows));
	let selectedControlSymbol = $derived(
		controlSymbols.find((row) => row.key === selectedControlSymbolKey) ?? null
	);
	let agentOptions = $derived(buildAgentOptions(savedAgentWallets, agentWallets.data));
	let selectedAgent = $derived(
		agentOptions.find((option) => option.address === selectedAgentAddress) ?? null
	);
	let canSubmitDeploy = $derived(Boolean(activeAddress && selectedAgent?.usable && !deployLoading));
	let canSubmitControl = $derived(
		Boolean(activeAddress && selectedAgent?.usable && selectedControlSymbol && !controlLoading)
	);
	let tabItems = $derived(
		TABS.map((tab) => ({
			id: tab.id,
			label: tab.label,
			count: tab.id === 'deployments' || tab.id === 'controls' ? (data?.totalAssets ?? null) : null
		}))
	);

	function selectTab(tab: Hip3Tab) {
		activeTab = tab;
	}

	function tupleRecord(rows: [string, string][] | undefined) {
		const next: Record<string, string> = {};
		for (const [key, value] of rows ?? []) next[key] = value;
		return next;
	}

	function buildOwnedDexRows(
		address: Address,
		dexs: PerpDexsResponse,
		metas: AllPerpMetasResponse
	) {
		const owner = address.toLowerCase();
		const rows: Hip3DexRow[] = [];

		for (let dexIndex = 0; dexIndex < dexs.length; dexIndex += 1) {
			const dex = dexs[dexIndex];
			if (!dex || dex.deployer.toLowerCase() !== owner) continue;

			const meta = metas[dexIndex] ?? null;
			const oiCapByAsset = tupleRecord(dex.assetToStreamingOiCap);
			const fundingMultiplierByAsset = tupleRecord(dex.assetToFundingMultiplier);
			const fundingInterestRateByAsset = tupleRecord(dex.assetToFundingInterestRate);
			const assets =
				meta?.universe.map<Hip3AssetRow>((asset, assetIndex) => ({
					key: `${dex.name}:${asset.name}:${assetIndex}`,
					asset,
					assetId: 100000 + dexIndex * 10000 + assetIndex,
					oiCap: oiCapByAsset[asset.name] ?? null,
					fundingMultiplier: fundingMultiplierByAsset[asset.name] ?? null,
					fundingInterestRate: fundingInterestRateByAsset[asset.name] ?? null
				})) ?? [];

			rows.push({
				key: `${dex.name}:${dexIndex}`,
				index: dexIndex,
				dex,
				meta,
				assets
			});
		}

		return rows;
	}

	function buildAgentOptions(saved: SavedAgentWallet[], registered: AgentWallet[] | null) {
		const registeredByAddress = new Map(
			(registered ?? []).map((agent) => [agent.address.toLowerCase(), agent])
		);
		return saved.map<AgentOption>((row) => {
			const registeredAgent = registeredByAddress.get(row.address.toLowerCase()) ?? null;
			const validUntil = registeredAgent?.validUntil ?? row.validUntil;
			const expired = validUntil <= Date.now();
			return {
				...row,
				registered: registeredAgent !== null,
				registeredName: registeredAgent ? agentBaseName(registeredAgent.name) : null,
				registeredValidUntil: registeredAgent?.validUntil ?? null,
				expired,
				usable: registeredAgent !== null && !expired
			};
		});
	}

	function buildControlSymbols(rows: Hip3DexRow[]) {
		return rows.flatMap<ControlSymbolRow>((row) =>
			row.assets.map((assetRow) => ({
				...assetRow,
				dexName: row.dex.name,
				dexFullName: row.dex.fullName || row.dex.name,
				coin: coinWithDexPrefix(row.dex.name, assetRow.asset.name)
			}))
		);
	}

	function agentBaseName(name: string) {
		return name.replace(/ valid_until \d+$/, '').trim();
	}

	async function loadHip3(address: Address, network: HyperliquidNetwork, generation: number) {
		loading = true;
		error = null;

		try {
			const info = getHttpInfoClient(network);
			const [dexs, metas] = await Promise.all([info.perpDexs(), info.allPerpMetas()]);
			if (generation !== loadGeneration) return;

			const ownedDexs = buildOwnedDexRows(address, dexs, metas);
			data = {
				dexs: ownedDexs,
				totalDexs: ownedDexs.length,
				totalAssets: ownedDexs.reduce((total, dex) => total + dex.assets.length, 0)
			};
			loadedAt = Date.now();
		} catch (err) {
			if (generation !== loadGeneration) return;
			error = err instanceof Error ? err.message : 'Failed to load HIP-3 deployments.';
		} finally {
			if (generation === loadGeneration) loading = false;
		}
	}

	async function loadRegisteredAgentWallets(
		user: Address,
		network: HyperliquidNetwork,
		generation = ++agentWalletGeneration
	) {
		agentWallets.loading = true;
		agentWallets.error = null;

		try {
			const rows = (await getHttpInfoClient(network).extraAgents({ user })) as AgentWallet[];
			if (generation !== agentWalletGeneration) return;
			agentWallets.data = rows;
			agentWallets.loading = false;
		} catch (err) {
			if (generation !== agentWalletGeneration) return;
			agentWallets.loading = false;
			agentWallets.error = err instanceof Error ? err.message : 'Failed to load API wallets.';
		}
	}

	async function loadAuctionStatus(network: HyperliquidNetwork, generation = ++auctionGeneration) {
		auctionStatus.loading = true;
		auctionStatus.error = null;

		try {
			const next = await getHttpInfoClient(network).perpDeployAuctionStatus();
			if (generation !== auctionGeneration) return;
			auctionStatus.data = next;
			auctionStatus.loading = false;
		} catch (err) {
			if (generation !== auctionGeneration) return;
			auctionStatus.loading = false;
			auctionStatus.error =
				err instanceof Error ? err.message : 'Failed to load HIP-3 auction status.';
		}
	}

	function refreshLocalAgentWallets(address: Address, network: HyperliquidNetwork) {
		savedAgentWallets = loadSavedAgentWallets(address, network);
	}

	function refreshHip3() {
		if (!activeAddress) return;
		const network = hyperliquidNetwork.current;
		refreshLocalAgentWallets(activeAddress, network);
		void loadHip3(activeAddress, network, ++loadGeneration);
		void loadRegisteredAgentWallets(activeAddress, network, ++agentWalletGeneration);
		void loadAuctionStatus(network, ++auctionGeneration);
	}

	function formatInteger(value: number | null | undefined) {
		return value == null ? '-' : integerFormatter.format(value);
	}

	function formatDecimal(value: string | number | null | undefined) {
		if (value == null || value === '') return '-';
		const n = typeof value === 'number' ? value : Number(value);
		return Number.isFinite(n) ? decimalFormatter.format(n) : String(value);
	}

	function formatFundingRate(value: string | null) {
		if (!value) return '-';
		const rate = Number(value);
		return Number.isFinite(rate) ? `${percentFormatter.format(rate * 100)}%` : value;
	}

	function formatAddress(address: string | null) {
		if (!address || !isAddress(address)) return '-';
		const normalized = getAddress(address);
		return `${normalized.slice(0, 6)}...${normalized.slice(-4)}`;
	}

	function formatDateTime(value: number | null) {
		return value == null ? '-' : new Date(value).toLocaleString();
	}

	function formatGas(value: string | null | undefined) {
		return value == null || value === '' ? '-' : `${formatDecimal(value)} HYPE`;
	}

	function formatDuration(seconds: number | null | undefined) {
		if (seconds == null || !Number.isFinite(seconds)) return '-';
		const clamped = Math.max(0, Math.floor(seconds));
		const hours = Math.floor(clamped / 3600);
		const minutes = Math.floor((clamped % 3600) / 60);
		if (hours > 0) return `${hours}h ${minutes}m`;
		return `${minutes}m`;
	}

	function auctionEndsAt(status: PerpDeployAuctionStatusResponse) {
		return (status.startTimeSeconds + status.durationSeconds) * 1000;
	}

	function auctionRemainingSeconds(status: PerpDeployAuctionStatusResponse) {
		return Math.max(0, Math.floor((auctionEndsAt(status) - Date.now()) / 1000));
	}

	function auctionProgress(status: PerpDeployAuctionStatusResponse) {
		const elapsed = Date.now() / 1000 - status.startTimeSeconds;
		if (status.durationSeconds <= 0) return 100;
		return Math.min(100, Math.max(0, (elapsed / status.durationSeconds) * 100));
	}

	function auctionStateLabel(status: PerpDeployAuctionStatusResponse) {
		if (Date.now() < status.startTimeSeconds * 1000) return 'Upcoming';
		if (Date.now() <= auctionEndsAt(status)) return 'Active';
		return 'Ended';
	}

	function marginLabel(asset: PerpAsset) {
		if (asset.isDelisted) return 'Delisted';
		if (asset.marginMode) return asset.marginMode;
		return asset.onlyIsolated ? 'Isolated' : 'Cross';
	}

	function marginBadgeClass(asset: PerpAsset) {
		if (asset.isDelisted) return 'badge-error';
		if (asset.onlyIsolated || asset.marginMode) return 'badge-warning';
		return 'badge-ghost';
	}

	function agentStatusLabel(option: AgentOption) {
		if (option.expired) return 'Expired';
		return option.registered ? 'Registered' : 'Local only';
	}

	function agentStatusBadgeClass(option: AgentOption) {
		if (option.expired) return 'badge-error';
		return option.registered ? 'badge-success' : 'badge-warning';
	}

	function requireUnsignedInteger(value: string, label: string, min = 0) {
		const trimmed = value.trim();
		if (!/^\d+$/.test(trimmed)) throw new Error(`${label} must be a whole number.`);
		const parsed = Number(trimmed);
		if (!Number.isSafeInteger(parsed) || parsed < min) {
			throw new Error(`${label} must be at least ${min}.`);
		}
		return parsed;
	}

	function requireDecimalString(value: string, label: string) {
		const trimmed = value.trim();
		if (!/^[0-9]+(\.[0-9]+)?$/.test(trimmed) || Number(trimmed) <= 0) {
			throw new Error(`${label} must be a positive decimal.`);
		}
		return trimmed;
	}

	function requireSignedDecimalString(value: string, label: string) {
		const trimmed = value.trim();
		if (!/^-?[0-9]+(\.[0-9]+)?$/.test(trimmed)) {
			throw new Error(`${label} must be a decimal.`);
		}
		return trimmed;
	}

	function requireBoundedDecimalString(value: string, label: string, min: number, max: number) {
		const trimmed = requireSignedDecimalString(value, label);
		const parsed = Number(trimmed);
		if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
			throw new Error(`${label} must be between ${min} and ${max}.`);
		}
		return trimmed;
	}

	function optionalMaxGas() {
		const trimmed = maxGasInput.trim();
		return trimmed ? requireUnsignedInteger(trimmed, 'Max gas', 0) : null;
	}

	function coinWithDexPrefix(dex: string, coin: string) {
		const trimmed = coin.trim();
		if (!trimmed) return `${dex}:`;
		return trimmed.includes(':') ? trimmed : `${dex}:${trimmed}`;
	}

	function deployCoin(dex: string) {
		const value = tickerInput.trim();
		if (!value) throw new Error('Enter a ticker.');

		const [maybePrefix, maybeTicker] = value.includes(':') ? value.split(':', 2) : ['', value];
		if (maybePrefix && maybePrefix.toLowerCase() !== dex.toLowerCase()) {
			throw new Error(`Ticker prefix must match selected DEX ${dex}.`);
		}

		const ticker = maybeTicker.trim().toUpperCase();
		if (!/^[A-Z0-9._-]{1,32}$/.test(ticker)) {
			throw new Error('Ticker can use letters, numbers, dot, underscore, or dash.');
		}
		return `${dex}:${ticker}`;
	}

	function controlCoin() {
		if (!selectedControlSymbol) throw new Error('Select a ticker.');
		return selectedControlSymbol.coin;
	}

	function normalizedDexName(value: string) {
		const dex = value.trim();
		if (!/^[A-Za-z0-9]{2,4}$/.test(dex)) {
			throw new Error('DEX code must be 2-4 letters or numbers.');
		}
		return dex;
	}

	function deployDexName() {
		if (deployTarget === 'existing') {
			if (!existingDexName) throw new Error('Select a DEX.');
			return normalizedDexName(existingDexName);
		}
		return normalizedDexName(newDexName);
	}

	function deploySchema() {
		if (deployTarget !== 'new') return null;

		const fullName = newDexFullName.trim();
		if (!fullName) throw new Error('Enter a DEX full name.');
		const oracleUpdater = newDexOracleUpdater.trim();
		if (oracleUpdater && !isAddress(oracleUpdater)) {
			throw new Error('Oracle updater must be a valid address.');
		}

		return {
			fullName,
			collateralToken: requireUnsignedInteger(newDexCollateralToken, 'Collateral token', 0),
			oracleUpdater: oracleUpdater ? getAddress(oracleUpdater) : null
		};
	}

	function buildDeployAction(): RegisterAsset2Parameters {
		const dex = deployDexName();
		return {
			registerAsset2: {
				maxGas: optionalMaxGas(),
				assetRequest: {
					coin: deployCoin(dex),
					szDecimals: requireUnsignedInteger(szDecimalsInput, 'Size decimals', 0),
					oraclePx: requireDecimalString(oraclePxInput, 'Oracle price'),
					marginTableId: requireUnsignedInteger(marginTableIdInput, 'Margin table ID', 1),
					marginMode
				},
				dex,
				schema: deploySchema()
			}
		};
	}

	function recordDeployRequest(request: RecordedExchangeRequest) {
		if (request.endpoint !== 'exchange') return;
		deployCurl = requestToCurl(request);
	}

	function recordControlRequest(request: RecordedExchangeRequest) {
		if (request.endpoint !== 'exchange') return;
		controlCurl = requestToCurl(request);
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

	async function deployTicker(event: SubmitEvent) {
		event.preventDefault();
		const user = activeAddress;
		const network = hyperliquidNetwork.current;
		if (!user || deployLoading) return;

		deployError = null;
		deployNotice = null;
		deployCurl = null;

		try {
			if (!selectedAgent) throw new Error('Select a locally saved API wallet.');
			if (!selectedAgent.usable) {
				throw new Error('Select a registered, unexpired API wallet with a local private key.');
			}

			const params = buildDeployAction();
			const dex = params.registerAsset2.dex;
			const coin = params.registerAsset2.assetRequest.coin;
			deployLoading = true;
			const agentAccount = privateKeyToAccount(selectedAgent.privateKey);
			await getExchangeClient(agentAccount, network, recordDeployRequest).perpDeploy(params);
			deployNotice = `Submitted deploy for ${dex}:${coin}.`;
			await loadHip3(user, network, ++loadGeneration);
		} catch (err) {
			deployError = err instanceof Error ? err.message : 'Failed to deploy HIP-3 ticker.';
		} finally {
			deployLoading = false;
		}
	}

	async function submitControlAction(
		action: ControlAction,
		label: string,
		params: PerpDeployParameters
	) {
		const user = activeAddress;
		const network = hyperliquidNetwork.current;
		if (!user || controlLoading) return;

		controlError = null;
		controlNotice = null;
		controlCurl = null;

		try {
			if (!selectedAgent) throw new Error('Select a locally saved API wallet.');
			if (!selectedAgent.usable) {
				throw new Error('Select a registered, unexpired API wallet with a local private key.');
			}
			const coin = controlCoin();
			controlLoading = action;
			const agentAccount = privateKeyToAccount(selectedAgent.privateKey);
			await getExchangeClient(agentAccount, network, recordControlRequest).perpDeploy(params);
			controlNotice = `${label} submitted for ${coin}.`;
			await loadHip3(user, network, ++loadGeneration);
		} catch (err) {
			controlError = err instanceof Error ? err.message : `Failed to submit ${label}.`;
		} finally {
			controlLoading = null;
		}
	}

	function submitBuiltControlAction(
		action: ControlAction,
		label: string,
		build: () => PerpDeployParameters
	) {
		controlError = null;
		try {
			void submitControlAction(action, label, build());
		} catch (err) {
			controlError = err instanceof Error ? err.message : `Failed to submit ${label}.`;
		}
	}

	function setFundingMultiplier() {
		submitBuiltControlAction('fundingMultiplier', 'Funding multiplier', () => {
			const params: SetFundingMultipliersParameters = {
				setFundingMultipliers: [
					[
						controlCoin(),
						requireBoundedDecimalString(fundingMultiplierInput, 'Funding multiplier', 0, 10)
					]
				]
			};
			return params;
		});
	}

	function setFundingInterestRate() {
		submitBuiltControlAction('fundingInterestRate', 'Funding interest rate', () => {
			const params: SetFundingInterestRatesParameters = {
				setFundingInterestRates: [
					[
						controlCoin(),
						requireBoundedDecimalString(
							fundingInterestRateInput,
							'Funding interest rate',
							-0.01,
							0.01
						)
					]
				]
			};
			return params;
		});
	}

	function setOpenInterestCap() {
		submitBuiltControlAction('openInterestCap', 'Open interest cap', () => {
			const params: SetOpenInterestCapsParameters = {
				setOpenInterestCaps: [
					[controlCoin(), requireUnsignedInteger(openInterestCapInput, 'Open interest cap', 0)]
				]
			};
			return params;
		});
	}

	function setGrowthMode() {
		submitBuiltControlAction('growthMode', 'Growth mode', () => {
			const params: SetGrowthModesParameters = {
				setGrowthModes: [[controlCoin(), growthModeInput]]
			};
			return params;
		});
	}

	function setTradingHalt() {
		submitBuiltControlAction(
			'trading',
			tradingHaltedInput ? 'Trading halt' : 'Trading resume',
			() => {
				const params: HaltTradingParameters = {
					haltTrading: {
						coin: controlCoin(),
						isHalted: tradingHaltedInput
					}
				};
				return params;
			}
		);
	}

	$effect(() => {
		const address = activeAddress;
		const network = hyperliquidNetwork.current;
		const generation = ++loadGeneration;
		const agentGeneration = ++agentWalletGeneration;
		const auctionGenerationId = ++auctionGeneration;

		if (!address) {
			loading = false;
			error = null;
			data = null;
			loadedAt = null;
			agentWallets = { loading: false, error: null, data: null };
			auctionStatus = { loading: false, error: null, data: null };
			savedAgentWallets = [];
			selectedAgentAddress = '';
			return;
		}

		data = null;
		loadedAt = null;
		refreshLocalAgentWallets(address, network);
		void loadHip3(address, network, generation);
		void loadRegisteredAgentWallets(address, network, agentGeneration);
		void loadAuctionStatus(network, auctionGenerationId);
	});

	$effect(() => {
		const options = agentOptions;
		if (options.some((option) => option.address === selectedAgentAddress)) return;
		selectedAgentAddress = options[0]?.address ?? '';
	});

	$effect(() => {
		const rows = controlSymbols;
		const selected = rows.find((row) => row.key === selectedControlSymbolKey) ?? null;
		if (selected) return;
		selectedControlSymbolKey = rows[0]?.key ?? '';
	});

	$effect(() => {
		if (ownedDexRows.length === 0) {
			deployTarget = 'new';
			existingDexName = '';
			return;
		}
		deployTarget = 'existing';
		if (!ownedDexRows.some((row) => row.dex.name === existingDexName)) {
			existingDexName = ownedDexRows[0]?.dex.name ?? '';
		}
	});
</script>

<View {viewId} title="HIP-3">
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
			aria-label="Refresh HIP-3"
			disabled={loading || agentWallets.loading || auctionStatus.loading || !activeAddress}
			onclick={refreshHip3}
		>
			{#if loading || agentWallets.loading || auctionStatus.loading}
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

		{#if activeTab === 'deployments'}
			{#if error}
				<div role="alert" class="alert alert-soft text-xs alert-error">
					<span>{error}</span>
				</div>
			{/if}

			{#if !activeAddress}
				<p class="p-2 text-sm text-base-content/60">No current address.</p>
			{:else if loading && !data}
				<div class="flex items-center justify-center py-8">
					<span class="loading loading-sm loading-spinner"></span>
				</div>
			{:else if data && data.dexs.length === 0}
				<div class="rounded-lg border border-base-300 bg-base-100 p-4">
					<p class="text-sm font-medium">No HIP-3 deployments</p>
					<p class="mt-1 text-xs text-base-content/60">
						{formatAddress(activeAddress)} is not the deployer for any current perpetual DEX.
					</p>
				</div>
			{:else if data}
				<div class="grid gap-2 sm:grid-cols-2">
					<div class="rounded-lg border border-base-300 bg-base-100 p-3">
						<div class="text-xs text-base-content/50 uppercase">DEXes</div>
						<div class="mt-1 font-mono text-2xl font-semibold">{formatInteger(data.totalDexs)}</div>
					</div>
					<div class="rounded-lg border border-base-300 bg-base-100 p-3">
						<div class="text-xs text-base-content/50 uppercase">Tickers</div>
						<div class="mt-1 font-mono text-2xl font-semibold">
							{formatInteger(data.totalAssets)}
						</div>
					</div>
				</div>

				{#each data.dexs as row (row.key)}
					<section class="rounded-lg border border-base-300 bg-base-100">
						<div class="border-b border-base-300 p-3">
							<div class="flex items-start justify-between gap-3">
								<div class="min-w-0">
									<div class="flex items-center gap-2">
										<h3 class="truncate text-sm font-semibold" title={row.dex.fullName}>
											{row.dex.fullName || row.dex.name}
										</h3>
										<span class="badge font-mono badge-sm">{row.dex.name}</span>
									</div>
									<div
										class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-base-content/55"
									>
										<span>DEX #{formatInteger(row.index)}</span>
										<span>/</span>
										<span>{formatInteger(row.assets.length)} tickers</span>
										<span>/</span>
										<span>collateral {formatInteger(row.meta?.collateralToken)}</span>
									</div>
								</div>
								<div class="flex shrink-0 items-center gap-1">
									{#if row.dex.feeRecipient}
										<CopyAddress
											address={row.dex.feeRecipient}
											label="Copy fee recipient"
											notification="Fee recipient copied"
										/>
									{/if}
								</div>
							</div>
							<div class="mt-2 grid gap-2 text-xs sm:grid-cols-2">
								<div class="min-w-0">
									<span class="text-base-content/45">Oracle updater</span>
									<div class="mt-0.5 truncate font-mono" title={row.dex.oracleUpdater ?? undefined}>
										{formatAddress(row.dex.oracleUpdater)}
									</div>
								</div>
								<div class="min-w-0">
									<span class="text-base-content/45">Fee recipient</span>
									<div class="mt-0.5 truncate font-mono" title={row.dex.feeRecipient ?? undefined}>
										{formatAddress(row.dex.feeRecipient)}
									</div>
								</div>
							</div>
						</div>

						{#if row.assets.length === 0}
							<p class="p-3 text-sm text-base-content/60">No deployed tickers.</p>
						{:else}
							<div class="overflow-x-auto">
								<table class="table min-w-[54rem] table-xs">
									<thead>
										<tr class="text-[10px] text-base-content/50 uppercase">
											<th>Ticker</th>
											<th class="text-right">Asset ID</th>
											<th class="text-right">Sz decimals</th>
											<th class="text-right">Max lev</th>
											<th>Margin</th>
											<th class="text-right">OI cap</th>
											<th class="text-right">Funding multiplier</th>
											<th class="text-right">Funding interest</th>
										</tr>
									</thead>
									<tbody>
										{#each row.assets as assetRow (assetRow.key)}
											<tr>
												<td class="max-w-40">
													<div
														class="truncate font-mono text-sm font-medium"
														title={assetRow.asset.name}
													>
														{assetRow.asset.name}
													</div>
												</td>
												<td class="text-right font-mono">{formatInteger(assetRow.assetId)}</td>
												<td class="text-right font-mono">
													{formatInteger(assetRow.asset.szDecimals)}
												</td>
												<td class="text-right font-mono">
													{formatInteger(assetRow.asset.maxLeverage)}x
												</td>
												<td>
													<span class="badge badge-xs {marginBadgeClass(assetRow.asset)}">
														{marginLabel(assetRow.asset)}
													</span>
												</td>
												<td class="text-right font-mono" title={assetRow.oiCap ?? undefined}>
													{formatDecimal(assetRow.oiCap)}
												</td>
												<td
													class="text-right font-mono"
													title={assetRow.fundingMultiplier ?? undefined}
												>
													{formatDecimal(assetRow.fundingMultiplier)}
												</td>
												<td
													class="text-right font-mono"
													title={assetRow.fundingInterestRate ?? undefined}
												>
													{formatFundingRate(assetRow.fundingInterestRate)}
												</td>
											</tr>
										{/each}
									</tbody>
								</table>
							</div>
						{/if}
					</section>
				{/each}
			{/if}
		{:else if activeTab === 'deploy'}
			<form class="space-y-3" onsubmit={deployTicker}>
				{#if deployError}
					<div role="alert" class="alert alert-soft text-xs alert-error">
						<span>{deployError}</span>
					</div>
				{/if}
				{#if deployNotice}
					<div role="status" class="alert alert-soft text-xs alert-success">
						<span>{deployNotice}</span>
					</div>
				{/if}
				{#if agentWallets.error}
					<div role="alert" class="alert alert-soft text-xs alert-warning">
						<span>{agentWallets.error}</span>
					</div>
				{/if}
				{#if auctionStatus.error && auctionNeeded}
					<div role="alert" class="alert alert-soft text-xs alert-warning">
						<span>{auctionStatus.error}</span>
					</div>
				{/if}

				<div class="rounded-lg border border-base-300 bg-base-100 p-3">
					<label class="form-control">
						<span class="label pb-1 text-xs text-base-content/60">API wallet</span>
						<select class="select w-full select-sm" bind:value={selectedAgentAddress}>
							<option value="">Select API wallet</option>
							{#each agentOptions as option (option.address)}
								<option value={option.address} disabled={!option.usable}>
									{option.name} / {formatAddress(option.address)} / {agentStatusLabel(option)}
								</option>
							{/each}
						</select>
					</label>
					{#if selectedAgent}
						<div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
							<span class="badge badge-xs {agentStatusBadgeClass(selectedAgent)}">
								{agentStatusLabel(selectedAgent)}
							</span>
							<span class="text-base-content/50">Valid until</span>
							<span class="font-mono">
								{formatDateTime(selectedAgent.registeredValidUntil ?? selectedAgent.validUntil)}
							</span>
							<CopyAddress address={selectedAgent.address} notification="API wallet copied" />
						</div>
					{:else if agentOptions.length === 0}
						<p class="mt-2 text-xs text-base-content/60">
							No local API wallets saved for this address.
						</p>
					{/if}
				</div>

				<div class="rounded-lg border border-base-300 bg-base-100 p-3">
					<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
						<div class="text-xs font-semibold text-base-content/60 uppercase">DEX</div>
						<span class="badge badge-sm"
							>{ownedDexRows.length === 0 ? 'New DEX' : 'Existing DEX'}</span
						>
					</div>

					{#if deployTarget === 'existing'}
						<label class="form-control">
							<span class="label pb-1 text-xs text-base-content/60">DEX code</span>
							<select class="select w-full select-sm" bind:value={existingDexName}>
								{#each ownedDexRows as row (row.key)}
									<option value={row.dex.name}>
										{row.dex.name} / {row.dex.fullName || row.dex.name}
									</option>
								{/each}
							</select>
						</label>
					{:else}
						<div class="grid gap-3 md:grid-cols-2">
							<label class="form-control">
								<span class="label pb-1 text-xs text-base-content/60">DEX code</span>
								<input
									class="input input-sm w-full font-mono"
									bind:value={newDexName}
									maxlength="4"
									placeholder="xyz"
								/>
							</label>
							<label class="form-control">
								<span class="label pb-1 text-xs text-base-content/60">Full name</span>
								<input class="input input-sm w-full" bind:value={newDexFullName} />
							</label>
							<label class="form-control">
								<span class="label pb-1 text-xs text-base-content/60">Collateral token</span>
								<input
									class="input input-sm w-full font-mono"
									bind:value={newDexCollateralToken}
									inputmode="numeric"
								/>
							</label>
							<label class="form-control">
								<span class="label pb-1 text-xs text-base-content/60">Oracle updater</span>
								<input
									class="input input-sm w-full font-mono"
									bind:value={newDexOracleUpdater}
									placeholder="Optional"
								/>
							</label>
						</div>
					{/if}
				</div>

				<div class="rounded-lg border border-base-300 bg-base-100 p-3">
					<div class="mb-3 flex flex-wrap items-center justify-between gap-2">
						<div class="text-xs font-semibold text-base-content/60 uppercase">Deploy auction</div>
						{#if auctionNeeded && auctionStatus.data}
							<span class="badge badge-sm badge-warning">
								{auctionStateLabel(auctionStatus.data)}
							</span>
						{:else}
							<span class="badge badge-sm badge-success">Not needed</span>
						{/if}
					</div>

					{#if !auctionNeeded}
						<p class="text-xs text-base-content/65">
							{#if deployTarget === 'new'}
								Creating your first HIP-3 DEX includes the first ticker, so no auction gas is
								needed.
							{:else}
								This DEX has {formatInteger(selectedDexAssetCount)} deployed tickers and
								{formatInteger(freeDeploymentsRemaining)} free ticker deployments remaining.
							{/if}
						</p>
					{:else if auctionStatus.loading && !auctionStatus.data}
						<div class="flex items-center justify-center py-4">
							<span class="loading loading-sm loading-spinner"></span>
						</div>
					{:else if auctionStatus.data}
						<div class="grid gap-2 sm:grid-cols-3">
							<div>
								<div class="text-xs text-base-content/45">Current gas</div>
								<div class="mt-0.5 font-mono text-sm font-medium">
									{formatGas(auctionStatus.data.currentGas)}
								</div>
							</div>
							<div>
								<div class="text-xs text-base-content/45">Ends</div>
								<div class="mt-0.5 text-sm">
									{formatDateTime(auctionEndsAt(auctionStatus.data))}
								</div>
							</div>
							<div>
								<div class="text-xs text-base-content/45">Remaining</div>
								<div class="mt-0.5 font-mono text-sm">
									{formatDuration(auctionRemainingSeconds(auctionStatus.data))}
								</div>
							</div>
						</div>
						<progress
							class="progress mt-3 h-1.5 w-full progress-warning"
							value={auctionProgress(auctionStatus.data)}
							max="100"
						></progress>
						<div class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-base-content/55">
							<span>Start {formatGas(auctionStatus.data.startGas)}</span>
							<span>End {formatGas(auctionStatus.data.endGas)}</span>
						</div>
					{:else}
						<p class="text-xs text-base-content/60">Auction status is not loaded yet.</p>
					{/if}
				</div>

				<div class="rounded-lg border border-base-300 bg-base-100 p-3">
					<div class="mb-3 text-xs font-semibold text-base-content/60 uppercase">Ticker</div>
					<div class="grid gap-3 md:grid-cols-2">
						<label class="form-control">
							<span class="label pb-1 text-xs text-base-content/60">Ticker</span>
							<input
								class="input input-sm w-full font-mono"
								bind:value={tickerInput}
								placeholder="COIN or dex:COIN"
							/>
						</label>
						<label class="form-control">
							<span class="label pb-1 text-xs text-base-content/60">Oracle price</span>
							<input
								class="input input-sm w-full font-mono"
								bind:value={oraclePxInput}
								inputmode="decimal"
							/>
						</label>
						<label class="form-control">
							<span class="label pb-1 text-xs text-base-content/60">Size decimals</span>
							<input
								class="input input-sm w-full font-mono"
								bind:value={szDecimalsInput}
								inputmode="numeric"
							/>
						</label>
						<label class="form-control">
							<span class="label pb-1 text-xs text-base-content/60">Margin table ID</span>
							<input
								class="input input-sm w-full font-mono"
								bind:value={marginTableIdInput}
								inputmode="numeric"
							/>
						</label>
						<label class="form-control">
							<span class="label pb-1 text-xs text-base-content/60">Margin mode</span>
							<select class="select w-full select-sm" bind:value={marginMode}>
								<option value="strictIsolated">strictIsolated</option>
								<option value="noCross">noCross</option>
							</select>
						</label>
						<label class="form-control">
							<span class="label pb-1 text-xs text-base-content/60">Max gas wei</span>
							<input
								class="input input-sm w-full font-mono"
								bind:value={maxGasInput}
								inputmode="numeric"
								placeholder="Current auction"
							/>
						</label>
					</div>
				</div>

				<div class="flex justify-end">
					<button type="submit" class="btn btn-sm btn-primary" disabled={!canSubmitDeploy}>
						{#if deployLoading}
							<span class="loading loading-xs loading-spinner"></span>
						{/if}
						Deploy ticker
					</button>
				</div>
			</form>

			<CurlDetails curl={deployCurl} />
		{:else}
			<div class="space-y-3">
				{#if controlError}
					<div role="alert" class="alert alert-soft text-xs alert-error">
						<span>{controlError}</span>
					</div>
				{/if}
				{#if controlNotice}
					<div role="status" class="alert alert-soft text-xs alert-success">
						<span>{controlNotice}</span>
					</div>
				{/if}
				{#if agentWallets.error}
					<div role="alert" class="alert alert-soft text-xs alert-warning">
						<span>{agentWallets.error}</span>
					</div>
				{/if}

				<div class="rounded-lg border border-base-300 bg-base-100 p-3">
					<label class="form-control">
						<span class="label pb-1 text-xs text-base-content/60">API wallet</span>
						<select class="select w-full select-sm" bind:value={selectedAgentAddress}>
							<option value="">Select API wallet</option>
							{#each agentOptions as option (option.address)}
								<option value={option.address} disabled={!option.usable}>
									{option.name} / {formatAddress(option.address)} / {agentStatusLabel(option)}
								</option>
							{/each}
						</select>
					</label>
					{#if selectedAgent}
						<div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
							<span class="badge badge-xs {agentStatusBadgeClass(selectedAgent)}">
								{agentStatusLabel(selectedAgent)}
							</span>
							<span class="text-base-content/50">Valid until</span>
							<span class="font-mono">
								{formatDateTime(selectedAgent.registeredValidUntil ?? selectedAgent.validUntil)}
							</span>
							<CopyAddress address={selectedAgent.address} notification="API wallet copied" />
						</div>
					{:else if agentOptions.length === 0}
						<p class="mt-2 text-xs text-base-content/60">
							No local API wallets saved for this address.
						</p>
					{/if}
				</div>

				<div class="rounded-lg border border-base-300 bg-base-100 p-3">
					<div class="mb-3 text-xs font-semibold text-base-content/60 uppercase">Ticker</div>
					{#if !activeAddress}
						<p class="text-sm text-base-content/60">No current address.</p>
					{:else if loading && !data}
						<div class="flex items-center justify-center py-4">
							<span class="loading loading-sm loading-spinner"></span>
						</div>
					{:else if controlSymbols.length === 0}
						<p class="text-sm text-base-content/60">No deployed HIP-3 tickers.</p>
					{:else}
						<label class="form-control">
							<span class="label pb-1 text-xs text-base-content/60">Symbol</span>
							<select class="select w-full select-sm" bind:value={selectedControlSymbolKey}>
								{#each controlSymbols as row (row.key)}
									<option value={row.key}>
										{row.coin} / {row.dexFullName}
									</option>
								{/each}
							</select>
						</label>
						{#if selectedControlSymbol}
							<div class="mt-2 flex flex-wrap gap-2 text-xs">
								<span class="badge font-mono badge-sm">{selectedControlSymbol.coin}</span>
								<span class="badge badge-sm">
									{marginLabel(selectedControlSymbol.asset)}
								</span>
								<span class="text-base-content/55">
									OI cap {formatDecimal(selectedControlSymbol.oiCap)}
								</span>
								<span class="text-base-content/55">
									Funding x{formatDecimal(selectedControlSymbol.fundingMultiplier)}
								</span>
								<span class="text-base-content/55">
									Interest {formatFundingRate(selectedControlSymbol.fundingInterestRate)}
								</span>
							</div>
						{/if}
					{/if}
				</div>

				<div class="grid gap-3 xl:grid-cols-2">
					<div class="rounded-lg border border-base-300 bg-base-100 p-3">
						<div class="mb-3 text-xs font-semibold text-base-content/60 uppercase">Funding</div>
						<div class="grid gap-3 md:grid-cols-2">
							<label class="form-control">
								<span class="label pb-1 text-xs text-base-content/60">Multiplier</span>
								<input
									class="input input-sm w-full font-mono"
									bind:value={fundingMultiplierInput}
									inputmode="decimal"
								/>
								<button
									type="button"
									class="btn mt-2 btn-sm"
									disabled={!canSubmitControl}
									onclick={setFundingMultiplier}
								>
									{#if controlLoading === 'fundingMultiplier'}
										<span class="loading loading-xs loading-spinner"></span>
									{/if}
									Set multiplier
								</button>
							</label>
							<label class="form-control">
								<span class="label pb-1 text-xs text-base-content/60">8h interest rate</span>
								<input
									class="input input-sm w-full font-mono"
									bind:value={fundingInterestRateInput}
									inputmode="decimal"
								/>
								<button
									type="button"
									class="btn mt-2 btn-sm"
									disabled={!canSubmitControl}
									onclick={setFundingInterestRate}
								>
									{#if controlLoading === 'fundingInterestRate'}
										<span class="loading loading-xs loading-spinner"></span>
									{/if}
									Set interest
								</button>
							</label>
						</div>
					</div>

					<div class="rounded-lg border border-base-300 bg-base-100 p-3">
						<div class="mb-3 text-xs font-semibold text-base-content/60 uppercase">Limits</div>
						<label class="form-control">
							<span class="label pb-1 text-xs text-base-content/60">Open interest cap</span>
							<input
								class="input input-sm w-full font-mono"
								bind:value={openInterestCapInput}
								inputmode="numeric"
								placeholder="Notional cap"
							/>
						</label>
						<div class="mt-3 flex justify-end">
							<button
								type="button"
								class="btn btn-sm"
								disabled={!canSubmitControl}
								onclick={setOpenInterestCap}
							>
								{#if controlLoading === 'openInterestCap'}
									<span class="loading loading-xs loading-spinner"></span>
								{/if}
								Set OI cap
							</button>
						</div>
					</div>

					<div class="rounded-lg border border-base-300 bg-base-100 p-3">
						<div class="mb-3 text-xs font-semibold text-base-content/60 uppercase">Growth mode</div>
						<label class="flex items-center justify-between gap-3 text-sm">
							<span>{growthModeInput ? 'Enabled' : 'Disabled'}</span>
							<input type="checkbox" class="toggle toggle-sm" bind:checked={growthModeInput} />
						</label>
						<div class="mt-3 flex justify-end">
							<button
								type="button"
								class="btn btn-sm"
								disabled={!canSubmitControl}
								onclick={setGrowthMode}
							>
								{#if controlLoading === 'growthMode'}
									<span class="loading loading-xs loading-spinner"></span>
								{/if}
								Set growth
							</button>
						</div>
					</div>

					<div class="rounded-lg border border-base-300 bg-base-100 p-3">
						<div class="mb-3 text-xs font-semibold text-base-content/60 uppercase">Trading</div>
						<label class="flex items-center justify-between gap-3 text-sm">
							<span>{tradingHaltedInput ? 'Halted' : 'Enabled'}</span>
							<input type="checkbox" class="toggle toggle-sm" bind:checked={tradingHaltedInput} />
						</label>
						<div class="mt-3 flex justify-end">
							<button
								type="button"
								class="btn btn-sm"
								disabled={!canSubmitControl}
								onclick={setTradingHalt}
							>
								{#if controlLoading === 'trading'}
									<span class="loading loading-xs loading-spinner"></span>
								{/if}
								{tradingHaltedInput ? 'Halt trading' : 'Resume trading'}
							</button>
						</div>
					</div>
				</div>

				<CurlDetails curl={controlCurl} />
			</div>
		{/if}
	</div>
</View>
