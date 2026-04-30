type StagedAttachmentInput = {
	bytes: number[];
	mimeType: string | null;
	name: string;
};

type AttachmentStager = {
	stageAttachmentData: (threadId: string, input: StagedAttachmentInput) => Promise<void>;
};

async function browserFileToStagedAttachment(file: File): Promise<StagedAttachmentInput> {
	const bytes = Array.from(new Uint8Array(await file.arrayBuffer()));
	return {
		bytes,
		mimeType: file.type || null,
		name: stagedFileName(file)
	};
}

export async function stageBrowserFiles(
	controller: AttachmentStager,
	threadId: string,
	files: File[]
) {
	for (const file of files) {
		await controller.stageAttachmentData(threadId, await browserFileToStagedAttachment(file));
	}
}

function stagedFileName(file: File) {
	const trimmedName = file.name.trim();
	if (trimmedName) {
		return trimmedName;
	}

	const extension = file.type.startsWith('image/') ? file.type.slice('image/'.length) : 'bin';
	return `pasted-file.${extension || 'bin'}`;
}
