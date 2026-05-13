/**
 * Kiro Enterprise authentication via AWS IAM Identity Center (SSO OIDC).
 *
 * Kiro enterprise accounts authenticate through AWS IAM Identity Center using
 * the OAuth 2.0 Device Authorization Grant (RFC 8628). This is the same flow
 * used by the AWS CLI and Kiro IDE itself.
 *
 * Flow:
 * 1. Register a public OIDC client with the SSO OIDC service.
 * 2. Start device authorization — user gets a verification URL and code.
 * 3. Poll for token completion while the user authorizes in their browser.
 * 4. Store the resulting access/refresh tokens locally.
 * 5. Refresh tokens before expiry on subsequent sessions.
 *
 * The start URL and region are user-provided (e.g. from their admin).
 * Example: https://infor-aws-portal-prod.awsapps.com/start in us-east-1.
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const CLIENT_NAME = 'DGCoder-Pi';
const CLIENT_TYPE = 'public';
const GRANT_TYPE_DEVICE = 'urn:ietf:params:oauth:grant-type:device_code';
const GRANT_TYPE_REFRESH = 'refresh_token';
const POLL_INTERVAL_MS = 5_000;
const MAX_POLL_DURATION_MS = 300_000;
const TOKEN_EXPIRY_BUFFER_MS = 300_000;

/**
 * @typedef {object} KiroSsoConfig
 * @property {string} startUrl - IAM Identity Center start URL
 * @property {string} region - AWS region hosting the identity directory
 */

/**
 * @typedef {object} KiroCredential
 * @property {string} type - Always 'kiro-sso'
 * @property {string} accessToken
 * @property {string} refreshToken
 * @property {number} expiresAtMs
 * @property {string} startUrl
 * @property {string} region
 * @property {string} clientId
 * @property {string} clientSecret
 * @property {number} clientExpiresAtMs
 */

/**
 * @typedef {object} DeviceAuthorizationResult
 * @property {string} verificationUri
 * @property {string} verificationUriComplete
 * @property {string} userCode
 * @property {string} deviceCode
 * @property {number} expiresIn
 * @property {number} interval
 */

function ssoOidcEndpoint(region) {
	return `https://oidc.${region}.amazonaws.com`;
}

/**
 * Register a public OIDC client with IAM Identity Center.
 * Client registrations are long-lived (typically 90 days).
 */
async function registerClient(region) {
	const endpoint = ssoOidcEndpoint(region);
	const response = await fetch(`${endpoint}/client/register`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			clientName: CLIENT_NAME,
			clientType: CLIENT_TYPE,
			grantTypes: [GRANT_TYPE_DEVICE, GRANT_TYPE_REFRESH],
			scopes: ['sso:account:access']
		})
	});

	if (!response.ok) {
		const body = await response.text();
		throw new Error(`SSO OIDC client registration failed (${response.status}): ${body}`);
	}

	const data = await response.json();
	return {
		clientId: data.clientId,
		clientSecret: data.clientSecret,
		clientExpiresAtMs: data.clientSecretExpiresAt * 1000
	};
}

/**
 * Start device authorization. Returns the verification URI and codes
 * the user needs to complete authorization in their browser.
 */
async function startDeviceAuthorization(region, clientId, clientSecret, startUrl) {
	const endpoint = ssoOidcEndpoint(region);
	const response = await fetch(`${endpoint}/device_authorization`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			clientId,
			clientSecret,
			startUrl
		})
	});

	if (!response.ok) {
		const body = await response.text();
		throw new Error(`SSO OIDC device authorization failed (${response.status}): ${body}`);
	}

	const data = await response.json();
	return {
		verificationUri: data.verificationUri,
		verificationUriComplete: data.verificationUriComplete,
		userCode: data.userCode,
		deviceCode: data.deviceCode,
		expiresIn: data.expiresIn,
		interval: data.interval ?? Math.ceil(POLL_INTERVAL_MS / 1000)
	};
}

/**
 * Poll for token creation after the user authorizes in their browser.
 * Respects the server-provided interval and handles slow_down responses.
 */
async function pollForToken(region, clientId, clientSecret, deviceCode, interval) {
	const endpoint = ssoOidcEndpoint(region);
	const pollIntervalMs = Math.max(interval * 1000, POLL_INTERVAL_MS);
	const deadline = Date.now() + MAX_POLL_DURATION_MS;

	let currentInterval = pollIntervalMs;

	while (Date.now() < deadline) {
		await sleep(currentInterval);

		const response = await fetch(`${endpoint}/token`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				clientId,
				clientSecret,
				deviceCode,
				grantType: GRANT_TYPE_DEVICE
			})
		});

		if (response.ok) {
			const data = await response.json();
			return {
				accessToken: data.accessToken,
				refreshToken: data.refreshToken,
				expiresIn: data.expiresIn
			};
		}

		const errorBody = await response.json().catch(() => ({}));
		const errorCode = errorBody.error ?? '';

		if (errorCode === 'authorization_pending') {
			continue;
		}

		if (errorCode === 'slow_down') {
			currentInterval += 5_000;
			continue;
		}

		if (errorCode === 'expired_token') {
			throw new Error('Device authorization expired. Please try again.');
		}

		if (errorCode === 'access_denied') {
			throw new Error('Authorization was denied by the user or administrator.');
		}

		throw new Error(
			`SSO OIDC token creation failed: ${errorCode || response.status} — ${errorBody.error_description || ''}`
		);
	}

	throw new Error('Device authorization timed out. Please try again.');
}

/**
 * Refresh an existing access token using the refresh token.
 */
