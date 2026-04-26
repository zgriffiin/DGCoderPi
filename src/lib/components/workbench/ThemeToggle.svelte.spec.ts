import { mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { setTheme } from '$lib/theme/theme';
import ThemeToggle from './ThemeToggle.svelte';

describe('ThemeToggle', () => {
	afterEach(() => {
		localStorage.clear();
		setTheme('g10');
	});

	it('updates the document theme attribute when toggled', async () => {
		setTheme('g10');

		const target = document.createElement('div');
		document.body.appendChild(target);

		const component = mount(ThemeToggle, { target });
		const input = target.querySelector('input[type="checkbox"]') as HTMLInputElement;

		expect(document.documentElement.getAttribute('theme')).toBe('g10');

		input.click();
		await Promise.resolve();

		expect(document.documentElement.getAttribute('theme')).toBe('g100');

		unmount(component);
		target.remove();
	});
});
