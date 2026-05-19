import APIView from './components/APIView.svelte';
import ApiSandboxView from './components/ApiSandboxView.svelte';
import AssetUniverseView from './components/AssetUniverseView.svelte';
import Hip3View from './components/Hip3View.svelte';
import HyperEvmView from './components/HyperEvmView.svelte';
import L1CoreView from './components/L1CoreView.svelte';
import Panel from './Panel.svelte';
import type { AnyComponent, ViewEntry, ViewSpec } from './stack.svelte';

type RegistrySpec = {
	title: string;
	component: AnyComponent;
	fixedId?: string;
};

export const DEFAULT_VIEW_TYPES = ['l1core', 'api'] as const;
export type RegisteredViewType =
	| 'panel'
	| 'l1core'
	| 'hyperevm'
	| 'api'
	| 'api-sandbox'
	| 'asset-universe'
	| 'hip3';
export type DefaultViewType = (typeof DEFAULT_VIEW_TYPES)[number];

export const VIEW_REGISTRY: Record<RegisteredViewType, RegistrySpec> = {
	panel: {
		title: 'Panel',
		component: Panel
	},
	l1core: {
		title: 'HyperCore L1',
		component: L1CoreView
	},
	hyperevm: {
		title: 'HyperEVM',
		component: HyperEvmView
	},
	api: {
		title: 'API',
		component: APIView,
		fixedId: 'api'
	},
	'api-sandbox': {
		title: 'API Sandbox',
		component: ApiSandboxView,
		fixedId: 'api-sandbox'
	},
	'asset-universe': {
		title: 'Asset Universe',
		component: AssetUniverseView,
		fixedId: 'asset-universe'
	},
	hip3: {
		title: 'HIP-3',
		component: Hip3View,
		fixedId: 'hip3'
	}
};

export function isRegisteredViewType(value: unknown): value is RegisteredViewType {
	return typeof value === 'string' && value in VIEW_REGISTRY;
}

export function isDefaultViewType(value: string | null): value is DefaultViewType {
	return DEFAULT_VIEW_TYPES.includes(value as DefaultViewType);
}

export function fixedViewIdForType(type: RegisteredViewType) {
	return VIEW_REGISTRY[type].fixedId ?? null;
}

export function viewSpecForType(
	type: RegisteredViewType,
	props: Record<string, unknown> = {}
): Omit<ViewSpec, 'id' | 'parentId'> {
	const entry = VIEW_REGISTRY[type];
	return {
		title: entry.title,
		component: entry.component,
		props
	};
}

export function viewTypeForEntry(
	entry: Pick<ViewEntry, 'id' | 'component'>
): RegisteredViewType | null {
	if (entry.id === 'api' || entry.component === VIEW_REGISTRY.api.component) return 'api';
	if (entry.id === 'api-sandbox' || entry.component === VIEW_REGISTRY['api-sandbox'].component) {
		return 'api-sandbox';
	}
	if (
		entry.id === 'asset-universe' ||
		entry.component === VIEW_REGISTRY['asset-universe'].component
	) {
		return 'asset-universe';
	}
	if (entry.id === 'hip3' || entry.component === VIEW_REGISTRY.hip3.component) return 'hip3';
	if (entry.id === 'l1core' || entry.component === VIEW_REGISTRY.l1core.component) return 'l1core';
	if (entry.id === 'hyperevm' || entry.component === VIEW_REGISTRY.hyperevm.component) {
		return 'hyperevm';
	}
	if (entry.component === VIEW_REGISTRY.panel.component) return 'panel';
	return null;
}
