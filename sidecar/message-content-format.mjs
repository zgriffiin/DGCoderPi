import { formatToolCall } from './tool-call-format.mjs';

function readMimeLabel(value) {
	return typeof value === 'string' && value.trim() ? value.trim() : 'unknown';
}

function readEntryLine(entry, imageLabel) {
	if (!entry || typeof entry !== 'object') {
		return '';
	}

	if (entry.type === 'text') {
		return typeof entry.text === 'string' ? entry.text : '';
	}

	if (entry.type === 'image') {
		return `[${imageLabel}: ${readMimeLabel(entry.mimeType)}]`;
	}

	return '';
}

export function flattenUserContent(content) {
	if (typeof content === 'string') {
		return content;
	}

	const entries = Array.isArray(content) ? content : [];
	return entries
		.map((entry) => readEntryLine(entry, 'Image'))
		.filter(Boolean)
		.join('\n');
}

export function flattenAssistantContent(content) {
	if (content == null) {
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
				return typeof entry.text === 'string' ? entry.text : '';
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
	if (typeof content === 'string') {
		return content;
	}

	const entries = Array.isArray(content) ? content : [];
	return entries
		.map((entry) => readEntryLine(entry, 'Image result'))
		.filter(Boolean)
		.join('\n');
}
