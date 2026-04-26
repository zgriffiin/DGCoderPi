export function readEventValue(event: Event) {
	const detail = (event as CustomEvent<{ value?: string } | string>).detail;
	if (typeof detail === 'string') {
		return detail;
	}

	if (detail && typeof detail === 'object' && typeof detail.value === 'string') {
		return detail.value;
	}

	const target = event.target as HTMLInputElement | HTMLTextAreaElement | null;
	return target?.value ?? '';
}
