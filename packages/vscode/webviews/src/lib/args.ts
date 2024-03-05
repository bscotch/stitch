export interface Arg {
	flag?: `--${string}`;
	value?: string;
}
export function parseArg(arg: string): Arg {
	const parts = arg.match(/^(?<flag>--\w*)(?:=(?<value>.*))?$/)?.groups;
	if (!parts) {
		return { value: arg };
	}
	parts.flag = "<span style='word-break:none;'>" + parts.flag + '</span>';
	return parts;
}
