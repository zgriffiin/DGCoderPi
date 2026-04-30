import path from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * @typedef {{ previewText: string | null, status: "ready" | "failed", warnings: string[] }} ParsedAttachment
 */

const IMAGE_EXTENSION_PATTERN = /\.(avif|bmp|gif|heic|heif|jpeg|jpg|png|tiff|webp)$/i;

let loadExtensionsPromise;
let toolPromise;

async function getLoadExtensions() {
	if (!loadExtensionsPromise) {
		const modulePath = path.resolve(
			'node_modules/@mariozechner/pi-coding-agent/dist/core/extensions/index.js'
		);
		loadExtensionsPromise = import(pathToFileURL(modulePath).href).then(
			({ loadExtensions }) => loadExtensions
		);
	}

	return loadExtensionsPromise;
}

async function loadDocumentParseTool() {
	if (!toolPromise) {
		toolPromise = createDocumentParseTool();
	}

	return toolPromise;
}

async function createDocumentParseTool() {
	const loadExtensions = await getLoadExtensions();
	const extensionPath = path.resolve('node_modules/pi-docparser/extensions/docparser/index.ts');
	const result = await loadExtensions([extensionPath], process.cwd());

	if (result.errors.length > 0) {
		throw new Error(result.errors[0].error);
	}

	const extension = result.extensions[0];
	const tool = extension?.tools.get('document_parse');
	if (!tool) {
		throw new Error('pi-docparser did not register the document_parse tool.');
	}

	return tool.definition;
}

function collectWarnings(details) {
	if (!details || typeof details !== 'object' || !Array.isArray(details.warnings)) {
		return [];
	}

	return details.warnings.filter((warning) => typeof warning === 'string');
}

function extractPreview(result) {
	if (!result || typeof result !== 'object' || !Array.isArray(result.content)) {
		return null;
	}

	const firstText = result.content.find(
		(entry) => entry && typeof entry === 'object' && entry.type === 'text'
	);
	return firstText?.text ?? null;
}

function isImagePath(filePath) {
	return IMAGE_EXTENSION_PATTERN.test(path.basename(filePath));
}

function normalizeImageWarning(error) {
	const message = error instanceof Error ? error.message : String(error);
	if (/imagemagick/i.test(message)) {
		return 'Image preview unavailable. Install ImageMagick or run /docparser:doctor.';
	}

	return 'Image preview unavailable. The image can still be attached and sent to image-capable models.';
}

/**
 * @param {{ enabled: boolean, filePath: string }} input
 * @returns {Promise<ParsedAttachment>}
 */
export async function parseAttachment(input) {
	if (!input.enabled) {
		if (isImagePath(input.filePath)) {
			return {
				previewText: null,
				status: 'ready',
				warnings: [
					'Image preview unavailable. Enable the document parser for inline image parsing.'
				]
			};
		}

		return {
			previewText: null,
			status: 'failed',
			warnings: ['The document parser feature is disabled.']
		};
	}

	try {
		const tool = await loadDocumentParseTool();
		const result = await tool.execute(
			`docparse-${Date.now()}`,
			{ path: input.filePath },
			undefined,
			undefined,
			{ cwd: path.dirname(input.filePath) }
		);

		return {
			previewText: extractPreview(result),
			status: 'ready',
			warnings: collectWarnings(result.details)
		};
	} catch (error) {
		if (isImagePath(input.filePath)) {
			return {
				previewText: null,
				status: 'ready',
				warnings: [normalizeImageWarning(error)]
			};
		}

		throw error;
	}
}
