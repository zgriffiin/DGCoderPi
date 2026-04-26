import { browser } from '$app/environment';
import { writable } from 'svelte/store';

type ThemeMode = 'g10' | 'g100';

const STORAGE_KEY = 'dgcoder-pi-theme';

function applyTheme(theme: ThemeMode) {
	if (!browser) {
		return;
	}

	document.documentElement.setAttribute('theme', theme);
	localStorage.setItem(STORAGE_KEY, theme);
}

function resolveInitialTheme(): ThemeMode {
	if (!browser) {
		return 'g10';
	}

	const storedTheme = localStorage.getItem(STORAGE_KEY);

	if (storedTheme === 'g10' || storedTheme === 'g100') {
		return storedTheme;
	}

	return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'g100' : 'g10';
}

const initialTheme = resolveInitialTheme();
applyTheme(initialTheme);

const store = writable<ThemeMode>(initialTheme);

export const theme = {
	subscribe: store.subscribe
};

export function setTheme(value: ThemeMode) {
	applyTheme(value);
	store.set(value);
}
