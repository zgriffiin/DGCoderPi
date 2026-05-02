import readline from 'node:readline';

export function writeMessage(message) {
	process.stdout.write(`${JSON.stringify(message)}\n`);
}

export async function runBridge(runtime) {
	const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });

	for await (const line of rl) {
		if (!line.trim()) {
			continue;
		}

		try {
			await dispatch(runtime, line);
		} catch (error) {
			const command = safeParse(line);
			writeMessage({
				error: error instanceof Error ? error.message : String(error),
				id: command?.id ?? '',
				ok: false
			});
		}
	}
}

async function dispatch(runtime, line) {
	const command = JSON.parse(line);
	if (!command || typeof command.type !== 'string') {
		throw new Error('Invalid bridge command payload.');
	}

	const handlerName = commandName(command.type);
	const runtimePrototype = Object.getPrototypeOf(runtime);
	const hasOwnHandler =
		Object.prototype.hasOwnProperty.call(runtime, handlerName) ||
		Object.prototype.hasOwnProperty.call(runtimePrototype, handlerName);
	if (!hasOwnHandler || typeof runtime[handlerName] !== 'function') {
		throw new Error(`Unsupported bridge command: ${command.type}`);
	}

	const payload = await runtime[handlerName](command.payload ?? {});
	writeMessage({ id: command.id, ok: true, payload });
}

function commandName(value) {
	return value
		.split('-')
		.map((segment, index) =>
			index === 0 ? segment : `${segment.slice(0, 1).toUpperCase()}${segment.slice(1)}`
		)
		.join('');
}

function safeParse(text) {
	try {
		return JSON.parse(text);
	} catch {
		return null;
	}
}
