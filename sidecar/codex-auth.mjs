import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export async function readCodexOauthCredential() {
	try {
		const authPath = path.join(os.homedir(), '.codex', 'auth.json');
		const auth = JSON.parse(await readFile(authPath, 'utf8'));
		if (auth?.auth_mode !== 'chatgpt' || !auth.tokens || typeof auth.tokens !== 'object') {
			return null;
		}

		const access = readNonEmptyString(auth.tokens.access_token);
		const refresh = readNonEmptyString(auth.tokens.refresh_token);
		if (!access || !refresh) {
			return null;
		}

		const accountId =
			readAccessTokenAccountId(access) ?? readNonEmptyString(auth.tokens.account_id) ?? null;
		const expires = readAccessTokenExpiry(access);
		if (!accountId || !expires) {
			return null;
		}

		return { access, accountId, expires, refresh };
	} catch {
		return null;
	}
}

function readNonEmptyString(value) {
	return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function readAccessTokenExpiry(token) {
	const payload = decodeJwtPayload(token);
	const exp = payload?.exp;
	return typeof exp === 'number' ? exp * 1000 : null;
}

function readAccessTokenAccountId(token) {
	const payload = decodeJwtPayload(token);
	const auth = payload?.['https://api.openai.com/auth'];
	return typeof auth?.chatgpt_account_id === 'string' && auth.chatgpt_account_id
		? auth.chatgpt_account_id
		: null;
}

function decodeJwtPayload(token) {
	const segments = token.split('.');
	if (segments.length !== 3) {
		return null;
	}

	try {
		const payload = segments[1];
		const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
		const json = Buffer.from(
			base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '='),
			'base64'
		).toString('utf8');
		return JSON.parse(json);
	} catch {
		return null;
	}
}
