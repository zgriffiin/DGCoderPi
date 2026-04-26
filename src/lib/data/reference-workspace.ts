import type { WorkbenchData } from '$lib/types/workbench';

export const referenceWorkbenchData: WorkbenchData = {
	models: [
		{
			id: 'gpt-5',
			text: 'GPT-5',
			helperText: 'General implementation and review'
		},
		{
			id: 'claude-sonnet-4-5',
			text: 'Claude Sonnet 4.5',
			helperText: 'Spec drafting and architecture iteration'
		},
		{
			id: 'pi-local',
			text: 'Pi Local',
			helperText: 'Repository-native work with local tools'
		}
	],
	projects: [
		{
			id: 'dgcoder-pi',
			name: 'DGCoder Pi',
			path: 'C:\\Users\\dgriffin3\\DGCoder-pi',
			branch: 'main',
			threads: [
				{
					id: 'desktop-shell',
					title: 'Build the desktop workbench shell',
					status: 'running',
					updatedAt: '11:29 AM',
					summary: 'Scaffold Tauri + SvelteKit + Carbon with the first durable three-pane shell.',
					branch: 'feat/workbench-shell',
					note: 'Frontend scaffolding is in place. Local desktop build verification is pending until the Rust toolchain is installed.',
					activities: [
						{
							id: 'act-1',
							title: 'Stack lock',
							tone: 'plan',
							timestamp: '11:04 AM',
							body: 'Locked the baseline stack to Tauri 2, SvelteKit SPA, Rust core, Carbon styling, pnpm, and strict TypeScript.',
							tags: ['architecture', 'packaging']
						},
						{
							id: 'act-2',
							title: 'Skill pack',
							tone: 'assistant',
							timestamp: '11:12 AM',
							body: 'Added repo-local skills for the stack, UI, and prompting so future agents work from the same implementation lane.',
							tags: ['skills', 'guidance']
						},
						{
							id: 'act-3',
							title: 'Tooling check',
							tone: 'tool',
							timestamp: '11:18 AM',
							body: 'Node 24 and pnpm 10 are installed.\nWebView2 and MSVC are present.\nRust, Cargo, and rustup are not installed yet.',
							tags: ['environment', 'tauri']
						},
						{
							id: 'act-4',
							title: 'Scaffold path',
							tone: 'system',
							timestamp: '11:24 AM',
							body: 'Created the SvelteKit scaffold with static adapter, lint, format, unit test, browser test, Playwright, and Storybook support.',
							tags: ['frontend', 'quality']
						}
					],
					tasks: [
						{
							id: 'task-1',
							title: 'Finish Carbon workbench shell',
							status: 'in-progress',
							owner: 'UI',
							validation: 'Svelte check, lint, storybook smoke'
						},
						{
							id: 'task-2',
							title: 'Add typed desktop services boundary',
							status: 'ready',
							owner: 'Rust',
							validation: 'Command schema and desktop runtime'
						},
						{
							id: 'task-3',
							title: 'Persist theme and shell preferences',
							status: 'ready',
							owner: 'Shared',
							validation: 'Browser + desktop state parity'
						},
						{
							id: 'task-4',
							title: 'Install Rust toolchain locally',
							status: 'blocked',
							owner: 'Environment',
							validation: 'pnpm tauri info shows rustc and cargo'
						}
					],
					files: [
						{
							id: 'file-1',
							path: 'package.json',
							change: 'modified',
							note: 'Quality and Tauri scripts'
						},
						{
							id: 'file-2',
							path: 'src/routes/+page.svelte',
							change: 'modified',
							note: 'Workbench entry route'
						},
						{
							id: 'file-3',
							path: 'src/lib/components/workbench/*',
							change: 'added',
							note: 'Carbon workbench shell components'
						},
						{
							id: 'file-4',
							path: 'src-tauri/tauri.conf.json',
							change: 'modified',
							note: 'Desktop shell defaults'
						}
					],
					checks: [
						{
							id: 'check-1',
							name: 'Svelte check',
							status: 'running',
							detail: 'Waiting for shell files to settle'
						},
						{
							id: 'check-2',
							name: 'Lint',
							status: 'pending',
							detail: 'Complexity and line limits are configured'
						},
						{
							id: 'check-3',
							name: 'Tauri info',
							status: 'passed',
							detail: 'Windows prerequisites found except Rust'
						}
					]
				},
				{
					id: 'spec-mode',
					title: 'Define specification-mode flow',
					status: 'waiting',
					updatedAt: '10:57 AM',
					summary: 'Capture requirements, design, and tasks as durable thread artifacts.',
					branch: 'feat/spec-mode',
					note: 'Waiting on the first workbench shell so the flow can be modeled in-context.',
					activities: [],
					tasks: [],
					files: [],
					checks: []
				}
			]
		},
		{
			id: 'prompt-lab',
			name: 'Prompt Lab',
			path: 'C:\\Users\\dgriffin3\\Prompt-Lab',
			branch: 'prompt-research',
			threads: [
				{
					id: 'provider-guidance',
					title: 'Version OpenAI and Anthropic prompt templates',
					status: 'completed',
					updatedAt: 'Yesterday',
					summary:
						'Split spec prompts from implementation prompts and capture provider-specific guidance.',
					branch: 'prompt-research',
					note: 'Ready to reuse from the desktop shell.',
					activities: [],
					tasks: [],
					files: [],
					checks: []
				}
			]
		}
	]
};
