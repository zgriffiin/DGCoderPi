/**
 * Kiro Enterprise SSO bridge integration.
 *
 * Provides the runtime methods for syncing, logging in, and logging out
 * of Kiro Enterprise via IAM Identity Center SSO.
 */

import { getValidKiroCredential, removeKiroCredential, startKiroLogin } from './kiro-auth.mjs';

/** @type {Map<string, { complete: () => Promise<unknown> }>} */
const pendingLogins = new Map();

/**
 * Sync the Kiro SSO credential into the auth storage.
 * Called during buildEnvironment to keep the provider status current.
 */
export async function syncKiroSso(agentDir, authStorage, disposeSessions) {
	const credential = await getValidKiroCredential(agentDir);
	const current = authStorage.get('kiro');
	if (!credential) {
		delete process.env.AWS_BEARER_TOKEN_BEDROCK;
		if (current) {
			authStorage.remove('kiro');
			disposeSessions();
		}
		return;
	}
	if (current?.type === 'api_key' && current?.key === credential.accessToken) {
		return;
	}
	authStorage.set('kiro', {
		type: 'api_key',
		key: credential.accessToken,
		region: credential.region,
		startUrl: credential.startUrl
	});
	disposeSessions();
}

/**
 * Start the Kiro SSO device authorization flow.
 * Returns the verification URI and user code for the UI.
 * Stores the pending login session so completeKiroSsoLogin can finalize it.
 */
export async function startKiroSsoLogin(agentDir, payload) {
	const { startUrl, region } = payload;
	if (!startUrl || !region) {
		throw new Error('startUrl and region are required for Kiro SSO login.');
	}
	const loginSession = await startKiroLogin(agentDir, { startUrl, region });
	pendingLogins.set(agentDir, loginSession);
	return {
		verificationUri: loginSession.verificationUri,
		verificationUriComplete: loginSession.verificationUriComplete,
		userCode: loginSession.userCode
	};
}

/**
 * Complete the Kiro SSO login after the user has authorized in their browser.
 * Calls the pending login session's complete() to poll for the token.
 */
export async function completeKiroSsoLogin(agentDir, authStorage, disposeSessions) {
	const loginSession = pendingLogins.get(agentDir);
	if (!loginSession) {
		throw new Error('No pending Kiro login session found.');
	}
	try {
		await loginSession.complete();
	} finally {
		pendingLogins.delete(agentDir);
	}
	await syncKiroSso(agentDir, authStorage, disposeSessions);
}

/**
 * Log out of Kiro Enterprise and remove stored credentials.
 */
export async function logoutKiro(agentDir, authStorage, disposeSessions) {
	await removeKiroCredential(agentDir);
	authStorage.remove('kiro');
	disposeSessions();
}
