import type DOMPurify from 'isomorphic-dompurify';
import type { marked } from 'marked';

const MARKDOWN_CACHE_MAX_ENTRIES = 64;
const MARKDOWN_CACHE_MAX_CHARS = 250_000;
const MARKDOWN_CACHE_MAX_MESSAGE_CHARS = 20_000;
const markdownCacheEntries = new Map<string, { html: string; size: number }>();
let markdownCacheCharCount = 0;

function cacheMarkdown(value: string, html: string) {
	if (value.length > MARKDOWN_CACHE_MAX_MESSAGE_CHARS) {
		return html;
	}

	const size = value.length + html.length;
	if (size > MARKDOWN_CACHE_MAX_CHARS) {
		return html;
	}

	const existingEntry = markdownCacheEntries.get(value);
	if (existingEntry) {
		markdownCacheEntries.delete(value);
		markdownCacheCharCount -= existingEntry.size;
	}

	markdownCacheEntries.set(value, { html, size });
	markdownCacheCharCount += size;

	while (
		markdownCacheEntries.size > MARKDOWN_CACHE_MAX_ENTRIES ||
		markdownCacheCharCount > MARKDOWN_CACHE_MAX_CHARS
	) {
		const oldestKey = markdownCacheEntries.keys().next().value;
		if (typeof oldestKey !== 'string') {
			break;
		}

		const oldestEntry = markdownCacheEntries.get(oldestKey);
		if (oldestEntry) {
			markdownCacheCharCount -= oldestEntry.size;
		}
		markdownCacheEntries.delete(oldestKey);
	}

	return html;
}

export function renderMarkdown(
	value: string,
	markdownParser: typeof marked,
	htmlSanitizer: typeof DOMPurify
) {
	const cached = markdownCacheEntries.get(value);
	if (cached) {
		markdownCacheEntries.delete(value);
		markdownCacheEntries.set(value, cached);
		return cached.html;
	}

	const parsedHtml = markdownParser.parse(value, {
		async: false,
		breaks: true,
		gfm: true
	} as const);

	return cacheMarkdown(value, htmlSanitizer.sanitize(parsedHtml));
}