async function refreshAccessToken(region, clientId, clientSecret, refreshToken) {
	const endpoint = ssoOidcEndpoint(region);
	const response = await fetch(`${endpoint}/token`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			clientId,
			clientSecret,
			grantType: GRANT_TYPE_REFRESH,
			refreshToken
		})
	});

	if (!response.ok) {
		const body = await response.text();
		throw new Error(`SSO OIDC token refresh failed (${response.status}): ${body}`);
	}

	const data = await response.json();
	return {
		accessToken: data.accessToken,
		refreshToken: data.refreshToken ?? refreshToken,
		expiresIn: data.expiresIn
	};
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function credentialPath(agentDir) {
	return path.join(agentDir, 'kiro-sso-credential.json');
}

/**
 * Read a stored Kiro SSO credential from disk.
 * @returns {Promise<KiroCredential | null>}
 */
export async function readKiroCredential(agentDir) {
	try {
		const raw = await readFile(credentialPath(agentDir), 'utf8');
		const credential = JSON.parse(raw);
		if (credential?.type !== 'kiro-sso') return null;
		if (!credential.accessToken || !credential.refreshToken) return null;
		return credential;
	} catch {
		return null;
	}
}

/**
 * Persist a Kiro SSO credential to disk.
 * @param {string} agentDir
 * @param {KiroCredential} credential
 */
async function writeKiroCredential(agentDir, credential) {
	await mkdir(path.dirname(credentialPath(agentDir)), { recursive: true });
	await writeFile(credentialPath(agentDir), JSON.stringify(credential, null, '\t'), {
		encoding: 'utf8',
		mode: 0o600
	});
}

/**
 * Remove the stored Kiro SSO credential.
 */
export async function removeKiroCredential(agentDir) {
	try {
		const { unlink } = await import('node:fs/promises');
		await unlink(credentialPath(agentDir));
	} catch {
		// Already gone or never existed.
	}
}

/**
 * Check whether the stored credential is still valid (not expired).
 * Applies a buffer so we refresh before actual expiry.
 */
export function isCredentialValid(credential) {
	if (!credential) return false;
	return Date.now() < credential.expiresAtMs - TOKEN_EXPIRY_BUFFER_MS;
}

/**
 * Check whether the client registration is still valid.
 */
function isClientValid(credential) {
	if (!credential) return false;
	return Date.now() < credential.clientExpiresAtMs - TOKEN_EXPIRY_BUFFER_MS;
}

/**
 * Attempt to refresh the credential. Returns the refreshed credential or null on failure.
 * @param {string} agentDir
 * @param {KiroCredential} credential
 * @returns {Promise<KiroCredential | null>}
 */
export async function refreshKiroCredential(agentDir, credential) {
	if (!credential || !isClientValid(credential)) return null;

	try {
		const result = await refreshAccessToken(
			credential.region,
			credential.clientId,
			credential.clientSecret,
			credential.refreshToken
		);

		const refreshed = {
			...credential,
			accessToken: result.accessToken,
			refreshToken: result.refreshToken,
			expiresAtMs: Date.now() + result.expiresIn * 1000
		};

		await writeKiroCredential(agentDir, refreshed);
		return refreshed;
	} catch (error) {
		console.warn('[kiro-auth] Token refresh failed:', error.message);
		return null;
	}
}

/**
 * Get a valid Kiro credential, refreshing if needed.
 * Returns null if no credential exists or refresh fails.
 * @param {string} agentDir
 * @returns {Promise<KiroCredential | null>}
 */
export async function getValidKiroCredential(agentDir) {
	const credential = await readKiroCredential(agentDir);
	if (!credential) return null;

	if (isCredentialValid(credential)) return credential;

	return refreshKiroCredential(agentDir, credential);
}

/**
 * Start the full Kiro SSO login flow.
 * Returns the device authorization info so the UI can show the verification URL.
 *
 * @param {string} agentDir
 * @param {KiroSsoConfig} config
 * @returns {Promise<{ verificationUri: string, verificationUriComplete: string, userCode: string, complete: () => Promise<KiroCredential> }>}
 */
export async function startKiroLogin(agentDir, config) {
	const { startUrl, region } = config;

	// Re-use existing client registration if still valid.
	const existing = await readKiroCredential(agentDir);
	let clientId, clientSecret, clientExpiresAtMs;

	if (existing && isClientValid(existing) && existing.region === region) {
		clientId = existing.clientId;
		clientSecret = existing.clientSecret;
		clientExpiresAtMs = existing.clientExpiresAtMs;
	} else {
		const registration = await registerClient(region);
		clientId = registration.clientId;
		clientSecret = registration.clientSecret;
		clientExpiresAtMs = registration.clientExpiresAtMs;
	}

	const deviceAuth = await startDeviceAuthorization(region, clientId, clientSecret, startUrl);

	return {
		verificationUri: deviceAuth.verificationUri,
		verificationUriComplete: deviceAuth.verificationUriComplete,
		userCode: deviceAuth.userCode,
		async complete() {
			const tokenResult = await pollForToken(
				region,
				clientId,
				clientSecret,
				deviceAuth.deviceCode,
				deviceAuth.interval
			);

			const credential = {
				type: 'kiro-sso',
				accessToken: tokenResult.accessToken,
				refreshToken: tokenResult.refreshToken,
				expiresAtMs: Date.now() + tokenResult.expiresIn * 1000,
				startUrl,
				region,
				clientId,
				clientSecret,
				clientExpiresAtMs
			};

			await writeKiroCredential(agentDir, credential);
			return credential;
		}
	};
}
