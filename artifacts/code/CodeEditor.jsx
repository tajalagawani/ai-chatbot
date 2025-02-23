'use client';

import { EditorView } from '@codemirror/view';
import { EditorState, Transaction } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import { basicSetup } from 'codemirror';
import { json } from '@codemirror/lang-json';
import React, { memo, useEffect, useRef } from 'react';

// Custom theme to enhance edge highlighting and other elements
const customTheme = EditorView.theme({
  // Core styling
  "&": { 
    backgroundColor: "#1e1e1e",
    height: "100%"
  },
  ".cm-content": { 
    padding: "10px 0",
    fontFamily: "'Fira Code', monospace",
    fontSize: "14px"
  },
  ".cm-line": {
    padding: "0 4px"
  },
  
  // General syntax styling
  ".cm-string": { color: "#ce9178" },
  ".cm-number": { color: "#b5cea8" },
  ".cm-keyword": { color: "#569cd6", fontWeight: "bold" },
  ".cm-property": { color: "#9cdcfe" },
  ".cm-comment": { color: "#6a9955", fontStyle: "italic" },
  ".cm-operator": { color: "#d4d4d4" },
  ".cm-punctuation": { color: "#d4d4d4" },
  
  // Special styling for brackets to make section headers stand out
  ".cm-bracket": { color: "#569cd6", fontWeight: "bold" }
});

function PureCodeEditor({ content, onSaveContent, status = 'idle', isCurrentVersion = true, currentVersionIndex = 0, suggestions = [] }) {
  const containerRef = useRef(null);
  const editorRef = useRef(null);

  useEffect(() => {
    if (containerRef.current && !editorRef.current) {
      // Use JSON mode as it provides some reasonable coloring for ACT-like content
      const startState = EditorState.create({
        doc: content,
        extensions: [
          basicSetup, 
          json(),
          oneDark,
          customTheme
        ],
      });

      editorRef.current = new EditorView({
        state: startState,
        parent: containerRef.current,
      });
    }

    return () => {
      if (editorRef.current) {
        editorRef.current.destroy();
        editorRef.current = null;
      }
    };
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (editorRef.current) {
      const updateListener = EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const transaction = update.transactions.find(
            (tr) => !tr.annotation(Transaction.remote),
          );

          if (transaction) {
            const newContent = update.state.doc.toString();
            onSaveContent(newContent, true);
          }
        }
      });

      const currentSelection = editorRef.current.state.selection;

      const newState = EditorState.create({
        doc: editorRef.current.state.doc,
        extensions: [
          basicSetup, 
          json(),
          oneDark, 
          customTheme,
          updateListener
        ],
        selection: currentSelection,
      });

      editorRef.current.setState(newState);
    }
  }, [onSaveContent]);

  useEffect(() => {
    if (editorRef.current && content) {
      const currentContent = editorRef.current.state.doc.toString();

      if (status === 'streaming' || currentContent !== content) {
        const transaction = editorRef.current.state.update({
          changes: {
            from: 0,
            to: currentContent.length,
            insert: content,
          },
          annotations: [Transaction.remote.of(true)],
        });

        editorRef.current.dispatch(transaction);
      }
    }
  }, [content, status]);

  return (
    <div
      className="relative not-prose w-full pb-[calc(80dvh)] text-sm"
      ref={containerRef}
    />
  );
}

function areEqual(prevProps, nextProps) {
  if (prevProps.suggestions !== nextProps.suggestions) return false;
  if (prevProps.currentVersionIndex !== nextProps.currentVersionIndex)
    return false;
  if (prevProps.isCurrentVersion !== nextProps.isCurrentVersion) return false;
  if (prevProps.status === 'streaming' && nextProps.status === 'streaming')
    return false;
  if (prevProps.content !== nextProps.content) return false;

  return true;
}

const CodeEditor = memo(PureCodeEditor, areEqual);

export default CodeEditor;