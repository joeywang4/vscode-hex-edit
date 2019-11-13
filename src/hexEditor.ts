'use strict';

import * as vscode from 'vscode';
import Selector from './hexSelector';

export default class HexEditor {
  private config: vscode.WorkspaceConfiguration;
  private _selector: Selector;

  static fileExt: string = "hex-edit";
  
  constructor(config: vscode.WorkspaceConfiguration) {
    this.config = config;
    this._selector = new Selector(config);
  }

  get getFileExt(): string {
    return HexEditor.fileExt;
  }

  public isHexDocument(doc: vscode.TextDocument) {
    return doc.languageId === HexEditor.fileExt;
  }

  public handleTextEditorSelection(e: vscode.TextEditorSelectionChangeEvent) {
    this._selector.handleSelection(e); 
  }

  public updateConfig(config: vscode.WorkspaceConfiguration) {
    this.config = config;
    this._selector.updateConfig(config);
  }
}