export function describeSessionCommandError(error, sessionEntry) {
	const message = error instanceof Error ? error.message : String(error);
	const modelKey = sessionEntry?.modelKey ?? 'unknown model';
	const thinkingLevel = sessionEntry?.thinkingLevel ?? 'unknown reasoning';
	return `${modelKey} (${thinkingLevel}) failed: ${message}`;
}

export function logSessionCommandFailure(error, sessionEntry) {
	const details = {
		cause: serializeErrorCause(error),
		error: error instanceof Error ? error.message : String(error),
		modelKey: sessionEntry?.modelKey ?? null,
		provider: sessionEntry?.model?.provider ?? null,
		stack: error instanceof Error ? error.stack : null,
		thinkingLevel: sessionEntry?.thinkingLevel ?? null
	};
	console.error('[session-command-failed]', JSON.stringify(details));
}

export function safeFindLatestAssistantError(session, previousAssistantCount) {
	try {
		return findLatestAssistantError(session, previousAssistantCount);
	} catch (error) {
		console.error(
			'[assistant-error-inspection-failed]',
			JSON.stringify({
				error: error instanceof Error ? error.message : String(error),
				stack: error instanceof Error ? error.stack : null
			})
		);
		return null;
	}
}

function findLatestAssistantError(session, previousAssistantCount) {
	const messages = Array.isArray(session?.messages) ? session.messages : [];
	const newAssistantMessages = messages
		.filter((message) => message?.role === 'assistant')
		.slice(previousAssistantCount);
	const latestAssistant = [...newAssistantMessages]
		.reverse()
		.find((message) => message?.role === 'assistant');
	if (latestAssistant?.stopReason !== 'error') {
		return null;
	}
	const message = readAssistantErrorMessage(latestAssistant);
	if (isNonFatalAssistantContentShapeError(message)) {
		return null;
	}
	return new Error(message);
}

function readAssistantErrorMessage(message) {
	const ownError = Object.getOwnPropertyDescriptor(message, 'errorMessage');
	if (typeof ownError?.value === 'string' && ownError.value.trim()) {
		return ownError.value;
	}

	const ownErrorObject = Object.getOwnPropertyDescriptor(message, 'error');
	const error = ownErrorObject?.value;
	if (error instanceof Error && error.message.trim()) {
		return error.message;
	}
	if (typeof error === 'string' && error.trim()) {
		return error;
	}

	return 'The assistant request stopped with an error.';
}

function isNonFatalAssistantContentShapeError(message) {
	return message.includes('assistantMsg.content.flatMap is not a function');
}

function serializeErrorCause(error) {
	if (!(error instanceof Error) || !error.cause) {
		return null;
	}

	const cause = error.cause;
	if (cause instanceof Error) {
		return {
			code: cause.code ?? null,
			message: cause.message,
			name: cause.name
		};
	}

	return String(cause);
}
