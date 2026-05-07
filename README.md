# purr.build

Frontend tools for building on Hyperliquid.

## Development

Install dependencies:

```sh
pnpm install
```

Start the local dev server:

```sh
pnpm dev
```

Run checks before opening a PR:

```sh
pnpm check
pnpm lint
```

Build the app:

```sh
pnpm build
```

## Configuration

The app runs without private server-side credentials. Optional browser analytics can be enabled with public SvelteKit environment variables:

```sh
cp .env.example .env
```

Set `PUBLIC_POSTHOG_KEY` only for deployments that should report analytics to your own PostHog project. Do not put private tokens, private keys, RPC secrets, or server-only API keys in variables prefixed with `PUBLIC_`; those values are exposed in the built frontend.

## License

This project is licensed under `FSL-1.1-MIT`. See [LICENSE](LICENSE).

## Security Notes

- User wallet connections are handled in the browser.
- Imported or generated agent wallet private keys are stored only in the user's browser `localStorage`.
- The repository should not contain `.env`, deployment metadata, private keys, npm tokens, or provider API secrets.
- If you accidentally commit a secret, rotate the secret before publishing and remove it from git history.
