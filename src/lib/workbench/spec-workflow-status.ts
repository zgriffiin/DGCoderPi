import type { ThreadRecord, WorkflowSettings } from '$lib/types/workbench';
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

type SpecWorkflowAdvanceState = {
	blocked: boolean;
	blockingStepLabel: string | null;
	reason: string | null;
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

function hasMeaningfulListContent(section: string | null) {
	if (!section) {
		return false;
	}

	const normalized = section
		.replace(/^\s*[-*]\s*/gm, '')
		.replace(/\bnone\b/gi, '')
		.replace(/\bno unresolved blockers\b/gi, '')
		.replace(/\bno blockers\b/gi, '')
		.replace(/\bn\/a\b/gi, '')
		.trim();
	return normalized.length > 0;
}

function unresolvedReviewBlockers(messageText: string, gateLabel: string) {
	if (gateStatus(messageText, gateLabel) !== 'FAIL') {
		return false;
	}

	return (
		hasMeaningfulListContent(sectionText(messageText, 'Blocking findings')) ||
		hasMeaningfulListContent(sectionText(messageText, 'Must-fix findings')) ||
		hasMeaningfulListContent(sectionText(messageText, 'Required fixes'))
	);
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

export function specWorkflowAdvanceState(
	thread: ThreadRecord | null,
	steps: SpecWorkflowStep[],
	workflowSettings: WorkflowSettings
): SpecWorkflowAdvanceState {
	if (!thread || !workflowSettings.blockTaskAdvanceOnReviewFindings) {
		return { blocked: false, blockingStepLabel: null, reason: null };
	}

	for (const step of steps) {
		if (step.label !== 'Implement' && step.label !== 'Review') {
			continue;
		}
		const message = latestAssistantMessageForGate(thread.messages, step.gateLabel);
		if (!message || !unresolvedReviewBlockers(message.text, step.gateLabel)) {
			continue;
		}
		return {
			blocked: true,
			blockingStepLabel: step.label,
			reason: `${step.label} still has unresolved blocker findings`
		};
	}

	return { blocked: false, blockingStepLabel: null, reason: null };
}

export function canRunSpecWorkflowStep(
	thread: ThreadRecord | null,
	steps: SpecWorkflowStep[],
	workflowSettings: WorkflowSettings,
	stepLabel: string
) {
	const advanceState = specWorkflowAdvanceState(thread, steps, workflowSettings);
	if (!advanceState.blocked) {
		return true;
	}

	const blockingIndex = steps.findIndex((step) => step.label === advanceState.blockingStepLabel);
	const targetIndex = steps.findIndex((step) => step.label === stepLabel);
	return blockingIndex < 0 || targetIndex <= blockingIndex;
}
