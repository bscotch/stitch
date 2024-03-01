import type { WebviewApi } from 'vscode-webview';

export class Vscode<State = unknown, PostMessage = unknown, ExtensionPostMessage = unknown> {
	private readonly api: WebviewApi<State> | undefined;

	constructor() {
		// Check if the acquireVsCodeApi function exists in the current development
		// context (i.e. VS Code development window or web browser)
		if (typeof acquireVsCodeApi === 'function') {
			this.api = acquireVsCodeApi();
		}
	}

	get developmentMode() {
		return !this.api;
	}

	public onMessage(listener: (message: ExtensionPostMessage) => void) {
		if (this.api) {
			window.addEventListener('message', (event) => {
				listener(event.data);
			});
		}
	}

	/**
	 * Post a message (i.e. send arbitrary data) to the owner of the webview.
	 */
	public postMessage(message: PostMessage) {
		if (this.api) {
			this.api.postMessage(message);
		} else {
			console.log(message);
		}
	}

	/** Get the persistent state stored for this webview. */
	public getState(): State | undefined {
		if (this.api) {
			return this.api.getState();
		} else {
			const state = localStorage.getItem('vscodeState');
			return state ? JSON.parse(state) : undefined;
		}
	}

	/** Set the persistent state stored for this webview. */
	public setState(newState: State): void {
		if (this.api) {
			this.api.setState(newState);
		} else {
			localStorage.setItem('vscodeState', JSON.stringify(newState));
		}
	}
}
