'use strict';

import * as vscode from 'vscode';
import { getBuffer, getOffset, getPhysicalPath, getPosition, getRanges, getBufferSelection, handleKeyInput } from './util';

export default class HexSelector {
  private config: vscode.WorkspaceConfiguration;

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
    this.config = config;
  }

  public updateConfig(config: vscode.WorkspaceConfiguration) {
    this.config = config;
  }

  public getNibbleOffset = (pos: vscode.Position): number => {
    const firstLine: number = this.config['showOffset'] ? 1 : 0;
    const hexLineLength: number = this.config['width'] * 2;
    const firstByteOffset: number = this.config['showAddress'] ? 10 : 0;
    const lastByteOffset: number = firstByteOffset + hexLineLength + hexLineLength / this.config['nibbles'] - 1;

    // check if within a valid section
    if (pos.line < firstLine || pos.character < firstByteOffset) {
        return NaN;
    }

    let offset: number = (pos.line - firstLine) * this.config['width'];
    var s: number = pos.character - firstByteOffset;
    if (pos.character >= firstByteOffset && pos.character <= lastByteOffset ) {
        // byte section
        offset += this.config['nibbles']*Math.floor((s+1)/(this.config['nibbles']+1)) + ((s%(this.config['nibbles']+1))%this.config['nibbles']);
    } else return NaN;
    return offset;
  }

  public getByteOffset = (pos: vscode.Position): number => {
    return Math.floor(this.getNibbleOffset(pos)/2);
  }

  public handleSelection(e: vscode.TextEditorSelectionChangeEvent) {
    let numLine = e.textEditor.document.lineCount;
    if (e.selections[0].start.line + 1 == numLine || e.selections[0].end.line + 1 == numLine) {
      e.textEditor.setDecorations(HexSelector.smallDecorationType, []);
      return;
    }
    let startOffset = getOffset(e.selections[0].start);
    let endOffset = getOffset(e.selections[0].end);
    if (typeof startOffset == 'undefined' ||
      typeof endOffset == 'undefined') {
      e.textEditor.setDecorations(HexSelector.smallDecorationType, []);
      return;
    }

    const buf = getBuffer(e.textEditor.document.uri);
    if (buf)
    {
      if (startOffset >= buf.length) {
        startOffset = buf.length - 1;
      }
      if (endOffset >= buf.length) {
        endOffset = buf.length - 1;
      }
    }

    let ranges = getRanges(startOffset, endOffset, false);
    if (this.config['showAscii']) {
      ranges = ranges.concat(getRanges(startOffset, endOffset, true));
    }
    e.textEditor.setDecorations(HexSelector.smallDecorationType, ranges);
  }

};