const {
	app,
	BrowserWindow
} = require('electron');

function createWindow() {
	// Create the browser window.
	let win = new BrowserWindow({
		width: 800,
		height: 600,
		webPreferences: {
			nodeIntegration: false
		}
	});
	win.loadFile('public/index.html');
}

app.on('ready', createWindow);