import { touchSession } from './session-history.mjs';

export async function promoteQueuedMessage(sessionEntry, text) {
	touchSession(sessionEntry);
	const queued = sessionEntry.session.clearQueue();
	let promoted = false;
	const takePromoted = (message) => {
		if (!promoted && message === text) {
			promoted = true;
			return false;
		}
		return true;
	};
	// Apply the promoted message first, then the remaining steering and follow-up messages in order.
	const pending = [
		{ kind: 'steer', message: text },
		...queued.steering.filter(takePromoted).map((message) => ({ kind: 'steer', message })),
		...queued.followUp.filter(takePromoted).map((message) => ({ kind: 'followUp', message }))
	];

	const apply = ({ kind, message }) =>
		kind === 'followUp'
			? sessionEntry.session.followUp(message)
			: sessionEntry.session.steer(message);

	for (let index = 0; index < pending.length; index += 1) {
		try {
			await apply(pending[index]);
		} catch (error) {
			// The queue was already cleared above, so re-queue every message that has not been
			// applied yet to avoid permanently losing pending work when a send fails.
			for (const operation of pending.slice(index)) {
				void Promise.resolve(apply(operation)).catch(() => {});
			}
			throw error;
		}
	}
}
