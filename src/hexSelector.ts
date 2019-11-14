'use strict';

import * as vscode from 'vscode';

export default class HexSelector {
  private config: vscode.WorkspaceConfiguration;
  private nibblesPerLine: number;
  private firstByteOffset: number;
  private lastByteOffset: number;
  private firstAsciiOffset: number;
  private lastAsciiOffset: number;
  private firstLine: number;
  private cursor: vscode.Position;

  static smallDecorationType = vscode.window.createTextEditorDecorationType({
    borderWidth: '1px',
    borderStyle: 'solid',
    overviewRulerColor: 'blue',
    overviewRulerLane: vscode.OverviewRulerLane.Right,
    light: {
        // this color will be used in light color themes
        borderColor: 'darkblue'
    },
    dark: {
        // this color will be used in dark color themes
        borderColor: 'lightblue'
    }
  });

  constructor(config: vscode.WorkspaceConfiguration) {
    this.updateConfig(config);
  }

  get getCursor() {return this.cursor;};

  public updateConfig(config: vscode.WorkspaceConfiguration) {
    this.config = config;
    this.nibblesPerLine = config['width'] * 2;
    this.firstByteOffset = config['showAddress'] ? 10 : 0;
    this.lastByteOffset = this.firstByteOffset + this.nibblesPerLine + this.nibblesPerLine / config['nibbles'] - 1;
    this.firstAsciiOffset = this.lastByteOffset + (config['nibbles'] == 2 ? 4 : 2);
    this.lastAsciiOffset = this.firstAsciiOffset + config['width'];
    this.firstLine = config['showOffset'] ? 1 : 0;
  }

  public getNibbleOffset = (pos: vscode.Position): number => {
    // check if within a valid section
    if (pos.line < this.firstLine || pos.character < this.firstByteOffset) {
        return NaN;
    }

    let offset: number = 2 * (pos.line - this.firstLine) * this.config['width'];
    const s: number = pos.character - this.firstByteOffset;
    if (pos.character >= this.firstByteOffset && pos.character <= this.lastByteOffset ) {
        // byte section
        const nibbles = this.config['nibbles'];
        offset += nibbles*Math.floor((s+1)/(nibbles+1)) + ((s%(nibbles+1))%nibbles);
    } else return NaN;
    return offset;
  }

  public getByteOffset = (pos: vscode.Position): number => {
    return Math.floor(this.getNibbleOffset(pos)/2);
  }

  public getRanges(startOffset: number, endOffset: number, ascii: boolean): vscode.Range[] {
    let startPos = this.getPosition(startOffset, ascii);
    let endPos = this.getPosition(endOffset, ascii);
    endPos = new vscode.Position(endPos.line, endPos.character + (ascii ? 1 : 2));

    let ranges = [];
    const firstOffset = ascii ? this.firstAsciiOffset : this.firstByteOffset;
    const lastOffset = ascii ? this.lastAsciiOffset : this.lastByteOffset;
    for (let i=startPos.line; i<=endPos.line; ++i) {
      const start = new vscode.Position(i, (i == startPos.line ? startPos.character : firstOffset));
      const end = new vscode.Position(i, (i == endPos.line ? endPos.character : lastOffset));
      ranges.push(new vscode.Range(start, end));
    }

    return ranges;
  }

  public getPosition(byteOffset: number, ascii: Boolean = false) : vscode.Position {
    let row = this.firstLine + Math.floor(byteOffset / this.config['width']);
    let column = byteOffset % this.config['width'];

    if (ascii) {
      column += this.firstAsciiOffset;
    } else {
      const bytesPerGroupLog2: number = this.config['nibbles'] >> 2;
      // begin + nibbles + spaces
      column = this.firstByteOffset + (column << 1) + (column >> bytesPerGroupLog2);
    }

    return new vscode.Position(row, column);
  }

  public handleSelection(e: vscode.TextEditorSelectionChangeEvent, fileLength: number) {
    let numLine = e.textEditor.document.lineCount;
    this.cursor = e.selections[0].start;
    if (e.selections[0].start.line + 1 == numLine || e.selections[0].end.line + 1 == numLine) {
      e.textEditor.setDecorations(HexSelector.smallDecorationType, []);
      return;
    }
    let startOffset = this.getByteOffset(e.selections[0].start);
    let endOffset = this.getByteOffset(e.selections[0].end);
    if (typeof startOffset == 'undefined' || typeof endOffset == 'undefined') {
      e.textEditor.setDecorations(HexSelector.smallDecorationType, []);
      return;
    }

    if (startOffset >= fileLength) {
      startOffset = fileLength - 1;
    }
    if (endOffset >= fileLength) {
      endOffset = fileLength - 1;
    }

    let ranges = this.getRanges(startOffset, endOffset, false);
    if (this.config['showAscii']) {
      ranges = ranges.concat(this.getRanges(startOffset, endOffset, true));
    }
    e.textEditor.setDecorations(HexSelector.smallDecorationType, ranges);
  }

};