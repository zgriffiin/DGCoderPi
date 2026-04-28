import { SessionManager } from '@mariozechner/pi-coding-agent';

const MAX_ACTIVE_SESSIONS = 6;
const SESSION_IDLE_MS = 10 * 60 * 1000;

export function sessionManagerForPayload(existing, cwd) {
	if (existing?.cwd === cwd) {
		return existing.sessionManager ?? SessionManager.inMemory(cwd);
	}

	return SessionManager.inMemory(cwd);
}

export function recordSessionPreferences(existing, nextModel, nextThinkingLevel) {
	const nextModelKey = `${nextModel.provider}::${nextModel.id}`;
	if (existing.modelKey !== nextModelKey) {
		existing.sessionManager.appendModelChange(nextModel.provider, nextModel.id);
	}

	if (existing.thinkingLevel !== nextThinkingLevel) {
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
		.sort((left, right) => left[1].lastTouchedAt - right[1].lastTouchedAt);

	for (const [threadId, entry] of eligibleEntries) {
		const idleDurationMs = now - entry.lastTouchedAt;
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
