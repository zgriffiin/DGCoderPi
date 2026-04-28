import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const roots = ['src', 'src-tauri', 'tests', '.storybook'];
const extensions = new Set(['.ts', '.js', '.mjs', '.cjs', '.svelte', '.json', '.d.ts']);
const ignoredDirectories = new Set(['.fallow', '.svelte-kit', 'gen', 'node_modules', 'target']);
const ignoredRelativeDirectories = ['tests/results', 'tests/runtime'];
const bannedNames = [/mock/i, /shim/i, /fake/i, /stub/i, /fixture/i, /dummy/i, /temp/i];
const bannedContent = [
	{ pattern: /\b(mock|mocked|mocking|fake|stub|shim|fixture|dummy|temporary)\b/i, label: 'term' },
	{ pattern: /\b(page|context|browserContext)\.route\s*\(/, label: 'playwright-route' },
	{ pattern: /\broute\.(fulfill|abort|continue)\s*\(/, label: 'playwright-route-mutation' },
	{ pattern: /\b(vi|jest)\.mock\s*\(/, label: 'module-mock' },
	{ pattern: /\bmock(Resolved|Rejected)?Value\b/, label: 'mock-value' },
	{ pattern: /\bmockImplementation\b/, label: 'mock-implementation' }
];
const bannedPackages = ['msw', 'nock', 'fetch-mock', 'axios-mock-adapter', 'sinon'];

const failures = [];

function walk(dir) {
	if (!statExists(dir)) {
		return;
	}

	for (const entry of readdirSync(dir)) {
		if (ignoredDirectories.has(entry)) {
			continue;
		}

		const fullPath = join(dir, entry);
		const relativePath = relative(process.cwd(), fullPath).replaceAll('\\', '/');
		if (
			ignoredRelativeDirectories.some(
				(ignoredPath) => relativePath === ignoredPath || relativePath.startsWith(`${ignoredPath}/`)
			)
		) {
			continue;
		}
		const stats = statSync(fullPath);
		if (stats.isDirectory()) {
			walk(fullPath);
			continue;
		}
		checkFile(fullPath);
	}
}

function statExists(targetPath) {
	try {
		statSync(targetPath);
		return true;
	} catch (error) {
		if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
			return false;
		}

		throw error;
	}
}

function checkFile(filePath) {
	if (!extensions.has(extname(filePath))) {
		return;
	}
	const relativePath = relative(process.cwd(), filePath);
	if (bannedNames.some((pattern) => pattern.test(relativePath))) {
		failures.push(`${relativePath}: banned file naming`);
	}
	const content = readFileSync(filePath, 'utf8');
	for (const { pattern, label } of bannedContent) {
		if (pattern.test(content)) {
			failures.push(`${relativePath}: banned ${label}`);
		}
	}
}

function checkPackageJson() {
	const manifest = JSON.parse(readFileSync('package.json', 'utf8'));
	const declared = { ...manifest.dependencies, ...manifest.devDependencies };
	for (const packageName of bannedPackages) {
		if (declared[packageName]) {
			failures.push(`package.json: banned dependency "${packageName}"`);
		}
	}
}

for (const root of roots) {
	walk(root);
}
checkPackageJson();

if (failures.length > 0) {
	console.error('Runtime policy violations found:');
	for (const failure of failures) {
		console.error(`- ${failure}`);
	}
	process.exit(1);
}

console.log('Runtime policy check passed.');
