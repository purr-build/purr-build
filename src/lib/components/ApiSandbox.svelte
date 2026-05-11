<script lang="ts">
	import {
		ApproveAgentTypes,
		ApproveBuilderFeeTypes,
		CDepositTypes,
		CWithdrawTypes,
		ConvertToMultiSigUserTypes,
		LinkStakingUserTypes,
		SendAssetTypes,
		SendToEvmWithDataTypes,
		SpotSendTypes,
		TokenDelegateTypes,
		UsdClassTransferTypes,
		UsdSendTypes,
		UserDexAbstractionTypes,
		UserPortfolioMarginTypes,
		UserSetAbstractionTypes,
		Withdraw3Types
	} from '@nktkas/hyperliquid/api/exchange';
	import {
		signL1Action,
		signUserSignedAction,
		type AbstractWallet
	} from '@nktkas/hyperliquid/signing';
	import { isAddress } from 'viem';
	import { privateKeyToAccount } from 'viem/accounts';
	import CopyAddress from '$lib/components/CopyAddress.svelte';
	import HeroIcon from '$lib/components/HeroIcon.svelte';
	import { loadSavedAgentWallets, type SavedAgentWallet } from '$lib/hl/agent-wallets.js';
	import { HYPERLIQUID_L1_SIGNATURE_CHAIN_ID } from '$lib/hl/clients.js';
	import { hyperliquidNetwork } from '$lib/hl/network.svelte';
	import { HYPERLIQUID_L1_ADD_ETHEREUM_CHAIN_PARAMETER } from '$lib/hl/wallet-chains.js';
	import { wallet } from '$lib/stores/wallet.svelte';

	type Eip712Types = Record<string, { name: string; type: string }[]>;
	type SigningKind = 'l1' | 'user';
	type MethodMeta = {
		id: string;
		label: string;
		signing: SigningKind;
		description: string;
		sample: Record<string, unknown>;
		types?: Eip712Types;
	};
	type MethodGroup = {
		label: string;
		methods: MethodMeta[];
	};
	type SignerOption = {
		key: string;
		label: string;
		address: `0x${string}`;
		kind: 'browser' | 'agent';
		agent?: SavedAgentWallet;
	};

	const MAINNET_EXCHANGE_URL = 'https://api.hyperliquid.xyz/exchange';
	const TESTNET_EXCHANGE_URL = 'https://api.hyperliquid-testnet.xyz/exchange';
	const SYSTEM_ACTION_FIELDS = new Set([
		'type',
		'signatureChainId',
		'hyperliquidChain',
		'nonce',
		'time',
		'signature'
	]);

	const COMMON_ORDER = {
		a: 0,
		b: true,
		p: '30000',
		s: '0.01',
		r: false,
		t: { limit: { tif: 'Gtc' } }
	};

	const L1_METHODS: MethodMeta[] = [
		{
			id: 'order',
			label: 'order',
			signing: 'l1',
			description: 'Place one or more perp orders with an agent or root wallet.',
			sample: { orders: [COMMON_ORDER], grouping: 'na' }
		},
		{
			id: 'cancel',
			label: 'cancel',
			signing: 'l1',
			description: 'Cancel one or more perp orders by order id.',
			sample: { cancels: [{ a: 0, o: 123456789 }] }
		},
		{
			id: 'modify',
			label: 'modify',
			signing: 'l1',
			description: 'Modify an existing perp order.',
			sample: { oid: 123456789, order: { ...COMMON_ORDER, p: '31000' } }
		},
		{
			id: 'batchModify',
			label: 'batchModify',
			signing: 'l1',
			description: 'Modify several existing orders in one request.',
			sample: { modifies: [{ oid: 123456789, order: { ...COMMON_ORDER, p: '31000' } }] }
		},
		{
			id: 'scheduleCancel',
			label: 'scheduleCancel',
			signing: 'l1',
			description: 'Schedule or clear a dead-man switch cancel time.',
			sample: { time: 1700000060000 }
		},
		{
			id: 'updateLeverage',
			label: 'updateLeverage',
			signing: 'l1',
			description: 'Update cross or isolated leverage for an asset.',
			sample: { asset: 0, isCross: true, leverage: 5 }
		},
		{
			id: 'updateIsolatedMargin',
			label: 'updateIsolatedMargin',
			signing: 'l1',
			description: 'Add or remove isolated margin.',
			sample: { asset: 0, isBuy: true, ntli: 1000000 }
		},
		{
			id: 'reserveRequestWeight',
			label: 'reserveRequestWeight',
			signing: 'l1',
			description: 'Reserve additional request weight.',
			sample: { weight: 1 }
		},
		{
			id: 'evmUserModify',
			label: 'evmUserModify',
			signing: 'l1',
			description: 'Set whether this account uses big HyperEVM blocks.',
			sample: { usingBigBlocks: true }
		},
		{
			id: 'agentSetAbstraction',
			label: 'agentSetAbstraction',
			signing: 'l1',
			description: 'Set abstraction mode from an agent wallet.',
			sample: { abstract: true }
		},
		{
			id: 'agentEnableDexAbstraction',
			label: 'agentEnableDexAbstraction',
			signing: 'l1',
			description: 'Deprecated HIP-3 agent abstraction action.',
			sample: {}
		},
		{
			id: 'borrowLend',
			label: 'borrowLend',
			signing: 'l1',
			description: 'Deposit to or withdraw from borrow/lend.',
			sample: { token: 0, amount: '1', isDeposit: true }
		},
		{
			id: 'cancelByCloid',
			label: 'cancelByCloid',
			signing: 'l1',
			description: 'Cancel one or more perp orders by client order id.',
			sample: { cancels: [{ asset: 0, cloid: '0x00000000000000000000000000000000' }] }
		},
		{
			id: 'claimRewards',
			label: 'claimRewards',
			signing: 'l1',
			description: 'Claim staking or referral rewards.',
			sample: {}
		},
		{
			id: 'createSubAccount',
			label: 'createSubAccount',
			signing: 'l1',
			description: 'Create a named sub-account.',
			sample: { name: 'subaccount' }
		},
		{
			id: 'createVault',
			label: 'createVault',
			signing: 'l1',
			description: 'Create a vault.',
			sample: { name: 'vault', description: 'Sandbox vault', initialUsd: 1000000 }
		},
		{
			id: 'cSignerAction',
			label: 'cSignerAction',
			signing: 'l1',
			description: 'Consensus signer action.',
			sample: {}
		},
		{
			id: 'cValidatorAction',
			label: 'cValidatorAction',
			signing: 'l1',
			description: 'Consensus validator action.',
			sample: {}
		},
		{
			id: 'noop',
			label: 'noop',
			signing: 'l1',
			description: 'No-op signed action.',
			sample: {}
		},
		{
			id: 'perpDeploy',
			label: 'perpDeploy',
			signing: 'l1',
			description: 'HIP-3 perp deploy action.',
			sample: { dex: 'test', action: { type: 'noop' } }
		},
		{
			id: 'registerReferrer',
			label: 'registerReferrer',
			signing: 'l1',
			description: 'Register a referral code.',
			sample: { code: 'CODE' }
		},
		{
			id: 'setDisplayName',
			label: 'setDisplayName',
			signing: 'l1',
			description: 'Set display name.',
			sample: { displayName: 'purrbuild' }
		},
		{
			id: 'setReferrer',
			label: 'setReferrer',
			signing: 'l1',
			description: 'Set a referrer code.',
			sample: { code: 'CODE' }
		},
		{
			id: 'spotDeploy',
			label: 'spotDeploy',
			signing: 'l1',
			description: 'Spot deploy action.',
			sample: { action: { type: 'noop' } }
		},
		{
			id: 'spotUser',
			label: 'spotUser',
			signing: 'l1',
			description: 'Spot user action.',
			sample: {}
		},
		{
			id: 'subAccountModify',
			label: 'subAccountModify',
			signing: 'l1',
			description: 'Rename a sub-account.',
			sample: { subAccountUser: '0x0000000000000000000000000000000000000000', name: 'subaccount' }
		},
		{
			id: 'subAccountSpotTransfer',
			label: 'subAccountSpotTransfer',
			signing: 'l1',
			description: 'Transfer spot funds between main account and sub-account.',
			sample: {
				subAccountUser: '0x0000000000000000000000000000000000000000',
				isDeposit: true,
				token: 0,
				amount: '1'
			}
		},
		{
			id: 'subAccountTransfer',
			label: 'subAccountTransfer',
			signing: 'l1',
			description: 'Transfer USDC between main account and sub-account.',
			sample: {
				subAccountUser: '0x0000000000000000000000000000000000000000',
				isDeposit: true,
				usd: 1000000
			}
		},
		{
			id: 'topUpIsolatedOnlyMargin',
			label: 'topUpIsolatedOnlyMargin',
			signing: 'l1',
			description: 'Top up isolated-only margin.',
			sample: { asset: 0, isBuy: true, ntli: 1000000 }
		},
		{
			id: 'twapCancel',
			label: 'twapCancel',
			signing: 'l1',
			description: 'Cancel a TWAP order.',
			sample: { a: 0, t: 123456789 }
		},
		{
			id: 'twapOrder',
			label: 'twapOrder',
			signing: 'l1',
			description: 'Place a TWAP order.',
			sample: { twap: { a: 0, b: true, s: '0.01', r: false, m: 10, t: false } }
		},
		{
			id: 'validatorL1Stream',
			label: 'validatorL1Stream',
			signing: 'l1',
			description: 'Configure validator L1 stream.',
			sample: { connect: true }
		},
		{
			id: 'vaultDistribute',
			label: 'vaultDistribute',
			signing: 'l1',
			description: 'Distribute vault funds.',
			sample: { vaultAddress: '0x0000000000000000000000000000000000000000', usd: 1000000 }
		},
		{
			id: 'vaultModify',
			label: 'vaultModify',
			signing: 'l1',
			description: 'Modify vault metadata.',
			sample: {
				vaultAddress: '0x0000000000000000000000000000000000000000',
				allowDeposits: true
			}
		},
		{
			id: 'vaultTransfer',
			label: 'vaultTransfer',
			signing: 'l1',
			description: 'Deposit to or withdraw from a vault.',
			sample: {
				vaultAddress: '0x0000000000000000000000000000000000000000',
				isDeposit: true,
				usd: 1000000
			}
		}
	];

	const USER_SIGNED_METHODS: MethodMeta[] = [
		{
			id: 'approveAgent',
			label: 'approveAgent',
			signing: 'user',
			description: 'Register or remove an API agent wallet.',
			types: ApproveAgentTypes,
			sample: {
				agentAddress: '0x0000000000000000000000000000000000000000',
				agentName: 'purrbuild'
			}
		},
		{
			id: 'approveBuilderFee',
			label: 'approveBuilderFee',
			signing: 'user',
			description: 'Approve a builder fee cap.',
			types: ApproveBuilderFeeTypes,
			sample: {
				maxFeeRate: '0.01%',
				builder: '0x0000000000000000000000000000000000000000'
			}
		},
		{
			id: 'usdSend',
			label: 'usdSend',
			signing: 'user',
			description: 'Send USDC to another address.',
			types: UsdSendTypes,
			sample: { destination: '0x0000000000000000000000000000000000000000', amount: '1' }
		},
		{
			id: 'spotSend',
			label: 'spotSend',
			signing: 'user',
			description: 'Send a spot token to another address.',
			types: SpotSendTypes,
			sample: { destination: '0x0000000000000000000000000000000000000000', token: 0, amount: '1' }
		},
		{
			id: 'withdraw3',
			label: 'withdraw3',
			signing: 'user',
			description: 'Initiate a USDC withdrawal.',
			types: Withdraw3Types,
			sample: { destination: '0x0000000000000000000000000000000000000000', amount: '1' }
		},
		{
			id: 'cDeposit',
			label: 'cDeposit',
			signing: 'user',
			description: 'Deposit from Core spot to perps.',
			types: CDepositTypes,
			sample: { wei: 1000000 }
		},
		{
			id: 'cWithdraw',
			label: 'cWithdraw',
			signing: 'user',
			description: 'Withdraw from perps to Core spot.',
			types: CWithdrawTypes,
			sample: { wei: 1000000 }
		},
		{
			id: 'convertToMultiSigUser',
			label: 'convertToMultiSigUser',
			signing: 'user',
			description: 'Convert an account to a multi-sig user.',
			types: ConvertToMultiSigUserTypes,
			sample: { signers: ['0x0000000000000000000000000000000000000000'], threshold: 1 }
		},
		{
			id: 'linkStakingUser',
			label: 'linkStakingUser',
			signing: 'user',
			description: 'Link a staking user.',
			types: LinkStakingUserTypes,
			sample: { user: '0x0000000000000000000000000000000000000000' }
		},
		{
			id: 'sendAsset',
			label: 'sendAsset',
			signing: 'user',
			description: 'Send a Core asset.',
			types: SendAssetTypes,
			sample: {
				destination: '0x0000000000000000000000000000000000000000',
				sourceDex: '',
				destinationDex: '',
				token: 0,
				amount: '1'
			}
		},
		{
			id: 'sendToEvmWithData',
			label: 'sendToEvmWithData',
			signing: 'user',
			description: 'Send Core spot to HyperEVM with calldata.',
			types: SendToEvmWithDataTypes,
			sample: {
				destination: '0x0000000000000000000000000000000000000000',
				token: 0,
				amount: '1',
				data: '0x'
			}
		},
		{
			id: 'tokenDelegate',
			label: 'tokenDelegate',
			signing: 'user',
			description: 'Delegate or undelegate HYPE.',
			types: TokenDelegateTypes,
			sample: {
				validator: '0x0000000000000000000000000000000000000000',
				wei: 100000000,
				isUndelegate: false
			}
		},
		{
			id: 'usdClassTransfer',
			label: 'usdClassTransfer',
			signing: 'user',
			description: 'Transfer USDC between perps and spot.',
			types: UsdClassTransferTypes,
			sample: { amount: '1', toPerp: true }
		},
		{
			id: 'userDexAbstraction',
			label: 'userDexAbstraction',
			signing: 'user',
			description: 'Set user DEX abstraction.',
			types: UserDexAbstractionTypes,
			sample: { dex: 'test' }
		},
		{
			id: 'userPortfolioMargin',
			label: 'userPortfolioMargin',
			signing: 'user',
			description: 'Toggle portfolio margin.',
			types: UserPortfolioMarginTypes,
			sample: { enabled: true }
		},
		{
			id: 'userSetAbstraction',
			label: 'userSetAbstraction',
			signing: 'user',
			description: 'Set user abstraction.',
			types: UserSetAbstractionTypes,
			sample: { abstract: true }
		}
	];

	const METHOD_GROUPS: MethodGroup[] = [
		{ label: 'L1 signed actions', methods: L1_METHODS },
		{ label: 'User-signed actions', methods: USER_SIGNED_METHODS }
	];
	const METHOD_OPTIONS = METHOD_GROUPS.flatMap((group) => group.methods);
	const METHOD_BY_ID = Object.fromEntries(METHOD_OPTIONS.map((method) => [method.id, method]));

	let selectedMethodId = $state('order');
	let selectedSignerKey = $state('');
	let payloadInput = $state(prettyJson(METHOD_BY_ID.order.sample));
	let nonceInput = $state('');
	let vaultAddressInput = $state('');
	let expiresAfterInput = $state('');
	let savedAgentWallets = $state<SavedAgentWallet[]>([]);
	let signing = $state(false);
	let chainSwitching = $state(false);
	let error = $state<string | null>(null);
	let notice = $state<string | null>(null);
	let curl = $state<string | null>(null);
	let signedBody = $state<unknown | null>(null);

	const selectedMethod = $derived(METHOD_BY_ID[selectedMethodId] ?? METHOD_OPTIONS[0]);
	const exchangeUrl = $derived(
		hyperliquidNetwork.current === 'testnet' ? TESTNET_EXCHANGE_URL : MAINNET_EXCHANGE_URL
	);
	const signerOptions = $derived(buildSignerOptions());

	function buildSignerOptions(): SignerOption[] {
		const options: SignerOption[] = [];
		const current = wallet.current;
		if (current?.source === 'injected' && wallet.canSign) {
			options.push({
				key: 'browser',
				label: current.providerName ? `Browser wallet: ${current.providerName}` : 'Browser wallet',
				address: current.address,
				kind: 'browser'
			});
		}
		for (const agent of savedAgentWallets) {
			const expired = agent.validUntil <= Date.now();
			options.push({
				key: `agent:${agent.address.toLowerCase()}`,
				label: `${agent.name || formatAddress(agent.address)} agent${expired ? ' (expired)' : ''}`,
				address: agent.address,
				kind: 'agent',
				agent
			});
		}
		return options;
	}

	function updateMethod(event: Event) {
		const nextId = (event.currentTarget as HTMLSelectElement).value;
		const next = METHOD_BY_ID[nextId] ?? METHOD_OPTIONS[0];
		selectedMethodId = next.id;
		payloadInput = prettyJson(next.sample);
		clearPreview();
	}

	function resetPayload() {
		payloadInput = prettyJson(selectedMethod.sample);
		clearPreview();
	}

	function formatPayload() {
		try {
			payloadInput = prettyJson(parseJsonObject(payloadInput));
			error = null;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Payload is not valid JSON.';
		}
	}

	function clearPreview() {
		error = null;
		notice = null;
		curl = null;
		signedBody = null;
	}

	function methodTag(method: MethodMeta) {
		return method.signing === 'l1' ? 'L1' : 'User';
	}

	function getNonce() {
		const trimmed = nonceInput.trim();
		if (!trimmed) return Date.now();
		const parsed = Number(trimmed);
		if (!Number.isSafeInteger(parsed) || parsed < 0) {
			throw new Error('Nonce must be a non-negative safe integer.');
		}
		return parsed;
	}

	function requestOptions() {
		const vaultAddress = vaultAddressInput.trim();
		const expiresAfter = expiresAfterInput.trim();
		const options: { vaultAddress?: `0x${string}`; expiresAfter?: number } = {};
		if (vaultAddress) {
			if (!isAddress(vaultAddress)) throw new Error('Vault address must be a valid EVM address.');
			options.vaultAddress = vaultAddress as `0x${string}`;
		}
		if (expiresAfter) {
			const parsed = Number(expiresAfter);
			if (!Number.isSafeInteger(parsed) || parsed < 0) {
				throw new Error('Expires after must be a non-negative safe integer timestamp.');
			}
			options.expiresAfter = parsed;
		}
		return options;
	}

	function selectedSigner() {
		return signerOptions.find((option) => option.key === selectedSignerKey) ?? null;
	}

	async function signerWallet() {
		const signer = selectedSigner();
		if (!signer) throw new Error('Choose a browser wallet or saved agent wallet.');

		if (signer.kind === 'agent') {
			if (!signer.agent) throw new Error('Saved agent wallet is unavailable.');
			return privateKeyToAccount(signer.agent.privateKey) as AbstractWallet;
		}

		const signingWallet = wallet.getSigningWallet();
		if (!signingWallet) throw new Error('Connect an injected browser wallet to sign.');

		chainSwitching = true;
		try {
			const chainId = await signingWallet.getChainId();
			const l1ChainId = Number(BigInt(HYPERLIQUID_L1_SIGNATURE_CHAIN_ID));
			if (chainId !== l1ChainId) {
				await wallet.switchChain({
					chainId: HYPERLIQUID_L1_SIGNATURE_CHAIN_ID,
					addEthereumChainParameter: HYPERLIQUID_L1_ADD_ETHEREUM_CHAIN_PARAMETER
				});
			}
			const nextChainId = await signingWallet.getChainId();
			if (nextChainId !== l1ChainId) {
				throw new Error('Switch wallet to Hyperliquid L1 before signing this request.');
			}
			return signingWallet as AbstractWallet;
		} finally {
			chainSwitching = false;
		}
	}

	function actionPayload(method: MethodMeta, payload: Record<string, unknown>) {
		const action: Record<string, unknown> = { type: method.id };
		for (const [key, value] of Object.entries(payload)) {
			if (key === 'signature') continue;
			if (key === 'type') continue;
			action[key] = value;
		}
		return action;
	}

	function userSignedAction(method: MethodMeta, payload: Record<string, unknown>, nonce: number) {
		if (!method.types) throw new Error(`${method.label} has no EIP-712 type metadata.`);
		const nonceField = nonceFieldName(method.types);
		const action: Record<string, unknown> = {
			type: method.id,
			signatureChainId: HYPERLIQUID_L1_SIGNATURE_CHAIN_ID,
			hyperliquidChain: hyperliquidNetwork.current === 'testnet' ? 'Testnet' : 'Mainnet'
		};
		for (const [key, value] of Object.entries(payload)) {
			if (SYSTEM_ACTION_FIELDS.has(key)) continue;
			action[key] = value;
		}
		action[nonceField] = nonce;
		return action as { signatureChainId: `0x${string}`; [key: string]: unknown };
	}

	function nonceFieldName(types: Eip712Types) {
		const primaryType = Object.keys(types)[0];
		const field = types[primaryType]?.find((item) => item.name === 'nonce' || item.name === 'time');
		return field?.name === 'time' ? 'time' : 'nonce';
	}

	async function signRequest() {
		if (signing) return;
		signing = true;
		clearPreview();

		try {
			const method = selectedMethod;
			const nonce = getNonce();
			const payload = parseJsonObject(payloadInput);
			const signer = await signerWallet();

			if (method.signing === 'l1') {
				const action = actionPayload(method, payload);
				const options = requestOptions();
				const signature = await signL1Action({
					wallet: signer,
					action,
					nonce,
					isTestnet: hyperliquidNetwork.current === 'testnet',
					...options
				});
				const body = compactObject({
					action,
					signature,
					nonce,
					...options
				});
				signedBody = body;
				curl = requestToCurl(exchangeUrl, body);
			} else {
				const action = userSignedAction(method, payload, nonce);
				const signature = await signUserSignedAction({
					wallet: signer,
					action,
					types: method.types as Eip712Types
				});
				const body = { action, signature, nonce };
				signedBody = body;
				curl = requestToCurl(exchangeUrl, body);
			}

			notice = 'Signed request preview updated.';
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not sign request.';
		} finally {
			signing = false;
		}
	}

	async function copyCurl() {
		if (!curl || typeof navigator === 'undefined') return;
		try {
			await navigator.clipboard.writeText(curl);
			notice = 'curl copied.';
		} catch (err) {
			error = err instanceof Error ? err.message : 'Could not copy curl.';
		}
	}

	function parseJsonObject(value: string) {
		const parsed = JSON.parse(value) as unknown;
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
			throw new Error('Payload must be a JSON object.');
		}
		return parsed as Record<string, unknown>;
	}

	function compactObject<T extends Record<string, unknown>>(value: T) {
		return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
	}

	function requestToCurl(url: string, payload: unknown) {
		return [
			`curl -X POST ${shellQuote(url)}`,
			`  -H ${shellQuote('Content-Type: application/json')}`,
			`  --data-raw ${shellQuote(JSON.stringify(payload))}`
		].join(' \\\n');
	}

	function shellQuote(value: string) {
		return `'${value.replaceAll("'", "'\\''")}'`;
	}

	function prettyJson(value: unknown) {
		return JSON.stringify(value, null, 2);
	}

	function formatAddress(address: string) {
		return `${address.slice(0, 6)}...${address.slice(-4)}`;
	}

	$effect(() => {
		const current = wallet.current?.address;
		const network = hyperliquidNetwork.current;
		savedAgentWallets = current ? loadSavedAgentWallets(current, network) : [];
	});

	$effect(() => {
		const options = signerOptions;
		if (options.length === 0) {
			selectedSignerKey = '';
			return;
		}
		if (!options.some((option) => option.key === selectedSignerKey)) {
			selectedSignerKey = options[0].key;
		}
	});
