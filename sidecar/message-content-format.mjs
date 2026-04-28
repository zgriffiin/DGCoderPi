import { formatToolCall } from './tool-call-format.mjs';

export function flattenUserContent(content) {
	if (typeof content === 'string') {
		return content;
	}

	return content
		.map((entry) => {
			if (entry.type === 'text') {
				return entry.text;
			}
			if (entry.type === 'image') {
				return `[Image: ${entry.mimeType}]`;
			}
			return '';
		})
		.filter(Boolean)
		.join('\n');
}

export function flattenAssistantContent(content) {
	const lines = content
		.map((entry) => {
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
	return content
		.map((entry) => (entry.type === 'text' ? entry.text : `[Image result: ${entry.mimeType}]`))
		.join('\n');
}
