import * as vscode from 'vscode';
import * as fs from 'fs';
import { getPhysicalPath } from './util';
import { sprintf } from 'sprintf-js';
const hexdump = require('hexy');

interface oldHexData {
  uri: vscode.Uri;
  buffer: Buffer;
  waiting: boolean;
  watcher: fs.FSWatcher;
  filename: string;
  editFilename: string;
}

interface hexDoc {
  size: number;
  waiting: boolean;
  watcher: fs.FSWatcher;
  editFilePath: string;
  editFileUri: vscode.Uri;
}

interface Map<T> {
  [path: string]: T;
}

export const uriToPath = (uri: vscode.Uri) : string => uri.fsPath;
export const pathToUri = (path: string) : vscode.Uri => vscode.Uri.file(path);
export const readFile = (path: string) : Buffer  => fs.readFileSync(path);
export const fileSize = (path: string) : number => {
  const fstat = fs.statSync(path);
  return fstat ? fstat['size'] : -1;
}

export default class HexDocMaster {
  private config: vscode.WorkspaceConfiguration;
  private fileExt: string;
  private header: string = "";
  private hexyFmt: object;
  private openedDocs: Map<hexDoc> = {};
  
  constructor(config: vscode.WorkspaceConfiguration, fileExt: string) {
    this.updateConfig(config);
    this.fileExt = fileExt;
  }

  get docsAsObject():object { return this.openedDocs as Object;};

  public getHexDump(uri: vscode.Uri): string {
    const sizeWarning = this.config['sizeWarning'];
    const sizeDisplay = this.config['sizeDisplay'];
    const path = uriToPath(uri);

    let tail = '(Reached the maximum size to display. You can change "hexdump.sizeDisplay" in your settings.)';

    let proceed = fileSize(path) < sizeWarning ? 'Open' : vscode.window.showWarningMessage('File might be too big, are you sure you want to continue?', 'Open');
    if (proceed == 'Open') {
        let buf = readFile(path);
        let hexString = this.header;
        hexString += hexdump.hexy(buf, this.hexyFmt).toString();
        if (buf.length > sizeDisplay) {
            hexString += tail;
        }
        return hexString;
    } else {
        return '(hexdump cancelled.)';
    }
  }

  public getDocFromEditPath = (editPath: string) : hexDoc => this.getDocFromPath(this.removeExt(editPath));
  public getDocFromEditUri = (editUri: vscode.Uri) : hexDoc => this.getDocFromPath(this.removeExt(uriToPath(editUri)));
  public getDocFromUri = (uri: vscode.Uri) : hexDoc => this.getDocFromPath(uriToPath(uri));
  public getDocFromPath(path: string) : hexDoc {
    if(typeof this.openedDocs[path] !== "undefined") return this.openedDocs[path];
    else return this.loadFile(pathToUri(path));
  }

  public removeExt(path: string) : string {
    return path.slice(0, -this.fileExt.length-1);
  }

  public loadFile(uri: vscode.Uri): hexDoc {
    const path = uriToPath(uri);
    // fs watch listener
    const fileListener = (event: string, _path: string) => {
      if(this.openedDocs[path].waiting === false) {
        this.openedDocs[path].waiting = true;
        fs.writeFileSync(this.openedDocs[path].editFilePath, this.getHexDump(pathToUri(path)));
        setTimeout(() => {
          const currentWatcher = dataDict[path].watcher;
          const newWatcher = fs.watch(path, fileListener);
          this.openedDocs[path].waiting = false;
          this.openedDocs[path].watcher = newWatcher;
          currentWatcher.close();
        }, 100);
      }
    }
    const editFilePath = path+"."+this.fileExt;
    if(typeof this.openedDocs[path] !== "undefined") {
      this.openedDocs[path].watcher.close();
    }
    this.openedDocs[path] = {
      size: fileSize(path),
      waiting: false,
      watcher: fs.watch(path, fileListener),
      editFilePath: editFilePath,
      editFileUri: pathToUri(editFilePath)
    };
    this.saveFile(this.getHexDump(uri), editFilePath);
    return this.openedDocs[path];
  }

  public saveFile(data: Buffer | string , path: string) {
    fs.writeFileSync(path, data);
  }

  public parseHex(rawHex: string, size: number) : Buffer {
    let data: Buffer = Buffer.alloc(size);
    let dataIdx: number = 0;
    for(let i:number = 0;i < rawHex.length-1 || dataIdx < size;) {
      if(rawHex[i] === " ") {
        i += 1;
        continue;
      }
      data[dataIdx] = parseInt(rawHex.substring(i, i+2), 16);
      i += 2;
      dataIdx += 1;
    }
    return data;
  }

  public deleteDoc = (path: string) => {
    if(typeof this.openedDocs[path] === "undefined") return;
    this.openedDocs[path].watcher.close();
    fs.unlinkSync(path);
    delete this.openedDocs[path];
  }

  public deleteAll = () => {
    for(let path of Object.keys(this.docsAsObject)) {
      this.deleteDoc(path);
    }
  }
  
  public updateConfig(config: vscode.WorkspaceConfiguration) {
    this.config = config;
    
    // generate hexdump header
    if(config['showOffset']){
      this.header = config['showAddress'] ? "  Offset: " : "";
      for (let i = 0; i < config['width']; ++i) {
        this.header += sprintf('%02X', i);
        if ((i+1) % (config['nibbles'] / 2) == 0) {
          this.header += ' ';
        }
      }
      this.header += "\t\n";
    }

    this.hexyFmt = {
      format    : config['nibbles'] == 8 ? 'eights' : 
                  config['nibbles'] == 4 ? 'fours' : 'twos',
      width     : config['width'],
      caps      : config['uppercase'] ? 'upper' : 'lower',
      numbering : config['showAddress'] ? "hex_digits" : "none",
      annotate  : config['showAscii'] ? "ascii" : "none",
      length    : config['sizeDisplay']
    };
    
    for(let path of Object.keys(this.docsAsObject)) {
      this.loadFile(pathToUri(path));
    }
  }
}

let dataDict: Map<oldHexData> = {};

export const getName = (uri: vscode.Uri) : string => {
  let name = getPhysicalPath(uri);
  if(name.substr(-9) === ".hex-edit") name = name.substring(0, name.length-9);
  return name;
}

export const getData = (uri: vscode.Uri) : oldHexData => {
  let name = getName(uri);
  const editName = name+".hex-edit";
  const editUri = vscode.Uri.file(editName);

  if(dataDict[name]) return dataDict[name];
  else {
    // fs watch listener
    const fileListener = (event: string, name: string) => {
      if(dataDict[name].waiting === false) {
        dataDict[name].waiting = true;
        setTimeout(() => {
            const currentWatcher = dataDict[name].watcher;
            const newWatcher = fs.watch(name, fileListener);
            dataDict[name] = { uri: editUri, buffer: fs.readFileSync(name), waiting: false, watcher: newWatcher,  filename: name, editFilename: name};
            currentWatcher.close();
        }, 100);
      }
    }
    dataDict[name] = {
      uri: editUri,
      buffer: fs.readFileSync(name),
      waiting: false,
      watcher: fs.watch(name, fileListener),
      filename: name,
      editFilename: name
    };
    //fs.writeFileSync(editName, genDump(uri));
    return dataDict[name];
  }
}