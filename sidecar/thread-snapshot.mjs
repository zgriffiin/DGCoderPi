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

export function buildThreadSnapshot(session) {
	const snapshotTimestamp = Date.now();
	return {
		lastError: session.state.errorMessage ?? lastAssistantError(session.messages),
		messages: session.messages.map((message, index) =>
			serializeMessage(message, index, snapshotTimestamp)
		),
		queue: [
			...serializeQueue(session.getSteeringMessages(), 'steer'),
			...serializeQueue(session.getFollowUpMessages(), 'follow-up')
		],
		status: sessionStatus(session)
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
	if (message.role === 'user') {
		return {
			id: `${message.timestamp}-user-${index}`,
			role: 'user',
			status: 'ready',
			text: flattenUserContent(message.content),
			timestampMs: message.timestamp
		};
	}

	if (message.role === 'assistant') {
		return {
			id: `${message.timestamp}-assistant-${index}`,
			role: 'assistant',
			status: message.stopReason === 'error' ? 'failed' : 'ready',
			text: flattenAssistantContent(message.content),
			timestampMs: message.timestamp
		};
	}

	if (message.role === 'toolResult') {
		return {
			id: `${message.timestamp}-tool-${index}`,
			role: 'tool',
			status: message.isError ? 'failed' : 'ready',
			text: flattenToolResultContent(message.content),
			timestampMs: message.timestamp
		};
	}

	return {
		id: `${snapshotTimestamp}-system-${index}`,
		role: 'system',
		status: 'ready',
		text: 'Unsupported message type.',
		timestampMs: snapshotTimestamp
	};
}

function lastAssistantError(messages) {
	const lastAssistant = [...messages]
		.reverse()
		.find((message) => message && message.role === 'assistant');
	return lastAssistant?.errorMessage ?? null;
}

function sessionStatus(session) {
	if (session.isStreaming) {
		return 'running';
	}

	const lastAssistant = [...session.messages]
		.reverse()
		.find((message) => message && message.role === 'assistant');
	if (
		session.state.errorMessage ||
		lastAssistantError(session.messages) ||
		lastAssistant?.stopReason === 'error'
	) {
		return 'failed';
	}

	return session.messages.length === 0 ? 'idle' : 'completed';
}
