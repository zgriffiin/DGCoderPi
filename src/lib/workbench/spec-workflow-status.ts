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

function escapePattern(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sectionText(messageText: string, heading: string) {
	const headingPattern = escapePattern(heading);
	const headingMatch = new RegExp(`^##\\s*${headingPattern}\\s*$`, 'im').exec(messageText);
	if (!headingMatch) {
		return null;
	}

	const sectionStart = headingMatch.index + headingMatch[0].length;
	const remainingText = messageText.slice(sectionStart);
	const nextHeadingIndex = remainingText.search(/^\s*##\s+/m);
	return nextHeadingIndex >= 0 ? remainingText.slice(0, nextHeadingIndex) : remainingText;
}

function gateStatus(messageText: string, gateLabel: string) {
	const scopedText = sectionText(messageText, gateLabel) ?? messageText;
	const match = /\bStatus:\s*(PASS|FAIL)\b/i.exec(scopedText);
	return match?.[1]?.toUpperCase() ?? null;
}

function blockingStatus(messageText: string, gateLabel: string) {
	const gateSection = sectionText(messageText, gateLabel) ?? messageText;
	if (/blocking questions resolved or listed:\s*yes/i.test(gateSection)) {
		return 'clear';
	}

	if (/blocking questions resolved or listed:\s*no/i.test(gateSection)) {
		return 'open';
	}

	const openQuestionsSection = sectionText(messageText, 'Open questions');
	if (!openQuestionsSection) {
		return 'pending';
	}

	if (/blocking questions[\s\S]*?(none|no blocking questions)/i.test(openQuestionsSection)) {
		return 'clear';
	}

	if (
		/blocking questions[\s\S]*?(please|should|what|which|who|when|where|why|how)/i.test(
			openQuestionsSection
		)
	) {
		return 'open';
	}

	return 'pending';
}

function coverageBadge(step: SpecWorkflowStep, messageText: string): SpecStatusBadge {
	const status = gateStatus(messageText, step.gateLabel);
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

function blockingBadge(step: SpecWorkflowStep, messageText: string): SpecStatusBadge {
	const status = blockingStatus(messageText, step.gateLabel);
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
		blocking: blockingBadge(step, message.text),
		coverage: coverageBadge(step, message.text)
	};
}
