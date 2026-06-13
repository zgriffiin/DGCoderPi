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
	const steering = queued.steering.filter(takePromoted);
	const followUp = queued.followUp.filter(takePromoted);
	await sessionEntry.session.steer(text);
	for (const message of steering) {
		await sessionEntry.session.steer(message);
	}
	for (const message of followUp) {
		await sessionEntry.session.followUp(message);
	}
}
