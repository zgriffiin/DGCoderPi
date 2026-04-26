<script lang="ts">
	import { Tag } from 'carbon-components-svelte';
	import type { ThreadStatus } from '$lib/types/workbench';

	const toneByStatus: Record<ThreadStatus, 'blue' | 'cool-gray' | 'green' | 'red' | 'warm-gray'> = {
		completed: 'green',
		failed: 'red',
		idle: 'cool-gray',
		running: 'blue',
		waiting: 'warm-gray'
	};

	function formatStatus(status: ThreadStatus) {
		return status.charAt(0).toUpperCase() + status.slice(1);
	}

	let { status }: { status: ThreadStatus } = $props();
</script>

<Tag size="sm" type={toneByStatus[status]}>
	{formatStatus(status)}
</Tag>
