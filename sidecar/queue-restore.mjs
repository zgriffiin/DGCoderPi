export function restoreSessionQueue(sessionEntry) {
	if (!sessionEntry) {
		return { queue: [] };
	}

	const { steering, followUp } = sessionEntry.session.clearQueue();
	return {
		queue: [
			...steering.map((text, index) => queueEntry('steer', text, index)),
			...followUp.map((text, index) => queueEntry('follow-up', text, index))
		]
	};
}

function queueEntry(mode, text, index) {
	return {
		id: `${mode}-${index}`,
		mode,
		status: 'pending',
		text
	};
}
