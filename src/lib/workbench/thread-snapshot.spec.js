import { describe, expect, it } from 'vitest';

const sidecarSnapshotPath = '../../../sidecar/' + 'thread-snapshot.mjs';

function session(overrides = {}) {
	return {
		getContextUsage: () => null,
		getFollowUpMessages: () => [],
		getSteeringMessages: () => [],
		isStreaming: false,
		messages: [],
		state: {},
		...overrides
	};
}

describe('thread snapshot status', () => {
	it('treats agent_end as terminal even if the session still reports streaming', async () => {
		const { buildThreadSnapshot } = await import(sidecarSnapshotPath);
		const snapshot = buildThreadSnapshot(
			session({
				isStreaming: true,
				messages: [
					{
						content: 'done',
						role: 'assistant',
						timestamp: 1
					}
				]
			}),
			null,
			{ terminalEventType: 'agent_end' }
		);

		expect(snapshot.status).toBe('completed');
	});

	it('keeps fatal assistant errors failed on agent_end', async () => {
		const { buildThreadSnapshot } = await import(sidecarSnapshotPath);
		const snapshot = buildThreadSnapshot(
			session({
				isStreaming: true,
				messages: [
					{
						content: 'failed',
						errorMessage: 'model failed',
						role: 'assistant',
						stopReason: 'error',
						timestamp: 1
					}
				]
			}),
			null,
			{ terminalEventType: 'agent_end' }
		);

		expect(snapshot.status).toBe('failed');
	});
});
