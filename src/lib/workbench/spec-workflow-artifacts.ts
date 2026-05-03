import type { MessageRecord, ThreadRecord } from '$lib/types/workbench';
import type { SpecWorkflowStep } from '$lib/workbench/spec-workflow';

const STAGE_HEADINGS: Record<string, string[]> = {
	Design: ['# Design'],
	Implement: ['# Implementation Run', '# Implementation Result'],
	Intent: ['# Intent'],
	Requirements: ['# Requirements'],
	Review: ['# Review'],
	Ship: ['# Ship'],
	Tasks: ['# Tasks'],
	Understand: ['# Context Map']
};

export function latestAssistantMessageForGate(messages: MessageRecord[], gateLabel: string) {
	return [...messages]
		.reverse()
		.find(
			(message) =>
				message.role === 'assistant' && message.text.toLowerCase().includes(gateLabel.toLowerCase())
		);
}

function artifactHeadingIndex(messageText: string, step: SpecWorkflowStep) {
	const candidateIndexes = (STAGE_HEADINGS[step.label] ?? [])
		.map((heading) => messageText.indexOf(heading))
		.filter((index) => index >= 0);
	if (candidateIndexes.length > 0) {
		return Math.min(...candidateIndexes);
	}

	const genericHeadingIndex = messageText.search(/^#\s/m);
	return genericHeadingIndex >= 0 ? genericHeadingIndex : 0;
}

export function latestSpecArtifactFallbackText(
	thread: ThreadRecord | null,
	step: SpecWorkflowStep
) {
	if (!thread) {
		return null;
	}

	const message = latestAssistantMessageForGate(thread.messages, step.gateLabel);
	if (!message) {
		return null;
	}

	const artifactText = message.text.slice(artifactHeadingIndex(message.text, step)).trim();
	return artifactText.length > 0 ? artifactText : null;
}
