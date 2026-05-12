import { invoke } from '@tauri-apps/api/core';

export interface DirectoryEntry {
	isDirectory: boolean;
	name: string;
	path: string;
	size: number;
}

export async function readDirectory(path: string): Promise<DirectoryEntry[]> {
	return invoke<DirectoryEntry[]>('read_directory', { input: { path } });
}

export async function readFileContent(path: string): Promise<string> {
	return invoke<string>('read_file_content', { input: { path } });
}

export async function writeFileContent(path: string, content: string): Promise<void> {
	return invoke<void>('write_file_content', { input: { path, content } });
}

export async function copyEntry(source: string, destination: string): Promise<void> {
	return invoke<void>('copy_entry', { input: { source, destination } });
}

export async function renameEntry(source: string, destination: string): Promise<void> {
	return invoke<void>('rename_entry', { input: { source, destination } });
}

export async function deleteEntry(path: string): Promise<void> {
	return invoke<void>('delete_entry', { input: { path } });
}

export async function createDirectory(path: string): Promise<void> {
	return invoke<void>('create_directory', { input: { path } });
}

export function relativePath(filePath: string, projectRoot: string): string {
	const normalized = filePath.replace(/\\/g, '/');
	const normalizedRoot = projectRoot.replace(/\\/g, '/');
	if (normalized.startsWith(normalizedRoot)) {
		const rel = normalized.slice(normalizedRoot.length);
		return rel.startsWith('/') ? rel.slice(1) : rel;
	}
	return normalized;
}

export function fileName(filePath: string): string {
	const parts = filePath.replace(/\\/g, '/').split('/');
	return parts[parts.length - 1] || filePath;
}

export function parentPath(filePath: string): string {
	const normalized = filePath.replace(/\\/g, '/');
	const lastSlash = normalized.lastIndexOf('/');
	return lastSlash > 0 ? normalized.slice(0, lastSlash) : normalized;
}

export function joinPath(dir: string, name: string): string {
	const sep = dir.includes('\\') ? '\\' : '/';
	return dir.endsWith(sep) ? dir + name : dir + sep + name;
}
