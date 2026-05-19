/**
 * Terminal session store.
 *
 * Manages PTY sessions that persist across panel open/close cycles.
 * Each session is keyed by shell type + project path so re-opening
 * the panel reconnects to the same running shell.
 */
import { spawn, type IPty } from 'tauri-pty';

export type ShellType = 'powershell' | 'wsl';

export interface TerminalSession {
	id: string;
	pty: IPty;
	shellType: ShellType;
	projectPath: string;
}

const sessions = new Map<string, TerminalSession>();

function sessionKey(shellType: ShellType, projectPath: string): string {
	return `${shellType}::${projectPath}`;
}

export function getSession(shellType: ShellType, projectPath: string): TerminalSession | null {
	return sessions.get(sessionKey(shellType, projectPath)) ?? null;
}

export function createSession(
	shellType: ShellType,
	projectPath: string,
	cols: number,
	rows: number
): TerminalSession {
	const key = sessionKey(shellType, projectPath);
	const existing = sessions.get(key);
	if (existing) {
		return existing;
	}

	const shell = shellType === 'powershell' ? 'powershell.exe' : 'wsl.exe';
	const pty = spawn(shell, [], { cols, rows, cwd: projectPath });

	const session: TerminalSession = {
		id: key,
		pty,
		shellType,
		projectPath
	};

	sessions.set(key, session);
	return session;
}

export function resizeSession(
	shellType: ShellType,
	projectPath: string,
	cols: number,
	rows: number
): void {
	const session = sessions.get(sessionKey(shellType, projectPath));
	if (session) {
		session.pty.resize(cols, rows);
	}
}

export function destroySession(shellType: ShellType, projectPath: string): void {
	const key = sessionKey(shellType, projectPath);
	const session = sessions.get(key);
	if (session) {
		session.pty.kill();
		sessions.delete(key);
	}
}

export function destroyAllSessions(): void {
	for (const session of sessions.values()) {
		session.pty.kill();
	}
	sessions.clear();
}
