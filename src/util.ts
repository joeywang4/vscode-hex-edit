import * as vscode from 'vscode';
import * as fs from 'fs';
import { getData } from "./hex";

export const getPhysicalPath = (uri: vscode.Uri): string => uri.fsPath;

export function getFileSize(uri: vscode.Uri) : Number {
    var filepath = getPhysicalPath(uri);
    var fstat = fs.statSync(filepath);
    return fstat ? fstat['size'] : -1;
}

export function getOffset(pos: vscode.Position) : number {
    var config = vscode.workspace.getConfiguration('hexdump');
    var firstLine: number = config['showOffset'] ? 1 : 0;
    var hexLineLength: number = config['width'] * 2;
    var firstByteOffset: number = config['showAddress'] ? 10 : 0;
    var lastByteOffset: number = firstByteOffset + hexLineLength + hexLineLength / config['nibbles'] - 1;
    var firstAsciiOffset: number = lastByteOffset + (config['nibbles'] == 2 ? 4 : 2);

    // check if within a valid section
    if (pos.line < firstLine || pos.character < firstByteOffset) {
        return;
    }

    var offset = (pos.line - firstLine) * config['width'];
    var s = pos.character - firstByteOffset;
    if (pos.character >= firstByteOffset && pos.character <= lastByteOffset ) {
        // byte section
        if (config['nibbles'] == 8) {
            offset += Math.floor(s / 9) + Math.floor((s + 2) / 9) + Math.floor((s + 4) / 9) + Math.floor((s + 6) / 9);
        } else if (config['nibbles'] == 4) {
            offset += Math.floor(s / 5) + Math.floor((s + 2) / 5);
        } else {
            offset += Math.floor(s / 3);
        }
    } else if (pos.character >= firstAsciiOffset) {
        // ascii section
        offset += (pos.character - firstAsciiOffset);
    }
    return offset;
}

export function getPosition(offset: number, ascii: Boolean = false) : vscode.Position {
    var config = vscode.workspace.getConfiguration('hexdump');
    var firstLine: number = config['showOffset'] ? 1 : 0;
    var hexLineLength: number = config['width'] * 2;
    var firstByteOffset: number = config['showAddress'] ? 10 : 0;
    var lastByteOffset: number = firstByteOffset + hexLineLength + hexLineLength / config['nibbles'] - 1;
    var firstAsciiOffset: number = lastByteOffset + (config['nibbles'] == 2 ? 4 : 2);

    let row = firstLine + Math.floor(offset / config['width']);
    let column = offset % config['width'];

    if (ascii) {
        column += firstAsciiOffset;
    } else {
        if (config['nibbles'] == 8) {
            column = firstByteOffset + column * 2 + Math.floor(column / 4);
        } else if (config['nibbles'] == 4) {
            column = firstByteOffset + column * 2 + Math.floor(column / 2);
        } else {
            column = firstByteOffset + column * 3;
        }
    }

    return new vscode.Position(row, column);
}

export function getRanges(startOffset: number, endOffset: number, ascii: boolean): vscode.Range[] {
    var config = vscode.workspace.getConfiguration('hexdump');
    var hexLineLength: number = config['width'] * 2;
    var firstByteOffset: number = config['showAddress'] ? 10 : 0;
    var lastByteOffset: number = firstByteOffset + hexLineLength + hexLineLength / config['nibbles'] - 1;
    var firstAsciiOffset: number = lastByteOffset + (config['nibbles'] == 2 ? 4 : 2);
    var lastAsciiOffset: number = firstAsciiOffset + config['width'];

    var startPos = getPosition(startOffset, ascii);
    var endPos = getPosition(endOffset, ascii);
    endPos = new vscode.Position(endPos.line, endPos.character + (ascii ? 1 : 2));

    var ranges = [];
    var firstOffset = ascii ? firstAsciiOffset : firstByteOffset;
    var lastOffset = ascii ? lastAsciiOffset : lastByteOffset;
    for (var i=startPos.line; i<=endPos.line; ++i) {
        var start = new vscode.Position(i, (i == startPos.line ? startPos.character : firstOffset));
        var end = new vscode.Position(i, (i == endPos.line ? endPos.character : lastOffset));
        ranges.push(new vscode.Range(start, end));
    }

    return ranges;
}

export function getBuffer(uri: vscode.Uri) : Buffer | undefined {
    return getData(uri).buffer;
}

export function toArrayBuffer(buffer: Buffer, offset: number, length: number): ArrayBuffer {
    var ab = new ArrayBuffer(buffer.length);
    var view = new Uint8Array(ab);
    for (var i = 0; i < buffer.length; ++i) {
        view[i] = buffer[offset + i];
    }
    return ab;
}

export function getBufferSelection(document: vscode.TextDocument, selection?: vscode.Selection): Buffer | undefined {
    let buf = getBuffer(document.uri);
    if (typeof buf == 'undefined') {
        return;
    }

    if (selection && !selection.isEmpty) {
        let start = getOffset(selection.start);
        let end = getOffset(selection.end) + 1;
        return buf.slice(start, end);
    }
    
    return buf;
}

export function handleKeyInput(uri: vscode.Uri, key: string) {
  console.log(key);
}