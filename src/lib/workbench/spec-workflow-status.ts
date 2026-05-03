import type { ThreadRecord } from '$lib/types/workbench';
import type { SpecWorkflowStep } from '$lib/workbench/spec-workflow';
import { latestAssistantMessageForGate } from '$lib/workbench/spec-workflow-artifacts';

type SpecStatusTone = 'cool-gray' | 'green' | 'red' | 'warm-gray';

type SpecStatusBadge = {
	label: string;
	tone: SpecStatusTone;
};

type SpecWorkflowStageStatus = {
	blocking: SpecStatusBadge;
	coverage: SpecStatusBadge;
};

function pendingStageStatus(step: SpecWorkflowStep): SpecWorkflowStageStatus {
	return {
		blocking: {
			label: 'Blocking questions: pending',
			tone: 'cool-gray'
		},
		coverage: {
			label: `${step.coverageLabel}: pending`,
			tone: 'cool-gray'
		}
	};
}

function gateStatus(messageText: string) {
	const match = /\bStatus:\s*(PASS|FAIL)\b/i.exec(messageText);
	return match?.[1]?.toUpperCase() ?? null;
}

function blockingStatus(messageText: string) {
	if (/blocking questions resolved or listed:\s*yes/i.test(messageText)) {
		return 'clear';
	}

	if (/blocking questions resolved or listed:\s*no/i.test(messageText)) {
		return 'open';
	}

	if (
		/## Open questions[\s\S]*?blocking questions[\s\S]*?(none|no blocking questions)/i.test(
			messageText
		)
	) {
		return 'clear';
	}

	if (
		/## Open questions[\s\S]*?blocking questions[\s\S]*?(please|should|what|which|who|when|where|why|how)/i.test(
			messageText
		)
	) {
		return 'open';
	}

	return 'pending';
}

function coverageBadge(step: SpecWorkflowStep, messageText: string): SpecStatusBadge {
	const status = gateStatus(messageText);
	if (status === 'PASS') {
		return {
			label: `${step.coverageLabel}: ready`,
			tone: 'green'
		};
	}

	if (status === 'FAIL') {
		return {
			label: `${step.coverageLabel}: needs work`,
			tone: 'red'
		};
	}

	return {
		label: `${step.coverageLabel}: pending`,
		tone: 'cool-gray'
	};
}

function blockingBadge(messageText: string): SpecStatusBadge {
	const status = blockingStatus(messageText);
	if (status === 'clear') {
		return {
			label: 'Blocking questions: clear',
			tone: 'green'
		};
	}

	if (status === 'open') {
		return {
			label: 'Blocking questions: open',
			tone: 'warm-gray'
		};
	}

	return {
		label: 'Blocking questions: pending',
		tone: 'cool-gray'
	};
}

export function specWorkflowStageStatus(
	thread: ThreadRecord | null,
	step: SpecWorkflowStep
): SpecWorkflowStageStatus {
	if (!thread) {
		return pendingStageStatus(step);
	}

	const message = latestAssistantMessageForGate(thread.messages, step.gateLabel);
	if (!message) {
		return pendingStageStatus(step);
	}

	return {
		blocking: blockingBadge(message.text),
		coverage: coverageBadge(step, message.text)
	};
}
