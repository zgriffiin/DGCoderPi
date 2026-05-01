import type { ThreadIntent } from '$lib/types/workbench';

export const THREAD_INTENTS: { label: string; value: ThreadIntent }[] = [
	{ label: 'Understand', value: 'understand' },
	{ label: 'Review', value: 'review' },
	{ label: 'Plan', value: 'plan' },
	{ label: 'Implement', value: 'implement' },
	{ label: 'Ship', value: 'ship' }
];

export function threadIntentLabel(intent: ThreadIntent) {
	return THREAD_INTENTS.find((entry) => entry.value === intent)?.label ?? 'Understand';
}
