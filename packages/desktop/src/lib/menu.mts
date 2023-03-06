import { app, Menu } from 'electron';
import { type Updater } from './updater.mjs';

export function createMenu(updater?: Updater) {
	const template: Electron.MenuItemConstructorOptions[] = [
		{
			label: 'File',
			submenu: [
				{
					label: 'Restart',
					click: () => {
						app.relaunch();
						app.exit();
					},
				},
				{ role: 'forceReload' },
				{ role: 'quit' },
			],
		},
		{
			label: 'Edit',
			submenu: [
				{ role: 'undo' },
				{ role: 'redo' },
				{ type: 'separator' },
				{ role: 'cut' },
				{ role: 'copy' },
				{ role: 'paste' },
				{ role: 'delete' },
				{ type: 'separator' },
				{ role: 'selectAll' },
			],
		},
		{
			label: 'View',
			submenu: [
				{ role: 'reload' },
				{ role: 'forceReload' },
				{ role: 'zoomIn' },
				{ role: 'zoomOut' },
				{ role: 'resetZoom' },
				{ role: 'togglefullscreen' },
				{ type: 'separator' },
				{ role: 'toggleDevTools' },
			],
		},
		{
			label: 'Window',
			submenu: [{ role: 'minimize' }, { role: 'zoom' }, { role: 'close' }],
		},
	];

	if (updater) {
		template.push({
			label: 'Help',
			submenu: [
				{
					label: 'Update',
					click: () => {
						updater.checkForUpdates();
					},
				},
			],
		});
	}

	return Menu.buildFromTemplate(template);
}
