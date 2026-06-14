<script lang="ts">
	import { Button, TextInput } from 'carbon-components-svelte';
	import type { KiroSsoDeviceAuth } from '$lib/types/workbench';
	import { readEventValue } from '$lib/workbench/read-event-value';

	type Props = {
		busy: boolean;
		configured: boolean;
		deviceAuth: KiroSsoDeviceAuth | null;
		error: string | null;
		onComplete: VoidFunction;
		onLogout: VoidFunction;
		onRegionChange: (value: string) => void;
		onStart: VoidFunction;
		onStartUrlChange: (value: string) => void;
		regionDraft: string;
		startUrlDraft: string;
	};

	let {
		busy,
		configured,
		deviceAuth,
		error,
		onComplete,
		onLogout,
		onRegionChange,
		onStart,
		onStartUrlChange,
		regionDraft,
		startUrlDraft
	}: Props = $props();

	function openDeviceAuthUrl() {
		if (!deviceAuth) {
			return;
		}
		window.open(
			deviceAuth.verificationUriComplete || deviceAuth.verificationUri,
			'_blank',
			'noopener,noreferrer'
		);
	}
</script>

<div class="provider-row__controls">
	<TextInput
		labelText="IAM Identity Center start URL"
		placeholder="https://company-aws-portal-prod.awsapps.com/start"
		size="sm"
		type="url"
		value={startUrlDraft}
		on:input={(event) => onStartUrlChange(readEventValue(event))}
	/>
	<TextInput
		labelText="IAM Identity Center region"
		placeholder="us-east-1"
		size="sm"
		value={regionDraft}
		on:input={(event) => onRegionChange(readEventValue(event))}
	/>
	<div class="settings-inline-actions">
		<Button
			disabled={busy || !startUrlDraft.trim() || !regionDraft.trim()}
			kind="secondary"
			size="small"
			on:click={onStart}
		>
			{busy ? 'Working...' : 'Start SSO'}
		</Button>
		{#if configured}
			<Button disabled={busy} kind="ghost" size="small" on:click={onLogout}>Sign out</Button>
		{/if}
	</div>
	{#if deviceAuth}
		<div class="kiro-device-auth">
			<p>
				Open {deviceAuth.verificationUriComplete || deviceAuth.verificationUri} and enter code
				<code>{deviceAuth.userCode}</code>.
			</p>
			<Button disabled={busy} kind="secondary" size="small" on:click={openDeviceAuthUrl}>
				Open authorization page
			</Button>
			<Button disabled={busy} kind="primary" size="small" on:click={onComplete}>
				{busy ? 'Completing...' : 'Complete SSO'}
			</Button>
		</div>
	{/if}
	{#if error}
		<p class="settings-error" role="alert">{error}</p>
	{/if}
</div>
