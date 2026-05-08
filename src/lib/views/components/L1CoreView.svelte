<script lang="ts">
	import { browser } from '$app/environment';
	import { onDestroy, untrack } from 'svelte';
	import type { Component } from 'svelte';
	import type { ISubscription } from '@nktkas/hyperliquid';
	import { getAddress, isAddress, type Address } from 'viem';
	import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
	import CopyAddress from '$lib/components/CopyAddress.svelte';
	import HeroIcon from '$lib/components/HeroIcon.svelte';
	import {
		HYPERLIQUID_L1_SIGNATURE_CHAIN_ID,
		getExchangeClient,
		getHttpInfoClient,
		getInfoClient,
		getSubscriptionClient
	} from '$lib/hl/clients.js';
	import type { RecordedExchangeRequest } from '$lib/hl/clients.js';
	import {
		loadSavedAgentWallets,
		saveSavedAgentWallets,
		type SavedAgentWallet
	} from '$lib/hl/agent-wallets.js';
	import { hyperliquidNetwork, type HyperliquidNetwork } from '$lib/hl/network.svelte';
	import { HYPERLIQUID_L1_ADD_ETHEREUM_CHAIN_PARAMETER } from '$lib/hl/wallet-chains.js';
	import { wallet } from '$lib/stores/wallet.svelte';
	import { normalizeTrackedWalletName, TRACKED_WALLET_NAME_MAX_LENGTH } from '$lib/wallet-names.js';
	import ViewTabs from './ViewTabs.svelte';
	import AccountTab from './l1core/AccountTab.svelte';
	import AgentsTab from './l1core/AgentsTab.svelte';
	import BalancesTab from './l1core/BalancesTab.svelte';
	import BuildersTab from './l1core/BuildersTab.svelte';
	import FillsTab from './l1core/FillsTab.svelte';
	import LedgerTab from './l1core/LedgerTab.svelte';
	import LendingTab from './l1core/LendingTab.svelte';
	import OrdersTab from './l1core/OrdersTab.svelte';
	import OutcomesTab from './l1core/OutcomesTab.svelte';
	import PositionsTab from './l1core/PositionsTab.svelte';
	import StakingTab from './l1core/StakingTab.svelte';
	import { views } from '../stack.svelte';
	import View from '../View.svelte';
	import builders from '../../../../builders.json' with { type: 'json' };

	type Props = {
		viewId: string;
		address?: Address | string | null;
		name?: string | null;
		closeable?: boolean;
		movable?: boolean;
		fullWidth?: boolean;
		editable?: boolean;
		initialTab?: string | null;
		syncTabHash?: boolean;
	};
	type L1TabComponent = Component<{ ctx: unknown }>;

	let {
		viewId,
		address = null,
		name = null,
		closeable = true,
		movable = true,
		fullWidth = false,
		editable = true,
		initialTab = null,
		syncTabHash = false
	}: Props = $props();

	const TABS = [
		{ id: 'account', label: 'Account', component: AccountTab },
		{ id: 'balances', label: 'Balances', component: BalancesTab },
		{ id: 'positions', label: 'Positions', component: PositionsTab },
		{ id: 'orders', label: 'Open orders', component: OrdersTab },
		{ id: 'outcomes', label: 'Outcomes', component: OutcomesTab },
		{ id: 'fills', label: 'Fills', component: FillsTab },
		{ id: 'ledger', label: 'Ledger', component: LedgerTab },
		{ id: 'agents', label: 'Agent wallets', component: AgentsTab },
		{ id: 'builders', label: 'Builder codes', component: BuildersTab },
		{ id: 'lending', label: 'Lending', component: LendingTab },
		{ id: 'staking', label: 'Staking', component: StakingTab }
	] as const;
	type TabId = (typeof TABS)[number]['id'];

	let activeTab = $state<TabId>('account');
	let trackedWalletModalOpen = $state(false);
	let agentImportModalOpen = $state(false);
	let trackedWalletNameInput = $state('');
	let trackedWalletAddressInput = $state('');
	let trackedWalletEditorError = $state<string | null>(null);
	const trackedAddress = $derived(
		typeof address === 'string' && isAddress(address) ? getAddress(address) : null
	);
	const activeAddress = $derived(trackedAddress ?? wallet.current?.address ?? null);
	const trackedWalletName = $derived(normalizeTrackedWalletName(name));
	const viewTitle = $derived(trackedWalletName ?? 'HyperCore L1');
	const canSignForActiveAddress = $derived(
		activeAddress !== null &&
			wallet.current?.source === 'injected' &&
			wallet.current.address.toLowerCase() === activeAddress.toLowerCase()
	);

	function tabIdFromString(value: string | null | undefined): TabId | null {
		if (!value) return null;
		const normalized = value.trim().replace(/^#/, '').toLowerCase();
		return TABS.some((tab) => tab.id === normalized) ? (normalized as TabId) : null;
	}

	type Loadable<T> = { loading: boolean; error: string | null; data: T | null };
	type AnyLoadable = { loading: boolean; error: string | null; data: unknown | null };

	type SpotBal = { coin: string; token: number; total: string; hold: string; entryNtl: string };
	type PerpAssetCtx = {
		markPx: string;
		midPx: string | null;
		oraclePx: string;
		funding: string;
	};
	type SpotAssetCtx = {
		coin: string;
		markPx: string;
		midPx: string | null;
	};
	type AssetPositionPayload = {
		position: {
			coin: string;
			szi: string;
			leverage:
				| {
						type: 'isolated';
						value: number;
						rawUsd: string;
				  }
				| {
						type: 'cross';
						value: number;
				  };
			entryPx: string;
			positionValue: string;
			unrealizedPnl: string;
			returnOnEquity: string;
			liquidationPx: string | null;
			marginUsed: string;
			maxLeverage: number;
			cumFunding: {
				allTime: string;
				sinceOpen: string;
				sinceChange: string;
			};
		};
	};
	type AccountSummaryPayload = {
		accountValue: string;
		totalNtlPos: string;
		totalRawUsd: string;
		totalMarginUsed: string;
	};
	type UserRateLimit = {
		cumVlm: string;
		nRequestsUsed: number;
		nRequestsCap: number;
		nRequestsSurplus: number;
	};
	type UserRole =
		| {
				role: 'missing' | 'user' | 'vault';
		  }
		| {
				role: 'agent';
				data: {
					user: `0x${string}`;
				};
		  }
		| {
				role: 'subAccount';
				data: {
					master: `0x${string}`;
				};
		  };
	type DelegatorSummary = {
		delegated: string;
		undelegated: string;
		totalPendingWithdrawal: string;
		nPendingWithdrawals: number;
	};
	type StakingDelegation = {
		validator: `0x${string}`;
		amount: string;
		lockedUntilTimestamp: number;
	};
	type DelegatorHistoryItem = {
		time: number;
		hash: `0x${string}`;
		delta:
			| {
					delegate: {
						validator: `0x${string}`;
						amount: string;
						isUndelegate: boolean;
					};
			  }
			| {
					cDeposit: {
						amount: string;
					};
			  }
			| {
					withdrawal: {
						amount: string;
						phase: 'initiated' | 'finalized';
					};
			  };
	};
	type DelegatorReward = {
		time: number;
		source: 'delegation' | 'commission';
		totalAmount: string;
	};
	type ValidatorSummary = {
		validator: `0x${string}`;
		name: string;
		stake: number;
		isJailed: boolean;
		isActive: boolean;
		commission: string;
		stats: [
			[period: 'day', stats: ValidatorStats],
			[period: 'week', stats: ValidatorStats],
			[period: 'month', stats: ValidatorStats]
		];
	};
	type ValidatorStats = {
		uptimeFraction: string;
		predictedApr: string;
		nSamples: number;
	};
	type UserFees = {
		dailyUserVlm: {
			date: string;
			userCross: string;
			userAdd: string;
			exchange: string;
		}[];
		feeSchedule: {
			cross: string;
			add: string;
			spotCross: string;
			spotAdd: string;
			referralDiscount: string;
			stakingDiscountTiers: {
				bpsOfMaxSupply: string;
				discount: string;
			}[];
		};
		userCrossRate: string;
		userAddRate: string;
		userSpotCrossRate: string;
		userSpotAddRate: string;
		activeReferralDiscount: string;
		trial: unknown | null;
		feeTrialEscrow?: string;
		feeTrialReward?: string;
		nextTrialAvailableTimestamp: unknown | null;
		stakingLink: {
			stakingUser: `0x${string}`;
			type: 'requested' | 'stakingUser' | 'tradingUser';
		} | null;
		activeStakingDiscount: {
			bpsOfMaxSupply: string;
			discount: string;
		};
	};
	type ReferralState = {
		cumVlm: string;
		cumRewardedFeesSinceReferred: string;
		cumFeesRewardedToReferrer: string;
		timeJoined: number;
		user: `0x${string}`;
	};
	type UserReferral = {
		referredBy: {
			referrer: `0x${string}`;
			code: string;
		} | null;
		cumVlm: string;
		unclaimedRewards: string;
		claimedRewards: string;
		builderRewards: string;
		referrerState:
			| {
					stage: 'ready';
					data: {
						code: string;
						nReferrals?: number;
						referralStates: ReferralState[];
					};
			  }
			| {
					stage: 'needToCreateCode';
			  }
			| {
					stage: 'needToTrade';
					data: {
						required: string;
					};
			  };
		rewardHistory: {
			earned: string;
			vlm: string;
			referralVlm: string;
			time: number;
		}[];
	};
	type UserStakingData = {
		summary: DelegatorSummary;
		delegations: StakingDelegation[];
		history: DelegatorHistoryItem[];
		rewards: DelegatorReward[];
		validators: ValidatorSummary[];
	};
	type StakingDelegationRow = StakingDelegation & {
		amountValue: number | null;
		validatorName: string | null;
		isActive: boolean | null;
		isJailed: boolean | null;
		commission: number | null;
		monthApr: number | null;
		weekUptime: number | null;
	};
	type BorrowLendUserState = {
		tokenToState: [
			tokenId: number,
			state: {
				borrow: {
					basis: string;
					value: string;
				};
				supply: {
					basis: string;
					value: string;
				};
			}
		][];
		health: string;
		healthFactor: string | number | null;
	};
	type BorrowLendInterest = {
		time: number;
		token: string;
		borrow: string;
		supply: string;
	};
	type UserLendingData = {
		userState: BorrowLendUserState;
		interest: BorrowLendInterest[];
	};
	type LendingPositionRow = {
		tokenId: number;
		tokenName: string;
		supplyBasis: number | null;
		supplyValue: number | null;
		borrowBasis: number | null;
		borrowValue: number | null;
		netValue: number | null;
	};
	type ClearinghouseStatePayload = {
		marginSummary: AccountSummaryPayload;
		crossMarginSummary: AccountSummaryPayload;
		crossMaintenanceMarginUsed: string;
		withdrawable: string;
		assetPositions: AssetPositionPayload[];
	};
	type AssetPos = AssetPositionPayload & {
		dex: string;
	};
	type AccountAbstraction = 'dexAbstraction' | 'unifiedAccount' | 'portfolioMargin' | 'disabled';
	type DexBalance = {
		dex: string;
		unified: boolean;
		accountValue: string;
		withdrawable: string;
		totalNtlPos: string;
		totalMarginUsed: string;
		unrealizedPnl: number;
	};
	type BalanceSortKey = 'coin' | 'total' | 'available' | 'usdcValue' | 'pnl' | 'contract';
	type PositionSortKey =
		| 'coin'
		| 'size'
		| 'positionValue'
		| 'entryPrice'
		| 'markPrice'
		| 'pnl'
		| 'liqPrice'
		| 'margin'
		| 'funding';
	type OrderSortKey =
		| 'coin'
		| 'side'
		| 'size'
		| 'origSize'
		| 'price'
		| 'value'
		| 'type'
		| 'tif'
		| 'reduceOnly'
		| 'time'
		| 'oid';
	type OutcomeSortKey =
		| 'market'
		| 'side'
		| 'coin'
		| 'total'
		| 'markPrice'
		| 'usdcValue'
		| 'pnl'
		| 'contract';
	type FillSortKey =
		| 'coin'
		| 'side'
		| 'size'
		| 'price'
		| 'value'
		| 'fee'
		| 'closedPnl'
		| 'liquidity'
		| 'time'
		| 'oid'
		| 'tid';
	type LedgerDelta = {
		type: string;
		[key: string]: unknown;
	};
	type LedgerUpdate = {
		time: number;
		hash: `0x${string}`;
		delta: LedgerDelta;
	};
	type AgentSortKey = 'name' | 'address' | 'validUntil' | 'status' | 'localKey';
	type BuilderSortKey = 'name' | 'address' | 'maxFee';
	type SortDirection = 'asc' | 'desc';
	type BalanceTableRow = {
		key: string;
		coin: string;
		total: number | null;
		available: number | null;
		usdcValue: number | null;
		pnlDollars: number | null;
		pnlPercent: number | null;
		contractAddress: string | null;
	};
	type PositionTableRow = {
		key: string;
		coin: string;
		size: number | null;
		positionValue: number | null;
		entryPrice: number | null;
		markPrice: number | null;
		pnlDollars: number | null;
		pnlPercent: number | null;
		liquidationPrice: number | null;
		margin: number | null;
		marginType: 'Isolated' | 'Cross' | null;
		funding: number | null;
	};
	type OrderTableRow = {
		key: string;
		coin: string;
		side: Order['side'];
		size: number | null;
		origSize: number | null;
		price: number | null;
		value: number | null;
		type: string;
		tif: string | null;
		reduceOnly: boolean;
		time: number | null;
		oid: number | null;
	};
	type OutcomeTableRow = {
		key: string;
		market: string;
		side: string;
		coin: string;
		total: number | null;
		markPrice: number | null;
		usdcValue: number | null;
		pnlDollars: number | null;
		pnlPercent: number | null;
		contractAddress: string | null;
	};
	type FillTableRow = {
		key: string;
		coin: string;
		side: Fill['side'];
		size: number | null;
		price: number | null;
		value: number | null;
		fee: number | null;
		feeToken: string | null;
		closedPnl: number | null;
		liquidity: string;
		direction: string | null;
		time: number | null;
		oid: number | null;
		tid: number | null;
		hash: string | null;
	};
	type LedgerTableRow = {
		key: string;
		time: number | null;
		hash: string | null;
		type: string;
		label: string;
		amount: string;
		amountValue: number | null;
		details: LedgerDetailItem[];
	};
	type LedgerDetailItem = {
		key: string;
		label: string;
		value: string;
		address: string | null;
	};
	type LedgerPageCursor = number | null;
	type AgentWallet = {
		address: `0x${string}`;
		name: string;
		validUntil: number;
	};
	type AgentTableRow = {
		key: string;
		name: string;
		approvalName: string | null;
		address: `0x${string}`;
		validUntil: number | null;
		privateKey: `0x${string}` | null;
		createdAt: number | null;
		registered: boolean;
	};
	type BuilderApproval = {
		address: `0x${string}`;
		maxFee: number | null;
	};
	type BuilderDirectoryEntry = {
		builder_name: string;
		builder_address: string;
	};
	type BuilderTableRow = {
		key: string;
		name: string | null;
		address: `0x${string}`;
		maxFee: number | null;
	};
	type Order = {
		dex?: string;
		coin: string;
		side: 'B' | 'A';
		limitPx: string;
		sz: string;
		origSz: string;
		oid: number;
		timestamp: number;
		orderType: string;
		reduceOnly: boolean;
		tif?: string | null;
		triggerPx?: string;
		triggerCondition?: string;
		isTrigger?: boolean;
		cloid?: string | null;
	};
	type Fill = {
		coin: string;
		px: string;
		sz: string;
		side: 'B' | 'A';
		time: number;
		startPosition?: string;
		dir?: string;
		closedPnl: string;
		hash?: `0x${string}`;
		oid?: number;
		crossed?: boolean;
		fee?: string;
		builderFee?: string;
		tid?: number;
		feeToken?: string;
		twapId?: number | null;
	};
	type OutcomeRow = {
		outcomeName: string;
		sideName: string;
		coin: string;
		token: number;
		encoding: number | null;
		total: string;
		entryNtl: string;
	};
	type ActiveOutcomeSpotSubscription = {
		generation: number;
		subscription: ISubscription | null;
	};
	type OutcomeToken = { outcomeName: string; sideName: string; encoding: number | null };
	type OutcomeMetaIndex = {
		byToken: Record<number, OutcomeToken>;
		byEncoding: Record<number, OutcomeToken>;
		byCoin: Record<string, OutcomeToken>;
	};
	type PerpUniverse = { name: string };
	type SpotUniverse = {
		tokens: number[];
		name: string;
		index: number;
		isCanonical: boolean;
	};
	type SpotTokenMeta = {
		index: number;
		name: string;
		fullName: string | null;
		evmContract: { address: `0x${string}` } | null;
	};

	let balances = $state<Loadable<SpotBal[]>>({ loading: false, error: null, data: null });
	let dexBalances = $state<Loadable<DexBalance[]>>({ loading: false, error: null, data: null });
	let positions = $state<Loadable<AssetPos[]>>({ loading: false, error: null, data: null });
	let orders = $state<Loadable<Order[]>>({ loading: false, error: null, data: null });
	let outcomes = $state<Loadable<OutcomeRow[]>>({ loading: false, error: null, data: null });
	let fills = $state<Loadable<Fill[]>>({ loading: false, error: null, data: null });
	let ledgerUpdates = $state<Loadable<LedgerUpdate[]>>({ loading: false, error: null, data: null });
	let agentWallets = $state<Loadable<AgentWallet[]>>({ loading: false, error: null, data: null });
	let approvedBuilders = $state<Loadable<BuilderApproval[]>>({
		loading: false,
		error: null,
		data: null
	});
	let accountRateLimit = $state<Loadable<UserRateLimit>>({
		loading: false,
		error: null,
		data: null
	});
	let userRole = $state<Loadable<UserRole>>({
		loading: false,
		error: null,
		data: null
	});
	let userReferral = $state<Loadable<UserReferral>>({
		loading: false,
		error: null,
		data: null
	});
	let userFees = $state<Loadable<UserFees>>({
		loading: false,
		error: null,
		data: null
	});
	let userStaking = $state<Loadable<UserStakingData>>({
		loading: false,
		error: null,
		data: null
	});
	let userLending = $state<Loadable<UserLendingData>>({
		loading: false,
		error: null,
		data: null
	});
	let perpUniverseByDex = $state<Record<string, PerpUniverse[]>>({});
	let perpCtxsByDexCoin = $state<Record<string, Record<string, PerpAssetCtx>>>({});
	let perpCtxsByAssetId = $state<Partial<Record<number, PerpAssetCtx>>>({});
	let perpAssetIdBySymbol = $state<Partial<Record<string, number>>>({});
	let spotCtxsByCoin = $state<Partial<Record<string, SpotAssetCtx>>>({});
	let spotCtxsByAssetId = $state<Partial<Record<number, SpotAssetCtx>>>({});
	let activeSpotCtxsByCoin = $state<Partial<Record<string, SpotAssetCtx>>>({});
	let spotTokenByIndex = $state<Partial<Record<number, SpotTokenMeta>>>({});
	let spotUniverseByIndex = $state<Partial<Record<number, SpotUniverse>>>({});
	let spotAssetIdBySymbol = $state<Partial<Record<string, number>>>({});
	let spotAssetIdByToken = $state<Partial<Record<number, number>>>({});
	let outcomeMetaIndex = $state<OutcomeMetaIndex | null>(null);
	let accountAbstraction = $state<AccountAbstraction | null>(null);
	let marketError = $state<string | null>(null);
	let userStreamKey = $state(0);
	let marketStreamKey = $state(0);
	let userGeneration = 0;
	let marketGeneration = 0;
	let balanceSortKey = $state<BalanceSortKey>('usdcValue');
	let balanceSortDirection = $state<SortDirection>('desc');
	let positionSortKey = $state<PositionSortKey>('positionValue');
	let positionSortDirection = $state<SortDirection>('desc');
	let orderSortKey = $state<OrderSortKey>('time');
	let orderSortDirection = $state<SortDirection>('desc');
	let outcomeSortKey = $state<OutcomeSortKey>('usdcValue');
	let outcomeSortDirection = $state<SortDirection>('desc');
	let fillSortKey = $state<FillSortKey>('time');
	let fillSortDirection = $state<SortDirection>('desc');
	let agentSortKey = $state<AgentSortKey>('validUntil');
	let agentSortDirection = $state<SortDirection>('desc');
	let builderSortKey = $state<BuilderSortKey>('maxFee');
	let builderSortDirection = $state<SortDirection>('desc');
	let ledgerPageIndex = $state(0);
	let ledgerPageCursors = $state<LedgerPageCursor[]>([null]);
	let agentNameInput = $state('purrbuild');
	let agentImportNameInput = $state('');
	let agentImportPrivateKeyInput = $state('');
	let agentValidDays = $state(90);
	let agentStorageAck = $state(false);
	let agentActionLoading = $state<string | null>(null);
	let agentActionError = $state<string | null>(null);
	let agentActionNotice = $state<string | null>(null);
	let agentCurl = $state<string | null>(null);
	let builderAddressInput = $state('');
	let builderMaxFeeRateInput = $state('0.01%');
	let builderActionLoading = $state(false);
	let builderActionError = $state<string | null>(null);
	let builderActionNotice = $state<string | null>(null);
	let builderCurl = $state<string | null>(null);
	let reserveWeightInput = $state(100);
	let reserveActionLoading = $state(false);
	let reserveActionError = $state<string | null>(null);
	let reserveActionNotice = $state<string | null>(null);
	let reserveCurl = $state<string | null>(null);
	let l1SignaturePrompt = $state<string | null>(null);
	let l1ChainSwitching = $state(false);
	let savedAgentWallets = $state<SavedAgentWallet[]>([]);
	let accountRateLimitGeneration = 0;
	let userRoleGeneration = 0;
	let userReferralGeneration = 0;
	let userFeesGeneration = 0;
	let userStakingGeneration = 0;
	let userLendingGeneration = 0;
	let ledgerGeneration = 0;
	let agentWalletGeneration = 0;
	let builderGeneration = 0;
	let activeOutcomeSpotSubscriptionNetwork: HyperliquidNetwork | null = null;
	let activeOutcomeSpotSubscriptionGeneration = 0;
	let activeOutcomeSpotSubscriptions: Record<string, ActiveOutcomeSpotSubscription> = {};
	const AGENT_MAX_VALID_DAYS = 180;
	const ZERO_AGENT_ADDRESS = '0x0000000000000000000000000000000000000000' as const;
	const HYPERLIQUID_L1_CHAIN_ID = Number(BigInt(HYPERLIQUID_L1_SIGNATURE_CHAIN_ID));
	const RESERVE_REQUEST_WEIGHT_PRICE_USDC = 0.0005;
	const BORROW_LEND_INTEREST_LOOKBACK_MS = 30 * 24 * 60 * 60 * 1000;
	const LEDGER_PAGE_LIMIT = 500;
	const BUILDER_NAME_BY_ADDRESS = buildBuilderNameIndex(builders);
	let reserveWeightPreview = $derived(clampReserveWeight(reserveWeightInput));
	let reservePricePreview = $derived(reserveWeightPreview * RESERVE_REQUEST_WEIGHT_PRICE_USDC);
	let userRoleDetail = $derived(getUserRoleDetail(userRole.data));
	let userFeesOverview = $derived(getUserFeesOverview(userFees.data));
	let userReferralOverview = $derived(getUserReferralOverview(userReferral.data));
	let userReferralRows = $derived(getUserReferralRows(userReferral.data));
	let userReferralRewardRows = $derived(getUserReferralRewardRows(userReferral.data));
	let userFeeVolumeRows = $derived(getUserFeeVolumeRows(userFees.data));
	let stakingOverview = $derived(getStakingOverview(userStaking.data, userFees.data));
	let stakingDelegationRows = $derived(getStakingDelegationRows(userStaking.data));
	let stakingHistoryRows = $derived(getStakingHistoryRows(userStaking.data));
	let stakingRewardRows = $derived(getStakingRewardRows(userStaking.data));
	let stakingRewardSummary = $derived(getStakingRewardSummary(userStaking.data));
	let lendingPositionRows = $derived(getLendingPositionRows(userLending.data));
	let lendingActiveRows = $derived(lendingPositionRows.filter(hasLendingActivity));
	let lendingInterestRows = $derived(getLendingInterestRows(userLending.data));
	let lendingOverview = $derived(getLendingOverview(userLending.data, lendingActiveRows));
	let lendingInterestSummary = $derived(getLendingInterestSummary(userLending.data));
	const balanceAmountFormatter = new Intl.NumberFormat(undefined, {
		maximumFractionDigits: 8
	});
	const priceFormatter = new Intl.NumberFormat(undefined, {
		maximumFractionDigits: 8
	});
	const usdFormatter = new Intl.NumberFormat(undefined, {
		style: 'currency',
		currency: 'USD',
		maximumFractionDigits: 2
	});
	const usdcCostFormatter = new Intl.NumberFormat(undefined, {
		maximumFractionDigits: 6
	});
	const percentFormatter = new Intl.NumberFormat(undefined, {
		maximumFractionDigits: 2
	});
	const integerFormatter = new Intl.NumberFormat(undefined, {
		maximumFractionDigits: 0
	});
	const STABLE_BALANCE_COINS = new Set(['USDC', 'USDH', 'USDT']);
	const LEDGER_TYPE_LABELS: Record<string, string> = {
		accountClassTransfer: 'Account class transfer',
		activateDexAbstraction: 'Activate DEX abstraction',
		borrowLend: 'Borrow/lend',
		cStakingTransfer: 'Staking transfer',
		deployGasAuction: 'Deploy gas auction',
		internalTransfer: 'Internal transfer',
		rewardsClaim: 'Rewards claim',
		spotGenesis: 'Spot genesis',
		spotTransfer: 'Spot transfer',
		subAccountTransfer: 'Sub-account transfer',
		vaultCreate: 'Vault create',
		vaultDeposit: 'Vault deposit',
		vaultDistribution: 'Vault distribution',
		vaultLeaderCommission: 'Vault leader commission',
		vaultWithdraw: 'Vault withdraw'
	};
	const LEDGER_DETAIL_OMIT_FIELDS = new Set([
		'type',
		'usdc',
		'amount',
		'token',
		'usdcValue',
		'liquidatedNtlPos',
		'netWithdrawnUsd',
		'requestedUsd'
	]);

	function setLoading(slot: AnyLoadable) {
		slot.loading = true;
		slot.error = null;
	}

	function setError(slot: AnyLoadable, err: unknown) {
		slot.loading = false;
		slot.error = err instanceof Error ? err.message : 'Failed to subscribe';
	}

	function clearSlot(slot: AnyLoadable) {
		slot.loading = false;
		slot.error = null;
		slot.data = null;
	}

	function resetLedgerPagination() {
		ledgerPageIndex = 0;
		ledgerPageCursors = [null];
	}

	function buildBuilderNameIndex(rows: unknown) {
		const index: Record<string, string> = {};
		if (!Array.isArray(rows)) return index;
		for (const row of rows as Partial<BuilderDirectoryEntry>[]) {
			if (typeof row.builder_name !== 'string' || typeof row.builder_address !== 'string') continue;
			if (!isAddress(row.builder_address)) continue;
			index[getAddress(row.builder_address).toLowerCase()] = row.builder_name;
		}
		return index;
	}

	function resetAll() {
		clearActiveOutcomeSpotSubscriptions();
		clearSlot(balances);
		clearSlot(dexBalances);
		clearSlot(positions);
		clearSlot(orders);
		clearSlot(outcomes);
		clearSlot(fills);
		clearSlot(ledgerUpdates);
		clearSlot(agentWallets);
		clearSlot(approvedBuilders);
		clearSlot(accountRateLimit);
		clearSlot(userRole);
		clearSlot(userReferral);
		clearSlot(userFees);
		clearSlot(userStaking);
		clearSlot(userLending);
		accountRateLimitGeneration += 1;
		userRoleGeneration += 1;
		userReferralGeneration += 1;
		userFeesGeneration += 1;
		userStakingGeneration += 1;
		userLendingGeneration += 1;
		ledgerGeneration += 1;
		agentWalletGeneration += 1;
		builderGeneration += 1;
		reserveActionLoading = false;
		reserveActionError = null;
		reserveActionNotice = null;
		reserveCurl = null;
		l1SignaturePrompt = null;
		l1ChainSwitching = false;
		agentActionLoading = null;
		agentActionError = null;
		agentActionNotice = null;
		agentCurl = null;
		builderActionLoading = false;
		builderActionError = null;
		builderActionNotice = null;
		builderCurl = null;
		resetLedgerPagination();
		perpUniverseByDex = {};
		perpCtxsByDexCoin = {};
		perpCtxsByAssetId = {};
		perpAssetIdBySymbol = {};
		spotCtxsByCoin = {};
		spotCtxsByAssetId = {};
		activeSpotCtxsByCoin = {};
		spotTokenByIndex = {};
		spotUniverseByIndex = {};
		spotAssetIdBySymbol = {};
		spotAssetIdByToken = {};
		outcomeMetaIndex = null;
		accountAbstraction = null;
		marketError = null;
	}

	function setUserLoading() {
		setLoading(balances);
		setLoading(dexBalances);
		setLoading(positions);
		setLoading(orders);
		setLoading(outcomes);
		setLoading(fills);
		setLoading(ledgerUpdates);
		setLoading(agentWallets);
		setLoading(approvedBuilders);
		setLoading(accountRateLimit);
		setLoading(userRole);
		setLoading(userReferral);
		setLoading(userFees);
		setLoading(userStaking);
		setLoading(userLending);
	}

	function trackSubscription(
		subscriptions: ISubscription[],
		isClosed: () => boolean,
		subscription: ISubscription
	) {
		if (isClosed()) {
			void subscription.unsubscribe();
		} else {
			subscriptions.push(subscription);
		}
	}

	function flattenPositions(states: [string, ClearinghouseStatePayload][]) {
		const rows: AssetPos[] = [];
		for (const [dex, state] of states) {
			for (const assetPosition of state.assetPositions) {
				rows.push({ ...assetPosition, dex });
			}
		}
		return rows;
	}

	function buildDexBalances(
		states: [string, ClearinghouseStatePayload][],
		abstraction: AccountAbstraction | null
	) {
		const rows: DexBalance[] = [];
		for (const [dex, state] of states) {
			const unrealizedPnl = state.assetPositions.reduce(
				(total, assetPosition) => total + (toNumber(assetPosition.position.unrealizedPnl) ?? 0),
				0
			);
			const row = {
				dex,
				unified: false,
				accountValue: state.marginSummary.accountValue,
				withdrawable: state.withdrawable,
				totalNtlPos: state.marginSummary.totalNtlPos,
				totalMarginUsed: state.marginSummary.totalMarginUsed,
				unrealizedPnl
			};
			if (hasDexBalanceValue(row)) rows.push(row);
		}
		return abstraction === 'unifiedAccount' ? mergeDexBalances(rows) : rows;
	}

	function mergeDexBalances(rows: DexBalance[]) {
		const merged = rows.reduce(
			(total, row) => ({
				accountValue: total.accountValue + (toNumber(row.accountValue) ?? 0),
				withdrawable: total.withdrawable + (toNumber(row.withdrawable) ?? 0),
				totalNtlPos: total.totalNtlPos + (toNumber(row.totalNtlPos) ?? 0),
				totalMarginUsed: total.totalMarginUsed + (toNumber(row.totalMarginUsed) ?? 0),
				unrealizedPnl: total.unrealizedPnl + row.unrealizedPnl
			}),
			{
				accountValue: 0,
				withdrawable: 0,
				totalNtlPos: 0,
				totalMarginUsed: 0,
				unrealizedPnl: 0
			}
		);
		const row: DexBalance = {
			dex: '',
			unified: true,
			accountValue: String(merged.accountValue),
			withdrawable: String(merged.withdrawable),
			totalNtlPos: String(merged.totalNtlPos),
			totalMarginUsed: String(merged.totalMarginUsed),
			unrealizedPnl: merged.unrealizedPnl
		};
		return hasDexBalanceValue(row) ? [row] : [];
	}

	function buildOutcomeRows(spotBalances: SpotBal[], metaIndex: OutcomeMetaIndex) {
		const rows: OutcomeRow[] = [];
		for (const b of spotBalances) {
			const hit = resolveOutcomeMeta(b, metaIndex);
			const signedOutcome = parseSignedOutcomeCoin(b.coin);
			if (!hit && !signedOutcome) continue;
			if (Number(b.total) === 0) continue;
			rows.push({
				outcomeName: hit?.outcomeName ?? signedOutcome?.outcomeName ?? b.coin,
				sideName: hit?.sideName ?? signedOutcome?.sideName ?? 'Outcome',
				coin: b.coin,
				token: b.token,
				encoding: hit?.encoding ?? signedOutcome?.encoding ?? parseOutcomeEncoding(b.coin),
				total: b.total,
				entryNtl: b.entryNtl
			});
		}
		return rows;
	}

	function resolveOutcomeMeta(balance: SpotBal, metaIndex: OutcomeMetaIndex) {
		return (
			metaIndex.byToken[balance.token] ??
			resolveOutcomeCoinMeta(balance.coin, metaIndex) ??
			resolveOutcomeEncodingMeta(parseOutcomeEncoding(balance.coin), metaIndex) ??
			resolveOutcomeEncodingMeta(balance.token, metaIndex) ??
			null
		);
	}

	function isOutcomeBalance(balance: SpotBal) {
		return balance.coin.startsWith('+') || balance.coin.startsWith('-');
	}

	function parseSignedOutcomeCoin(coin: string) {
		const sign = coin[0];
		if (sign !== '+' && sign !== '-') return null;
		const encoding = parseOutcomeEncoding(coin);

		return {
			outcomeName: coin.slice(1) || coin,
			sideName: sign === '+' ? 'Yes' : 'No',
			encoding
		};
	}

	function dedupeFills(next: Fill[]) {
		const seen: Record<string, true> = {};
		const rows: Fill[] = [];
		for (const fill of next) {
			const key = `${fill.time}:${fill.coin}:${fill.side}:${fill.px}:${fill.sz}`;
			if (seen[key]) continue;
			seen[key] = true;
			rows.push(fill);
			if (rows.length === 200) break;
		}
		return rows;
	}

	function saveAgentWallets(user: Address, network: HyperliquidNetwork, rows: SavedAgentWallet[]) {
		saveSavedAgentWallets(user, network, rows);
	}

	function upsertSavedAgentWallet(
		user: Address,
		network: HyperliquidNetwork,
		next: SavedAgentWallet
	) {
		const rows = [
			next,
			...savedAgentWallets.filter((row) => row.address.toLowerCase() !== next.address.toLowerCase())
		];
		savedAgentWallets = rows;
		saveAgentWallets(user, network, rows);
	}

	function forgetSavedAgentWallet(user: Address, network: HyperliquidNetwork, address: string) {
		const rows = savedAgentWallets.filter(
			(row) => row.address.toLowerCase() !== address.toLowerCase()
		);
		savedAgentWallets = rows;
		saveAgentWallets(user, network, rows);
	}

	function sanitizeAgentName(value: string) {
		return value.trim().replace(/\s+/g, '-').slice(0, 16);
	}

	function normalizePrivateKeyInput(value: string) {
		const trimmed = value.trim();
		const withPrefix = trimmed.startsWith('0x') ? trimmed : `0x${trimmed}`;
		if (!/^0x[0-9a-fA-F]{64}$/.test(withPrefix)) {
			throw new Error('Enter a valid 32-byte private key.');
		}
		return withPrefix as `0x${string}`;
	}

	function agentBaseName(name: string) {
		return name.replace(/ valid_until \d+$/, '').trim();
	}

	function agentApprovalName(name: string, validUntil: number) {
		return `${name} valid_until ${validUntil}`;
	}

	function clampAgentValidDays(value: number) {
		if (!Number.isFinite(value)) return 90;
		return Math.min(AGENT_MAX_VALID_DAYS, Math.max(1, Math.floor(value)));
	}

	function symbolKey(symbol: string) {
		return symbol.trim().toUpperCase();
	}

	function outcomeCoinKey(coin: string) {
		return coin.trim().toUpperCase();
	}

	function normalizeOutcomeEncoding(value: number | null | undefined) {
		if (value == null || !Number.isSafeInteger(value) || value < 0) return null;
		return value >= 100_000_000 ? value - 100_000_000 : value;
	}

	function parseOutcomeEncoding(value: string | number | null | undefined) {
		if (typeof value === 'number') return normalizeOutcomeEncoding(value);
		if (typeof value !== 'string') return null;

		const trimmed = value.trim();
		if (!trimmed) return null;
		const body = ['+', '-', '#'].includes(trimmed[0]) ? trimmed.slice(1) : trimmed;
		if (!/^\d+$/.test(body)) return null;
		return normalizeOutcomeEncoding(Number(body));
	}

	function resolveOutcomeEncodingMeta(
		encoding: number | null | undefined,
		metaIndex: OutcomeMetaIndex
	) {
		const normalized = normalizeOutcomeEncoding(encoding);
		return normalized == null ? null : (metaIndex.byEncoding[normalized] ?? null);
	}

	function resolveOutcomeCoinMeta(coin: string, metaIndex: OutcomeMetaIndex) {
		return (
			metaIndex.byCoin[outcomeCoinKey(coin)] ??
			resolveOutcomeEncodingMeta(parseOutcomeEncoding(coin), metaIndex) ??
			null
		);
	}

	function setOutcomeCoinAlias(
		metaIndex: OutcomeMetaIndex,
		coin: string,
		outcome: OutcomeToken,
		overwrite = true
	) {
		const key = outcomeCoinKey(coin);
		if (overwrite || metaIndex.byCoin[key] == null) {
			metaIndex.byCoin[key] = outcome;
		}
	}

	function resolvePerpAssetId(symbol: string) {
		return perpAssetIdBySymbol[symbolKey(symbol)] ?? null;
	}

	function resolveSpotAssetId(symbol: string, tokenIndex?: number | null) {
		if (tokenIndex != null) {
			const byToken = spotAssetIdByToken[tokenIndex];
			if (byToken != null) return byToken;
		}

		const trimmed = symbol.trim();
		if (trimmed.startsWith('@')) {
			const index = Number(trimmed.slice(1));
			return Number.isInteger(index) && index >= 0 ? 10000 + index : null;
		}

		return spotAssetIdBySymbol[symbolKey(trimmed)] ?? null;
	}

	function getPerpCtx(dex: string, coin: string) {
		const assetId = resolvePerpAssetId(dex ? `${dex}:${coin}` : coin);
		const byAssetId = assetId == null ? null : (perpCtxsByAssetId[assetId] ?? null);
		if (byAssetId) return byAssetId;
		const byDex = perpCtxsByDexCoin[dex]?.[coin] ?? null;
		if (byDex) return byDex;
		const byDefaultDex = perpCtxsByDexCoin['']?.[coin] ?? null;
		if (byDefaultDex) return byDefaultDex;
		return null;
	}

	function getSpotCtx(coin: string, tokenIndex?: number | null) {
		const assetId = resolveSpotAssetId(coin, tokenIndex);
		if (assetId != null) {
			const index = assetId - 10000;
			const spotInfo = spotUniverseByIndex[index];
			const base = spotInfo ? spotTokenByIndex[spotInfo.tokens[0]]?.name : null;
			const quote = spotInfo ? spotTokenByIndex[spotInfo.tokens[1]]?.name : null;
			const byActiveSpotName = spotInfo ? (activeSpotCtxsByCoin[spotInfo.name] ?? null) : null;
			if (byActiveSpotName) return byActiveSpotName;
			const byActiveOutcomeName = activeSpotCtxsByCoin[`#${index}`] ?? null;
			if (byActiveOutcomeName) return byActiveOutcomeName;
			const byActiveIndexName = activeSpotCtxsByCoin[`@${index}`] ?? null;
			if (byActiveIndexName) return byActiveIndexName;
			const byAssetId = spotCtxsByAssetId[assetId] ?? null;
			if (byAssetId) return byAssetId;
			const byCoin = spotCtxsByCoin[coin] ?? null;
			if (byCoin) return byCoin;
			const byUniverseName = spotCtxsByCoin[`@${index}`] ?? null;
			if (byUniverseName) return byUniverseName;
			const bySpotName = spotInfo ? (spotCtxsByCoin[spotInfo.name] ?? null) : null;
			if (bySpotName) return bySpotName;
			const byPair = base && quote ? (spotCtxsByCoin[`${base}/${quote}`] ?? null) : null;
			if (byPair) return byPair;
			return null;
		}
		return spotCtxsByCoin[coin] ?? null;
	}

	function toNumber(value: string | number | null | undefined) {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : null;
	}

	function hasDexBalanceValue(balance: DexBalance) {
		return (
			Math.abs(toNumber(balance.accountValue) ?? 0) > 0 ||
			Math.abs(toNumber(balance.withdrawable) ?? 0) > 0 ||
			Math.abs(toNumber(balance.totalNtlPos) ?? 0) > 0 ||
			Math.abs(toNumber(balance.totalMarginUsed) ?? 0) > 0 ||
			Math.abs(balance.unrealizedPnl) > 0
		);
	}

	function spotMarkPx(balance: SpotBal) {
		if (balance.coin === 'USDC') return 1;
		return toNumber(getSpotCtx(balance.coin, balance.token)?.markPx);
	}

	function isStableBalance(balance: SpotBal) {
		return STABLE_BALANCE_COINS.has(balance.coin.toUpperCase());
	}

	function dexBalanceName(balance: DexBalance) {
		if (balance.unified) return 'USDC';
		return balance.dex ? `USDC (${balance.dex})` : 'USDC (Perps)';
	}

	function dexBalanceRow(balance: DexBalance) {
		const accountValue = toNumber(balance.accountValue);
		const withdrawable = toNumber(balance.withdrawable);
		const pnlPercent =
			accountValue == null || accountValue <= 0
				? null
				: (balance.unrealizedPnl / accountValue) * 100;

		return {
			accountValue,
			withdrawable,
			totalNtlPos: toNumber(balance.totalNtlPos),
			totalMarginUsed: toNumber(balance.totalMarginUsed),
			pnlDollars: balance.unrealizedPnl,
			pnlPercent
		};
	}

	function sumKnown(...values: (number | null)[]) {
		let sum = 0;
		let seen = false;
		for (const value of values) {
			if (value == null) continue;
			sum += value;
			seen = true;
		}
		return seen ? sum : null;
	}

	function getSpotTokenMeta(balance: SpotBal) {
		if (balance.token == null) return null;
		return spotTokenByIndex[balance.token] ?? null;
	}

	function spotInfoByAssetId(assetId: number | null) {
		if (assetId == null) return null;
		const spotIndex = assetId - 10000;
		if (!Number.isInteger(spotIndex) || spotIndex < 0) return null;
		return spotUniverseByIndex[spotIndex] ?? null;
	}

	function spotInfoForMarketCoin(coin: string) {
		const trimmed = coin.trim();
		if (!trimmed.startsWith('@') && !trimmed.includes('/')) return null;
		return spotInfoByAssetId(resolveSpotAssetId(trimmed));
	}

	function spotBaseName(spotInfo: SpotUniverse | null) {
		if (!spotInfo) return null;
		return spotTokenByIndex[spotInfo.tokens[0]]?.name ?? null;
	}

	function spotQuoteName(spotInfo: SpotUniverse | null) {
		if (!spotInfo) return null;
		return spotTokenByIndex[spotInfo.tokens[1]]?.name ?? null;
	}

	function spotPairName(spotInfo: SpotUniverse | null) {
		if (!spotInfo) return null;
		const base = spotBaseName(spotInfo);
		const quote = spotQuoteName(spotInfo);
		if (base && quote) return `${base}/${quote}`;
		return spotInfo.name;
	}

	function spotBalanceName(balance: SpotBal) {
		const coin = balance.coin || 'Unknown';
		const spotInfo = spotInfoForMarketCoin(coin);
		const base = spotBaseName(spotInfo);
		if (base) return base;
		return getSpotTokenMeta(balance)?.name ?? coin;
	}

	function marketDisplayName(coin: string) {
		const trimmed = coin.trim();
		if (!trimmed) return 'Unknown';

		const outcome = outcomeMetaIndex ? resolveOutcomeCoinMeta(trimmed, outcomeMetaIndex) : null;
		if (outcome) return `${outcome.outcomeName} (${outcome.sideName})`;

		const spotInfo = spotInfoForMarketCoin(trimmed);
		return spotPairName(spotInfo) ?? trimmed;
	}

	function balanceRow(balance: SpotBal) {
		const total = toNumber(balance.total);
		const hold = toNumber(balance.hold) ?? 0;
		const markPx = spotMarkPx(balance);
		const usdcValue = total == null || markPx == null ? null : total * markPx;
		const entryValue = toNumber(balance.entryNtl);
		const pnlDollars =
			isStableBalance(balance) || usdcValue == null || entryValue == null || entryValue <= 0
				? null
				: usdcValue - entryValue;
		const pnlPercent =
			pnlDollars == null || entryValue == null || entryValue <= 0
				? null
				: (pnlDollars / entryValue) * 100;

		return {
			total,
			available: total == null ? null : total - hold,
			usdcValue,
			pnlDollars,
			pnlPercent,
			contractAddress: getSpotTokenMeta(balance)?.evmContract?.address ?? null
		};
	}

	function isSpotUsdcBalance(balance: SpotBal) {
		return balance.coin.toUpperCase() === 'USDC';
	}

	function spotUsdcBalance() {
		return balances.data?.find(isSpotUsdcBalance) ?? null;
	}

	function shouldMergeSpotUsdc() {
		return dexBalances.data?.some((balance) => balance.unified) ?? false;
	}

	function tableSpotBalances() {
		const rows = balances.data ?? [];
		return shouldMergeSpotUsdc() ? rows.filter((balance) => !isSpotUsdcBalance(balance)) : rows;
	}

	function tableDexBalanceRow(balance: DexBalance) {
		const row = dexBalanceRow(balance);
		if (!balance.unified) return { ...row, usdcValue: row.accountValue, contractAddress: null };

		const spot = spotUsdcBalance();
		if (!spot) return { ...row, usdcValue: row.accountValue, contractAddress: null };

		const spotRow = balanceRow(spot);
		const accountValue = sumKnown(row.accountValue, spotRow.total);
		const pnlPercent =
			row.pnlDollars == null || accountValue == null || accountValue <= 0
				? null
				: (row.pnlDollars / accountValue) * 100;

		return {
			...row,
			accountValue,
			withdrawable: sumKnown(row.withdrawable, spotRow.available),
			usdcValue: sumKnown(row.accountValue, spotRow.usdcValue),
			pnlPercent,
			contractAddress: spotRow.contractAddress
		};
	}

	function balanceTableRows() {
		const rows: BalanceTableRow[] = [];
		for (const [index, balance] of (dexBalances.data ?? []).entries()) {
			const row = tableDexBalanceRow(balance);
			rows.push({
				key: dexBalanceKey(balance, index),
				coin: dexBalanceName(balance),
				total: row.accountValue,
				available: row.withdrawable,
				usdcValue: row.usdcValue,
				pnlDollars: row.pnlDollars,
				pnlPercent: row.pnlPercent,
				contractAddress: row.contractAddress
			});
		}
		for (const [index, balance] of tableSpotBalances().entries()) {
			const row = balanceRow(balance);
			rows.push({
				key: balanceKey(balance, index),
				coin: spotBalanceName(balance),
				total: row.total,
				available: row.available,
				usdcValue: row.usdcValue,
				pnlDollars: row.pnlDollars,
				pnlPercent: row.pnlPercent,
				contractAddress: row.contractAddress
			});
		}
		return sortBalanceRows(rows);
	}

	function positionTableRows() {
		const rows: PositionTableRow[] = [];
		for (const [index, position] of (positions.data ?? []).entries()) {
			const row = positionRow(position);
			rows.push({
				key: positionKey(position, index),
				coin: positionCoinName(position),
				size: row.size,
				positionValue: row.positionValue,
				entryPrice: row.entryPrice,
				markPrice: row.markPrice,
				pnlDollars: row.pnlDollars,
				pnlPercent: row.pnlPercent,
				liquidationPrice: row.liquidationPrice,
				margin: row.margin,
				marginType: row.marginType,
				funding: row.funding
			});
		}
		return sortPositionRows(rows);
	}

	function orderTableRows() {
		const rows: OrderTableRow[] = [];
		for (const [index, order] of (orders.data ?? []).entries()) {
			const row = orderRow(order);
			rows.push({
				key: orderKey(order, index),
				coin: marketDisplayName(order.coin),
				side: order.side,
				size: row.size,
				origSize: row.origSize,
				price: row.price,
				value: row.value,
				type: order.orderType,
				tif: order.tif ?? null,
				reduceOnly: order.reduceOnly,
				time: toNumber(order.timestamp),
				oid: toNumber(order.oid)
			});
		}
		return sortOrderRows(rows);
	}

	function outcomeTableRows() {
		const rows: OutcomeTableRow[] = [];
		for (const [index, outcome] of (outcomes.data ?? []).entries()) {
			const row = outcomeRow(outcome);
			rows.push({
				key: outcomeKey(outcome, index),
				market: outcome.outcomeName,
				side: outcome.sideName,
				coin: outcome.coin,
				total: row.total,
				markPrice: row.markPrice,
				usdcValue: row.usdcValue,
				pnlDollars: row.pnlDollars,
				pnlPercent: row.pnlPercent,
				contractAddress: row.contractAddress
			});
		}
		return sortOutcomeRows(rows);
	}

	function fillTableRows() {
		const rows: FillTableRow[] = [];
		for (const [index, fill] of (fills.data ?? []).entries()) {
			const row = fillRow(fill);
			rows.push({
				key: fillKey(fill, index),
				coin: marketDisplayName(fill.coin),
				side: fill.side,
				size: row.size,
				price: row.price,
				value: row.value,
				fee: row.fee,
				feeToken: fill.feeToken ?? null,
				closedPnl: toNumber(fill.closedPnl),
				liquidity: fill.crossed ? 'Taker' : 'Maker',
				direction: fill.dir ?? null,
				time: toNumber(fill.time),
				oid: toNumber(fill.oid),
				tid: toNumber(fill.tid),
				hash: fill.hash ?? null
			});
		}
		return sortFillRows(rows);
	}

	function ledgerTableRows() {
		const rows: LedgerTableRow[] = [];
		const sorted = [...(ledgerUpdates.data ?? [])].sort(
			(a, b) => b.time - a.time || b.hash.localeCompare(a.hash)
		);
		for (const [index, update] of sorted.entries()) {
			const delta = update.delta;
			const amount = ledgerAmount(delta);
			rows.push({
				key: ledgerKey(update, index),
				time: toNumber(update.time),
				hash: update.hash ?? null,
				type: delta.type,
				label: ledgerTypeLabel(delta.type),
				amount: amount.label,
				amountValue: amount.value,
				details: ledgerDetails(delta)
			});
		}
		return rows;
	}

	function agentTableRows() {
		const rows: AgentTableRow[] = [];
		const localByAddress = new Map(
			savedAgentWallets.map((row) => [row.address.toLowerCase(), row])
		);
		const seen: Record<string, true> = {};

		for (const agent of agentWallets.data ?? []) {
			const key = agent.address.toLowerCase();
			const saved = localByAddress.get(key) ?? null;
			const baseName = agentBaseName(agent.name);
			seen[key] = true;
			rows.push({
				key,
				name: baseName || 'Unnamed',
				approvalName: baseName || null,
				address: agent.address,
				validUntil: agent.validUntil,
				privateKey: saved?.privateKey ?? null,
				createdAt: saved?.createdAt ?? null,
				registered: true
			});
		}

		for (const saved of savedAgentWallets) {
			const key = saved.address.toLowerCase();
			if (seen[key]) continue;
			rows.push({
				key,
				name: saved.name,
				approvalName: saved.name,
				address: saved.address,
				validUntil: saved.validUntil,
				privateKey: saved.privateKey,
				createdAt: saved.createdAt,
				registered: false
			});
		}

		return sortAgentRows(rows);
	}

	function builderTableRows() {
		const rows: BuilderTableRow[] = [];
		for (const builder of approvedBuilders.data ?? []) {
			rows.push({
				key: builder.address.toLowerCase(),
				name: builderName(builder.address),
				address: builder.address,
				maxFee: builder.maxFee
			});
		}
		return sortBuilderRows(rows);
	}

	function builderName(address: string) {
		return BUILDER_NAME_BY_ADDRESS[address.toLowerCase()] ?? null;
	}

	function fillRow(fill: Fill) {
		const size = toNumber(fill.sz);
		const price = toNumber(fill.px);
		return {
			size,
			price,
			value: size == null || price == null ? null : size * price,
			fee: toNumber(fill.fee)
		};
	}

	function ledgerAmount(delta: LedgerDelta) {
		const token = ledgerString(delta, 'token');
		const amount = ledgerString(delta, 'amount');
		const usdc = ledgerString(delta, 'usdc');
		const usdcValue = ledgerString(delta, 'usdcValue');

		if ((delta.type === 'spotTransfer' || delta.type === 'send') && amount) {
			const parsedAmount = toNumber(amount);
			const parsedUsdc = toNumber(usdcValue);
			const sign = ledgerTransferSign(delta);
			return {
				label: [
					formatTokenValue(parsedAmount, token ?? 'Token'),
					parsedUsdc == null ? null : formatUsd(parsedUsdc)
				]
					.filter(Boolean)
					.join(' / '),
				value: sign == null || parsedUsdc == null ? null : sign * parsedUsdc
			};
		}

		if (amount) {
			const parsedAmount = toNumber(amount);
			const sign = delta.type === 'spotGenesis' ? Math.sign(parsedAmount ?? 0) || null : null;
			return {
				label:
					sign == null
						? formatTokenValue(parsedAmount, token ?? 'Token')
						: formatSignedTokenAmount(parsedAmount, token ?? 'Token'),
				value: sign == null || parsedAmount == null ? null : sign * Math.abs(parsedAmount)
			};
		}

		if (delta.type === 'liquidation') {
			return {
				label: formatUsd(toNumber(ledgerString(delta, 'liquidatedNtlPos'))),
				value: null
			};
		}

		if (delta.type === 'vaultWithdraw') {
			const value = toNumber(ledgerString(delta, 'netWithdrawnUsd'));
			return {
				label: formatUsd(value),
				value
			};
		}

		if (usdc) {
			const value = toNumber(usdc);
			const sign = ledgerUsdcSign(delta);
			return {
				label:
					value == null
						? '—'
						: sign == null
							? formatTokenValue(value, 'USDC')
							: formatSignedTokenAmount(sign * (value ?? 0), 'USDC'),
				value: sign == null || value == null ? null : sign * value
			};
		}

		return { label: '—', value: null };
	}

	function ledgerUsdcSign(delta: LedgerDelta) {
		if (delta.type === 'deposit') return 1;
		if (delta.type === 'withdraw') return -1;
		if (delta.type === 'vaultCreate' || delta.type === 'vaultDeposit') return -1;
		if (delta.type === 'vaultDistribution') return 1;
		if (delta.type === 'internalTransfer' || delta.type === 'subAccountTransfer') {
			return ledgerTransferSign(delta);
		}
		if (delta.type === 'vaultLeaderCommission') return 1;
		return null;
	}

	function ledgerTransferSign(delta: LedgerDelta) {
		const current = activeAddress?.toLowerCase();
		if (!current) return null;

		const destination = ledgerString(delta, 'destination')?.toLowerCase();
		if (destination === current) return 1;

		const source = ledgerString(delta, 'user')?.toLowerCase();
		if (source === current) return -1;

		return null;
	}

	function ledgerDetails(delta: LedgerDelta) {
		const details: LedgerDetailItem[] = [];
		const add = (key: string, label = ledgerDetailLabel(key)) =>
			addLedgerDetail(details, key, label, delta[key]);
		const addValue = (key: string, label: string, value: unknown) =>
			addLedgerDetail(details, key, label, value);
		const addUsd = (key: string, label: string) => {
			const value = toNumber(ledgerString(delta, key));
			if (value != null) addValue(key, label, formatUsd(value));
		};
		const addToken = (key: string, label: string, token = ledgerString(delta, 'token')) => {
			const value = toNumber(ledgerString(delta, key));
			if (value != null) addValue(key, label, formatTokenValue(value, token ?? 'Token'));
		};
		const addFee = (key: string, label: string, token = 'USDC') => {
			const value = toNumber(ledgerString(delta, key));
			if (value != null) addValue(key, label, formatTokenValue(value, token));
		};

		if (delta.type === 'accountClassTransfer') {
			addValue('direction', 'Direction', delta.toPerp === true ? 'Spot to perps' : 'Perps to spot');
		} else if (delta.type === 'internalTransfer') {
			add('user', 'From');
			add('destination', 'To');
			addFee('fee', 'Fee');
		} else if (delta.type === 'liquidation') {
			addUsd('accountValue', 'Account value');
			add('leverageType', 'Leverage');
			add('liquidatedPositions', 'Positions');
		} else if (delta.type === 'rewardsClaim') {
			add('token', 'Token');
		} else if (delta.type === 'spotTransfer') {
			add('user', 'From');
			add('destination', 'To');
			add('token', 'Token');
			addFee('fee', 'Fee', ledgerString(delta, 'feeToken') ?? 'USDC');
			addFee('nativeTokenFee', 'Native fee', ledgerString(delta, 'token') ?? 'Token');
			add('nonce', 'Nonce');
		} else if (delta.type === 'subAccountTransfer') {
			add('user', 'From');
			add('destination', 'To');
		} else if (delta.type === 'vaultCreate') {
			add('vault', 'Vault');
			addFee('fee', 'Creation fee');
		} else if (delta.type === 'vaultDeposit' || delta.type === 'vaultDistribution') {
			add('vault', 'Vault');
		} else if (delta.type === 'vaultWithdraw') {
			add('vault', 'Vault');
			add('user', 'User');
			addUsd('requestedUsd', 'Requested');
			addUsd('commission', 'Commission');
			addUsd('closingCost', 'Closing cost');
			addUsd('basis', 'Basis');
		} else if (delta.type === 'withdraw') {
			add('nonce', 'Nonce');
			addFee('fee', 'Fee');
		} else if (delta.type === 'send') {
			add('user', 'From');
			add('destination', 'To');
			add('sourceDex', 'Source DEX');
			add('destinationDex', 'Destination DEX');
			add('token', 'Token');
			addFee('fee', 'Fee', ledgerString(delta, 'feeToken') ?? 'USDC');
			addFee('nativeTokenFee', 'Native fee', ledgerString(delta, 'token') ?? 'Token');
			add('nonce', 'Nonce');
		} else if (delta.type === 'deployGasAuction') {
			add('token', 'Token');
		} else if (delta.type === 'cStakingTransfer') {
			addValue(
				'direction',
				'Direction',
				delta.isDeposit === true ? 'Spot to staking' : 'Staking to spot'
			);
			add('token', 'Token');
		} else if (delta.type === 'borrowLend') {
			add('operation', 'Operation');
			add('token', 'Token');
			addToken('interestAmount', 'Interest');
		} else if (delta.type === 'activateDexAbstraction') {
			add('dex', 'DEX');
			add('token', 'Token');
		} else if (delta.type === 'vaultLeaderCommission') {
			add('user', 'Leader');
		}

		return details.length > 0 ? details : ledgerGenericDetails(delta);
	}

	function ledgerGenericDetails(delta: LedgerDelta) {
		const details: LedgerDetailItem[] = [];
		for (const [key, value] of Object.entries(delta)) {
			if (LEDGER_DETAIL_OMIT_FIELDS.has(key) || value == null) continue;
			addLedgerDetail(details, key, ledgerDetailLabel(key), value);
		}
		return details;
	}

	function addLedgerDetail(
		details: LedgerDetailItem[],
		key: string,
		label: string,
		value: unknown
	) {
		const item = ledgerDetailItem(key, label, value);
		if (item) details.push(item);
	}

	function ledgerDetailItem(key: string, label: string, value: unknown): LedgerDetailItem | null {
		if (value == null) return null;
		const rendered = ledgerDetailValue(key, value);
		if (!rendered) return null;
		const address = typeof value === 'string' && isAddressLike(value) ? value : null;
		return { key, label, value: rendered, address };
	}

	function ledgerDetailLabel(key: string) {
		const withSpaces = key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
		return withSpaces
			.replace(/\busdc\b/gi, 'USDC')
			.replace(/\bdex\b/gi, 'DEX')
			.replace(/\bid\b/gi, 'ID')
			.replace(/^\w/, (letter) => letter.toUpperCase());
	}

	function ledgerDetailValue(key: string, value: unknown): string {
		if (key === 'toPerp' && typeof value === 'boolean') {
			return value ? 'To perps' : 'To spot';
		}
		if (key === 'isDeposit' && typeof value === 'boolean') {
			return value ? 'Deposit' : 'Withdrawal';
		}
		if (typeof value === 'string') {
			return isAddressLike(value) ? short(value) : value;
		}
		if (typeof value === 'number' || typeof value === 'boolean') {
			return String(value);
		}
		if (Array.isArray(value)) {
			return ledgerArrayDetail(value);
		}
		if (isRecord(value)) {
			return truncateLedgerDetail(JSON.stringify(value));
		}
		return truncateLedgerDetail(String(value));
	}

	function ledgerArrayDetail(value: unknown[]) {
		const rendered = value.map((item) => {
			if (isRecord(item) && typeof item.coin === 'string') {
				return `${item.coin} ${typeof item.szi === 'string' ? item.szi : ''}`.trim();
			}
			if (isRecord(item)) return JSON.stringify(item);
			return String(item);
		});
		return truncateLedgerDetail(rendered.join(', '));
	}

	function truncateLedgerDetail(value: string) {
		return value.length <= 120 ? value : `${value.slice(0, 117)}...`;
	}

	function ledgerString(delta: LedgerDelta, key: string) {
		const value = delta[key];
		return typeof value === 'string' ? value : null;
	}

	function ledgerTypeLabel(type: string) {
		return LEDGER_TYPE_LABELS[type] ?? ledgerDetailLabel(type);
	}

	function isAddressLike(value: string) {
		return /^0x[a-fA-F0-9]{40,64}$/.test(value);
	}

	function isRecord(value: unknown): value is Record<string, unknown> {
		return typeof value === 'object' && value !== null && !Array.isArray(value);
	}

	function outcomeRow(outcome: OutcomeRow) {
		const total = toNumber(outcome.total);
		const markPrice = toNumber(outcomeSpotCtx(outcome)?.markPx);
		const usdcValue = total == null || markPrice == null ? null : total * markPrice;
		const entryValue = toNumber(outcome.entryNtl);
		const pnlDollars =
			usdcValue == null || entryValue == null || entryValue <= 0 ? null : usdcValue - entryValue;
		const pnlPercent =
			pnlDollars == null || entryValue == null || entryValue <= 0
				? null
				: (pnlDollars / entryValue) * 100;
		return {
			total,
			markPrice,
			usdcValue,
			pnlDollars,
			pnlPercent,
			contractAddress: spotTokenByIndex[outcome.token]?.evmContract?.address ?? null
		};
	}

	function outcomeSpotCtx(outcome: OutcomeRow) {
		for (const coin of outcomeActiveSpotCoinsFor(outcome)) {
			const ctx = activeSpotCtxsByCoin[coin] ?? null;
			if (ctx) return ctx;
		}
		return getSpotCtx(outcome.coin, outcome.token);
	}

	function orderRow(order: Order) {
		const size = toNumber(order.sz);
		const origSize = toNumber(order.origSz);
		const price = toNumber(order.limitPx);
		return {
			size,
			origSize,
			price,
			value: size == null || price == null ? null : size * price
		};
	}

	function positionRow(position: AssetPos) {
		const pos = position.position;
		const size = toNumber(pos.szi);
		const positionValue = toNumber(pos.positionValue);
		const entryPrice = toNumber(pos.entryPx);
		const markPrice = positionMarkPrice(position);
		const pnlDollars = toNumber(pos.unrealizedPnl);
		const returnOnEquity = toNumber(pos.returnOnEquity);
		const margin = toNumber(pos.marginUsed) ?? isolatedRawUsd(pos.leverage);
		const pnlPercent =
			returnOnEquity == null
				? pnlDollars == null || margin == null || margin <= 0
					? null
					: (pnlDollars / margin) * 100
				: returnOnEquity * 100;

		return {
			size,
			positionValue,
			entryPrice,
			markPrice,
			pnlDollars,
			pnlPercent,
			liquidationPrice: toNumber(pos.liquidationPx),
			margin,
			marginType: positionMarginType(position),
			funding: toNumber(pos.cumFunding?.sinceOpen)
		};
	}

	function positionCoinName(position: AssetPos) {
		return position.position.coin || 'Unknown';
	}

	function positionMarkPrice(position: AssetPos) {
		const fromCtx = toNumber(getPerpCtx(position.dex, position.position.coin)?.markPx);
		if (fromCtx != null) return fromCtx;

		const positionValue = toNumber(position.position.positionValue);
		const size = toNumber(position.position.szi);
		if (positionValue == null || size == null || size === 0) return null;
		return positionValue / Math.abs(size);
	}

	function positionMarginType(position: AssetPos): PositionTableRow['marginType'] {
		const type = position.position.leverage?.type;
		if (type === 'isolated') return 'Isolated';
		if (type === 'cross') return 'Cross';
		return null;
	}

	function isolatedRawUsd(leverage: AssetPositionPayload['position']['leverage'] | undefined) {
		return leverage?.type === 'isolated' ? toNumber(leverage.rawUsd) : null;
	}

	function sortBalanceRows(rows: BalanceTableRow[]) {
		return [...rows].sort((a, b) => {
			const aValue = balanceSortValue(a, balanceSortKey);
			const bValue = balanceSortValue(b, balanceSortKey);
			if (aValue == null && bValue == null) return a.coin.localeCompare(b.coin);
			if (aValue == null) return 1;
			if (bValue == null) return -1;
			const comparison = compareSortValues(aValue, bValue) || a.coin.localeCompare(b.coin);
			return balanceSortDirection === 'asc' ? comparison : -comparison;
		});
	}

	function sortPositionRows(rows: PositionTableRow[]) {
		return [...rows].sort((a, b) => {
			const aValue = positionSortValue(a, positionSortKey);
			const bValue = positionSortValue(b, positionSortKey);
			if (aValue == null && bValue == null) return a.coin.localeCompare(b.coin);
			if (aValue == null) return 1;
			if (bValue == null) return -1;
			const comparison = compareSortValues(aValue, bValue) || a.coin.localeCompare(b.coin);
			return positionSortDirection === 'asc' ? comparison : -comparison;
		});
	}

	function sortOrderRows(rows: OrderTableRow[]) {
		return [...rows].sort((a, b) => {
			const aValue = orderSortValue(a, orderSortKey);
			const bValue = orderSortValue(b, orderSortKey);
			if (aValue == null && bValue == null) return a.coin.localeCompare(b.coin);
			if (aValue == null) return 1;
			if (bValue == null) return -1;
			const comparison = compareSortValues(aValue, bValue) || a.coin.localeCompare(b.coin);
			return orderSortDirection === 'asc' ? comparison : -comparison;
		});
	}

	function sortOutcomeRows(rows: OutcomeTableRow[]) {
		return [...rows].sort((a, b) => {
			const aValue = outcomeSortValue(a, outcomeSortKey);
			const bValue = outcomeSortValue(b, outcomeSortKey);
			if (aValue == null && bValue == null) return a.market.localeCompare(b.market);
			if (aValue == null) return 1;
			if (bValue == null) return -1;
			const comparison =
				compareSortValues(aValue, bValue) ||
				a.market.localeCompare(b.market) ||
				a.side.localeCompare(b.side);
			return outcomeSortDirection === 'asc' ? comparison : -comparison;
		});
	}

	function sortFillRows(rows: FillTableRow[]) {
		return [...rows].sort((a, b) => {
			const aValue = fillSortValue(a, fillSortKey);
			const bValue = fillSortValue(b, fillSortKey);
			if (aValue == null && bValue == null) return a.coin.localeCompare(b.coin);
			if (aValue == null) return 1;
			if (bValue == null) return -1;
			const comparison = compareSortValues(aValue, bValue) || a.coin.localeCompare(b.coin);
			return fillSortDirection === 'asc' ? comparison : -comparison;
		});
	}

	function sortAgentRows(rows: AgentTableRow[]) {
		return [...rows].sort((a, b) => {
			const aValue = agentSortValue(a, agentSortKey);
			const bValue = agentSortValue(b, agentSortKey);
			if (aValue == null && bValue == null) return a.name.localeCompare(b.name);
			if (aValue == null) return 1;
			if (bValue == null) return -1;
			const comparison = compareSortValues(aValue, bValue) || a.name.localeCompare(b.name);
			return agentSortDirection === 'asc' ? comparison : -comparison;
		});
	}

	function sortBuilderRows(rows: BuilderTableRow[]) {
		return [...rows].sort((a, b) => {
			const aValue = builderSortValue(a, builderSortKey);
			const bValue = builderSortValue(b, builderSortKey);
			const fallback =
				(a.name ?? '').localeCompare(b.name ?? '') || a.address.localeCompare(b.address);
			if (aValue == null && bValue == null) return fallback;
			if (aValue == null) return 1;
			if (bValue == null) return -1;
			const comparison = compareSortValues(aValue, bValue) || fallback;
			return builderSortDirection === 'asc' ? comparison : -comparison;
		});
	}

	function balanceSortValue(row: BalanceTableRow, key: BalanceSortKey) {
		if (key === 'coin') return row.coin;
		if (key === 'total') return row.total;
		if (key === 'available') return row.available;
		if (key === 'usdcValue') return row.usdcValue;
		if (key === 'pnl') return row.pnlDollars;
		return row.contractAddress;
	}

	function positionSortValue(row: PositionTableRow, key: PositionSortKey) {
		if (key === 'coin') return row.coin;
		if (key === 'size') return row.size;
		if (key === 'positionValue') return row.positionValue;
		if (key === 'entryPrice') return row.entryPrice;
		if (key === 'markPrice') return row.markPrice;
		if (key === 'pnl') return row.pnlDollars;
		if (key === 'liqPrice') return row.liquidationPrice;
		if (key === 'margin') return row.margin;
		return row.funding;
	}

	function orderSortValue(row: OrderTableRow, key: OrderSortKey) {
		if (key === 'coin') return row.coin;
		if (key === 'side') return orderSideLabel(row.side);
		if (key === 'size') return row.size;
		if (key === 'origSize') return row.origSize;
		if (key === 'price') return row.price;
		if (key === 'value') return row.value;
		if (key === 'type') return row.type;
		if (key === 'tif') return row.tif;
		if (key === 'reduceOnly') return row.reduceOnly ? 1 : 0;
		if (key === 'time') return row.time;
		return row.oid;
	}

	function outcomeSortValue(row: OutcomeTableRow, key: OutcomeSortKey) {
		if (key === 'market') return row.market;
		if (key === 'side') return row.side;
		if (key === 'coin') return row.coin;
		if (key === 'total') return row.total;
		if (key === 'markPrice') return row.markPrice;
		if (key === 'usdcValue') return row.usdcValue;
		if (key === 'pnl') return row.pnlDollars;
		return row.contractAddress;
	}

	function fillSortValue(row: FillTableRow, key: FillSortKey) {
		if (key === 'coin') return row.coin;
		if (key === 'side') return orderSideLabel(row.side);
		if (key === 'size') return row.size;
		if (key === 'price') return row.price;
		if (key === 'value') return row.value;
		if (key === 'fee') return row.fee;
		if (key === 'closedPnl') return row.closedPnl;
		if (key === 'liquidity') return row.liquidity;
		if (key === 'time') return row.time;
		if (key === 'oid') return row.oid;
		return row.tid;
	}

	function agentSortValue(row: AgentTableRow, key: AgentSortKey) {
		if (key === 'name') return row.name;
		if (key === 'address') return row.address;
		if (key === 'validUntil') return row.validUntil;
		if (key === 'status') return row.registered ? 'Registered' : 'Local only';
		return row.privateKey ? 1 : 0;
	}

	function builderSortValue(row: BuilderTableRow, key: BuilderSortKey) {
		if (key === 'name') return row.name;
		if (key === 'address') return row.address;
		return row.maxFee;
	}

	function compareSortValues(a: string | number, b: string | number) {
		if (typeof a === 'number' && typeof b === 'number') return a - b;
		return String(a).localeCompare(String(b));
	}

	function setBalanceSort(key: BalanceSortKey) {
		if (balanceSortKey === key) {
			balanceSortDirection = balanceSortDirection === 'asc' ? 'desc' : 'asc';
			return;
		}
		balanceSortKey = key;
		balanceSortDirection = 'asc';
	}

	function setPositionSort(key: PositionSortKey) {
		if (positionSortKey === key) {
			positionSortDirection = positionSortDirection === 'asc' ? 'desc' : 'asc';
			return;
		}
		positionSortKey = key;
		positionSortDirection = 'asc';
	}

	function setOrderSort(key: OrderSortKey) {
		if (orderSortKey === key) {
			orderSortDirection = orderSortDirection === 'asc' ? 'desc' : 'asc';
			return;
		}
		orderSortKey = key;
		orderSortDirection = 'asc';
	}

	function setOutcomeSort(key: OutcomeSortKey) {
		if (outcomeSortKey === key) {
			outcomeSortDirection = outcomeSortDirection === 'asc' ? 'desc' : 'asc';
			return;
		}
		outcomeSortKey = key;
		outcomeSortDirection = 'asc';
	}

	function setFillSort(key: FillSortKey) {
		if (fillSortKey === key) {
			fillSortDirection = fillSortDirection === 'asc' ? 'desc' : 'asc';
			return;
		}
		fillSortKey = key;
		fillSortDirection = 'asc';
	}

	function setAgentSort(key: AgentSortKey) {
		if (agentSortKey === key) {
			agentSortDirection = agentSortDirection === 'asc' ? 'desc' : 'asc';
			return;
		}
		agentSortKey = key;
		agentSortDirection = 'asc';
	}

	function setBuilderSort(key: BuilderSortKey) {
		if (builderSortKey === key) {
			builderSortDirection = builderSortDirection === 'asc' ? 'desc' : 'asc';
			return;
		}
		builderSortKey = key;
		builderSortDirection = 'asc';
	}

	function sortDirectionIcon(direction: SortDirection) {
		return direction === 'asc' ? 'chevron-up' : 'chevron-down';
	}

	function balanceSortIndicator(key: BalanceSortKey) {
		return balanceSortKey === key ? sortDirectionIcon(balanceSortDirection) : null;
	}

	function positionSortIndicator(key: PositionSortKey) {
		return positionSortKey === key ? sortDirectionIcon(positionSortDirection) : null;
	}

	function orderSortIndicator(key: OrderSortKey) {
		return orderSortKey === key ? sortDirectionIcon(orderSortDirection) : null;
	}

	function outcomeSortIndicator(key: OutcomeSortKey) {
		return outcomeSortKey === key ? sortDirectionIcon(outcomeSortDirection) : null;
	}

	function fillSortIndicator(key: FillSortKey) {
		return fillSortKey === key ? sortDirectionIcon(fillSortDirection) : null;
	}

	function agentSortIndicator(key: AgentSortKey) {
		return agentSortKey === key ? sortDirectionIcon(agentSortDirection) : null;
	}

	function builderSortIndicator(key: BuilderSortKey) {
		return builderSortKey === key ? sortDirectionIcon(builderSortDirection) : null;
	}

	function formatTokenAmount(value: number | null) {
		if (value == null) return '—';
		if (value !== 0 && Math.abs(value) < 0.000001) return value.toExponential(2);
		return balanceAmountFormatter.format(value);
	}

	function formatUsd(value: number | null) {
		return value == null ? '—' : usdFormatter.format(value);
	}

	function formatUsdcCost(value: number | null) {
		return value == null ? '—' : `${usdcCostFormatter.format(value)} USDC`;
	}

	function formatInteger(value: number | null) {
		return value == null ? '—' : integerFormatter.format(value);
	}

	function formatBuilderFee(value: number | null) {
		if (value == null) return '—';
		return `${formatInteger(value)} (${percentFormatter.format(value / 1000)}%)`;
	}

	function formatPrice(value: number | null) {
		if (value == null) return '—';
		if (value !== 0 && Math.abs(value) < 0.000001) return `$${value.toExponential(2)}`;
		return `$${priceFormatter.format(value)}`;
	}

	function formatLiquidationPrice(value: number | null) {
		return value == null ? 'N/A' : formatPrice(value);
	}

	function formatSignedUsd(value: number | null) {
		if (value == null) return '—';
		const sign = value > 0 ? '+' : value < 0 ? '-' : '';
		return `${sign}${usdFormatter.format(Math.abs(value))}`;
	}

	function formatSignedPercent(value: number | null) {
		if (value == null) return '—';
		const sign = value > 0 ? '+' : value < 0 ? '-' : '';
		return `${sign}${percentFormatter.format(Math.abs(value))}%`;
	}

	function formatSignedTokenAmount(value: number | null, token: string | null) {
		if (value == null) return '—';
		const sign = value > 0 ? '+' : value < 0 ? '-' : '';
		return `${sign}${formatTokenAmount(Math.abs(value))}${token ? ` ${token}` : ''}`;
	}

	function pnlClass(value: number | null) {
		if (value == null || value === 0) return 'text-base-content/50';
		return value > 0 ? 'text-success' : 'text-error';
	}

	function sizeClass(value: number | null) {
		if (value == null || value === 0) return 'text-base-content/50';
		return value > 0 ? 'text-success' : 'text-error';
	}

	function formatMargin(value: number | null, type: PositionTableRow['marginType']) {
		if (!type && value == null) return '—';
		return `${formatUsd(value)}${type ? ` (${type})` : ''}`;
	}

	function orderSideLabel(side: Order['side']) {
		return side === 'B' ? 'BUY' : 'SELL';
	}

	function orderSideClass(side: Order['side']) {
		return side === 'B' ? 'badge-success' : 'badge-error';
	}

	function formatOrderFlag(value: boolean) {
		return value ? 'Yes' : 'No';
	}

	function outcomeActiveSpotCoins() {
		const seen: Record<string, true> = {};
		const coins: string[] = [];
		for (const outcome of outcomes.data ?? []) {
			for (const coin of outcomeActiveSpotCoinsFor(outcome)) {
				if (seen[coin]) continue;
				seen[coin] = true;
				coins.push(coin);
			}
		}
		return coins.sort();
	}

	function outcomeActiveSpotCoinsFor(outcome: OutcomeRow) {
		const seen: Record<string, true> = {};
		const coins: string[] = [];
		if (outcome.encoding != null) {
			addOutcomeActiveSpotCoin(coins, seen, `#${outcome.encoding}`);
		}

		const coinEncoding = parseOutcomeEncoding(outcome.coin);
		if (coinEncoding != null) {
			addOutcomeActiveSpotCoin(coins, seen, `#${coinEncoding}`);
		}

		if (Number.isFinite(outcome.token)) {
			addOutcomeActiveSpotCoin(coins, seen, `#${outcome.token}`);
		}

		const assetId = resolveSpotAssetId(outcome.coin, outcome.token);
		if (assetId != null) {
			const spotIndex = assetId - 10000;
			addOutcomeActiveSpotCoin(coins, seen, `#${spotIndex}`);

			const spotInfo = spotUniverseByIndex[spotIndex];
			if (spotInfo?.name?.startsWith('#')) {
				addOutcomeActiveSpotCoin(coins, seen, spotInfo.name);
			}
		}

		return coins;
	}

	function addOutcomeActiveSpotCoin(coins: string[], seen: Record<string, true>, coin: string) {
		if (seen[coin]) return;
		seen[coin] = true;
		coins.push(coin);
	}

	function syncCurrentOutcomeSpotSubscriptions(network: HyperliquidNetwork) {
		syncActiveOutcomeSpotSubscriptions(network, outcomeActiveSpotCoins());
	}

	function syncActiveOutcomeSpotSubscriptions(network: HyperliquidNetwork, coins: string[]) {
		if (activeOutcomeSpotSubscriptionNetwork !== network) {
			clearActiveOutcomeSpotSubscriptions();
			activeOutcomeSpotSubscriptionNetwork = network;
		}

		const desired: Record<string, true> = {};
		for (const coin of coins) desired[coin] = true;

		for (const [coin, entry] of Object.entries(activeOutcomeSpotSubscriptions)) {
			if (desired[coin]) continue;
			void entry.subscription?.unsubscribe();
			delete activeOutcomeSpotSubscriptions[coin];
			const next = { ...activeSpotCtxsByCoin };
			delete next[coin];
			activeSpotCtxsByCoin = next;
		}

		const client = getSubscriptionClient(network);
		for (const coin of coins) {
			if (activeOutcomeSpotSubscriptions[coin]) continue;

			const generation = ++activeOutcomeSpotSubscriptionGeneration;
			activeOutcomeSpotSubscriptions[coin] = { generation, subscription: null };
			void client
				.activeSpotAssetCtx({ coin }, (event) => {
					if (!isActiveOutcomeSpotSubscription(coin, generation)) return;

					const ctx = event.ctx as SpotAssetCtx;
					activeSpotCtxsByCoin = {
						...activeSpotCtxsByCoin,
						[coin]: ctx,
						[event.coin]: ctx,
						[ctx.coin]: ctx
					};
				})
				.then((subscription) => {
					const entry = activeOutcomeSpotSubscriptions[coin];
					if (!entry || entry.generation !== generation) {
						void subscription.unsubscribe();
						return;
					}
					entry.subscription = subscription;
				})
				.catch((err: unknown) => {
					if (!isActiveOutcomeSpotSubscription(coin, generation)) return;
					delete activeOutcomeSpotSubscriptions[coin];
					marketError =
						err instanceof Error ? err.message : `Failed to subscribe to outcome spot ${coin}`;
				});
		}
	}

	function isActiveOutcomeSpotSubscription(coin: string, generation: number) {
		const entry = activeOutcomeSpotSubscriptions[coin];
		return entry?.generation === generation;
	}

	function clearActiveOutcomeSpotSubscriptions() {
		activeOutcomeSpotSubscriptionGeneration += 1;
		for (const entry of Object.values(activeOutcomeSpotSubscriptions)) {
			void entry.subscription?.unsubscribe();
		}
		activeOutcomeSpotSubscriptions = {};
		activeOutcomeSpotSubscriptionNetwork = null;
		activeSpotCtxsByCoin = {};
	}

	function balanceTabHasData() {
		return balances.data !== null || dexBalances.data !== null;
	}

	function balanceTabHasRows() {
		return tableSpotBalances().length + (dexBalances.data?.length ?? 0) > 0;
	}

	function balanceTabLoading() {
		return (balances.loading && !balances.data) || (dexBalances.loading && !dexBalances.data);
	}

	function balanceTabError() {
		return [balances.error, dexBalances.error].filter(Boolean).join(' · ');
	}

	function tabCount(tab: TabId) {
		if (tab === 'account') return null;
		if (tab === 'fills') return null;
		if (tab === 'ledger') return ledgerUpdates.data ? ledgerUpdates.data.length : null;
		if (tab === 'lending') return userLending.data ? lendingActiveRows.length : null;
		if (tab === 'staking') return userStaking.data ? stakingDelegationRows.length : null;
		if (tab === 'balances') return balanceTabHasData() ? balanceTableRows().length : null;
		if (tab === 'positions') return positions.data ? positionTableRows().length : null;
		if (tab === 'orders') return orders.data ? orderTableRows().length : null;
		if (tab === 'outcomes') return outcomes.data ? outcomeTableRows().length : null;
		if (tab === 'agents') {
			return agentWallets.data || savedAgentWallets.length > 0 ? agentTableRows().length : null;
		}
		return approvedBuilders.data ? builderTableRows().length : null;
	}

	function accountTabHasData() {
		return userRole.data !== null || userReferral.data !== null || userFees.data !== null;
	}

	function accountTabLoading() {
		return (
			(userRole.loading && !userRole.data) ||
			(userReferral.loading && !userReferral.data) ||
			(userFees.loading && !userFees.data)
		);
	}

	function accountTabError() {
		return [userRole.error, userReferral.error, userFees.error].filter(Boolean).join(' · ');
	}

	function balanceKey(balance: SpotBal, index: number) {
		return balance.token == null ? `unknown:${balance.coin}:${index}` : `token:${balance.token}`;
	}

	function dexBalanceKey(balance: DexBalance, index: number) {
		return balance.unified ? 'dex:unified' : `dex:${balance.dex || 'main'}:${index}`;
	}

	function positionKey(position: AssetPos, index: number) {
		return position.position.coin
			? `${position.dex}:${position.position.coin}`
			: `${position.dex}:unknown:${index}`;
	}

	function orderKey(order: Order, index: number) {
		return order.oid == null
			? `${order.dex ?? ''}:unknown:${order.coin}:${order.side}:${order.limitPx}:${index}`
			: `${order.dex ?? ''}:${order.oid}:${order.coin}:${order.side}`;
	}

	function outcomeKey(outcome: OutcomeRow, index: number) {
		return outcome.token == null
			? `unknown:${outcome.coin}:${outcome.outcomeName}:${outcome.sideName}:${index}`
			: `token:${outcome.token}`;
	}

	function fillKey(fill: Fill, index: number) {
		if (fill.tid != null) return `tid:${fill.tid}`;
		if (fill.hash && fill.oid != null) return `${fill.hash}:${fill.oid}:${index}`;
		return `${fill.time}:${fill.coin}:${fill.side}:${fill.px}:${fill.sz}:${index}`;
	}

	function ledgerKey(update: LedgerUpdate, index: number) {
		return `${update.hash}:${update.time}:${update.delta.type}:${index}`;
	}

	function reloadAll() {
		clearActiveOutcomeSpotSubscriptions();
		accountRateLimitGeneration += 1;
		userRoleGeneration += 1;
		userReferralGeneration += 1;
		userFeesGeneration += 1;
		userStakingGeneration += 1;
		userLendingGeneration += 1;
		ledgerGeneration += 1;
		agentWalletGeneration += 1;
		builderGeneration += 1;
		clearSlot(accountRateLimit);
		clearSlot(userRole);
		clearSlot(userReferral);
		clearSlot(userFees);
		clearSlot(userStaking);
		clearSlot(userLending);
		clearSlot(balances);
		clearSlot(dexBalances);
		clearSlot(positions);
		clearSlot(orders);
		clearSlot(outcomes);
		clearSlot(fills);
		clearSlot(ledgerUpdates);
		clearSlot(agentWallets);
		clearSlot(approvedBuilders);
		reserveActionError = null;
		reserveActionNotice = null;
		reserveCurl = null;
		l1SignaturePrompt = null;
		l1ChainSwitching = false;
		agentActionError = null;
		agentActionNotice = null;
		agentCurl = null;
		builderActionError = null;
		builderActionNotice = null;
		builderCurl = null;
		resetLedgerPagination();
		userStreamKey += 1;
		marketStreamKey += 1;
	}

	function trackedWalletDialogController(node: HTMLDialogElement) {
		$effect(() => {
			if (trackedWalletModalOpen && !node.open) node.showModal();
			else if (!trackedWalletModalOpen && node.open) node.close();
		});
	}

	function openTrackedWalletEditor() {
		if (!activeAddress) return;
		trackedWalletNameInput = trackedWalletName ?? '';
		trackedWalletAddressInput = activeAddress;
		trackedWalletEditorError = null;
		trackedWalletModalOpen = true;
	}

	function closeTrackedWalletEditor() {
		trackedWalletModalOpen = false;
		trackedWalletNameInput = '';
		trackedWalletAddressInput = '';
		trackedWalletEditorError = null;
	}

	function saveTrackedWallet(event: SubmitEvent) {
		event.preventDefault();
		const trimmed = trackedWalletAddressInput.trim();
		if (!isAddress(trimmed)) {
			trackedWalletEditorError = 'Enter a valid EVM address.';
			return;
		}

		views.updateProps(viewId, {
			address: getAddress(trimmed),
			name: normalizeTrackedWalletName(trackedWalletNameInput)
		});
		closeTrackedWalletEditor();
	}

	function openAgentImportModal() {
		agentActionError = null;
		agentActionNotice = null;
		agentImportModalOpen = true;
	}

	function closeAgentImportModal() {
		agentImportModalOpen = false;
		agentImportNameInput = '';
		agentImportPrivateKeyInput = '';
	}

	function submitImportAgentWalletPrivateKey(event: SubmitEvent) {
		event.preventDefault();
		importAgentWalletPrivateKey();
	}

	function formatUserRole(role: UserRole['role']) {
		if (role === 'subAccount') return 'Sub-account';
		if (role === 'agent') return 'Agent wallet';
		return role.charAt(0).toUpperCase() + role.slice(1);
	}

	function getUserRoleDetail(role: UserRole | null) {
		if (!role) return null;
		if (role.role === 'agent') {
			return { label: 'Root user', address: role.data.user };
		}
		if (role.role === 'subAccount') {
			return { label: 'Master account', address: role.data.master };
		}
		return null;
	}

	async function loadUserRole(
		user: Address,
		network: HyperliquidNetwork,
		generation = ++userRoleGeneration
	) {
		setLoading(userRole);
		try {
			const data = (await getHttpInfoClient(network).userRole({ user })) as UserRole;
			if (generation !== userRoleGeneration) return;
			userRole.data = data;
			userRole.error = null;
			userRole.loading = false;
		} catch (err) {
			if (generation !== userRoleGeneration) return;
			userRole.loading = false;
			userRole.error = err instanceof Error ? err.message : 'Failed to load user role.';
		}
	}

	async function loadUserReferral(
		user: Address,
		network: HyperliquidNetwork,
		generation = ++userReferralGeneration
	) {
		setLoading(userReferral);
		try {
			const data = (await getHttpInfoClient(network).referral({ user })) as UserReferral;
			if (generation !== userReferralGeneration) return;
			userReferral.data = data;
			userReferral.error = null;
			userReferral.loading = false;
		} catch (err) {
			if (generation !== userReferralGeneration) return;
			userReferral.loading = false;
			userReferral.error = err instanceof Error ? err.message : 'Failed to load referral info.';
		}
	}

	async function loadUserFees(
		user: Address,
		network: HyperliquidNetwork,
		generation = ++userFeesGeneration
	) {
		setLoading(userFees);
		try {
			const data = (await getHttpInfoClient(network).userFees({ user })) as UserFees;
			if (generation !== userFeesGeneration) return;
			userFees.data = data;
			userFees.error = null;
			userFees.loading = false;
		} catch (err) {
			if (generation !== userFeesGeneration) return;
			userFees.loading = false;
			userFees.error = err instanceof Error ? err.message : 'Failed to load user fees.';
		}
	}

	function getUserFeesOverview(data: UserFees | null) {
		if (!data) return null;
		let takerVolume = 0;
		let makerVolume = 0;
		let exchangeVolume = 0;
		for (const row of data.dailyUserVlm) {
			takerVolume += toNumber(row.userCross) ?? 0;
			makerVolume += toNumber(row.userAdd) ?? 0;
			exchangeVolume += toNumber(row.exchange) ?? 0;
		}
		const sortedDates = data.dailyUserVlm
			.map((row) => row.date)
			.filter(Boolean)
			.sort();

		return {
			takerVolume,
			makerVolume,
			totalVolume: takerVolume + makerVolume,
			exchangeVolume,
			activeReferralDiscount: toNumber(data.activeReferralDiscount),
			activeStakingDiscount: toNumber(data.activeStakingDiscount.discount),
			activeStakingTierBps: toNumber(data.activeStakingDiscount.bpsOfMaxSupply),
			feeTrialEscrow: toNumber(data.feeTrialEscrow ?? data.feeTrialReward),
			nextTrialAvailableTimestamp: toTimestamp(data.nextTrialAvailableTimestamp),
			firstDate: sortedDates[0] ?? null,
			lastDate: sortedDates.at(-1) ?? null
		};
	}

	function getUserFeeVolumeRows(data: UserFees | null) {
		if (!data) return [];
		return [...data.dailyUserVlm].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 7);
	}

	function getUserReferralOverview(data: UserReferral | null) {
		if (!data) return null;
		const referrerState = data.referrerState;
		const referralStates = referrerState.stage === 'ready' ? referrerState.data.referralStates : [];
		return {
			cumVlm: toNumber(data.cumVlm),
			unclaimedRewards: toNumber(data.unclaimedRewards),
			claimedRewards: toNumber(data.claimedRewards),
			builderRewards: toNumber(data.builderRewards),
			referrerStage: referrerState.stage,
			referrerCode: referrerState.stage === 'ready' ? referrerState.data.code : null,
			nReferrals:
				referrerState.stage === 'ready'
					? (referrerState.data.nReferrals ?? referralStates.length)
					: 0,
			requiredVolume:
				referrerState.stage === 'needToTrade' ? toNumber(referrerState.data.required) : null,
			rewardHistoryCount: data.rewardHistory.length
		};
	}

	function getUserReferralRows(data: UserReferral | null) {
		if (!data || data.referrerState.stage !== 'ready') return [];
		return [...data.referrerState.data.referralStates]
			.sort((a, b) => (toNumber(b.cumVlm) ?? 0) - (toNumber(a.cumVlm) ?? 0))
			.slice(0, 6);
	}

	function getUserReferralRewardRows(data: UserReferral | null) {
		if (!data) return [];
		return [...data.rewardHistory].sort((a, b) => b.time - a.time).slice(0, 6);
	}

	function toTimestamp(value: unknown) {
		if (typeof value === 'number' && Number.isFinite(value)) return value;
		if (typeof value === 'string') {
			const parsed = Number(value);
			return Number.isFinite(parsed) ? parsed : null;
		}
		return null;
	}

	function referrerStageLabel(stage: UserReferral['referrerState']['stage']) {
		if (stage === 'ready') return 'Ready';
		if (stage === 'needToCreateCode') return 'Needs code';
		return 'Needs trade';
	}

	function getStakingOverview(data: UserStakingData | null, fees: UserFees | null) {
		if (!data) return null;
		const delegated = toNumber(data.summary.delegated) ?? 0;
		const undelegated = toNumber(data.summary.undelegated) ?? 0;
		const pending = toNumber(data.summary.totalPendingWithdrawal) ?? 0;
		const rewards = getStakingRewardSummary(data);
		const lockedDelegations = data.delegations.filter(
			(delegation) => delegation.lockedUntilTimestamp > Date.now()
		);
		const nextUnlock =
			lockedDelegations.length === 0
				? null
				: Math.min(...lockedDelegations.map((delegation) => delegation.lockedUntilTimestamp));

		return {
			delegated,
			undelegated,
			pending,
			total: delegated + undelegated + pending,
			nPendingWithdrawals: data.summary.nPendingWithdrawals,
			nValidators: data.delegations.length,
			nLockedDelegations: lockedDelegations.length,
			nextUnlock,
			totalRewards: rewards.total,
			activeStakingDiscount: toNumber(fees?.activeStakingDiscount.discount),
			activeStakingTierBps: toNumber(fees?.activeStakingDiscount.bpsOfMaxSupply),
			hasActivity:
				delegated > 0 ||
				undelegated > 0 ||
				pending > 0 ||
				data.delegations.length > 0 ||
				data.history.length > 0 ||
				data.rewards.length > 0
		};
	}

	function getStakingDelegationRows(data: UserStakingData | null): StakingDelegationRow[] {
		if (!data) return [];
		const validators = validatorSummaryIndex(data.validators);
		return [...data.delegations]
			.map((delegation) => {
				const validator = validators[delegation.validator.toLowerCase()] ?? null;
				return {
					...delegation,
					amountValue: toNumber(delegation.amount),
					validatorName: validator?.name?.trim() || null,
					isActive: validator?.isActive ?? null,
					isJailed: validator?.isJailed ?? null,
					commission: toNumber(validator?.commission),
					monthApr: toNumber(validatorStat(validator, 'month')?.predictedApr),
					weekUptime: toNumber(validatorStat(validator, 'week')?.uptimeFraction)
				};
			})
			.sort((a, b) => (b.amountValue ?? 0) - (a.amountValue ?? 0));
	}

	function getStakingHistoryRows(data: UserStakingData | null) {
		if (!data) return [];
		return [...data.history].sort((a, b) => b.time - a.time).slice(0, 8);
	}

	function getStakingRewardRows(data: UserStakingData | null) {
		if (!data) return [];
		return [...data.rewards].sort((a, b) => b.time - a.time).slice(0, 8);
	}

	function getStakingRewardSummary(data: UserStakingData | null) {
		const summary = {
			total: 0,
			delegation: 0,
			commission: 0,
			latestTime: null as number | null
		};
		if (!data) return summary;

		for (const reward of data.rewards) {
			const amount = toNumber(reward.totalAmount) ?? 0;
			summary.total += amount;
			if (reward.source === 'commission') summary.commission += amount;
			else summary.delegation += amount;
			if (summary.latestTime == null || reward.time > summary.latestTime) {
				summary.latestTime = reward.time;
			}
		}
		return summary;
	}

	function validatorSummaryIndex(validators: ValidatorSummary[]) {
		const index: Record<string, ValidatorSummary> = {};
		for (const validator of validators) index[validator.validator.toLowerCase()] = validator;
		return index;
	}

	function validatorStat(validator: ValidatorSummary | null, period: 'day' | 'week' | 'month') {
		return validator?.stats.find(([rowPeriod]) => rowPeriod === period)?.[1] ?? null;
	}

	function stakingHistoryAction(row: DelegatorHistoryItem) {
		if ('delegate' in row.delta) return row.delta.delegate.isUndelegate ? 'Undelegate' : 'Delegate';
		if ('cDeposit' in row.delta) return 'Spot to staking';
		return row.delta.withdrawal.phase === 'initiated' ? 'Withdrawal queued' : 'Withdrawal done';
	}

	function stakingHistoryAmount(row: DelegatorHistoryItem) {
		if ('delegate' in row.delta) return toNumber(row.delta.delegate.amount);
		if ('cDeposit' in row.delta) return toNumber(row.delta.cDeposit.amount);
		return toNumber(row.delta.withdrawal.amount);
	}

	function stakingHistoryValidator(row: DelegatorHistoryItem) {
		return 'delegate' in row.delta ? row.delta.delegate.validator : null;
	}

	function stakingHistoryBadgeClass(row: DelegatorHistoryItem) {
		if ('delegate' in row.delta) {
			return row.delta.delegate.isUndelegate ? 'badge-warning' : 'badge-success';
		}
		if ('cDeposit' in row.delta) return 'badge-info';
		return row.delta.withdrawal.phase === 'initiated' ? 'badge-warning' : 'badge-success';
	}

	function stakingValidatorStatus(row: StakingDelegationRow) {
		if (row.isJailed) return 'Jailed';
		if (row.isActive === true) return 'Active';
		if (row.isActive === false) return 'Inactive';
		return 'Unknown';
	}

	function stakingValidatorStatusClass(row: StakingDelegationRow) {
		if (row.isJailed) return 'badge-error';
		if (row.isActive === true) return 'badge-success';
		if (row.isActive === false) return 'badge-warning';
		return 'badge-ghost';
	}

	function stakingLinkLabel(type: 'requested' | 'stakingUser' | 'tradingUser') {
		if (type === 'requested') return 'Link requested';
		if (type === 'stakingUser') return 'Trading account';
		return 'Staking account';
	}

	function stakingDelegationLockLabel(lockedUntilTimestamp: number) {
		return lockedUntilTimestamp > Date.now() ? 'Locked' : 'Unlocked';
	}

	function formatHypeAmount(value: number | null) {
		return value == null ? '—' : `${formatTokenAmount(value)} HYPE`;
	}

	function formatFractionPercent(value: number | null) {
		return value == null ? '—' : `${percentFormatter.format(value * 100)}%`;
	}

	function formatBps(value: number | null) {
		return value == null ? '—' : `${formatTokenAmount(value)} bps`;
	}

	function borrowLendTokenName(tokenId: number) {
		return (
			spotTokenByIndex[tokenId]?.name ?? spotTokenByIndex[tokenId]?.fullName ?? `Token ${tokenId}`
		);
	}

	function getLendingPositionRows(data: UserLendingData | null): LendingPositionRow[] {
		if (!data) return [];
		return data.userState.tokenToState
			.map(([tokenId, state]) => {
				const supplyValue = toNumber(state.supply.value);
				const borrowValue = toNumber(state.borrow.value);

				return {
					tokenId,
					tokenName: borrowLendTokenName(tokenId),
					supplyBasis: toNumber(state.supply.basis),
					supplyValue,
					borrowBasis: toNumber(state.borrow.basis),
					borrowValue,
					netValue:
						supplyValue == null && borrowValue == null
							? null
							: (supplyValue ?? 0) - (borrowValue ?? 0)
				};
			})
			.sort((a, b) => {
				const aActive = hasLendingActivity(a) ? 1 : 0;
				const bActive = hasLendingActivity(b) ? 1 : 0;
				if (aActive !== bActive) return bActive - aActive;
				return (
					Math.abs(b.netValue ?? 0) - Math.abs(a.netValue ?? 0) ||
					a.tokenName.localeCompare(b.tokenName)
				);
			});
	}

	function hasLendingActivity(row: LendingPositionRow) {
		return (
			Math.abs(row.supplyValue ?? 0) > 0 ||
			Math.abs(row.borrowValue ?? 0) > 0 ||
			Math.abs(row.supplyBasis ?? 0) > 0 ||
			Math.abs(row.borrowBasis ?? 0) > 0
		);
	}

	function getLendingOverview(data: UserLendingData | null, rows: LendingPositionRow[]) {
		if (!data) return null;
		return {
			health: data.userState.health,
			healthFactor: data.userState.healthFactor,
			supplyTokens: rows.filter((row) => Math.abs(row.supplyValue ?? 0) > 0).length,
			borrowTokens: rows.filter((row) => Math.abs(row.borrowValue ?? 0) > 0).length,
			activeTokens: rows.length
		};
	}

	function getLendingInterestRows(data: UserLendingData | null) {
		if (!data) return [];
		return [...data.interest].sort((a, b) => b.time - a.time).slice(0, 12);
	}

	function getLendingInterestSummary(data: UserLendingData | null) {
		const summary = {
			supplyEvents: 0,
			borrowEvents: 0,
			netEvents: 0,
			latestTime: null as number | null
		};
		if (!data) return summary;

		for (const row of data.interest) {
			const supplyValue = toNumber(row.supply) ?? 0;
			const borrowValue = toNumber(row.borrow) ?? 0;
			if (supplyValue !== 0) summary.supplyEvents += 1;
			if (borrowValue !== 0) summary.borrowEvents += 1;
			if (supplyValue !== 0 || borrowValue !== 0) summary.netEvents += 1;
			if (summary.latestTime == null || row.time > summary.latestTime) {
				summary.latestTime = row.time;
			}
		}

		return summary;
	}

	function formatTokenValue(value: number | null, token: string) {
		return value == null ? '—' : `${formatTokenAmount(value)} ${token}`;
	}

	function formatHealthFactor(value: string | number | null) {
		if (value == null) return 'N/A';
		const parsed = toNumber(value);
		return parsed == null ? String(value) : formatTokenAmount(parsed);
	}

	async function loadUserLending(
		user: Address,
		network: HyperliquidNetwork,
		generation = ++userLendingGeneration
	) {
		setLoading(userLending);
		try {
			const client = getHttpInfoClient(network);
			const startTime = Date.now() - BORROW_LEND_INTEREST_LOOKBACK_MS;
			const [userState, interest] = await Promise.all([
				client.borrowLendUserState({ user }) as Promise<BorrowLendUserState>,
				client.userBorrowLendInterest({ user, startTime }).catch(() => []) as Promise<
					BorrowLendInterest[]
				>
			]);

			if (generation !== userLendingGeneration) return;
			userLending.data = { userState, interest };
			userLending.error = null;
			userLending.loading = false;
		} catch (err) {
			if (generation !== userLendingGeneration) return;
			userLending.loading = false;
			userLending.error =
				err instanceof Error ? err.message : 'Failed to load user lending summary.';
		}
	}

	async function loadLedgerUpdatesPage(
		user: Address,
		network: HyperliquidNetwork,
		pageIndex = ledgerPageIndex,
		endTime: LedgerPageCursor = ledgerPageCursors[pageIndex] ?? null,
		generation = ++ledgerGeneration
	) {
		setLoading(ledgerUpdates);
		try {
			const params = endTime == null ? { user } : { user, endTime };
			const data = (await getHttpInfoClient(network).userNonFundingLedgerUpdates(
				params
			)) as LedgerUpdate[];
			if (generation !== ledgerGeneration) return;
			ledgerPageIndex = pageIndex;
			ledgerUpdates.data = data;
			ledgerUpdates.error = null;
			ledgerUpdates.loading = false;
		} catch (err) {
			if (generation !== ledgerGeneration) return;
			ledgerUpdates.loading = false;
			ledgerUpdates.error = err instanceof Error ? err.message : 'Failed to load ledger updates.';
		}
	}

	async function refreshLedgerUpdates(user = activeAddress, network = hyperliquidNetwork.current) {
		if (!user || ledgerUpdates.loading) return;
		await loadLedgerUpdatesPage(
			user,
			network,
			ledgerPageIndex,
			ledgerPageCursors[ledgerPageIndex] ?? null,
			++ledgerGeneration
		);
	}

	async function loadNewerLedgerUpdates(
		user = activeAddress,
		network = hyperliquidNetwork.current
	) {
		if (!user || ledgerUpdates.loading || !ledgerCanLoadNewer()) return;
		const pageIndex = Math.max(0, ledgerPageIndex - 1);
		await loadLedgerUpdatesPage(
			user,
			network,
			pageIndex,
			ledgerPageCursors[pageIndex] ?? null,
			++ledgerGeneration
		);
	}

	async function loadOlderLedgerUpdates(
		user = activeAddress,
		network = hyperliquidNetwork.current
	) {
		if (!user || ledgerUpdates.loading || !ledgerCanLoadOlder()) return;
		const endTime = ledgerOlderEndTime();
		if (endTime == null) return;

		const pageIndex = ledgerPageIndex + 1;
		ledgerPageCursors = [...ledgerPageCursors.slice(0, pageIndex), endTime];
		await loadLedgerUpdatesPage(user, network, pageIndex, endTime, ++ledgerGeneration);
	}

	function ledgerCanLoadNewer() {
		return ledgerPageIndex > 0;
	}

	function ledgerCanLoadOlder() {
		return (ledgerUpdates.data?.length ?? 0) >= LEDGER_PAGE_LIMIT && ledgerOlderEndTime() !== null;
	}

	function ledgerOlderEndTime() {
		const times = (ledgerUpdates.data ?? [])
			.map((row) => toNumber(row.time))
			.filter((time): time is number => time !== null);
		if (times.length === 0) return null;

		const oldest = Math.min(...times);
		return oldest > 0 ? oldest - 1 : null;
	}

	function ledgerRangeLabel() {
		const times = (ledgerUpdates.data ?? [])
			.map((row) => toNumber(row.time))
			.filter((time): time is number => time !== null);
		if (times.length === 0) return `Page ${ledgerPageIndex + 1}`;

		const oldest = Math.min(...times);
		const newest = Math.max(...times);
		const range = oldest === newest ? fmtTs(newest) : `${fmtTs(oldest)} to ${fmtTs(newest)}`;
		return `Page ${ledgerPageIndex + 1} · ${range}`;
	}

	async function loadUserStaking(
		user: Address,
		network: HyperliquidNetwork,
		generation = ++userStakingGeneration
	) {
		setLoading(userStaking);
		try {
			const client = getHttpInfoClient(network);
			const [summary, delegations, history, rewards] = await Promise.all([
				client.delegatorSummary({ user }) as Promise<DelegatorSummary>,
				client.delegations({ user }) as Promise<StakingDelegation[]>,
				client.delegatorHistory({ user }) as Promise<DelegatorHistoryItem[]>,
				client.delegatorRewards({ user }) as Promise<DelegatorReward[]>
			]);
			const validators =
				delegations.length === 0
					? []
					: ((await client.validatorSummaries().catch(() => [])) as ValidatorSummary[]);

			if (generation !== userStakingGeneration) return;
			userStaking.data = { summary, delegations, history, rewards, validators };
			userStaking.error = null;
			userStaking.loading = false;
		} catch (err) {
			if (generation !== userStakingGeneration) return;
			userStaking.loading = false;
			userStaking.error =
				err instanceof Error ? err.message : 'Failed to load user staking summary.';
		}
	}

	async function loadUserRateLimit(
		user: Address,
		network: HyperliquidNetwork,
		generation = ++accountRateLimitGeneration
	) {
		setLoading(accountRateLimit);
		try {
			const data = (await getHttpInfoClient(network).userRateLimit({ user })) as UserRateLimit;
			if (generation !== accountRateLimitGeneration) return;
			accountRateLimit.data = data;
			accountRateLimit.error = null;
			accountRateLimit.loading = false;
		} catch (err) {
			if (generation !== accountRateLimitGeneration) return;
			accountRateLimit.loading = false;
			accountRateLimit.error =
				err instanceof Error ? err.message : 'Failed to load user rate limits.';
		}
	}

	async function refreshUserRateLimit(user = activeAddress, network = hyperliquidNetwork.current) {
		if (!user) return;
		await loadUserRateLimit(user, network, ++accountRateLimitGeneration);
	}

	async function loadAgentWallets(
		user: Address,
		network: HyperliquidNetwork,
		generation = ++agentWalletGeneration
	) {
		setLoading(agentWallets);
		try {
			const data = (await getHttpInfoClient(network).extraAgents({ user })) as AgentWallet[];
			if (generation !== agentWalletGeneration) return;
			agentWallets.data = data;
			agentWallets.error = null;
			agentWallets.loading = false;
		} catch (err) {
			if (generation !== agentWalletGeneration) return;
			setError(agentWallets, err);
		}
	}

	async function refreshAgentWallets(user = activeAddress, network = hyperliquidNetwork.current) {
		if (!user) return;
		await loadAgentWallets(user, network, ++agentWalletGeneration);
	}

	async function loadApprovedBuilders(
		user: Address,
		network: HyperliquidNetwork,
		generation = ++builderGeneration
	) {
		setLoading(approvedBuilders);
		try {
			const info = getHttpInfoClient(network);
			const addresses = (await info.approvedBuilders({ user })) as `0x${string}`[];
			const rows = await Promise.all(
				addresses.map(async (address) => {
					try {
						return {
							address,
							maxFee: (await info.maxBuilderFee({ user, builder: address })) as number
						};
					} catch {
						return { address, maxFee: null };
					}
				})
			);
			if (generation !== builderGeneration) return;
			approvedBuilders.data = rows;
			approvedBuilders.error = null;
			approvedBuilders.loading = false;
		} catch (err) {
			if (generation !== builderGeneration) return;
			setError(approvedBuilders, err);
		}
	}

	async function refreshApprovedBuilders(
		user = activeAddress,
		network = hyperliquidNetwork.current
	) {
		if (!user) return;
		await loadApprovedBuilders(user, network, ++builderGeneration);
	}

	function requireSigningWallet(action = 'sign this action') {
		const signingWallet = wallet.getSigningWallet();
		if (!signingWallet || !canSignForActiveAddress) {
			throw new Error(`Connect the tracked wallet as an injected root wallet to ${action}.`);
		}
		return signingWallet;
	}

	async function requireL1SigningWallet(action = 'sign this action') {
		const signingWallet = requireSigningWallet(action);
		const chainId = await signingWallet.getChainId();
		if (chainId === HYPERLIQUID_L1_CHAIN_ID) return signingWallet;

		l1SignaturePrompt = `Switching wallet to Hyperliquid L1 for ${action}.`;
		l1ChainSwitching = true;
		try {
			await wallet.switchChain({
				chainId: HYPERLIQUID_L1_SIGNATURE_CHAIN_ID,
				addEthereumChainParameter: HYPERLIQUID_L1_ADD_ETHEREUM_CHAIN_PARAMETER
			});
		} finally {
			l1SignaturePrompt = null;
			l1ChainSwitching = false;
		}

		const nextChainId = await signingWallet.getChainId();
		if (nextChainId !== HYPERLIQUID_L1_CHAIN_ID) {
			throw new Error(`Switch wallet to Hyperliquid L1 before you ${action}.`);
		}
		return signingWallet;
	}

	function recordAgentRequest(request: RecordedExchangeRequest) {
		if (request.endpoint !== 'exchange') return;
		agentCurl = requestToCurl(request);
	}

	function recordReserveRequest(request: RecordedExchangeRequest) {
		if (request.endpoint !== 'exchange') return;
		reserveCurl = requestToCurl(request);
	}

	function recordBuilderRequest(request: RecordedExchangeRequest) {
		if (request.endpoint !== 'exchange') return;
		builderCurl = requestToCurl(request);
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

	function clampReserveWeight(value: number | string) {
		const parsed = Number(value);
		if (!Number.isFinite(parsed)) return 1;
		return Math.min(1844674407370955, Math.max(1, Math.floor(parsed)));
	}

	function normalizeBuilderFeeRate(value: string) {
		const trimmed = value.trim();
		const withoutPercent = trimmed.endsWith('%') ? trimmed.slice(0, -1).trim() : trimmed;
		if (!/^[0-9]+(\.[0-9]+)?$/.test(withoutPercent)) return null;
		const parsed = Number(withoutPercent);
		if (!Number.isFinite(parsed) || parsed < 0) return null;
		return `${withoutPercent}%` as `${string}%`;
	}

	async function reserveRequestWeight() {
		const user = activeAddress;
		const network = hyperliquidNetwork.current;
		if (!user || reserveActionLoading) return;

		const weight = clampReserveWeight(reserveWeightInput);
		reserveWeightInput = weight;
		reserveActionLoading = true;
		reserveActionError = null;
		reserveActionNotice = null;
		reserveCurl = null;

		try {
			const signingWallet = await requireL1SigningWallet('reserve request weight');
			await getExchangeClient(signingWallet, network, recordReserveRequest).reserveRequestWeight({
				weight
			});
			reserveActionNotice = `Reserved ${formatInteger(weight)} request weight.`;
			await refreshUserRateLimit(user, network);
		} catch (err) {
			reserveActionError = err instanceof Error ? err.message : 'Failed to reserve request weight.';
		} finally {
			reserveActionLoading = false;
		}
	}

	function submitReserveRequestWeight(event: SubmitEvent) {
		event.preventDefault();
		void reserveRequestWeight();
	}

	async function approveBuilder() {
		const user = activeAddress;
		const network = hyperliquidNetwork.current;
		if (!user || builderActionLoading) return;

		const builder = builderAddressInput.trim();
		if (!isAddress(builder)) {
			builderActionError = 'Enter a valid builder address.';
			return;
		}

		const maxFeeRate = normalizeBuilderFeeRate(builderMaxFeeRateInput);
		if (!maxFeeRate) {
			builderActionError = 'Enter a valid max fee rate, e.g. 0.01%.';
			return;
		}

		builderAddressInput = getAddress(builder);
		builderMaxFeeRateInput = maxFeeRate;
		builderActionLoading = true;
		builderActionError = null;
		builderActionNotice = null;
		builderCurl = null;

		try {
			const signingWallet = await requireL1SigningWallet('approve builder fees');
			await getExchangeClient(signingWallet, network, recordBuilderRequest).approveBuilderFee({
				builder: getAddress(builder),
				maxFeeRate
			});
			builderActionNotice = `Builder approved with max fee ${maxFeeRate}.`;
			builderAddressInput = '';
			await refreshApprovedBuilders(user, network);
		} catch (err) {
			builderActionError = err instanceof Error ? err.message : 'Failed to approve builder.';
		} finally {
			builderActionLoading = false;
		}
	}

	function submitApproveBuilder(event: SubmitEvent) {
		event.preventDefault();
		void approveBuilder();
	}

	async function addAgentWallet() {
		const user = activeAddress;
		const network = hyperliquidNetwork.current;
		if (!user || agentActionLoading) return;

		const name = sanitizeAgentName(agentNameInput);
		if (!name) {
			agentActionError = 'Enter an agent name.';
			return;
		}
		if (!agentStorageAck) {
			agentActionError = 'Acknowledge local private-key storage before creating an agent.';
			return;
		}

		const validDays = clampAgentValidDays(agentValidDays);
		agentValidDays = validDays;
		const validUntil = Date.now() + validDays * 24 * 60 * 60 * 1000;
		const privateKey = generatePrivateKey();
		const agentAccount = privateKeyToAccount(privateKey);
		agentActionLoading = 'add';
		agentActionError = null;
		agentActionNotice = null;
		agentCurl = null;

		try {
			const signingWallet = await requireL1SigningWallet('manage agent wallets');
			await getExchangeClient(signingWallet, network, recordAgentRequest).approveAgent({
				agentAddress: agentAccount.address,
				agentName: agentApprovalName(name, validUntil)
			});
			upsertSavedAgentWallet(user, network, {
				address: agentAccount.address,
				name,
				privateKey,
				createdAt: Date.now(),
				validUntil
			});
			agentActionNotice = 'Agent wallet added and private key saved locally.';
			agentStorageAck = false;
			await refreshAgentWallets(user, network);
		} catch (err) {
			agentActionError = err instanceof Error ? err.message : 'Failed to add agent wallet.';
		} finally {
			agentActionLoading = null;
		}
	}

	function importAgentWalletPrivateKey() {
		const user = activeAddress;
		const network = hyperliquidNetwork.current;
		if (!user || agentActionLoading) return;

		agentActionLoading = 'import';
		agentActionError = null;
		agentActionNotice = null;
		agentCurl = null;

		try {
			if (!agentStorageAck) {
				throw new Error('Acknowledge local private-key storage before importing an agent.');
			}
			const privateKey = normalizePrivateKeyInput(agentImportPrivateKeyInput);
			const agentAccount = privateKeyToAccount(privateKey);
			const name =
				sanitizeAgentName(agentImportNameInput) || `imported-${agentAccount.address.slice(2, 8)}`;
			const validDays = clampAgentValidDays(agentValidDays);
			agentValidDays = validDays;
			upsertSavedAgentWallet(user, network, {
				address: agentAccount.address,
				name,
				privateKey,
				createdAt: Date.now(),
				validUntil: Date.now() + validDays * 24 * 60 * 60 * 1000
			});
			agentImportNameInput = '';
			agentImportPrivateKeyInput = '';
			agentImportModalOpen = false;
			agentStorageAck = false;
			agentActionNotice = 'Agent private key saved locally.';
		} catch (err) {
			agentActionError = err instanceof Error ? err.message : 'Failed to import agent private key.';
		} finally {
			agentActionLoading = null;
		}
	}

	async function removeAgentWallet(row: AgentTableRow) {
		const user = activeAddress;
		const network = hyperliquidNetwork.current;
		if (!user || agentActionLoading) return;

		if (!row.registered) {
			forgetSavedAgentWallet(user, network, row.address);
			agentActionNotice = 'Local private key removed.';
			return;
		}

		const name = row.approvalName ? sanitizeAgentName(row.approvalName) : '';
		if (!name) {
			agentActionError = 'Unnamed agents cannot be removed from this view.';
			return;
		}
		if (
			!confirm(
				`Remove agent ${name}? This signs an approval with the zero address for that agent name.`
			)
		) {
			return;
		}

		agentActionLoading = row.address;
		agentActionError = null;
		agentActionNotice = null;
		agentCurl = null;

		try {
			const signingWallet = await requireL1SigningWallet('manage agent wallets');
			await getExchangeClient(signingWallet, network, recordAgentRequest).approveAgent({
				agentAddress: ZERO_AGENT_ADDRESS,
				agentName: name
			});
			forgetSavedAgentWallet(user, network, row.address);
			agentActionNotice = 'Agent removal submitted.';
			await refreshAgentWallets(user, network);
		} catch (err) {
			agentActionError = err instanceof Error ? err.message : 'Failed to remove agent wallet.';
		} finally {
			agentActionLoading = null;
		}
	}

	async function loadPerpMetadata(network: HyperliquidNetwork, generation: number) {
		const info = getInfoClient(network);
		const [dexs, metas] = await Promise.all([info.perpDexs(), info.allPerpMetas()]);
		if (generation !== marketGeneration) return;

		const next: Record<string, PerpUniverse[]> = {};
		const assetIds: Partial<Record<string, number>> = {};
		for (let i = 0; i < metas.length; i += 1) {
			const dex = dexs[i]?.name ?? '';
			const universe = metas[i].universe;
			next[dex] = universe;
			for (let index = 0; index < universe.length; index += 1) {
				const coin = universe[index]?.name;
				if (!coin) continue;
				if (dex) {
					assetIds[symbolKey(`${dex}:${coin}`)] = 100000 + i * 10000 + index;
				} else {
					assetIds[symbolKey(coin)] = index;
				}
			}
		}
		perpUniverseByDex = next;
		perpAssetIdBySymbol = assetIds;
	}

	async function loadSpotMetadata(network: HyperliquidNetwork, generation: number) {
		const meta = await getInfoClient(network).spotMeta();
		if (generation !== marketGeneration) return;

		const tokensByIndex: Partial<Record<number, SpotTokenMeta>> = {};
		for (const token of meta.tokens) {
			tokensByIndex[token.index] = {
				index: token.index,
				name: token.name,
				fullName: token.fullName,
				evmContract: token.evmContract
			};
		}

		const universeByIndex: Partial<Record<number, SpotUniverse>> = {};
		const assetIdsBySymbol: Partial<Record<string, number>> = {};
		const assetIdsByToken: Partial<Record<number, number>> = {};
		for (const spotInfo of meta.universe) {
			const assetId = 10000 + spotInfo.index;
			const base = tokensByIndex[spotInfo.tokens[0]]?.name;
			const quote = tokensByIndex[spotInfo.tokens[1]]?.name;
			const baseTokenIndex = spotInfo.tokens[0];
			universeByIndex[spotInfo.index] = spotInfo;
			assetIdsBySymbol[symbolKey(spotInfo.name)] = assetId;
			assetIdsBySymbol[symbolKey(`@${spotInfo.index}`)] = assetId;
			if (baseTokenIndex != null && assetIdsByToken[baseTokenIndex] == null) {
				assetIdsByToken[baseTokenIndex] = assetId;
			}
			if (base && quote) {
				assetIdsBySymbol[symbolKey(`${base}/${quote}`)] = assetId;
				const baseKey = symbolKey(base);
				if (quote.toUpperCase() === 'USDC' && assetIdsBySymbol[baseKey] == null) {
					assetIdsBySymbol[baseKey] = assetId;
				}
				if (quote.toUpperCase() === 'USDC' && baseTokenIndex != null) {
					assetIdsByToken[baseTokenIndex] = assetId;
				}
			}
		}

		spotTokenByIndex = tokensByIndex;
		spotUniverseByIndex = universeByIndex;
		spotAssetIdBySymbol = assetIdsBySymbol;
		spotAssetIdByToken = assetIdsByToken;
		syncCurrentOutcomeSpotSubscriptions(network);
	}

	async function loadOutcomeMetaIndex(network: HyperliquidNetwork, generation: number) {
		if (outcomeMetaIndex) return outcomeMetaIndex;

		const meta = await getInfoClient(network).outcomeMeta();
		if (generation !== userGeneration) return { byToken: {}, byEncoding: {}, byCoin: {} };

		const questionNameByOutcome: Record<number, string> = {};
		for (const question of meta.questions) {
			for (const outcomeId of question.namedOutcomes) {
				questionNameByOutcome[outcomeId] = question.name;
			}
			questionNameByOutcome[question.fallbackOutcome] ??= question.name;
		}

		const next: OutcomeMetaIndex = { byToken: {}, byEncoding: {}, byCoin: {} };
		for (const outcome of meta.outcomes) {
			const marketName = questionNameByOutcome[outcome.outcome] ?? outcome.name;
			const signedNames = [outcome.name, marketName];

			for (const name of signedNames) {
				setOutcomeCoinAlias(next, `+${name}`, {
					outcomeName: marketName,
					sideName: 'Yes',
					encoding: null
				});
				setOutcomeCoinAlias(next, `-${name}`, {
					outcomeName: marketName,
					sideName: 'No',
					encoding: null
				});
			}

			for (let sideIndex = 0; sideIndex < outcome.sideSpecs.length; sideIndex += 1) {
				const side = outcome.sideSpecs[sideIndex];
				const encoding = 10 * outcome.outcome + sideIndex;
				const token = {
					outcomeName: marketName,
					sideName: side.name,
					encoding
				};

				next.byEncoding[encoding] = token;
				setOutcomeCoinAlias(next, `#${encoding}`, token);
				setOutcomeCoinAlias(next, `+${encoding}`, token);
				setOutcomeCoinAlias(next, String(encoding), token);
				if (typeof side.token === 'number') {
					next.byToken[side.token] = token;
					setOutcomeCoinAlias(next, `#${side.token}`, token, false);
					setOutcomeCoinAlias(next, `+${side.token}`, token, false);
					setOutcomeCoinAlias(next, String(side.token), token, false);
				}
			}
		}
		outcomeMetaIndex = next;
		return next;
	}

	async function startMarketStreams(network: HyperliquidNetwork, generation: number) {
		const client = getSubscriptionClient(network);
		const subscriptions: ISubscription[] = [];
		let closed = false;
		const isClosed = () => closed || generation !== marketGeneration;

		void loadPerpMetadata(network, generation).catch((err: unknown) => {
			if (!isClosed())
				marketError = err instanceof Error ? err.message : 'Failed to load perp metadata';
		});

		void loadSpotMetadata(network, generation).catch((err: unknown) => {
			if (!isClosed())
				marketError = err instanceof Error ? err.message : 'Failed to load spot metadata';
		});

		void client
			.allDexsAssetCtxs((event) => {
				if (isClosed()) return;

				const next: Record<string, Record<string, PerpAssetCtx>> = {};
				const nextByAssetId: Partial<Record<number, PerpAssetCtx>> = {};
				for (const [dex, ctxs] of event.ctxs) {
					const universe = perpUniverseByDex[dex] ?? [];
					const byCoin: Record<string, PerpAssetCtx> = {};
					for (let i = 0; i < ctxs.length; i += 1) {
						const coin = universe[i]?.name;
						const ctx = ctxs[i] as PerpAssetCtx;
						if (coin) {
							byCoin[coin] = ctx;
							const assetId = resolvePerpAssetId(dex ? `${dex}:${coin}` : coin);
							if (assetId != null) nextByAssetId[assetId] = ctx;
						}
					}
					next[dex] = byCoin;
				}
				perpCtxsByDexCoin = next;
				perpCtxsByAssetId = nextByAssetId;
				marketError = null;
			})
			.then((subscription) => trackSubscription(subscriptions, isClosed, subscription))
			.catch((err: unknown) => {
				if (!isClosed()) marketError = err instanceof Error ? err.message : 'Failed to subscribe';
			});

		void client
			.spotAssetCtxs((event) => {
				if (isClosed()) return;

				const next: Partial<Record<string, SpotAssetCtx>> = {};
				const nextByAssetId: Partial<Record<number, SpotAssetCtx>> = {};
				for (const ctx of event) {
					const spotCtx = ctx as SpotAssetCtx;
					next[spotCtx.coin] = spotCtx;
					const assetId = resolveSpotAssetId(spotCtx.coin);
					if (assetId != null) nextByAssetId[assetId] = spotCtx;
				}
				spotCtxsByCoin = next;
				spotCtxsByAssetId = nextByAssetId;
				marketError = null;
			})
			.then((subscription) => trackSubscription(subscriptions, isClosed, subscription))
			.catch((err: unknown) => {
				if (!isClosed()) marketError = err instanceof Error ? err.message : 'Failed to subscribe';
			});

		return () => {
			closed = true;
			for (const subscription of subscriptions) void subscription.unsubscribe();
		};
	}

	async function startUserStreams(user: Address, network: HyperliquidNetwork, generation: number) {
		const client = getSubscriptionClient(network);
		const subscriptions: ISubscription[] = [];
		let closed = false;
		let latestSpotBalances: SpotBal[] | null = null;
		let latestClearinghouseStates: [string, ClearinghouseStatePayload][] | null = null;
		let currentOutcomeIndex: OutcomeMetaIndex | null = outcomeMetaIndex;
		let currentAbstraction: AccountAbstraction | null = accountAbstraction;
		const isClosed = () => closed || generation !== userGeneration;

		setUserLoading();
		void loadUserRole(user, network, ++userRoleGeneration);
		void loadUserReferral(user, network, ++userReferralGeneration);
		void loadUserFees(user, network, ++userFeesGeneration);
		void loadUserStaking(user, network, ++userStakingGeneration);
		void loadUserLending(user, network, ++userLendingGeneration);
		void loadLedgerUpdatesPage(user, network, 0, null, ++ledgerGeneration);
		void loadUserRateLimit(user, network, ++accountRateLimitGeneration);
		void loadAgentWallets(user, network, ++agentWalletGeneration);
		void loadApprovedBuilders(user, network, ++builderGeneration);

		function updateOutcomes() {
			if (!latestSpotBalances || !currentOutcomeIndex) return;
			outcomes.data = buildOutcomeRows(latestSpotBalances, currentOutcomeIndex);
			outcomes.error = null;
			outcomes.loading = false;
			syncCurrentOutcomeSpotSubscriptions(network);
		}

		function updateDexBalances() {
			if (!latestClearinghouseStates) return;
			dexBalances.data = buildDexBalances(latestClearinghouseStates, currentAbstraction);
			dexBalances.error = null;
			dexBalances.loading = false;
		}

		void loadOutcomeMetaIndex(network, generation)
			.then((metaIndex) => {
				if (isClosed()) return;
				currentOutcomeIndex = metaIndex;
				updateOutcomes();
			})
			.catch((err: unknown) => {
				if (!isClosed()) setError(outcomes, err);
			});

		void client
			.spotState({ user }, (event) => {
				if (isClosed()) return;
				latestSpotBalances = event.spotState.balances as SpotBal[];
				balances.data = latestSpotBalances.filter((balance) => !isOutcomeBalance(balance));
				balances.error = null;
				balances.loading = false;
				updateOutcomes();
			})
			.then((subscription) => trackSubscription(subscriptions, isClosed, subscription))
			.catch((err: unknown) => {
				if (isClosed()) return;
				setError(balances, err);
				setError(outcomes, err);
			});

		void client
			.allDexsClearinghouseState({ user }, (event) => {
				if (isClosed()) return;
				latestClearinghouseStates = event.clearinghouseStates;
				updateDexBalances();
				positions.data = flattenPositions(event.clearinghouseStates);
				positions.error = null;
				positions.loading = false;
			})
			.then((subscription) => trackSubscription(subscriptions, isClosed, subscription))
			.catch((err: unknown) => {
				if (!isClosed()) {
					setError(dexBalances, err);
					setError(positions, err);
				}
			});

		void client
			.webData3({ user }, (event) => {
				if (isClosed()) return;
				currentAbstraction = event.userState.abstraction ?? null;
				accountAbstraction = currentAbstraction;
				updateDexBalances();
			})
			.then((subscription) => trackSubscription(subscriptions, isClosed, subscription))
			.catch((err: unknown) => {
				if (!isClosed()) {
					const message = err instanceof Error ? err.message : 'Failed to subscribe to webData3';
					dexBalances.error = dexBalances.error ?? message;
				}
			});

		void client
			.openOrders({ user, dex: 'ALL_DEXS' }, (event) => {
				if (isClosed()) return;
				orders.data = event.orders.map((order) => ({ ...order, dex: event.dex }));
				orders.error = null;
				orders.loading = false;
			})
			.then((subscription) => trackSubscription(subscriptions, isClosed, subscription))
			.catch((err: unknown) => {
				if (!isClosed()) setError(orders, err);
			});

		void client
			.userFills({ user }, (event) => {
				if (isClosed()) return;
				const current = event.isSnapshot ? [] : (fills.data ?? []);
				fills.data = dedupeFills([...(event.fills as Fill[]), ...current]);
				fills.error = null;
				fills.loading = false;
			})
			.then((subscription) => trackSubscription(subscriptions, isClosed, subscription))
			.catch((err: unknown) => {
				if (!isClosed()) setError(fills, err);
			});

		return () => {
			closed = true;
			for (const subscription of subscriptions) void subscription.unsubscribe();
		};
	}

	$effect(() => {
		const resetKey = `${activeAddress ?? 'disconnected'}:${hyperliquidNetwork.current}`;
		untrack(() => {
			if (!resetKey) return;
			resetAll();
		});
	});

	$effect(() => {
		const nextTab = tabIdFromString(initialTab);
		if (nextTab) activeTab = nextTab;
	});

	$effect(() => {
		const user = activeAddress;
		const network = hyperliquidNetwork.current;
		untrack(() => {
			savedAgentWallets = user ? loadSavedAgentWallets(user, network) : [];
		});
	});

	$effect(() => {
		const user = activeAddress;
		const streamKey = `${user ?? 'disconnected'}:${hyperliquidNetwork.current}:${marketStreamKey}`;
		if (!user || !streamKey) return;

		const network = hyperliquidNetwork.current;
		const generation = ++marketGeneration;
		let cleanup: (() => void) | undefined;
		untrack(() => {
			void startMarketStreams(network, generation).then((nextCleanup) => {
				if (generation === marketGeneration) cleanup = nextCleanup;
				else nextCleanup();
			});
		});

		return () => {
			marketGeneration += 1;
			cleanup?.();
		};
	});

	$effect(() => {
		const user = activeAddress;
		const streamKey = `${user ?? 'disconnected'}:${hyperliquidNetwork.current}:${userStreamKey}`;
		if (!user || !streamKey) return;

		const network = hyperliquidNetwork.current;
		const generation = ++userGeneration;
		let cleanup: (() => void) | undefined;
		untrack(() => {
			void startUserStreams(user, network, generation).then((nextCleanup) => {
				if (generation === userGeneration) cleanup = nextCleanup;
				else nextCleanup();
			});
		});

		return () => {
			userGeneration += 1;
			cleanup?.();
		};
	});

	$effect(() => {
		const network = hyperliquidNetwork.current;
		const user = activeAddress;
		untrack(() => {
			if (user) syncCurrentOutcomeSpotSubscriptions(network);
			else clearActiveOutcomeSpotSubscriptions();
		});
	});

	onDestroy(() => {
		clearActiveOutcomeSpotSubscriptions();
	});

	const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
	const fmtTs = (t: number) => new Date(t).toLocaleString();

	let tabItems = $derived(
		TABS.map((tab) => ({
			id: tab.id,
			label: tab.label,
			count: tabCount(tab.id)
		}))
	);
	let activeTabComponent = $derived(
		(TABS.find((tab) => tab.id === activeTab)?.component ?? AccountTab) as unknown as L1TabComponent
	);
	let ActiveL1Tab = $derived(activeTabComponent);
	let l1TabContext = $derived({
		accountAbstraction,
		accountRateLimit,
		accountTabError,
		accountTabHasData,
		accountTabLoading,
		activeAddress,
		agentActionError,
		agentActionLoading,
		agentActionNotice,
		agentCurl,
		agentImportNameInput,
		agentImportPrivateKeyInput,
		agentImportModalOpen,
		agentNameInput,
		agentSortIndicator,
		agentStorageAck,
		agentTableRows,
		agentValidDays,
		agentWallets,
		approvedBuilders,
		balanceSortIndicator,
		balanceTabError,
		balanceTabHasData,
		balanceTabHasRows,
		balanceTabLoading,
		balanceTableRows,
		builderActionError,
		builderActionLoading,
		builderActionNotice,
		builderAddressInput,
		builderCurl,
		builderMaxFeeRateInput,
		builderSortIndicator,
		builderTableRows,
		canSignForActiveAddress,
		fillSortIndicator,
		fillTableRows,
		fills,
		formatBps,
		formatBuilderFee,
		formatFractionPercent,
		formatHealthFactor,
		formatHypeAmount,
		formatInteger,
		formatLiquidationPrice,
		formatMargin,
		formatOrderFlag,
		formatPrice,
		formatSignedPercent,
		formatSignedTokenAmount,
		formatSignedUsd,
		formatTokenAmount,
		formatTokenValue,
		formatUsd,
		formatUsdcCost,
		formatUserRole,
		ledgerCanLoadNewer,
		ledgerCanLoadOlder,
		ledgerRangeLabel,
		ledgerTableRows,
		ledgerUpdates,
		loadNewerLedgerUpdates,
		loadOlderLedgerUpdates,
		lendingActiveRows,
		lendingInterestRows,
		lendingInterestSummary,
		lendingOverview,
		orderSideClass,
		orderSideLabel,
		orderSortIndicator,
		orderTableRows,
		orders,
		outcomeSortIndicator,
		outcomeTableRows,
		outcomes,
		pnlClass,
		positionSortIndicator,
		positionTableRows,
		positions,
		removeAgentWallet,
		refreshLedgerUpdates,
		reserveActionError,
		reserveActionLoading,
		reserveActionNotice,
		reserveCurl,
		reservePricePreview,
		reserveWeightInput,
		setAgentSort,
		setBalanceSort,
		setBuilderSort,
		setFillSort,
		setOrderSort,
		setOutcomeSort,
		setPositionSort,
		short,
		sizeClass,
		stakingDelegationLockLabel,
		stakingDelegationRows,
		stakingHistoryAction,
		stakingHistoryAmount,
		stakingHistoryBadgeClass,
		stakingHistoryRows,
		stakingHistoryValidator,
		stakingLinkLabel,
		stakingOverview,
		stakingRewardRows,
		stakingRewardSummary,
		stakingValidatorStatus,
		stakingValidatorStatusClass,
		submitApproveBuilder,
		submitReserveRequestWeight,
		toNumber,
		userFeeVolumeRows,
		userFees,
		userFeesOverview,
		userLending,
		userReferral,
		userReferralOverview,
		userReferralRewardRows,
		userReferralRows,
		userRole,
		userRoleDetail,
		userStaking,
		AGENT_MAX_VALID_DAYS,
		RESERVE_REQUEST_WEIGHT_PRICE_USDC,
		addAgentWallet,
		fmtTs,
		importAgentWalletPrivateKey,
		openAgentImportModal,
		referrerStageLabel,
		submitImportAgentWalletPrivateKey,
		closeAgentImportModal,
		setAgentImportNameInput,
		setAgentImportPrivateKeyInput,
		setAgentNameInput,
		setAgentStorageAck,
		setAgentValidDays,
		setBuilderAddressInput,
		setBuilderMaxFeeRateInput,
		setReserveWeightInput
	});

	function selectTab(tab: TabId) {
		activeTab = tab;
		if (syncTabHash && browser) {
			window.history.replaceState(
				window.history.state,
				'',
				`${window.location.pathname}${window.location.search}#${tab}`
			);
		}
	}

	function setReserveWeightInput(value: string | number) {
		reserveWeightInput = Number(value);
	}

	function setAgentNameInput(value: string) {
		agentNameInput = value;
	}

	function setAgentImportNameInput(value: string) {
		agentImportNameInput = value;
	}

	function setAgentImportPrivateKeyInput(value: string) {
		agentImportPrivateKeyInput = value;
	}

	function setAgentValidDays(value: string | number) {
		agentValidDays = Number(value);
	}

	function setAgentStorageAck(value: boolean) {
		agentStorageAck = value;
	}

	function setBuilderAddressInput(value: string) {
		builderAddressInput = value;
	}

	function setBuilderMaxFeeRateInput(value: string) {
		builderMaxFeeRateInput = value;
	}
</script>

<View {viewId} title={viewTitle} {closeable} {movable} {fullWidth}>
	{#snippet subtitleContent()}
		{#if trackedWalletName}
			<span>HyperCore L1</span>
			<span>·</span>
		{/if}
		<span>{hyperliquidNetwork.config.label}</span>
		{#if activeAddress}
			<span>·</span>
			<CopyAddress
				address={activeAddress}
				label={short(activeAddress)}
				notification="Wallet address copied"
				buttonClass="h-auto min-h-0 px-0 py-0 font-mono text-xs text-base-content/60 hover:text-base-content"
			/>
			{#if editable}
				<button
					type="button"
					class="btn h-auto min-h-0 px-0.5 py-0 text-xs btn-ghost btn-xs"
					aria-label="Edit tracked wallet"
					title="Edit tracked wallet"
					onclick={openTrackedWalletEditor}
				>
					<HeroIcon name="pencil-square" />
				</button>
			{/if}
		{:else}
			<span>· No wallet</span>
		{/if}
	{/snippet}

	{#snippet actions()}
		{#if activeAddress}
			<button class="btn btn-ghost btn-xs" aria-label="Reload" onclick={reloadAll}>
				<HeroIcon name="arrow-path" />
			</button>
		{/if}
	{/snippet}

	{#if !activeAddress}
		<div class="px-3 py-4">
			<div role="alert" class="alert alert-soft text-xs">
				<span>Connect a wallet to load HyperCore L1.</span>
			</div>
		</div>
	{:else}
		<ViewTabs
			tabs={tabItems}
			active={activeTab}
			onSelect={selectTab}
			className="sticky top-0 z-10 m-2"
		/>

		{#if marketError}
			<div class="px-3 pb-2">
				<div role="alert" class="alert alert-soft text-xs alert-warning">
					<span>Market stream: {marketError}</span>
				</div>
			</div>
		{/if}
		{#if l1SignaturePrompt}
			<div class="px-3 pb-2">
				<div role="status" class="alert alert-soft text-xs alert-info">
					{#if l1ChainSwitching}
						<span class="loading loading-xs loading-spinner"></span>
					{/if}
					<span>{l1SignaturePrompt}</span>
				</div>
			</div>
		{/if}

		<div class="px-1 pb-2">
			<ActiveL1Tab ctx={l1TabContext} />
		</div>
	{/if}
</View>

{#if editable}
	<dialog {@attach trackedWalletDialogController} class="modal" onclose={closeTrackedWalletEditor}>
		<div class="modal-box max-w-md">
			<div class="flex items-center justify-between">
				<h3 class="text-lg font-bold">Tracked wallet</h3>
				<form method="dialog">
					<button class="btn btn-circle btn-ghost btn-sm" aria-label="Close">
						<HeroIcon name="x-mark" />
					</button>
				</form>
			</div>

			<form class="mt-5 space-y-3" onsubmit={saveTrackedWallet}>
				<label class="floating-label">
					<span>Name (Optional)</span>
					<input
						type="text"
						class="input-bordered input w-full text-sm"
						placeholder="Optional"
						bind:value={trackedWalletNameInput}
						maxlength={TRACKED_WALLET_NAME_MAX_LENGTH}
						autocomplete="off"
					/>
				</label>
				<label class="floating-label">
					<span>Address</span>
					<input
						type="text"
						class="input-bordered input w-full font-mono text-sm"
						placeholder="0x..."
						bind:value={trackedWalletAddressInput}
						spellcheck="false"
						autocomplete="off"
					/>
				</label>
				<button
					type="submit"
					class="btn w-full btn-primary"
					disabled={trackedWalletAddressInput.trim() === ''}
				>
					Save
				</button>
			</form>

			{#if trackedWalletEditorError}
				<div role="alert" class="mt-4 alert alert-soft text-sm alert-error">
					<span>{trackedWalletEditorError}</span>
				</div>
			{/if}
		</div>
		<form method="dialog" class="modal-backdrop">
			<button aria-label="Close">close</button>
		</form>
	</dialog>
{/if}
