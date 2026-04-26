export type ThreadStatus = 'completed' | 'failed' | 'idle' | 'running' | 'waiting';

export type ActivityTone = 'assistant' | 'plan' | 'system' | 'tool';

export type TaskStatus = 'blocked' | 'done' | 'in-progress' | 'ready';

export type FileImpactChange = 'added' | 'deleted' | 'modified';

type QualityStatus = 'passed' | 'pending' | 'running';

export interface ModelOption {
	id: string;
	text: string;
	helperText: string;
}

export interface ActivityEntry {
	id: string;
	body: string;
	tags: string[];
	timestamp: string;
	title: string;
	tone: ActivityTone;
}

interface TaskItem {
	id: string;
	owner: string;
	status: TaskStatus;
	title: string;
	validation: string;
}

interface FileImpact {
	change: FileImpactChange;
	id: string;
	note: string;
	path: string;
}

interface QualityCheck {
	detail: string;
	id: string;
	name: string;
	status: QualityStatus;
}

export interface ThreadRecord {
	activities: ActivityEntry[];
	branch: string;
	checks: QualityCheck[];
	files: FileImpact[];
	id: string;
	note: string;
	status: ThreadStatus;
	summary: string;
	tasks: TaskItem[];
	title: string;
	updatedAt: string;
}

export interface ProjectRecord {
	branch: string;
	id: string;
	name: string;
	path: string;
	threads: ThreadRecord[];
}

export interface WorkbenchData {
	models: ModelOption[];
	projects: ProjectRecord[];
}
