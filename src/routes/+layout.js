import { browser } from '$app/environment';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/public';
import { injectAnalytics } from '@vercel/analytics/sveltekit';
import { posthog } from 'posthog-js';

injectAnalytics({ mode: dev ? 'development' : 'production' });

export const load = async () => {
	if (browser && env.PUBLIC_POSTHOG_KEY) {
		posthog.init(env.PUBLIC_POSTHOG_KEY, {
			api_host: env.PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
			defaults: '2026-01-30'
		});
	}

	return;
};
