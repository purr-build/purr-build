<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import View from '../View.svelte';
	import HeroIcon from '$lib/components/HeroIcon.svelte';
	import TableScroll from '$lib/components/TableScroll.svelte';

	type Props = {
		viewId: string;
	};

	let { viewId }: Props = $props();

	type StatusIndicator = 'none' | 'minor' | 'major' | 'critical' | 'maintenance' | string;
	type ComponentStatus =
		| 'operational'
		| 'degraded_performance'
		| 'partial_outage'
		| 'major_outage'
		| 'under_maintenance'
		| string;
	type StatusPage = {
		id: string;
		name: string;
		url: string;
		time_zone: string;
		updated_at: string;
	};
	type StatusSummary = {
		indicator: StatusIndicator;
		description: string;
	};
	type StatusComponent = {
		id: string;
		name: string;
		status: ComponentStatus;
		updated_at: string;
	};
	type IncidentUpdate = {
		id: string;
		status: string;
		body: string;
		created_at: string;
		display_at: string;
		updated_at: string;
	};
	type Incident = {
		id: string;
		name: string;
		status: string;
		impact: StatusIndicator;
		created_at: string;
		updated_at: string;
		resolved_at: string | null;
		shortlink: string | null;
		incident_updates: IncidentUpdate[];
	};
	type ScheduledMaintenance = Incident & {
		scheduled_for: string | null;
		scheduled_until: string | null;
	};
	type SummaryResponse = {
		page: StatusPage;
		status: StatusSummary;
		components: StatusComponent[];
		incidents: Incident[];
		scheduled_maintenances: ScheduledMaintenance[];
	};
	type IncidentsResponse = {
		page: StatusPage;
		incidents: Incident[];
	};

	const SUMMARY_URL = 'https://h20qtjygwppc.statuspage.io/api/v2/summary.json';
	const INCIDENTS_URL = 'https://h20qtjygwppc.statuspage.io/api/v2/incidents.json';
	const REFRESH_MS = 60_000;

	let summary = $state<SummaryResponse | null>(null);
	let incidents = $state<Incident[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let lastLoadedAt = $state<number | null>(null);
	let refreshTimer: ReturnType<typeof setInterval> | null = null;
	let requestGeneration = 0;

	async function loadStatus() {
		const generation = ++requestGeneration;
		loading = true;
		error = null;

		try {
			const [summaryResponse, incidentsResponse] = await Promise.all([
				fetch(SUMMARY_URL),
				fetch(INCIDENTS_URL)
			]);
			if (!summaryResponse.ok) throw new Error(`Summary returned ${summaryResponse.status}`);
			if (!incidentsResponse.ok) throw new Error(`Incidents returned ${incidentsResponse.status}`);

			const [nextSummary, nextIncidents] = (await Promise.all([
				summaryResponse.json(),
				incidentsResponse.json()
			])) as [SummaryResponse, IncidentsResponse];
			if (generation !== requestGeneration) return;

			summary = {
				...nextSummary,
				components: nextSummary.components ?? [],
				incidents: nextSummary.incidents ?? [],
				scheduled_maintenances: nextSummary.scheduled_maintenances ?? []
			};
			incidents = nextIncidents.incidents ?? [];
			lastLoadedAt = Date.now();
		} catch (err) {
			if (generation !== requestGeneration) return;
			error = err instanceof Error ? err.message : 'Failed to load API status.';
		} finally {
			if (generation === requestGeneration) loading = false;
		}
	}

	function refreshStatus() {
		void loadStatus();
	}

	function latestIncidentUpdate(incident: Incident) {
		return incident.incident_updates?.[0] ?? null;
	}

	function statusLabel(value: string) {
		return value.replaceAll('_', ' ');
	}

	function statusBadgeClass(value: string) {
		if (value === 'none' || value === 'operational' || value === 'resolved') return 'badge-success';
		if (value === 'minor' || value === 'degraded_performance' || value === 'monitoring')
			return 'badge-warning';
		if (value === 'major' || value === 'partial_outage' || value === 'identified')
			return 'badge-error';
		if (value === 'critical' || value === 'major_outage' || value === 'investigating')
			return 'badge-error';
		return 'badge-ghost';
	}

	function formatDateTime(value: string | null | undefined) {
		if (!value) return '—';
		return new Date(value).toLocaleString();
	}

	function shortBody(value: string) {
		const normalized = value.trim().replace(/\s+/g, ' ');
		return normalized.length > 220 ? `${normalized.slice(0, 217)}...` : normalized;
	}

	onMount(() => {
		void loadStatus();
		refreshTimer = setInterval(refreshStatus, REFRESH_MS);
	});

	onDestroy(() => {
		requestGeneration += 1;
		if (refreshTimer) clearInterval(refreshTimer);
	});
</script>

<View {viewId} title="API">
	{#snippet subtitleContent()}
		<span>Statuspage</span>
		{#if lastLoadedAt}
			<span>·</span>
			<span>{formatDateTime(new Date(lastLoadedAt).toISOString())}</span>
		{/if}
	{/snippet}

	{#snippet actions()}
		<button
			class="btn btn-ghost btn-xs"
			aria-label="Refresh API status"
			disabled={loading}
			onclick={refreshStatus}
		>
			{#if loading}
				<span class="loading loading-xs loading-spinner"></span>
			{:else}
				<HeroIcon name="arrow-path" />
			{/if}
		</button>
	{/snippet}

	<div class="space-y-3 p-3">
		{#if error}
			<div role="alert" class="alert alert-soft text-xs alert-error">
				<span>{error}</span>
			</div>
		{/if}

		{#if loading && !summary}
			<div class="flex items-center justify-center py-8">
				<span class="loading loading-sm loading-spinner"></span>
			</div>
		{:else if summary}
			<div class="rounded-lg border border-base-300 bg-base-100 p-3">
				<div class="flex items-start justify-between gap-3">
					<div class="min-w-0">
						<div class="text-sm font-semibold">{summary.status.description}</div>
						<div class="mt-1 truncate text-xs text-base-content/50" title={summary.page.name}>
							{summary.page.name}
						</div>
					</div>
					<span class="badge badge-sm {statusBadgeClass(summary.status.indicator)}">
						{statusLabel(summary.status.indicator)}
					</span>
				</div>
			</div>

			<TableScroll class="rounded-lg border border-base-300 bg-base-100">
				<table class="table table-md">
					<thead>
						<tr class="text-[10px] text-base-content/50 uppercase">
							<th>Component</th>
							<th>Status</th>
							<th>Updated</th>
						</tr>
					</thead>
					<tbody>
						{#each summary.components as component (component.id)}
							<tr>
								<td class="max-w-44">
									<div class="truncate text-sm font-medium" title={component.name}>
										{component.name}
									</div>
								</td>
								<td class="whitespace-nowrap">
									<span class="badge badge-xs {statusBadgeClass(component.status)}">
										{statusLabel(component.status)}
									</span>
								</td>
								<td class="text-[11px] whitespace-nowrap">
									{formatDateTime(component.updated_at)}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</TableScroll>

			{#if summary.incidents.length > 0}
				<div class="rounded-lg border border-base-300 bg-base-100 p-3">
					<div class="text-xs font-semibold text-base-content/60 uppercase">Active incidents</div>
					<div class="mt-2 space-y-2">
						{#each summary.incidents as incident (incident.id)}
							<div class="rounded border border-base-300 p-2">
								<div class="flex items-start justify-between gap-2">
									<div class="min-w-0 truncate text-sm font-medium" title={incident.name}>
										{incident.name}
									</div>
									<span class="badge badge-xs {statusBadgeClass(incident.impact)}">
										{statusLabel(incident.impact)}
									</span>
								</div>
								{#if latestIncidentUpdate(incident)}
									<p class="mt-1 text-xs text-base-content/60">
										{shortBody(latestIncidentUpdate(incident)?.body ?? '')}
									</p>
								{/if}
							</div>
						{/each}
					</div>
				</div>
			{/if}

			{#if summary.scheduled_maintenances.length > 0}
				<div class="rounded-lg border border-base-300 bg-base-100 p-3">
					<div class="text-xs font-semibold text-base-content/60 uppercase">
						Scheduled maintenance
					</div>
					<div class="mt-2 space-y-2">
						{#each summary.scheduled_maintenances as maintenance (maintenance.id)}
							<div class="rounded border border-base-300 p-2">
								<div class="text-sm font-medium">{maintenance.name}</div>
								<div class="mt-1 text-xs text-base-content/60">
									{formatDateTime(maintenance.scheduled_for)} to {formatDateTime(
										maintenance.scheduled_until
									)}
								</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<div class="space-y-2">
				<div class="flex items-center justify-between gap-2 px-1">
					<h3 class="text-xs font-semibold text-base-content/60 uppercase">Historical incidents</h3>
					<span class="text-xs text-base-content/40">{incidents.length}</span>
				</div>

				{#if incidents.length === 0}
					<p class="p-2 text-sm text-base-content/60">No incidents returned.</p>
				{:else}
					<div class="space-y-2">
						{#each incidents as incident (incident.id)}
							<div class="rounded-lg border border-base-300 bg-base-100 p-3">
								<div class="flex items-start justify-between gap-2">
									<div class="min-w-0">
										<div class="truncate text-sm font-medium" title={incident.name}>
											{incident.name}
										</div>
										<div class="mt-1 text-[11px] text-base-content/50">
											{formatDateTime(incident.created_at)}
										</div>
									</div>
									<div class="flex shrink-0 flex-col items-end gap-1">
										<span class="badge badge-xs {statusBadgeClass(incident.impact)}">
											{statusLabel(incident.impact)}
										</span>
										<span class="badge badge-xs {statusBadgeClass(incident.status)}">
											{statusLabel(incident.status)}
										</span>
									</div>
								</div>
								{#if latestIncidentUpdate(incident)}
									<p class="mt-2 text-xs text-base-content/70">
										{shortBody(latestIncidentUpdate(incident)?.body ?? '')}
									</p>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>
</View>
