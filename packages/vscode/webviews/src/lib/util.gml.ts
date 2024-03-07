import { createFileUri } from './Vscode.js';

interface ParsedGmFileMacroScript {
	kind: 'scripts';
	assetName: string;
}
interface ParsedGmFileMacroObject {
	kind: 'objects';
	assetName: string;
	eventName: `${string}_${number}`;
}
type ParsedGmFileMacro = ParsedGmFileMacroScript | ParsedGmFileMacroObject;

export function gmlFileMacroToUri(
	projectRoot: string,
	macroValue: string,
	lineNumber = 0
): string | undefined {
	const parsed = parseGmFileMacroString(macroValue);
	if (!parsed) return;
	if (parsed.kind === 'scripts') {
		return createFileUri(`${projectRoot}/scripts/${parsed.assetName}/${parsed.assetName}.gml`);
	} else if (parsed.kind === 'objects') {
		return createFileUri(`${projectRoot}/objects/${parsed.assetName}/${parsed.eventName}.gml`);
	}
}

/**
 * In stack traces and via the GameMaker macro `_GMFILE_`,
 * GameMaker produces a string that represents a particular
 * object or script file. This function parses that string
 * into its constituent parts.
 */
function parseGmFileMacroString(macroValue: string): ParsedGmFileMacro | undefined {
	// Sample from a script: `gml_Script_packed_file_get_load_path`
	// Samples from objects:
	// - gml_Object_o_rumpus_item_searcher_Step_0:11
	// - gml_Object_o_http_controller_Other_62:105

	const [, type, fullName] = macroValue.match(/^gml_(Object|Script)_(.+)$/) || [];
	console.log('MACROVALUE', macroValue, type, fullName);
	if (!type || !fullName) return;
	if (type === 'Script') {
		return { kind: 'scripts', assetName: fullName };
	} else {
		const [, assetName, fileName] = fullName.match(/^(.+)_([A-Za-z]+_[0-9]+)$/) || [];
		if (!assetName || !fileName) return;
		return { kind: 'objects', assetName, eventName: fileName as `${string}_${number}` };
	}
}
