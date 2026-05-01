/**
 * @param {string} text
 * @param {{ mimeType: string, name: string, path: string, previewText?: string | null }[] | null | undefined} attachments
 * @param {string | null | undefined} intentGuidance
 */
export function formatPromptText(text, attachments, intentGuidance) {
	const promptText = intentGuidance ? `${intentGuidance}\n\n${text}` : text;
	if (!attachments || attachments.length === 0) {
		return promptText;
	}

	const lines = attachments.map((attachment) => {
		const preview = attachment.previewText ? `\n  Preview: ${attachment.previewText}` : '';
		return `- ${attachment.name} (${attachment.mimeType}) at ${attachment.path}${preview}`;
	});

	return `${promptText}\n\nAttached files:\n${lines.join('\n')}\nUse the local file paths above when you need to inspect these attachments.`;
}
