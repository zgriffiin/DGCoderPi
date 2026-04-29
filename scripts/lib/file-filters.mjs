const LINTABLE_FILE_PATTERN = /\.(?:[cm]?jsx?|[cm]?tsx?|svelte)$/i;
const PRETTIER_FILE_PATTERN = /\.(?:[cm]?jsx?|[cm]?tsx?|json|md|svelte|css|ya?ml)$/i;

export function filterLintableFiles(filePaths) {
	return filePaths.filter((filePath) => LINTABLE_FILE_PATTERN.test(filePath));
}

export function filterPrettierFiles(filePaths) {
	return filePaths.filter((filePath) => PRETTIER_FILE_PATTERN.test(filePath));
}