</script>

<div class="space-y-3">
	<div class="grid gap-3 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
		<section class="space-y-3 rounded-lg border border-base-300 bg-base-100 p-3">
			<div class="grid gap-3 sm:grid-cols-2">
				<label class="form-control">
					<span class="label pb-1 text-xs text-base-content/60">Method</span>
					<select class="select w-full select-sm" value={selectedMethodId} onchange={updateMethod}>
						{#each METHOD_GROUPS as group (group.label)}
							<optgroup label={group.label}>
								{#each group.methods as method (method.id)}
									<option value={method.id}>{method.label}</option>
								{/each}
							</optgroup>
						{/each}
					</select>
				</label>

				<label class="form-control">
					<span class="label pb-1 text-xs text-base-content/60">Signer</span>
					<select
						class="select w-full select-sm"
						bind:value={selectedSignerKey}
						disabled={signerOptions.length === 0}
						onchange={clearPreview}
					>
						{#if signerOptions.length === 0}
							<option value="">No signer available</option>
						{:else}
							{#each signerOptions as option (option.key)}
								<option value={option.key}>{option.label}</option>
							{/each}
						{/if}
					</select>
				</label>
			</div>

			<div class="flex flex-wrap items-center justify-between gap-2">
				<div class="min-w-0">
					<div class="flex flex-wrap items-center gap-2">
						<span class="badge badge-xs">{methodTag(selectedMethod)}</span>
						<span class="truncate text-xs text-base-content/60">{exchangeUrl}</span>
					</div>
					<p class="mt-1 text-xs text-base-content/60">{selectedMethod.description}</p>
				</div>
			</div>

			<label class="form-control">
				<span class="label pb-1 text-xs text-base-content/60">Action payload</span>
				<textarea
					class="textarea-bordered textarea h-80 min-h-60 w-full resize-y font-mono text-xs leading-5"
					spellcheck="false"
					bind:value={payloadInput}
					oninput={clearPreview}
				></textarea>
			</label>

			<div class="grid gap-3 md:grid-cols-3">
				<label class="form-control">
					<span class="label pb-1 text-xs text-base-content/60">Nonce</span>
					<input
						class="input input-sm w-full font-mono"
						placeholder="Date.now()"
						inputmode="numeric"
						bind:value={nonceInput}
						oninput={clearPreview}
					/>
				</label>
				<label class="form-control">
					<span class="label pb-1 text-xs text-base-content/60">Vault address</span>
					<input
						class="input input-sm w-full font-mono"
						placeholder="L1 actions only"
						bind:value={vaultAddressInput}
						oninput={clearPreview}
					/>
				</label>
				<label class="form-control">
					<span class="label pb-1 text-xs text-base-content/60">Expires after</span>
					<input
						class="input input-sm w-full font-mono"
						placeholder="timestamp ms"
						inputmode="numeric"
						bind:value={expiresAfterInput}
						oninput={clearPreview}
					/>
				</label>
			</div>

			<div class="flex flex-wrap gap-2">
				<button
					class="btn btn-sm btn-primary"
					disabled={signing || !selectedSignerKey}
					onclick={signRequest}
				>
					{#if signing || chainSwitching}
						<span class="loading loading-xs loading-spinner"></span>
					{/if}
					Sign request
				</button>
				<button class="btn btn-ghost btn-sm" type="button" onclick={formatPayload}>
					<HeroIcon name="pencil-square" />
					Format JSON
				</button>
				<button class="btn btn-ghost btn-sm" type="button" onclick={resetPayload}>
					<HeroIcon name="arrow-path" />
					Reset sample
				</button>
			</div>
		</section>

		<section class="space-y-3 rounded-lg border border-base-300 bg-base-100 p-3">
			<div class="flex flex-wrap items-start justify-between gap-3">
				<div class="min-w-0">
					<h3 class="text-sm font-semibold">Signed request preview</h3>
					<p class="mt-1 text-xs text-base-content/60">
						This builds the HTTP body and curl command without sending it.
					</p>
				</div>
				{#if selectedSigner()}
					<CopyAddress
						address={selectedSigner()?.address ?? '0x0000000000000000000000000000000000000000'}
						label={formatAddress(selectedSigner()?.address ?? '')}
						notification="Signer address copied"
						buttonClass="btn h-auto min-h-0 px-2 py-1 font-mono text-xs btn-ghost"
					/>
				{/if}
			</div>

			{#if error}
				<div role="alert" class="alert alert-soft text-xs alert-error">
					<span>{error}</span>
				</div>
			{/if}
			{#if notice}
				<div role="status" class="alert alert-soft text-xs alert-success">
					<span>{notice}</span>
				</div>
			{/if}
			{#if !wallet.current}
				<div role="alert" class="alert alert-soft text-xs alert-warning">
					<span>Connect a browser wallet, or select a tracked wallet with saved agent keys.</span>
				</div>
			{:else if signerOptions.length === 0}
				<div role="alert" class="alert alert-soft text-xs alert-warning">
					<span>No browser signer or local agent key is available for this wallet.</span>
				</div>
			{/if}

			<div class="rounded-lg border border-base-300 bg-base-200/45">
				<div class="border-b border-base-300 px-3 py-2 text-xs font-medium text-base-content/70">
					HTTP body
				</div>
				<pre
					class="max-h-80 overflow-auto p-3 text-[11px] whitespace-pre-wrap text-base-content/80"><code
						>{signedBody
							? prettyJson(signedBody)
							: 'Sign a request to preview the JSON body.'}</code
					></pre>
			</div>

			<div class="rounded-lg border border-base-300 bg-base-200/45">
				<div class="flex items-center justify-between gap-2 border-b border-base-300 px-3 py-2">
					<span class="text-xs font-medium text-base-content/70">curl</span>
					<button class="btn btn-ghost btn-xs" disabled={!curl} onclick={copyCurl}>Copy</button>
				</div>
				<pre
					class="max-h-80 overflow-auto p-3 text-[11px] whitespace-pre-wrap text-base-content/80"><code
						>{curl ?? 'curl preview will appear here.'}</code
					></pre>
			</div>
		</section>
	</div>
</div>
