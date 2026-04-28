export function formatToolCall(name, args) {
	const values = normalizeToolArgs(args);

	switch (name) {
		case 'read':
			return `[read: ${formatReadTarget(values)}]`;
		case 'write':
			return `[write: ${formatPathValue(values.path ?? values.file_path)}]`;
		case 'edit':
			return `[edit: ${formatPathValue(values.path ?? values.file_path)}]`;
		case 'bash':
			return `[bash: ${formatCommandValue(values.command)}]`;
		case 'grep':
			return `[grep: /${formatInlineValue(values.pattern)}/ in ${formatPathValue(values.path, '.')}]`;
		case 'find':
			return `[find: ${formatInlineValue(values.pattern)} in ${formatPathValue(values.path, '.')}]`;
		case 'ls':
			return `[ls: ${formatPathValue(values.path, '.')}]`;
		default:
			return `[${name}: ${formatGenericArgs(values)}]`;
	}
}

function normalizeToolArgs(args) {
	if (!args) {
		return {};
	}

	if (typeof args === 'string') {
		try {
			const parsed = JSON.parse(args);
			return parsed && typeof parsed === 'object' ? parsed : { value: args };
		} catch {
			return { value: args };
		}
	}

	return typeof args === 'object' ? args : { value: String(args) };
}

function formatReadTarget(args) {
	const target = formatPathValue(args.path ?? args.file_path);
	const offset = normalizeInteger(args.offset);
	const limit = normalizeInteger(args.limit);
	if (offset === null && limit === null) {
		return target;
	}

	const start = offset ?? 1;
	if (limit === null) {
		return `${target}:${start}`;
	}

	return `${target}:${start}-${start + limit - 1}`;
}

function normalizeInteger(value) {
	const parsed =
		typeof value === 'number'
			? value
			: typeof value === 'string'
				? Number.parseInt(value, 10)
				: Number.NaN;
	return Number.isFinite(parsed) ? parsed : null;
}

function formatPathValue(value, fallback = '?') {
	if (typeof value !== 'string' || value.trim().length === 0) {
		return fallback;
	}

	return value.replaceAll('\\', '/');
}

function formatCommandValue(value) {
	if (typeof value !== 'string' || value.trim().length === 0) {
		return '?';
	}

	const normalized = value.replace(/[\r\n\t]+/g, ' ').trim();
	return normalized.length <= 72 ? normalized : `${normalized.slice(0, 72)}...`;
}

function formatInlineValue(value, fallback = '?') {
	if (value === undefined || value === null) {
		return fallback;
	}

	const text = String(value)
		.replace(/[\r\n\t]+/g, ' ')
		.trim();
	return text.length > 0 ? text : fallback;
}

function formatGenericArgs(args) {
	const entries = Object.entries(args).slice(0, 3);
	if (entries.length === 0) {
		return 'requested';
	}

	return entries.map(([key, value]) => `${key}=${formatInlineValue(value, '')}`).join(', ');
}
