# Security Policy

Do not open public issues for sensitive vulnerabilities or leaked credentials.

Use GitHub private vulnerability reporting if it is enabled on the repository. Otherwise, contact the maintainers privately before publishing details.

## Credential Handling

This is a browser frontend. Any value exposed through `PUBLIC_` SvelteKit environment variables is bundled into client-side JavaScript and must be safe to publish.

Never commit private wallet keys, seed phrases, npm tokens, RPC provider secrets, webhook URLs, or deployment credentials. If a secret is committed, rotate it first, then remove it from git history before publishing the repository.
