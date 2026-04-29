export function normalizePriority(value) {
	const normalized = safeText(value).toLowerCase();
	if (normalized === 'critical' || normalized === 'severe' || normalized === 'high') return 'high';
	if (normalized === 'moderate' || normalized === 'medium') return 'medium';
	if (normalized === 'low' || normalized === 'minor') return 'low';
	return 'unknown';
}

function safeText(value) {
	return typeof value === 'string' ? value.trim() : '';
}
