import electron, { app, BrowserWindow, dialog, shell } from 'electron'
import path from "path"
import url from 'url'
import process from 'process'
import child_process from 'child_process'
import Electron from 'electron'

var mainWindow : Electron.BrowserWindow = null;
var helpWindow : Electron.BrowserWindow = null;
var crashedWindow : Electron.BrowserWindow = null;

const Menu = electron.Menu;
const Tray = electron.Tray;
const ipc = electron.ipcMain;
const exec = child_process.exec;

var appTray : Electron.Tray = null;
var appQuit = false
var appIco : Electron.NativeImage = null;

function createMainWindow () {

  mainWindow = new BrowserWindow({
    minWidth: 710,
    minHeight: 500,
    width: 900, 
    height: 600,
    frame: false,
    transparent: false,
    fullscreen: false,
    resizable: true,
    show: false,
    icon: appIco,
    webPreferences: {
      webSecurity: false, 
      nodeIntegration: true,
    },
  })
  mainWindow.setMenu(null)
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true
  }))
  mainWindow.webContents.on('crashed', (event, killed) => {
    if(killed) {
      showCrashedWindow();
      destroyMainWindow();
    }
    else {
      /*
      mainWindow.webContents.loadURL(url.format({
        pathname: path.join(__dirname, 'pages/index.html'),
        protocol: 'file:',
        slashes: true
      }))

      //Collect error info

      //Reload
      setTimeout(() => {
        mainWindow.loadURL(url.format({
          pathname: path.join(__dirname, 'index.html'),
          protocol: 'file:',
          slashes: true
        }))
      }, 10000);*/
    }
  });
  mainWindow.webContents.on('devtools-reload-page', () => {
    if(!mainWindow.isMinimized()) mainWindow.restore();
    if(!mainWindow.isFocused()) mainWindow.focus();
  });
  mainWindow.on('closed', () =>  {
    if(helpWindow != null) {      
      helpWindow.close();
      helpWindow = null;
    }
    if(appTray != null) {
      appTray.destroy();
      appTray = null;
    }
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null
  })
  mainWindow.on('unresponsive', () => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      message: '软件可能卡住了，需要一些时间让其完成工作。',
      title: '抱歉，软件出现了一些故障',
      detail: '如果它长时间没有响应，可能是软件故障。您可以尝试强制重新加载页面',
      noLink: true,
      buttons: [ '等待其响应', '强制重新加载页面' ],
    }).then((value) => {
      if(value.response == 1) {
        mainWindow.reload();
      }
    })
  });
  mainWindow.on('close',(e) => {  
    if(!appQuit){
      e.preventDefault();
      mainWindow.hide();
    } 
  });
  mainWindow.once('ready-to-show', () => mainWindow.show())

  var trayMenuTemplate = [
    {
      label: '显示主界面',
      click: function () { mainWindow.show(); mainWindow.focus();  }
    },
    {
      label: '退出',
      click: function () { 
        mainWindow.show(); 
        mainWindow.webContents.send('main-window-act', 'show-exit-dialog');
      }
    }
  ];
  const contextMenu = Menu.buildFromTemplate(trayMenuTemplate);

  appTray = new Tray(appIco);
  appTray.setToolTip('PunctualCat');
  appTray.setContextMenu(contextMenu);
  appTray.on('click', () => mainWindow.show())
  
}
function destroyMainWindow() {
  appQuit = true;
  mainWindow.removeAllListeners();
  mainWindow.close();
}

function showCrashedWindow() {
  crashedWindow = new BrowserWindow({
    width: 560, 
    height: 410,
    frame: true,
    transparent: false,
    fullscreen: false,
    resizable: false,
    minimizable: false,
    icon: path.join(__dirname, 'main.ico'),
    webPreferences: {
      webSecurity: false,
      nodeIntegration: true,
      disableBlinkFeatures: "",
    },
  })
  crashedWindow.setMenu(null)
  crashedWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'pages/crashed.html'),
    protocol: 'file:',
    slashes: true
  }));
  crashedWindow.on('close', () => {
    crashedWindow = null;
  });
}
function showHelpWindow(anchorPos) {
  let targetUrl = url.format({
    pathname: path.join(__dirname, 'pages/docs.html'),
    protocol: 'file:',
    slashes: true,
    hash: anchorPos ? anchorPos : '',
  })
  if(helpWindow == null){
    helpWindow = new BrowserWindow({
      minWidth: 510,
      minHeight: 460,
      width: 960, 
      height: 660,
      frame: true,
      show: false,
      icon: path.join(__dirname, 'main.ico'),
      webPreferences: { nodeIntegration: true, webSecurity: false },
    })
    helpWindow.setMenu(null)
    helpWindow.loadURL(targetUrl);
    helpWindow.webContents.openDevTools();
    helpWindow.on('closed', () => helpWindow = null)
    helpWindow.once('ready-to-show', () => helpWindow.show())
  }else{
    helpWindow.loadURL(targetUrl);
    helpWindow.show();
    helpWindow.focus();
  }
}

