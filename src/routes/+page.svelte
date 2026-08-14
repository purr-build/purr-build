<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { getAddress, isAddress, type Address } from 'viem';
	import ConnectWalletModal from '$lib/components/ConnectWalletModal.svelte';
	import TrackWalletModal from '$lib/components/TrackWalletModal.svelte';
	import { upsertSavedAgentWallet, type SavedAgentWallet } from '$lib/hl/agent-wallets.js';
	import { getExchangeClient, HYPERLIQUID_L1_SIGNATURE_CHAIN_ID } from '$lib/hl/clients.js';
	import { HYPEREVM_NETWORKS, hyperEvmRpcUrl } from '$lib/hl/hyperevm.js';
	import { hyperliquidNetwork, type HyperliquidNetwork } from '$lib/hl/network.svelte';
	import { HYPERLIQUID_L1_ADD_ETHEREUM_CHAIN_PARAMETER } from '$lib/hl/wallet-chains.js';
	import { wallet } from '$lib/stores/wallet.svelte';
	import { normalizeTrackedWalletName } from '$lib/wallet-names.js';
	import SupportFooter from '$lib/components/SupportFooter.svelte';
	import HeroIcon from '$lib/components/HeroIcon.svelte';
	import {
		views,
		DEFAULT_COLUMN_SIZE,
		type LayoutSnapshot,
		type ViewEntry,
		type ViewSpec
	} from '$lib/views/stack.svelte';
	import ViewStack from '$lib/views/ViewStack.svelte';
	import WidgetSelector from '$lib/components/WidgetSelector.svelte';
	import {
		DEFAULT_VIEW_TYPES,
		fixedViewIdForType,
		isDefaultViewType,
		isRegisteredViewType,
		viewSpecForType,
		viewTypeForEntry as registeredViewTypeForEntry,
		type DefaultViewType,
		type RegisteredViewType
	} from '$lib/views/registry.js';
	import demoWorkspace from '../../demoworkspace.json' with { type: 'json' };
	import purr from '$lib/assets/purr.svg';

	const DEMO_ADDRESS = '0x162cc7c861ebd0c06b3d72319201150482518185';
	const DISCONNECTED_QUOTES = [
		"Those who can, do. Those who can't, fud.",
		'Hyperliquid',
		'gn. gm. back to work',
		'gm',
		'Purrrrrrrrrrrrr',
		'House of all finance',
		'You are welcome to trade elsewhere',
		'Alright buddy',
		'Nocex'
	] as const;
	const LANDING_FEATURES = [
		{
			title: 'Account overview',
			description: 'Balances, positions, orders, fills, funding, and PnL across HyperCore.'
		},
		{
			title: 'HyperEVM',
			description: 'Native HYPE and ERC-20 balances, token tracking, and EVM network controls.'
		},
		{
			title: 'Builder tools',
			description: 'HIP-1 deployment, HIP-3 DEX discovery, agents, and builder approvals.'
		},
		{
			title: 'Network data',
			description: 'Asset metadata, validator votes, API status, and a signed request sandbox.'
		}
	] as const;

	const HYPERLIQUID_L1_CHAIN = {
		chainId: HYPERLIQUID_L1_SIGNATURE_CHAIN_ID,
		label: 'Hyperliquid L1',
		addEthereumChainParameter: HYPERLIQUID_L1_ADD_ETHEREUM_CHAIN_PARAMETER
	} as const;
	const HYPERLIQUID_L1_CHAIN_ID = Number(BigInt(HYPERLIQUID_L1_SIGNATURE_CHAIN_ID));
	const DEFAULT_VIEW_IDS = DEFAULT_VIEW_TYPES;
	const CLOSED_DEFAULT_VIEWS_KEY = 'purrbuild:closed-default-views';
	const VIEW_STACK_STORAGE_KEY = 'purrbuild:view-stack';
	const WORKSPACE_LAYOUT_STORAGE_KEY = 'purrbuild:workspace-layout';
	type DefaultViewId = DefaultViewType;
	type PersistentViewType = RegisteredViewType;
	type PersistedViewEntry = {
		id: string;
		type: PersistentViewType;
		address?: Address;
		name?: string;
		parentId?: string;
	};
	type PersistedViewStack = {
		entries: PersistedViewEntry[];
		focusedId: string | null;
	};
	type WorkspaceExport = {
		app: 'purrbuild';
		kind: 'workspace';
		version: 1;
		exportedAt: string;
		network: HyperliquidNetwork;
		closedDefaultViews: DefaultViewId[];
		workspace: PersistedViewStack;
		layout: LayoutSnapshot;
	};
	type NormalizedWorkspaceExport = {
		network: HyperliquidNetwork | null;
		closedDefaultViews: DefaultViewId[];
		workspace: PersistedViewStack;
		layout: LayoutSnapshot | null;
	};
	type EvmBlockMode = 'big' | 'small';

	let connectModalOpen = $state(false);
	let trackL1CoreModalOpen = $state(false);
	let trackHyperEvmModalOpen = $state(false);
	let disconnectedQuote = $state<string>(DISCONNECTED_QUOTES[0]);
	let chainSwitching = $state<'l1' | 'evm' | 'big-blocks' | 'small-blocks' | null>(null);
	let chainSwitchMessage = $state<string | null>(null);
	let chainSwitchError = $state<string | null>(null);
	let evmBlockMode = $state<EvmBlockMode | null>(null);
	let evmBlockModeLoading = $state(false);
	let evmBlockModeError = $state<string | null>(null);
	let workspaceExportMessage = $state<string | null>(null);
	let workspaceExportError = $state<string | null>(null);
	let demoWorkspaceLoading = $state(false);
	let demoWorkspaceError = $state<string | null>(null);
	let closedDefaultViews = $state<Partial<Record<DefaultViewId, true>>>({});
	let defaultViewsHydrated = $state(false);
	let viewStackRestored = $state(false);
	let widgetSelectorOpen = $state(false);
	let widgetSelectorTarget = $state<string | null>(null);
	let pendingColumnTarget: string | null = null;
	let handledCloseNonce = 0;
	let evmBlockModeGeneration = 0;

	type AddableWidget =
		| 'l1core'
		| 'hyperevm'
		| 'asset-universe'
		| 'hip1'
		| 'hip3'
		| 'api'
		| 'validator-votes'
		| 'api-sandbox'
		| 'panel';
	const WIDGET_TYPES: { type: AddableWidget; label: string; description: string }[] = [
		{ type: 'l1core', label: 'L1 Core', description: 'Track a HyperCore L1 wallet.' },
		{ type: 'hyperevm', label: 'HyperEVM', description: 'Track a HyperEVM wallet.' },
		{
			type: 'asset-universe',
			label: 'Asset universe',
			description: 'All DEX, spot, and outcome metadata.'
		},
		{ type: 'hip1', label: 'HIP-1', description: 'Deploy a native spot token.' },
		{ type: 'hip3', label: 'HIP-3', description: 'Builder-deployed perp DEXes.' },
		{ type: 'api', label: 'API', description: 'Hyperliquid API status and incidents.' },
		{
			type: 'validator-votes',
			label: 'Validator votes',
			description: 'L1 governance votes and quorum status.'
		},
		{ type: 'api-sandbox', label: 'API sandbox', description: 'Build and sign exchange payloads.' },
		{ type: 'panel', label: 'Blank panel', description: 'An empty placeholder window.' }
	];
	let widgetOptions = $derived(
		WIDGET_TYPES.map((widget) => ({
			label: widget.label,
			description: widget.description,
			run: () => addWidget(widget.type, widgetSelectorTarget)
		}))
	);

	function openSelector(target: string | null = null) {
		widgetSelectorTarget = target;
		widgetSelectorOpen = true;
	}

	function closeSelector() {
		widgetSelectorOpen = false;
	}

	function addWidget(type: AddableWidget, columnId: string | null = null) {
		widgetSelectorOpen = false;
		if (type === 'l1core') {
			pendingColumnTarget = columnId;
			trackL1CoreModalOpen = true;
			return;
		}
		if (type === 'hyperevm') {
			pendingColumnTarget = columnId;
			trackHyperEvmModalOpen = true;
			return;
		}
		if (type === 'api') {
			closedDefaultViews = withoutClosedDefault('api');
			persistClosedDefaultViews();
		}
		views.open(
			{ ...viewSpecForType(type), id: fixedViewIdForType(type) ?? undefined },
			columnId ? { columnId } : {}
		);
	}

	function openDefaultView(id: DefaultViewId, name?: string | null) {
		closedDefaultViews = withoutClosedDefault(id);
		persistClosedDefaultViews();
		openDefaultViewEntry(id, name);
	}

	function openDefaultViewEntry(id: DefaultViewId, name?: string | null) {
		if (id === 'api') {
			views.open({
				...viewSpecForType('api'),
				id: fixedViewIdForType('api') ?? undefined
			});
			return;
		}

		const address = wallet.current?.address;
		if (!address) return;
		openL1CoreView(address, { id: 'l1core', name });
	}

	function openL1CoreView(address: Address, options: { id?: string; name?: string | null } = {}) {
		const id = options.id ?? l1CoreViewId(address);
		const name = normalizeTrackedWalletName(options.name);
		const existing = views.entries.find(
			(entry) => isL1CoreViewEntry(entry) && l1CoreAddressForEntry(entry) === address
		);
		if (existing) {
			if (name) views.updateProps(existing.id, { name });
			views.focus(existing.id);
			pendingColumnTarget = null;
			return;
		}

		const columnId = pendingColumnTarget;
		pendingColumnTarget = null;
		views.open(
			{
				...viewSpecForType('l1core', {
					address,
					...(name ? { name } : {})
				}),
				id
			},
			columnId ? { columnId } : {}
		);
	}

	function openHyperEvmView(address: Address, options: { id?: string; name?: string | null } = {}) {
		const id = options.id ?? hyperEvmViewId(address);
		const name = normalizeTrackedWalletName(options.name);
		const existing = views.entries.find(
			(entry) => isHyperEvmViewEntry(entry) && hyperEvmAddressForEntry(entry) === address
		);
		if (existing) {
			if (name) views.updateProps(existing.id, { name });
			views.focus(existing.id);
			pendingColumnTarget = null;
			return;
		}

		const columnId = pendingColumnTarget;
		pendingColumnTarget = null;
		views.open(
			{
				...viewSpecForType('hyperevm', {
					address,
					...(name ? { name } : {})
				}),
				id
			},
			columnId ? { columnId } : {}
		);
	}

	function addManualL1Core(
		address: Address,
		name: string | null,
		agentWallet: SavedAgentWallet | null
	) {
		if (agentWallet) {
			upsertSavedAgentWallet(address, hyperliquidNetwork.current, agentWallet);
		}
		openL1CoreView(address, { name });
	}

	function addManualHyperEvm(address: Address, name: string | null) {
		openHyperEvmView(address, { name });
	}

	function addCurrentL1Core(name: string | null) {
		if (!wallet.current?.address) return;
		openDefaultView('l1core', name);
	}

	function addCurrentHyperEvm(name: string | null) {
		if (!wallet.current?.address) return;
		openHyperEvmView(wallet.current.address, { name });
	}

	function isL1CoreViewEntry(entry: ViewEntry) {
		return viewTypeForEntry(entry) === 'l1core';
	}

	function isHyperEvmViewEntry(entry: ViewEntry) {
		return viewTypeForEntry(entry) === 'hyperevm';
	}

	function l1CoreViewId(address: Address) {
		return `l1core:${address.toLowerCase()}`;
	}

	function hyperEvmViewId(address: Address) {
		return `hyperevm:${address.toLowerCase()}`;
	}

	function normalizedAddress(value: unknown): Address | null {
		return typeof value === 'string' && isAddress(value) ? getAddress(value) : null;
	}

	function l1CoreAddressForEntry(entry: ViewEntry) {
		return (
			normalizedAddress(entry.props.address) ??
			(entry.id === 'l1core' ? wallet.current?.address : null)
		);
	}

	function hyperEvmAddressForEntry(entry: ViewEntry) {
		return (
			normalizedAddress(entry.props.address) ??
			(entry.id === 'hyperevm' ? wallet.current?.address : null)
		);
	}

	function closeDefaultView(id: DefaultViewId) {
		closedDefaultViews = { ...closedDefaultViews, [id]: true };
		persistClosedDefaultViews();
	}

	function withoutClosedDefault(id: DefaultViewId) {
		const next = { ...closedDefaultViews };
		delete next[id];
		return next;
	}

	function isDefaultViewId(value: string | null): value is DefaultViewId {
		return isDefaultViewType(value);
	}

	function isHyperliquidNetwork(value: unknown): value is HyperliquidNetwork {
		return value === 'mainnet' || value === 'testnet';
	}

	function isDefaultViewClosed(id: DefaultViewId) {
		return closedDefaultViews[id] === true;
	}

	function loadClosedDefaultViews() {
		if (!browser) return {};
		try {
			const raw = localStorage.getItem(CLOSED_DEFAULT_VIEWS_KEY);
			if (!raw) return {};
			const parsed = JSON.parse(raw);
			if (!Array.isArray(parsed)) return {};
			return parsed.reduce<Partial<Record<DefaultViewId, true>>>((next, id) => {
				if (isDefaultViewId(id)) next[id] = true;
				return next;
			}, {});
		} catch {
			return {};
		}
	}

	function persistClosedDefaultViews() {
		if (!browser) return;
		try {
			const ids = DEFAULT_VIEW_IDS.filter((id) => closedDefaultViews[id]);
			localStorage.setItem(CLOSED_DEFAULT_VIEWS_KEY, JSON.stringify(ids));
		} catch {
			// The in-memory closed state still applies for this session.
		}
	}

	function isPersistentViewType(value: unknown): value is PersistentViewType {
		return isRegisteredViewType(value);
	}

	function fixedPersistentViewId(type: PersistentViewType) {
		return fixedViewIdForType(type);
	}

	function isWalletViewType(type: PersistentViewType) {
		return type === 'l1core' || type === 'hyperevm';
	}

	function walletAddressForEntry(entry: ViewEntry, type: PersistentViewType) {
		if (type === 'l1core') return l1CoreAddressForEntry(entry);
		if (type === 'hyperevm') return hyperEvmAddressForEntry(entry);
		return null;
	}

	function persistentViewSpec(
		entry: Pick<PersistedViewEntry, 'type' | 'address' | 'name'>
	): Omit<ViewSpec, 'id' | 'parentId'> {
		return viewSpecForType(entry.type, {
			...(entry.address ? { address: entry.address } : {}),
			...(entry.name ? { name: entry.name } : {})
		});
	}

	function viewTypeForEntry(entry: ViewEntry): PersistentViewType | null {
		return registeredViewTypeForEntry(entry);
	}

	function persistedEntryForView(entry: ViewEntry): PersistedViewEntry | null {
		const type = viewTypeForEntry(entry);
		if (!type) return null;
		const address = walletAddressForEntry(entry, type);
		const name = isWalletViewType(type) ? normalizeTrackedWalletName(entry.props.name) : null;
		return {
			id: fixedPersistentViewId(type) ?? entry.id,
			type,
			...(address ? { address } : {}),
			...(name ? { name } : {}),
			parentId: entry.parentId
		};
	}

	function persistedViewStack(
		currentEntries = views.entries,
		currentFocusedId = views.focusedId
	): PersistedViewStack {
		const entries = currentEntries
			.map(persistedEntryForView)
			.filter((entry): entry is PersistedViewEntry => entry !== null);
		const ids = entries.reduce<Record<string, true>>((next, entry) => {
			next[entry.id] = true;
			return next;
		}, {});
		const normalized = entries.map((entry) => ({
			id: entry.id,
			type: entry.type,
			...(entry.address ? { address: entry.address } : {}),
			...(entry.name ? { name: entry.name } : {}),
			parentId: entry.parentId && ids[entry.parentId] ? entry.parentId : undefined
		}));
		const focusedId =
			currentFocusedId && ids[currentFocusedId]
				? currentFocusedId
				: (normalized.at(-1)?.id ?? null);

		return {
			entries: normalized,
			focusedId
		};
	}

	function persistViewStack(currentEntries = views.entries, currentFocusedId = views.focusedId) {
		if (!browser) return;

		try {
			localStorage.setItem(
				VIEW_STACK_STORAGE_KEY,
				JSON.stringify({
					version: 1,
					...persistedViewStack(currentEntries, currentFocusedId)
				})
			);
		} catch {
			// The live stack remains usable even if localStorage is unavailable.
		}
	}

	function persistWorkspaceLayout(layout = views.snapshotLayout()) {
		if (!browser) return;
		try {
			localStorage.setItem(WORKSPACE_LAYOUT_STORAGE_KEY, JSON.stringify({ version: 1, ...layout }));
		} catch {
			// The live layout still applies in-memory for this session.
		}
	}

	function normalizedLayoutSnapshot(value: unknown): LayoutSnapshot | null {
		if (!value || typeof value !== 'object') return null;
		const source = value as Record<string, unknown>;
		if (!Array.isArray(source.columns)) return null;

		const columns: LayoutSnapshot['columns'] = [];
		for (const rawColumn of source.columns) {
			if (!rawColumn || typeof rawColumn !== 'object') continue;
			const column = rawColumn as Record<string, unknown>;
			if (!Array.isArray(column.slots)) continue;

			const slots: LayoutSnapshot['columns'][number]['slots'] = [];
			for (const rawSlot of column.slots) {
				if (!rawSlot || typeof rawSlot !== 'object') continue;
				const slot = rawSlot as Record<string, unknown>;
				if (typeof slot.id !== 'string') continue;
				slots.push({ id: slot.id, weight: typeof slot.weight === 'number' ? slot.weight : 1 });
			}
			if (slots.length === 0) continue;

			columns.push({
				id: typeof column.id === 'string' ? column.id : '',
				size: typeof column.size === 'number' ? column.size : DEFAULT_COLUMN_SIZE,
				slots
			});
		}
		if (columns.length === 0) return null;

		return {
			orientation: source.orientation === 'vertical' ? 'vertical' : 'horizontal',
			focusedId: typeof source.focusedId === 'string' ? source.focusedId : null,
			columns
		};
	}

	function loadWorkspaceLayout(): LayoutSnapshot | null {
		if (!browser) return null;
		try {
			const raw = localStorage.getItem(WORKSPACE_LAYOUT_STORAGE_KEY);
			if (!raw) return null;
			return normalizedLayoutSnapshot(JSON.parse(raw));
		} catch {
			return null;
		}
	}

	function normalizedPersistedViewStack(value: unknown): PersistedViewStack | null {
		const source = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
		const rawEntries = Array.isArray(value)
			? value
			: Array.isArray(source.entries)
				? source.entries
				: null;
		if (!rawEntries) return null;

		const entries: PersistedViewEntry[] = [];
		const ids: Record<string, true> = {};
		for (const rawEntry of rawEntries) {
			if (!rawEntry || typeof rawEntry !== 'object') continue;
			const entry = rawEntry as Record<string, unknown>;
			const type = entry.type;
			if (typeof entry.id !== 'string' || !isPersistentViewType(type)) continue;

			const id = fixedPersistentViewId(type) ?? entry.id;
			if (!id || ids[id]) continue;

			const address = isWalletViewType(type) ? normalizedAddress(entry.address) : null;
			const name = isWalletViewType(type) ? normalizeTrackedWalletName(entry.name) : null;
			ids[id] = true;
			entries.push({
				id,
				type,
				...(address ? { address } : {}),
				...(name ? { name } : {}),
				parentId: typeof entry.parentId === 'string' ? entry.parentId : undefined
			});
		}

		const normalized = entries.map((entry) => ({
			id: entry.id,
			type: entry.type,
			...(entry.address ? { address: entry.address } : {}),
			...(entry.name ? { name: entry.name } : {}),
			parentId: entry.parentId && ids[entry.parentId] ? entry.parentId : undefined
		}));
		const rawFocusedId = typeof source.focusedId === 'string' ? source.focusedId : null;
		const focusedId = rawFocusedId && ids[rawFocusedId] ? rawFocusedId : null;

		return {
			entries: normalized,
			focusedId
		};
	}

	function normalizedWorkspaceExport(value: unknown): NormalizedWorkspaceExport | null {
		if (!value || typeof value !== 'object') return null;
		const source = value as Record<string, unknown>;
		const workspace = normalizedPersistedViewStack(source.workspace ?? source);
		if (!workspace) return null;

		return {
			network: isHyperliquidNetwork(source.network) ? source.network : null,
			closedDefaultViews: Array.isArray(source.closedDefaultViews)
				? source.closedDefaultViews.filter(isDefaultViewId)
				: [],
			workspace,
			layout: normalizedLayoutSnapshot(source.layout)
		};
	}

	function closedDefaultViewMap(ids: DefaultViewId[]) {
		return ids.reduce<Partial<Record<DefaultViewId, true>>>((next, id) => {
			next[id] = true;
			return next;
		}, {});
	}

	function applyPersistedViewStack(persisted: PersistedViewStack) {
		if (views.entries.length > 0) views.clear();
		for (const entry of persisted.entries) {
			views.open({
				...persistentViewSpec(entry),
				id: entry.id,
				parentId: entry.parentId
			});
		}
		if (persisted.focusedId) views.focus(persisted.focusedId);
	}

	function workspaceExportPayload(exportedAt = new Date()): WorkspaceExport {
		return {
			app: 'purrbuild',
			kind: 'workspace',
			version: 1,
			exportedAt: exportedAt.toISOString(),
			network: hyperliquidNetwork.current,
			closedDefaultViews: DEFAULT_VIEW_IDS.filter((id) => closedDefaultViews[id]),
			workspace: persistedViewStack(),
			layout: views.snapshotLayout()
		};
	}

	function workspaceExportFilename(exportedAt: Date) {
		const stamp = exportedAt.toISOString().slice(0, 19).replace(/[:T]/g, '-');
		return `purrbuild-workspace-${stamp}.json`;
	}

	function downloadJson(filename: string, payload: unknown) {
		const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], {
			type: 'application/json'
		});
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = filename;
		link.rel = 'noopener';
		document.body.appendChild(link);
		link.click();
		link.remove();
		window.setTimeout(() => URL.revokeObjectURL(url), 0);
	}

	function exportWorkspace() {
		if (!browser) return;
		workspaceExportMessage = null;
		workspaceExportError = null;

		try {
			const exportedAt = new Date();
			const payload = workspaceExportPayload(exportedAt);
			persistViewStack();
			persistClosedDefaultViews();
			downloadJson(workspaceExportFilename(exportedAt), payload);
			workspaceExportMessage = `Exported ${payload.workspace.entries.length} views.`;
		} catch (err) {
			workspaceExportError =
				err instanceof Error ? err.message : 'Could not export workspace JSON.';
		}
	}

	function loadPersistedViewStack(): PersistedViewStack | null {
		if (!browser) return null;
		try {
			const raw = localStorage.getItem(VIEW_STACK_STORAGE_KEY);
			if (!raw) return null;

			return normalizedPersistedViewStack(JSON.parse(raw));
		} catch {
			return null;
		}
	}

	function restoreViewStack() {
		const persisted = loadPersistedViewStack();
		if (persisted) {
			applyPersistedViewStack(persisted);
			const layout = loadWorkspaceLayout();
			if (layout) views.applyLayout(layout);
			return;
		}

		if (!isDefaultViewClosed('l1core') && !views.entries.some(isL1CoreViewEntry)) {
			openDefaultViewEntry('l1core');
		}
		if (!isDefaultViewClosed('api') && !views.entries.some((entry) => entry.id === 'api')) {
			openDefaultViewEntry('api');
		}
	}

	function primaryAddressForWorkspace(workspace: PersistedViewStack) {
		const focused = workspace.entries.find((entry) => entry.id === workspace.focusedId);
		if (focused && isWalletViewType(focused.type) && focused.address) return focused.address;
		return (
			workspace.entries.find((entry) => isWalletViewType(entry.type) && entry.address)?.address ??
			DEMO_ADDRESS
		);
	}

	function useDemoWorkspace() {
		demoWorkspaceLoading = true;
		demoWorkspaceError = null;
		try {
			const demo = normalizedWorkspaceExport(demoWorkspace);
			if (!demo || demo.workspace.entries.length === 0) {
				throw new Error('Demo workspace JSON is invalid.');
			}
			if (demo.network) hyperliquidNetwork.set(demo.network);
			closedDefaultViews = closedDefaultViewMap(demo.closedDefaultViews);
			persistClosedDefaultViews();
			wallet.setManual(primaryAddressForWorkspace(demo.workspace));
			applyPersistedViewStack(demo.workspace);
			if (demo.layout) views.applyLayout(demo.layout);
			viewStackRestored = true;
			persistViewStack();
			persistWorkspaceLayout();
		} catch (err) {
			demoWorkspaceError = err instanceof Error ? err.message : 'Could not load demo workspace.';
		} finally {
			demoWorkspaceLoading = false;
		}
	}

	async function switchWalletChain(target: 'l1' | 'evm') {
		if (chainSwitching) return;
		chainSwitching = target;
		chainSwitchMessage = null;
		chainSwitchError = null;

		try {
			if (target === 'l1') {
				await wallet.switchChain({
					chainId: HYPERLIQUID_L1_CHAIN.chainId,
					addEthereumChainParameter: HYPERLIQUID_L1_CHAIN.addEthereumChainParameter
				});
				chainSwitchMessage = 'Wallet switched to Hyperliquid L1.';
			} else {
				const chain = HYPEREVM_NETWORKS[hyperliquidNetwork.current];
				await wallet.switchChain({
					chainId: chain.chainIdHex,
					addEthereumChainParameter: chain.addEthereumChainParameter
				});
				chainSwitchMessage = `Wallet switched to ${chain.label}.`;
			}
		} catch (err) {
			const fallback =
				target === 'l1'
					? 'Could not switch to Hyperliquid L1. Approve the add-network request in your wallet, then try again.'
					: 'Could not switch to HyperEVM.';
			chainSwitchError = err instanceof Error ? err.message : fallback;
		} finally {
			chainSwitching = null;
		}
	}

	async function switchEvmBlockMode(usingBigBlocks: boolean) {
		const target = usingBigBlocks ? 'big-blocks' : 'small-blocks';
		if (chainSwitching) return;
		chainSwitching = target;
		chainSwitchMessage = null;
		chainSwitchError = null;

		try {
			const mode = usingBigBlocks ? 'big' : 'small';
			const signingWallet = await requireL1SigningWallet(`switch to ${mode} EVM blocks`);
			await getExchangeClient(signingWallet, hyperliquidNetwork.current).evmUserModify({
				usingBigBlocks
			});
			evmBlockMode = usingBigBlocks ? 'big' : 'small';
			evmBlockModeError = null;
			chainSwitchMessage = `EVM transactions will use ${mode} blocks.`;
			const address = wallet.current?.address;
			if (address && browser) {
				window.setTimeout(() => {
					void loadEvmBlockMode(address, hyperliquidNetwork.current);
				}, 2_000);
			}
		} catch (err) {
			const mode = usingBigBlocks ? 'big' : 'small';
			chainSwitchError =
				err instanceof Error ? err.message : `Could not switch to ${mode} EVM blocks.`;
		} finally {
			chainSwitching = null;
		}
	}

	async function requireL1SigningWallet(action: string) {
		const signingWallet = wallet.getSigningWallet();
		if (!signingWallet) {
			throw new Error(`Connect an injected root wallet to ${action}.`);
		}
		const chainId = await signingWallet.getChainId();
		if (chainId === HYPERLIQUID_L1_CHAIN_ID) return signingWallet;

		await wallet.switchChain({
			chainId: HYPERLIQUID_L1_CHAIN.chainId,
			addEthereumChainParameter: HYPERLIQUID_L1_CHAIN.addEthereumChainParameter
		});
		const nextChainId = await signingWallet.getChainId();
		if (nextChainId !== HYPERLIQUID_L1_CHAIN_ID) {
			throw new Error(`Switch wallet to Hyperliquid L1 before you ${action}.`);
		}
		return signingWallet;
	}

	async function loadEvmBlockMode(
		address: string,
		network: HyperliquidNetwork,
		generation = ++evmBlockModeGeneration
	) {
		evmBlockModeLoading = true;
		evmBlockModeError = null;
		try {
			const usingBigBlocks = await fetchUsingBigBlocks(address, network);
			if (generation !== evmBlockModeGeneration) return;
			evmBlockMode = usingBigBlocks ? 'big' : 'small';
		} catch (err) {
			if (generation !== evmBlockModeGeneration) return;
			evmBlockMode = null;
			evmBlockModeError =
				err instanceof Error ? err.message : 'Could not read current EVM block mode.';
		} finally {
			if (generation === evmBlockModeGeneration) evmBlockModeLoading = false;
		}
	}

	async function fetchUsingBigBlocks(address: string, network: HyperliquidNetwork) {
		const response = await fetch(hyperEvmRpcUrl(network), {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				jsonrpc: '2.0',
				id: 1,
				method: 'eth_usingBigBlocks',
				params: [address]
			})
		});
		if (!response.ok) throw new Error('Could not read current EVM block mode.');
		const payload = (await response.json()) as {
			result?: unknown;
			error?: { message?: string };
		};
		if (payload.error) {
			throw new Error(payload.error.message ?? 'Could not read current EVM block mode.');
		}
		if (typeof payload.result !== 'boolean') {
			throw new Error('HyperEVM RPC returned an invalid block mode.');
		}
		return payload.result;
	}

	function isTextEntryTarget(target: EventTarget | null) {
		if (!(target instanceof HTMLElement)) return false;
		const tag = target.tagName;
		return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
	}

	function handleWorkspaceKeydown(event: KeyboardEvent) {
		if (!wallet.current || event.metaKey || event.ctrlKey || event.altKey) return;
		if (isTextEntryTarget(event.target)) return;
		if (connectModalOpen || trackL1CoreModalOpen || trackHyperEvmModalOpen || widgetSelectorOpen) {
			return;
		}

		const horizontal = views.orientation === 'horizontal';
		switch (event.key) {
			case 'h':
				if (horizontal) views.focusColumn(-1);
				else views.focusSlot(-1);
				break;
			case 'l':
				if (horizontal) views.focusColumn(1);
				else views.focusSlot(1);
				break;
			case 'k':
				if (horizontal) views.focusSlot(-1);
				else views.focusColumn(-1);
				break;
			case 'j':
				if (horizontal) views.focusSlot(1);
				else views.focusColumn(1);
				break;
			case 'o':
				openSelector();
				break;
			case 'q':
				if (views.focusedId) views.close(views.focusedId);
				break;
			default:
				return;
		}
		event.preventDefault();
	}

	onMount(() => {
		closedDefaultViews = loadClosedDefaultViews();
		defaultViewsHydrated = true;
		disconnectedQuote =
			DISCONNECTED_QUOTES[Math.floor(Math.random() * DISCONNECTED_QUOTES.length)] ??
			DISCONNECTED_QUOTES[0];
	});

	$effect(() => {
		const nonce = views.closeNonce;
		if (nonce === handledCloseNonce) return;
		handledCloseNonce = nonce;
		if (isDefaultViewId(views.lastClosedId)) closeDefaultView(views.lastClosedId);
	});

	$effect(() => {
		if (!wallet.current) {
			viewStackRestored = false;
			if (views.entries.length > 0) views.clear();
			return;
		}
		if (!defaultViewsHydrated) return;

		if (viewStackRestored) return;
		restoreViewStack();
		viewStackRestored = true;
	});

	$effect(() => {
		if (!browser || !wallet.current || !defaultViewsHydrated || !viewStackRestored) return;

		persistViewStack(views.entries, views.focusedId);
	});

	$effect(() => {
		if (!browser || !wallet.current || !defaultViewsHydrated || !viewStackRestored) return;

		persistWorkspaceLayout(views.snapshotLayout());
	});

	$effect(() => {
		const address = wallet.current?.address;
		const network = hyperliquidNetwork.current;
		if (!address || wallet.current?.source !== 'injected') {
			evmBlockModeGeneration += 1;
			evmBlockMode = null;
			evmBlockModeLoading = false;
			evmBlockModeError = null;
			return;
		}

		void loadEvmBlockMode(address, network);
	});
