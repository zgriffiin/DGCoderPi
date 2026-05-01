export function formatPromptText(
	text: string,
	attachments?:
		| { mimeType: string; name: string; path: string; previewText?: string | null }[]
		| null,
	intentGuidance?: string | null
): string;