function initApp() {

  appIco = Electron.nativeImage.createFromPath(require('./assets/images/logo.ico'));

  app.on('ready', () => createMainWindow())
  app.on('window-all-closed', () =>  {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== 'darwin') app.quit()
  })
  app.on('activate', () =>  {
    // On OS X it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) createMainWindow()
  })
  app.on('web-contents-created', (event, contents) => {
    
    contents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL, isMainFrame, frameProcessId, frameRoutingId) => {
      let failedPageUrl = url.format({
        pathname: path.join(__dirname, 'pages/failed.html'),
        protocol: 'file:',
        slashes: true
      });
      if(contents.getURL() != failedPageUrl) {
        contents.loadURL(failedPageUrl);
        contents.executeJavaScript('document.getElementById(\'global-error-info-code\').innerText = \''+errorDescription+'('+errorCode+')\'');
      }else {
        dialog.showErrorBox('发生了错误', '加载页面时发生连环错误');
      }
    });

    contents.on('will-navigate', (event, navigationUrl) => {
      const parsedUrl = new URL(navigationUrl)
      if(parsedUrl.protocol == 'file:') {
        console.log('navigate to file : ' + parsedUrl.pathname);
      }else if(parsedUrl.protocol == 'http:' || parsedUrl.protocol == 'https:') {
        event.preventDefault();
        dialog.showMessageBox(mainWindow, {
          title: '打开外部链接',
          message: '您是否需要在浏览器中打开外部链接？',
          detail: '目标链接：' + navigationUrl,
          buttons: [ '在浏览器中打开此页面', '取消打开' ]
        }).then((value) => {
          if(value.response == 0) shell.openExternal(navigationUrl)
        }).catch(() => {});
      }
    });
    contents.on('new-window', async (event, navigationUrl) => {
      const parsedUrl = new URL(navigationUrl);
      if(parsedUrl.protocol != 'devtools:' && parsedUrl.protocol != 'file:'){
        console.log(parsedUrl);
        event.preventDefault();
        shell.openExternal(navigationUrl)
      }
    })
  })

}
function initIpcs() {

  ipc.on('main-open-file-dialog-music', (event, arg) => {
    var properties = ['openFile'];
    if(arg.type == 'addMusicsToHistoryList')
      properties.push('multiSelections');
    dialog.showOpenDialog(mainWindow, {
      properties: <any>properties,
      title: '选择音乐文件',
      filters: [
        { name: '音乐文件', extensions: ['mp3', 'wav', 'wma', 'ogg', 'flac'] },
        { name: '所有文件', extensions: ['*'] }
      ],
    }).then((value) => {
      if (value) event.sender.send('selected-music', arg, value.filePaths)
    }).catch((e) => console.log(e))
  })
  ipc.on('main-open-file-dialog-image', (event, arg) => {
    var properties = ['openFile'];
    dialog.showOpenDialog(mainWindow, {
      properties: <any>properties,
      title: '选择图片文件',
      filters: [
        { name: '图像文件', extensions: ['bmp', 'jpg', 'png'] },
        { name: '所有文件', extensions: ['*'] }
      ],
    }).then((value) => {
      if (value) event.sender.send('selected-image', arg, value.filePaths)
    }).catch((e) => console.log(e))
  })
  ipc.on('main-open-file-dialog-json', (event, arg) => {
    var properties = ['openFile'];
    dialog.showOpenDialog(mainWindow, {
      properties: <any>properties,
      title: '选择 JSON 数据文件',
      filters: [
        { name: 'JSON 数据文件', extensions: ['json'] },
        { name: '所有文件', extensions: ['*'] }
      ],
    }).then((value) => {
      if (value) event.sender.send('selected-json', arg, value.filePaths)
    }).catch((e) => console.log(e))
  })
  ipc.on('main-save-file-dialog-json', (event, arg) => {
    dialog.showSaveDialog(mainWindow, {
      title: '保存 JSON 数据文件',
      filters: [
        { name: arg.filename ? arg.filename : 'JSON 数据文件', extensions: ['json'] }
      ]
    }).then((value) => {
      if (arg) arg.isSave = true;
      if (value) event.sender.send('selected-json', arg, value.filePath)
    }).catch((e) => console.log(e));
  })
  ipc.on('main-act-quit', (event, arg) => {
    appQuit = true; app.quit();
  });
  ipc.on('main-act-show-help-window', (event, arg) => {
    showHelpWindow(arg);
  });
  ipc.on('main-act-recreate', (event) => {
    if(mainWindow == null) createMainWindow();
  });
  ipc.on('main-act-reload', (event) => {
    if(mainWindow && event.sender == mainWindow.webContents) 
      mainWindow.webContents.loadURL(url.format({ pathname: path.join(__dirname, 'index.html'), protocol: 'file:', slashes: true }))
    else if(helpWindow && event.sender == helpWindow.webContents) {
      helpWindow.webContents.loadURL(url.format({ pathname: path.join(__dirname, 'pages/docs.html'), protocol: 'file:', slashes: true }))
    }
  });

  ipc.on('main-act-run-shell', (event, arg) => {
    let workerProcess
    //console.log('run command : ' + arg.command);
    workerProcess = exec(arg.command)
    workerProcess.stdout.on('data', function (data) {
      event.sender.send('shell-data', arg, data)
    });
  });
  ipc.on('main-act-shutdown', (event) => {
    if(process.platform == 'win32')
      exec("shutdown -s -t 0")
    else 
      exec("shutdown -t 0")
    appQuit = true; app.quit();
  });
  ipc.on('main-act-reboot', (event) => {
    if(process.platform == 'win32')
      exec("shutdown -r -t 0")
    else 
      exec("reboot")
    appQuit = true; app.quit();
  });
}

initApp();
initIpcs();