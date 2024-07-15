import { createFileUri } from './Vscode.js';

interface ParsedTraceLocation {
	start: number;
	end: number;
	text: string;
	kind: 'scripts' | 'objects';
	asset: string;
	event?: string;
	line: number;
	uri: string;
}

const tracePattern = /\bgml_(?<type>Object|Script)_(?<name>[a-zA-Z0-9_]+) \(line (?<line>\d+)\)/d;
const tracePatterns = new RegExp(tracePattern, 'dg');

export function extractTraceLocations(projectRoot: string, message: string) {
	const locations: ParsedTraceLocation[] = [];
	const extractedTraces = [...message.matchAll(tracePatterns)];
	// Iterate backwards, updating the string to excise the extracted part as we go (extracted stuff can be re-inserted later)
	for (let i = extractedTraces.length - 1; i >= 0; i--) {
		const trace = extractedTraces[i];
		let { type, name, line } = trace.groups!;
		let event: string | undefined;
		if (type === 'Object') {
			const parts = name.match(/^(?<name>.+)_(?<event>[A-Za-z]+_[0-9]+)$/);
			if (!parts) {
				console.error(`Failed to parse object name: ${name}`);
				continue;
			}
			name = parts.groups!.name;
			event = parts.groups!.event;
		}
		const start = trace.index!;
		const end = start + trace[0].length;
		const text = trace[0];

		let uri = `${projectRoot}/`;
		if (type === 'Object') {
			uri += `objects/${name}/${event}.gml`;
		} else {
			uri += `scripts/${name}/${name}.gml`;
		}
		uri += `:${line}`;
		uri = createFileUri(uri);

		locations.push({
			start,
			end,
			text,
			kind: type as 'scripts' | 'objects',
			asset: name,
			event,
			line: Number(line) || 0,
			uri
		});
		message = message.slice(0, start) + message.slice(end);
	}

	return {
		traces: locations,
		messageWithoutLocations: message
	};
}