</script>

<svelte:window onkeydown={handleWorkspaceKeydown} />

<div class="flex h-[calc(100svh-3.5rem-1.5rem)] flex-col gap-3">
	{#if wallet.current}
		{#if wallet.current.source === 'injected'}
			<section
				class="flex flex-col gap-3 rounded-lg bg-base-100/80 px-3 py-2 shadow-sm shadow-neutral/5 backdrop-blur"
				aria-label="Wallet controls"
			>
				<div class="min-w-0">
					<p class="text-xs font-semibold text-base-content/70">Wallet controls</p>
					{#if chainSwitchError}
						<div role="alert" class="mt-1 text-xs text-error">{chainSwitchError}</div>
					{:else if chainSwitchMessage}
						<div role="status" class="mt-1 text-xs text-success">{chainSwitchMessage}</div>
					{:else if evmBlockModeLoading}
						<div role="status" class="mt-1 text-xs text-base-content/60">
							Checking EVM block mode...
						</div>
					{:else if evmBlockModeError}
						<div role="alert" class="mt-1 text-xs text-warning">{evmBlockModeError}</div>
					{/if}
				</div>
				<div class="flex flex-wrap items-center justify-start gap-2">
					<button
						class="btn btn-sm"
						disabled={chainSwitching !== null}
						onclick={() => switchWalletChain('l1')}
						title="Switch wallet to Hyperliquid L1 signing chain"
					>
						{#if wallet.current.providerIcon}
							<img src={wallet.current.providerIcon} alt="" class="size-4 rounded" />
						{/if}
						{#if chainSwitching === 'l1'}
							<span class="loading loading-xs loading-spinner"></span>
						{/if}
						Switch to Hyperliquid L1
					</button>
					<button
						class="btn btn-sm"
						disabled={chainSwitching !== null}
						onclick={() => switchWalletChain('evm')}
						title="Add or switch wallet to HyperEVM"
					>
						{#if wallet.current.providerIcon}
							<img src={wallet.current.providerIcon} alt="" class="size-4 rounded" />
						{/if}
						{#if chainSwitching === 'evm'}
							<span class="loading loading-xs loading-spinner"></span>
						{/if}
						Switch to HyperEVM
					</button>
					<div class="join">
						<button
							class="btn join-item border-base-300 btn-sm"
							class:bg-base-300={evmBlockMode === 'big'}
							class:text-base-content={evmBlockMode === 'big'}
							class:btn-ghost={evmBlockMode !== 'big'}
							disabled={chainSwitching !== null}
							onclick={() => switchEvmBlockMode(true)}
							title="Set this account to send HyperEVM transactions to big blocks"
						>
							{#if chainSwitching === 'big-blocks'}
								<span class="loading loading-xs loading-spinner"></span>
							{/if}
							Big EVM blocks
						</button>
						<button
							class="btn join-item border-base-300 btn-sm"
							class:bg-base-300={evmBlockMode === 'small'}
							class:text-base-content={evmBlockMode === 'small'}
							class:btn-ghost={evmBlockMode !== 'small'}
							disabled={chainSwitching !== null}
							onclick={() => switchEvmBlockMode(false)}
							title="Set this account to send HyperEVM transactions to small blocks"
						>
							{#if chainSwitching === 'small-blocks'}
								<span class="loading loading-xs loading-spinner"></span>
							{/if}
							Small EVM blocks
						</button>
					</div>
				</div>
			</section>
		{/if}

		<div
			class="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-base-100/60 p-1 shadow-sm shadow-neutral/5"
		>
			<div class="flex flex-wrap gap-2">
				<button
					class="btn btn-ghost btn-sm"
					onclick={() => addWidget('l1core')}
					title="Open HyperCore L1 view"
				>
					L1 Core
				</button>
				<button
					class="btn btn-ghost btn-sm"
					onclick={() => addWidget('hyperevm')}
					title="Open HyperEVM view"
				>
					HyperEVM
				</button>
				<button
					class="btn btn-ghost btn-sm"
					onclick={() => addWidget('asset-universe')}
					title="Open asset universe view"
				>
					Asset universe
				</button>
				<button
					class="btn btn-ghost btn-sm"
					onclick={() => addWidget('hip1')}
					title="Open HIP-1 deployment view"
				>
					HIP-1
				</button>
				<button
					class="btn btn-ghost btn-sm"
					onclick={() => addWidget('hip3')}
					title="Open HIP-3 view"
				>
					HIP-3
				</button>
				<button
					class="btn btn-ghost btn-sm"
					onclick={() => addWidget('api')}
					title="Open API status view"
				>
					API
				</button>
				<button
					class="btn btn-ghost btn-sm"
					onclick={() => addWidget('validator-votes')}
					title="Open validator votes view"
				>
					Validator votes
				</button>
				<button
					class="btn btn-ghost btn-sm"
					onclick={() => addWidget('api-sandbox')}
					title="Open API sandbox view"
				>
					API sandbox
				</button>
			</div>
			<div class="flex flex-wrap items-center justify-end gap-2">
				{#if workspaceExportError}
					<span role="alert" class="px-1 text-xs text-error">{workspaceExportError}</span>
				{:else if workspaceExportMessage}
					<span role="status" class="px-1 text-xs text-success">{workspaceExportMessage}</span>
				{/if}
				<button
					class="btn btn-ghost btn-sm"
					onclick={() => views.toggleOrientation()}
					title="Toggle between horizontal and vertical scroll"
				>
					<HeroIcon name={views.orientation === 'horizontal' ? 'arrow-right' : 'chevron-down'} />
					{views.orientation === 'horizontal' ? 'Horizontal' : 'Vertical'}
				</button>
				<button
					class="btn btn-ghost btn-sm"
					onclick={exportWorkspace}
					title="Export workspace JSON"
				>
					<HeroIcon name="arrow-down-tray" />
					Export workspace
				</button>
			</div>
		</div>

		<div class="min-h-0 flex-1">
			{#if views.entries.length === 0}
				<div class="flex h-full items-center justify-center">
					<button class="btn btn-primary" onclick={() => addWidget('l1core')}>Add wallet</button>
				</div>
			{:else}
				<ViewStack />
			{/if}
		</div>
	{:else}
		<div class="relative min-h-0 flex-1 overflow-y-auto px-2 py-5 sm:px-6 sm:py-7">
			<div class="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
				<div class="absolute -top-24 left-[12%] size-80 rounded-full bg-primary/5 blur-3xl"></div>
				<div class="absolute right-[8%] bottom-0 size-64 rounded-full bg-accent/5 blur-3xl"></div>
			</div>

			<div class="relative mx-auto flex min-h-full w-full max-w-6xl flex-col gap-6">
				<div
					class="grid flex-1 gap-8 lg:grid-cols-[minmax(0,0.84fr)_minmax(0,1.16fr)] lg:items-center xl:gap-12"
				>
					<section class="flex min-w-0 flex-col gap-6 py-2 lg:py-8">
						<div class="space-y-4">
							<div class="flex items-center gap-3">
								<span
									class="grid size-11 place-items-center rounded-xl border border-base-content/5 bg-base-100/80 shadow-sm shadow-neutral/5"
								>
									<img src={purr} alt="" class="size-7" />
								</span>
								<div>
									<p
										class="font-mono text-[11px] font-semibold tracking-[0.16em] text-base-content/55 uppercase"
									>
										purr.build
									</p>
									<p class="mt-0.5 text-xs text-base-content/40">Builder workspace</p>
								</div>
							</div>

							<h1
								class="max-w-2xl text-4xl leading-[1.08] font-semibold tracking-[-0.025em] text-base-content sm:text-5xl lg:text-[3.25rem]"
							>
								Hyperliquid builder tools in one workspace.
							</h1>
							<p class="max-w-xl text-base leading-7 text-base-content/65">
								Track accounts, inspect network data, and use builder tools without jumping between
								dashboards. Connect a wallet, or explore the read-only demo.
							</p>
						</div>

						<div class="flex flex-wrap gap-3">
							<button
								class="btn cursor-pointer px-5 shadow-sm shadow-primary/15 btn-primary"
								onclick={() => (connectModalOpen = true)}
							>
								Connect wallet
								<span aria-hidden="true">→</span>
							</button>
							<button
								class="btn cursor-pointer border-base-content/15 bg-base-100/40 px-5 font-mono btn-outline disabled:cursor-not-allowed"
								disabled={demoWorkspaceLoading}
								onclick={useDemoWorkspace}
							>
								{#if demoWorkspaceLoading}
									<span class="loading loading-xs loading-spinner"></span>
								{/if}
								Demo workspace
							</button>
						</div>
						{#if demoWorkspaceError}
							<p role="alert" class="text-sm text-error">{demoWorkspaceError}</p>
						{/if}

						<blockquote
							class="max-w-md border-l border-base-content/10 pl-4 text-xs leading-5 text-base-content/35 italic"
						>
							{disconnectedQuote}
						</blockquote>
					</section>

					<section
						class="min-w-0 rounded-2xl border border-base-content/5 bg-base-100/35 p-3 shadow-xl shadow-neutral/5 backdrop-blur-sm sm:p-4"
						aria-labelledby="landing-features-title"
					>
						<div class="mb-4 px-1">
							<h2 id="landing-features-title" class="text-lg font-semibold text-base-content">
								Core features
							</h2>
							<p class="mt-1 text-sm text-base-content/50">
								Track accounts, build, and inspect the network.
							</p>
						</div>

						<div class="grid min-w-0 gap-2 sm:grid-cols-2">
							{#each LANDING_FEATURES as feature (feature.title)}
								<article
									class="rounded-xl border border-base-content/5 bg-base-100/70 p-5 shadow-sm shadow-neutral/5"
								>
									<h3 class="text-sm font-semibold text-base-content">{feature.title}</h3>
									<p class="mt-2 text-sm leading-6 text-base-content/60">
										{feature.description}
									</p>
								</article>
							{/each}
						</div>
					</section>
				</div>
			</div>
		</div>
	{/if}

	<SupportFooter />
</div>

<ConnectWalletModal open={connectModalOpen} onClose={() => (connectModalOpen = false)} />
<TrackWalletModal
	open={trackL1CoreModalOpen}
	title="Track L1 wallet"
	addCurrentLabel="Add current L1 wallet"
	currentAddress={wallet.current?.address ?? null}
	onAdd={addManualL1Core}
	onAddCurrent={addCurrentL1Core}
	onClose={() => {
		trackL1CoreModalOpen = false;
		pendingColumnTarget = null;
	}}
/>
<TrackWalletModal
	open={trackHyperEvmModalOpen}
	title="Track HyperEVM wallet"
	addCurrentLabel="Add current HyperEVM wallet"
	showAgentWallet={false}
	currentAddress={wallet.current?.address ?? null}
	onAdd={addManualHyperEvm}
	onAddCurrent={addCurrentHyperEvm}
	onClose={() => {
		trackHyperEvmModalOpen = false;
		pendingColumnTarget = null;
	}}
/>
<WidgetSelector open={widgetSelectorOpen} options={widgetOptions} onClose={closeSelector} />
