import { describe, expect, it } from 'vitest';
import { THREAD_INTENTS, threadIntentLabel } from './thread-intents';

describe('thread intents', () => {
	it('lists the phase one intent choices in UI order', () => {
		expect(THREAD_INTENTS.map((intent) => intent.value)).toEqual([
			'understand',
			'review',
			'plan',
			'implement',
			'ship'
		]);
	});

	it('formats compact labels', () => {
		expect(threadIntentLabel('plan')).toBe('Plan');
	});
});
