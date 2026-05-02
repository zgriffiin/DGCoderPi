const STALLED_AFTER_MS = 2 * 60 * 1000;

export function startRun(runtimeStates, threadId) {
	const state = {
		activeTools: [],
		lastHeartbeatAt: 0,
		lastProgressAt: Date.now(),
		startedAt: Date.now(),
		stallWarningSent: false
	};
	runtimeStates.set(threadId, state);
	return state;
}

export function clearRun(runtimeStates, threadId) {
	runtimeStates.delete(threadId);
}

export function noteRunEvent(runtimeStates, threadId, event) {
	const state = runtimeStates.get(threadId);
	if (!state) {
		return null;
	}

	state.lastProgressAt = Date.now();
	state.stallWarningSent = false;
	if (event.type === 'tool_execution_start') {
		state.activeTools.push({ name: event.toolName, startedAt: Date.now() });
	} else if (event.type === 'tool_execution_end') {
		state.activeTools.pop();
	}
	return state;
}

export function heartbeatPayload(runtimeStates, threadId, now = Date.now()) {
	const state = runtimeStates.get(threadId);
	if (!state) {
		return null;
	}

	const activeTool = state.activeTools.at(-1);
	return {
		activeToolName: activeTool?.name ?? null,
		idleMs: now - state.lastProgressAt,
		runDurationMs: now - state.startedAt,
		toolDurationMs: activeTool ? now - activeTool.startedAt : null
	};
}

export function shouldSendHeartbeat(runtimeStates, threadId, now = Date.now()) {
	const state = runtimeStates.get(threadId);
	if (!state) {
		return false;
	}

	if (now - state.lastHeartbeatAt < 30_000) {
		return false;
	}

	state.lastHeartbeatAt = now;
	return true;
}

export function shouldWarnStalled(runtimeStates, threadId, now = Date.now()) {
	const state = runtimeStates.get(threadId);
	if (!state || state.stallWarningSent) {
		return false;
	}

	if (now - state.lastProgressAt < STALLED_AFTER_MS) {
		return false;
	}

	state.stallWarningSent = true;
	return true;
}
