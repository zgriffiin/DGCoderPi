export function readFeatures(payload) {
	return {
		diagnosticLoggingEnabled: payload.diagnosticLoggingEnabled !== false,
		docparserEnabled: payload.docparserEnabled !== false
	};
}

export function logDiagnostic(features, label, payload) {
	if (!features.diagnosticLoggingEnabled) {
		return;
	}
	console.error(`[${label}]`, JSON.stringify(payload));
}

export function logAgentEvent(features, threadId, event) {
	if (!features.diagnosticLoggingEnabled) {
		return;
	}

	if (event.type === 'agent_start' || event.type === 'agent_end') {
		logDiagnostic(features, 'agent-event', {
			at: new Date().toISOString(),
			threadId,
			type: event.type
		});
	} else if (event.type === 'tool_execution_start' || event.type === 'tool_execution_end') {
		logDiagnostic(features, 'tool-event', {
			at: new Date().toISOString(),
			isError: event.isError ?? false,
			threadId,
			toolName: event.toolName,
			type: event.type
		});
	} else if (event.type === 'auto_retry_start' || event.type === 'compaction_start') {
		logDiagnostic(features, 'agent-event', {
			at: new Date().toISOString(),
			threadId,
			type: event.type
		});
	}
}
