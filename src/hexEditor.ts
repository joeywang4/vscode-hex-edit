'use strict';

import * as vscode from 'vscode';
import Selector from './hexSelector';
import DocMaster, { uriToPath } from './hexDocument';
import HoverProvider from './hoverProvider';

export default class HexEditor {
  private config: vscode.WorkspaceConfiguration;
  private _selector: Selector;
  private _docMaster: DocMaster;
  private _hoverProvider: HoverProvider;

  static fileExt: string = "hex-edit";
  
  constructor(config: vscode.WorkspaceConfiguration) {
    this.config = config;
    this._selector = new Selector(config);
    this._docMaster = new DocMaster(config, this.getFileExt);
    this._hoverProvider = new HoverProvider(config);
    vscode.languages.registerHoverProvider(this.getFileExt, this._hoverProvider);
  }

  get getFileExt(): string {
    return HexEditor.fileExt;
  }

  public isHexDocument(doc: vscode.TextDocument) {
    return doc.languageId === HexEditor.fileExt;
  }

  public handleTextEditorSelection(e: vscode.TextEditorSelectionChangeEvent) {
    const size = this._docMaster.getDocFromEditUri(e.textEditor.document.uri).size;
    this._selector.handleSelection(e, size); 
  }

  public handleEditFileClose(editPath: string) {
    const path = this._docMaster.removeExt(editPath);
    this._docMaster.deleteDoc(path);
  }

  public handleKeyInput(uri: vscode.Uri, key: string) {
    if(key === "s") {
      this.saveHexFile(uri);
    }
    else if(/^[a-f0-9A-F]$/.test(key)) {
      const cursor:vscode.Position = this._selector.getCursor;
      //const editor = new vscode.texteditor
      vscode.window.activeTextEditor.edit(editBuilder => {
        editBuilder.replace(new vscode.Range(cursor, new vscode.Position(cursor.line, cursor.character+1)), key.toUpperCase());
      })
    }
  }

  public openHexFile = (uri: vscode.Uri) => {
    const docData = this._docMaster.loadFile(uri);
    vscode.window.showTextDocument(docData.editFileUri, {preview: false});
  }

  public saveHexFile = (editUri: vscode.Uri) => {
    const size = this._docMaster.getDocFromEditUri(editUri).size;
    const data = this.hexToBytes(0, size);
    const path = this._docMaster.removeExt(uriToPath(editUri));
    this._docMaster.saveFile(data, path);
  }

  public hexToBytes(begOffset: number, endOffset: number) : Buffer {
    const ranges = this._selector.getRanges(begOffset, endOffset, false);
    let rawData = "";
    ranges.forEach(range => {
      rawData +=  vscode.window.activeTextEditor.document.getText(range);
    })
    return this._docMaster.parseHex(rawData, endOffset-begOffset);
  }

  public updateConfig(config: vscode.WorkspaceConfiguration) {
    this.config = config;
    this._selector.updateConfig(config);
    this._docMaster.updateConfig(config);
    this._hoverProvider.updateConfig(config);
  }

  public dispose() {
    this._hoverProvider.dispose();
    this._docMaster.deleteAll();
  }
}