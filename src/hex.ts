import * as vscode from 'vscode';
import * as fs from 'fs';
import { getFileSize, getPhysicalPath } from './util';
import { sprintf } from 'sprintf-js';
var hexdump = require('hexy');

interface hexData {
  uri: vscode.Uri;
  buffer: Buffer;
  waiting: boolean;
  watcher: fs.FSWatcher;
}

interface Map<T> {
  [uri: string]: T;
}

let dataDict: Map<hexData> = {};

const getHeader = (config: vscode.WorkspaceConfiguration) :string => {
  let header = config['showAddress'] ? "  Offset: " : "";

  for (var i = 0; i < config['width']; ++i) {
    header += sprintf('%02X', i);
    if ((i+1) % (config['nibbles'] / 2) == 0) {
      header += ' ';
    }
  }

  header += "\t\n";
  return header;
}

export const genDump = (uri: vscode.Uri) : string => {
  const config = vscode.workspace.getConfiguration('hexdump');
  const sizeWarning = config['sizeWarning'];
  const sizeDisplay = config['sizeDisplay'];

  let hexyFmt = {
    format    : config['nibbles'] == 8 ? 'eights' : 
                config['nibbles'] == 4 ? 'fours' : 
                'twos',
    width     : config['width'],
    caps      : config['uppercase'] ? 'upper' : 'lower',
    numbering : config['showAddress'] ? "hex_digits" : "none",
    annotate  : config['showAscii'] ? "ascii" : "none",
    length    : sizeDisplay
  };

  let header = config['showOffset'] ? getHeader(config) : "";
  let tail = '(Reached the maximum size to display. You can change "hexdump.sizeDisplay" in your settings.)';

  let proceed = getFileSize(uri) < sizeWarning ? 'Open' : vscode.window.showWarningMessage('File might be too big, are you sure you want to continue?', 'Open');
  if (proceed == 'Open') {
      let buf = getData(uri).buffer;
      let hexString = header;
      hexString += hexdump.hexy(buf, hexyFmt).toString();
      if (buf.length > sizeDisplay) {
          hexString += tail;
      }
      return hexString;
  } else {
      return '(hexdump cancelled.)';
  }
}

export const getData = (uri: vscode.Uri) :hexData => {
  let name = getPhysicalPath(uri);
  const editName = name+".hex-edit";
  const editUri = vscode.Uri.file(editName);
  if(name.substr(-9) === ".hex-edit") name = name.substring(0, name.length-9);

  if(dataDict[name]) return dataDict[name];
  else {
    // fs watch listener
    const fileListener = (event: string, name: string) => {
      if(dataDict[name].waiting === false) {
        dataDict[name].waiting = true;
        setTimeout(() => {
            const currentWatcher = dataDict[name].watcher;
            const newWatcher = fs.watch(name, fileListener);
            dataDict[name] = { uri: editUri, buffer: fs.readFileSync(name), waiting: false, watcher: newWatcher};
            currentWatcher.close();
        }, 100);
      }
    }
    dataDict[name] = {
      uri: editUri,
      buffer: fs.readFileSync(name),
      waiting: false,
      watcher: fs.watch(name, fileListener)
    };
    fs.writeFileSync(editName, genDump(uri));
    return dataDict[name];
  }
}

export const openEdit = (uri: vscode.Uri) => {
  const editData = getData(uri);
  vscode.window.showTextDocument(editData.uri, {preview: false});
}

export const clearAll = () => {
  let Data = dataDict as Object;
  for(let key of Object.keys(Data)) {
    clearData(key);
  }
}

export const clearData = (name: string) => {
  dataDict[name].watcher.close();
  fs.unlinkSync(getPhysicalPath(dataDict[name].uri));
  delete dataDict[name];
}