<script lang="ts">
	import { Tag } from 'carbon-components-svelte';
	import type { ThreadRecord } from '$lib/types/workbench';

	const toneByStatus: Record<ThreadRecord['status'], 'blue' | 'cool-gray' | 'green' | 'red'> = {
		completed: 'green',
		failed: 'red',
		idle: 'cool-gray',
		running: 'blue'
	};

	function formatStatus(status: ThreadRecord['status']) {
		return status.charAt(0).toUpperCase() + status.slice(1);
	}

	let { status }: { status: ThreadRecord['status'] } = $props();
</script>

<Tag size="sm" type={toneByStatus[status]}>
	{formatStatus(status)}
</Tag>
