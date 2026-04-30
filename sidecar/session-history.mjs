import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';

import { SessionManager } from '@mariozechner/pi-coding-agent';

const MAX_ACTIVE_SESSIONS = 6;
const SESSION_IDLE_MS = 10 * 60 * 1000;

export function sessionManagerForPayload(existing, payload, agentDir) {
	const cwd = validPayloadCwd(payload);
	if (!cwd) {
		const fallbackCwd = process.cwd();
		return {
			cwd: fallbackCwd,
			sessionManager: hydratedInMemorySession(fallbackCwd, payload.messages)
		};
	}

	if (existing?.cwd === cwd) {
		if (existing.sessionManager && hasSessionMessages(existing.sessionManager)) {
			return { cwd, sessionManager: existing.sessionManager };
		}
		return {
			cwd,
			sessionManager: hydratedInMemorySession(cwd, payload.messages)
		};
	}

	const sessionRoot = validAgentDir(agentDir);
	if (!sessionRoot) {
		return {
			cwd,
			sessionManager: hydratedInMemorySession(cwd, payload.messages)
		};
	}

	const sessionManager = SessionManager.continueRecent(
		cwd,
		path.join(sessionRoot, 'thread-sessions', safeThreadId(payload.threadId))
	);
	hydrateSessionFromThreadMessages(sessionManager, payload.messages);
	return { cwd, sessionManager };
}

function validPayloadCwd(payload) {
	const trimmed = typeof payload?.cwd === 'string' ? payload.cwd.trim() : '';
	return trimmed.length > 0 ? trimmed : null;
}

function validAgentDir(agentDir) {
	return typeof agentDir === 'string' && path.isAbsolute(agentDir) ? agentDir : null;
}

export function recordSessionPreferences(existing, nextModel, nextThinkingLevel) {
	if (!existing || !nextModel) {
		return;
	}

	const nextModelKey = `${nextModel.provider}::${nextModel.id}`;
	if (existing.sessionManager && existing.modelKey !== nextModelKey) {
		existing.sessionManager.appendModelChange(nextModel.provider, nextModel.id);
	}

	if (existing.sessionManager && existing.thinkingLevel !== nextThinkingLevel) {
		existing.sessionManager.appendThinkingLevelChange(nextThinkingLevel);
	}
}

export function touchSession(entry, timestamp = Date.now()) {
	entry.lastTouchedAt = timestamp;
}

export function evictDormantSessions(sessions, now = Date.now()) {
	const entries = [...sessions.entries()];
	const eligibleEntries = entries
		.filter(([, entry]) => canDisposeSession(entry))
		.sort((left, right) => lastTouchedAtMs(left[1]) - lastTouchedAtMs(right[1]));

	for (const [threadId, entry] of eligibleEntries) {
		const idleDurationMs = now - lastTouchedAtMs(entry);
		if (sessions.size <= MAX_ACTIVE_SESSIONS && idleDurationMs < SESSION_IDLE_MS) {
			break;
		}

		entry.unsubscribe();
		entry.session.dispose();
		sessions.delete(threadId);
	}
}

function canDisposeSession(entry) {
	if (entry.session.isStreaming) {
		return false;
	}

	const hasQueuedWork =
		entry.session.getSteeringMessages().length > 0 ||
		entry.session.getFollowUpMessages().length > 0;
	return !hasQueuedWork;
}

function lastTouchedAtMs(entry) {
	return Number(entry.lastTouchedAt ?? 0);
}

function safeThreadId(threadId) {
	const raw = threadId === undefined || threadId === null ? 'missing-thread-id' : String(threadId);
	const hash = createHash('sha256').update(raw).digest('hex');
	const readable = raw
		.replace(/[^a-zA-Z0-9_.-]/g, '_')
		.replace(/\.\.+/g, '_')
		.replace(/^\.+|\.+$/g, '')
		.slice(0, 40);
	return readable ? `${hash}_${readable}` : hash;
}

function hydratedInMemorySession(cwd, messages) {
	const sessionManager = SessionManager.inMemory(cwd);
	hydrateSessionFromThreadMessages(sessionManager, messages);
	return sessionManager;
}

function hydrateSessionFromThreadMessages(sessionManager, messages) {
	if (!Array.isArray(messages) || messages.length === 0 || hasSessionMessages(sessionManager)) {
		return;
	}

	for (const message of messages) {
		const agentMessage = toAgentMessage(message);
		if (agentMessage) {
			sessionManager.appendMessage(agentMessage);
		}
	}
}

function hasSessionMessages(sessionManager) {
	return sessionManager.getEntries().some((entry) => entry.type === 'message');
}

function toAgentMessage(message) {
	const text = typeof message?.text === 'string' ? message.text : '';
	if (!text.trim()) {
		return null;
	}

	if (message.role === 'user') {
		return { content: text, role: 'user' };
	}

	if (message.role === 'assistant') {
		return { content: text, role: 'assistant' };
	}

	if (message.role === 'system') {
		return { content: text, role: 'system' };
	}

	if (message.role === 'tool') {
		const timestamp = Number.isFinite(message.timestampMs) ? message.timestampMs : Date.now();
		return {
			content: [{ type: 'text', text }],
			isError: message.status === 'failed',
			role: 'toolResult',
			timestamp,
			toolCallId:
				nonEmptyString(message.toolCallId) ?? `restored-tool-${timestamp}-${randomUUID()}`,
			toolName: nonEmptyString(message.toolName) ?? 'restored_tool'
		};
	}

	return null;
}

function nonEmptyString(value) {
	return typeof value === 'string' && value.trim().length > 0 ? value : null;
}
