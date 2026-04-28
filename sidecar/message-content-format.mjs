import { formatToolCall } from './tool-call-format.mjs';

function readMimeLabel(value) {
	return typeof value === 'string' && value.trim() ? value.trim() : 'unknown';
}

export function flattenUserContent(content) {
	if (typeof content === 'string') {
		return content;
	}

	const entries = Array.isArray(content) ? content : [];
	return entries
		.map((entry) => {
			if (!entry || typeof entry !== 'object') {
				return '';
			}
			if (entry.type === 'text') {
				return entry.text;
			}
			if (entry.type === 'image') {
				return `[Image: ${readMimeLabel(entry.mimeType)}]`;
			}
			return '';
		})
		.filter(Boolean)
		.join('\n');
}

export function flattenAssistantContent(content) {
	if (!content) {
		return 'Pi is preparing the next step.';
	}

	if (typeof content === 'string') {
		return content;
	}

	const entries = Array.isArray(content) ? content : [];
	const lines = entries
		.map((entry) => {
			if (!entry || typeof entry !== 'object') {
				return '';
			}
			if (entry.type === 'text') {
				return entry.text;
			}
			if (entry.type === 'toolCall') {
				return formatToolCall(entry.name, entry.arguments);
			}
			return '';
		})
		.filter(Boolean);

	return lines.length > 0 ? lines.join('\n') : 'Pi is preparing the next step.';
}

export function flattenToolResultContent(content) {
	const entries = Array.isArray(content) ? content : [];
	return entries
		.map((entry) => {
			if (!entry || typeof entry !== 'object') {
				return '';
			}
			if (entry.type === 'text') {
				return entry.text;
			}
			if (entry.type === 'image') {
				return `[Image result: ${readMimeLabel(entry.mimeType)}]`;
			}
			return '';
		})
		.filter(Boolean)
		.join('\n');
}
