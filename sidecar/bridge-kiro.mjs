/**
 * Kiro Enterprise SSO bridge integration.
 *
 * Provides the runtime methods for syncing, logging in, and logging out
 * of Kiro Enterprise via IAM Identity Center SSO.
 */

import {
	getValidKiroCredential,
	readKiroCredential,
	removeKiroCredential,
	startKiroLogin
} from './kiro-auth.mjs';

/**
 * Sync the Kiro SSO credential into the auth storage.
 * Called during buildEnvironment to keep the provider status current.
 */
export async function syncKiroSso(agentDir, authStorage, disposeSessions) {
	const credential = await getValidKiroCredential(agentDir);
	const current = authStorage.get('kiro');
	if (!credential) {
		if (current) {
			authStorage.remove('kiro');
			disposeSessions();
		}
		return;
	}
	if (current?.accessToken === credential.accessToken) {
		return;
	}
	authStorage.set('kiro', {
		type: 'bearer',
		key: credential.accessToken,
		region: credential.region,
		startUrl: credential.startUrl
	});
	disposeSessions();
}

/**
 * Start the Kiro SSO device authorization flow.
 * Returns the verification URI and user code for the UI.
 */
export async function startKiroSsoLogin(agentDir, payload) {
	const { startUrl, region } = payload;
	if (!startUrl || !region) {
		throw new Error('startUrl and region are required for Kiro SSO login.');
	}
	const loginSession = await startKiroLogin(agentDir, { startUrl, region });
	return {
		verificationUri: loginSession.verificationUri,
		verificationUriComplete: loginSession.verificationUriComplete,
		userCode: loginSession.userCode
	};
}

/**
 * Complete the Kiro SSO login after the user has authorized in their browser.
 */
export async function completeKiroSsoLogin(agentDir, authStorage, disposeSessions) {
	const credential = await readKiroCredential(agentDir);
	if (!credential) {
		throw new Error('No pending Kiro login session found.');
	}
	await syncKiroSso(agentDir, authStorage, disposeSessions);
	disposeSessions();
}

/**
 * Log out of Kiro Enterprise and remove stored credentials.
 */
export async function logoutKiro(agentDir, authStorage, disposeSessions) {
	await removeKiroCredential(agentDir);
	authStorage.remove('kiro');
	disposeSessions();
}
