import { createHash } from 'node:crypto';
import {
	flattenAssistantContent,
	flattenToolResultContent,
	flattenUserContent
} from './message-content-format.mjs';

export function buildActivity(event) {
	if (event.type === 'agent_start') {
		return { detail: 'The agent accepted the current turn.', title: 'Run started', tone: 'system' };
	}

	if (event.type === 'agent_end') {
		return {
			detail: 'The agent finished the current turn.',
			title: 'Run complete',
			tone: 'system'
		};
	}

	if (event.type === 'tool_execution_start') {
		return {
			detail: `${event.toolName} started.`,
			title: 'Tool running',
			tone: 'tool'
		};
	}

	if (event.type === 'tool_execution_end') {
		return {
			detail: event.isError
				? `${event.toolName} reported an error.`
				: `${event.toolName} completed successfully.`,
			title: 'Tool finished',
			tone: 'tool'
		};
	}

	if (event.type === 'queue_update') {
		return {
			detail: `${event.steering.length} steer and ${event.followUp.length} follow-up items pending.`,
			title: 'Queue updated',
			tone: 'system'
		};
	}

	if (event.type === 'auto_retry_start') {
		return {
			detail: `Retry ${event.attempt} of ${event.maxAttempts} after ${event.delayMs}ms.`,
			title: 'Retry scheduled',
			tone: 'system'
		};
	}

	if (event.type === 'compaction_start') {
		return {
			detail: `Compaction started because of ${event.reason}.`,
			title: 'Compaction running',
			tone: 'system'
		};
	}

	return null;
}

export function buildThreadSnapshot(session, sessionManager) {
	const snapshotTimestamp = Date.now();
	const sessionError = readSessionErrorMessage(session);
	const liveMessages = Array.isArray(session?.messages) ? session.messages : [];
	const messages = resolveSnapshotMessages(liveMessages, sessionManager, snapshotTimestamp);
	return {
		lastError: sessionError ?? lastAssistantError(liveMessages),
		messages,
		queue: [
			...serializeQueue(session.getSteeringMessages(), 'steer'),
			...serializeQueue(session.getFollowUpMessages(), 'follow-up')
		],
		status: sessionStatus(session, sessionError, messages.length)
	};
}

function serializeQueue(items, mode) {
	return items.map((text, index) => ({
		id: `${mode}-${index}`,
		mode,
		status: 'pending',
		text
	}));
}

function serializeMessage(message, index, snapshotTimestamp) {
	return serializeSnapshotMessage(
		{
			content: message.content,
			failed: message.role === 'assistant' ? hasFatalAssistantStop(message) : message.isError,
			id: message.id ?? message.responseId ?? message.toolCallId ?? null,
			role: message.role,
			timestamp: message.timestamp
		},
		index,
		snapshotTimestamp
	);
}

function resolveSnapshotMessages(liveMessages, sessionManager, snapshotTimestamp) {
	const serializedLiveMessages = liveMessages.map((message, index) =>
		serializeMessage(message, index, snapshotTimestamp)
	);
	const serializedPersistedMessages = serializeSessionEntries(sessionManager, snapshotTimestamp);
	return serializedPersistedMessages.length >= serializedLiveMessages.length
		? serializedPersistedMessages
		: serializedLiveMessages;
}

function serializeSessionEntries(sessionManager, snapshotTimestamp) {
	if (typeof sessionManager?.getEntries !== 'function') {
		return [];
	}

	return sessionManager
		.getEntries()
		.filter((entry) => entry?.type === 'message')
		.map((entry, index) => serializePersistedMessage(entry, index, snapshotTimestamp))
		.filter(Boolean);
}

function serializePersistedMessage(entry, index, snapshotTimestamp) {
	const message = entry?.message;
	if (!message || typeof message !== 'object') {
		return null;
	}

	return serializeSnapshotMessage(
		{
			content: message.content,
			failed: message.isError,
			id: message.id ?? entry?.id ?? null,
			role: message.role,
			timestamp: message.timestamp
		},
		index,
		snapshotTimestamp
	);
}

function serializeSnapshotMessage(message, index, snapshotTimestamp) {
	if (message.role === 'user') {
		return snapshotEntry(
			message,
			'user',
			index,
			snapshotTimestamp,
			message.timestamp,
			'ready',
			() => flattenUserContent(message.content)
		);
	}

	if (message.role === 'assistant') {
		return snapshotEntry(
			message,
			'assistant',
			index,
			snapshotTimestamp,
			message.timestamp,
			message.failed ? 'failed' : 'ready',
			() => flattenAssistantContent(message.content)
		);
	}

	if (message.role === 'toolResult') {
		return snapshotEntry(
			message,
			'tool',
			index,
			snapshotTimestamp,
			message.timestamp,
			message.failed ? 'failed' : 'ready',
			() => flattenToolResultContent(message.content)
		);
	}

	if (message.role === 'system') {
		return snapshotEntry(
			message,
			'system',
			index,
			snapshotTimestamp,
			message.timestamp,
			'ready',
			() =>
				typeof message.content === 'string'
					? message.content
					: flattenAssistantContent(message.content)
		);
	}

	return null;
}

function snapshotEntry(message, role, index, snapshotTimestamp, timestamp, status, readText) {
	const timestampMs = timestamp ?? snapshotTimestamp;
	const text = readText();
	return {
		id: stableMessageId(message, role, index, timestampMs, text),
		role,
		status,
		text,
		timestampMs
	};
}

function stableMessageId(message, role, index, timestampMs, text) {
	if (typeof message.id === 'string' && message.id.trim()) {
		return message.id;
	}

	const payload = JSON.stringify({
		index,
		role,
		text,
		timestampMs
	});
	return createHash('sha1').update(payload).digest('hex');
}

function lastAssistantError(messages) {
	const lastAssistant = [...messages]
		.reverse()
		.find((message) => message && message.role === 'assistant');
	if (!lastAssistant || lastAssistant.stopReason !== 'error') {
		return null;
	}

	const errorMessage = readOwnErrorMessage(lastAssistant);
	return isNonFatalAssistantContentShapeError(errorMessage) ? null : errorMessage;
}

function sessionStatus(
	session,
	sessionError = readSessionErrorMessage(session),
	messageCount = Array.isArray(session?.messages) ? session.messages.length : 0
) {
	if (session.isStreaming) {
		return 'running';
	}

	const lastAssistant = [...session.messages]
		.reverse()
		.find((message) => message && message.role === 'assistant');
	if (
		sessionError ||
		lastAssistantError(session.messages) ||
		hasFatalAssistantStop(lastAssistant)
	) {
		return 'failed';
	}

	return messageCount === 0 ? 'idle' : 'completed';
}

function readOwnErrorMessage(message) {
	const descriptor = Object.getOwnPropertyDescriptor(message, 'errorMessage');
	if (typeof descriptor?.value === 'string' && descriptor.value.trim()) {
		return descriptor.value;
	}
	return null;
}

function readSessionErrorMessage(session) {
	try {
		const errorMessage = session?.state?.errorMessage;
		if (typeof errorMessage !== 'string' || !errorMessage.trim()) {
			return null;
		}
		return isNonFatalAssistantContentShapeError(errorMessage) ? null : errorMessage;
	} catch (error) {
		console.error(
			'[thread-snapshot-session-error-inspection-failed]',
			JSON.stringify({
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : null
			})
		);
		return null;
	}
}

function isNonFatalAssistantContentShapeError(message) {
	return (
		typeof message === 'string' &&
		message.includes('assistantMsg.content.flatMap is not a function')
	);
}

function hasFatalAssistantStop(message) {
	if (message?.stopReason !== 'error') {
		return false;
	}
	return !isNonFatalAssistantContentShapeError(readOwnErrorMessage(message));
}
