'use client';

import { EditorView } from '@codemirror/view';
import { EditorState, Transaction } from '@codemirror/state';
import { oneDark } from '@codemirror/theme-one-dark';
import { basicSetup } from 'codemirror';
import { json } from '@codemirror/lang-json';
import React, { memo, useEffect, useRef, useState, useMemo, useCallback } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap,
  ReactFlowProvider
} from 'reactflow';
import 'reactflow/dist/style.css';
import { parseWorkflow, generateWorkflowCode, isActContent } from './WorkflowUtils';
import { FlowEditor , } from './FlowEditor';


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

// FlowWrapper Component
const FlowWrapper = memo(({ nodes, edges, workflow, env, edgesRaw, onSave }) => {
  return (
    <ReactFlowProvider>
      <div style={{ width: '100%', height: '100%' }}>
        <FlowEditor
          nodes={nodes}
          edges={edges}
          workflow={workflow}
          env={env}
          edgesRaw={edgesRaw}
          onSave={onSave}
        />
      </div>
    </ReactFlowProvider>
  );
});

// Prevent unnecessary rerenders
FlowWrapper.displayName = 'FlowWrapper';

function PureCodeEditor({ content, onSaveContent, status = 'idle', isCurrentVersion = true, currentVersionIndex = 0, suggestions = [] }) {
  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const flowContainerRef = useRef(null);
  const [isFlowView, setIsFlowView] = useState(false);
  const [parsedData, setParsedData] = useState(null);
  const [ignoreSave, setIgnoreSave] = useState(false);
  const [isValidActContent, setIsValidActContent] = useState(true);
  const lastUpdateRef = useRef('');

  // Initialize the flowData state - optimized with debouncing
  useEffect(() => {
    if (!ignoreSave && content) {
      // Skip if content hasn't changed
      if (content === lastUpdateRef.current) return;
      
      // Check if content is valid ACT format
      const isValid = isActContent(content);
      setIsValidActContent(isValid);
      
      // Use requestIdleCallback if available for non-critical updates
      const updateParsedData = () => {
        try {
          lastUpdateRef.current = content;
          if (isValid) {
            const parsed = parseWorkflow(content);
            setParsedData(parsed);
          } else {
            console.warn('Content is not in ACT format, disabling flow view');
            setParsedData(null);
            // If in flow view but content is invalid, switch to code view
            if (isFlowView) {
              setIsFlowView(false);
            }
          }
        } catch (error) {
          console.error('Error parsing workflow:', error);
          setIsValidActContent(false);
        }
      };
      
      if (window.requestIdleCallback) {
        window.requestIdleCallback(updateParsedData, { timeout: 300 });
      } else {
        setTimeout(updateParsedData, 1);
      }
    }
  }, [content, ignoreSave, isFlowView]);

  // Initialize or update the editor
  useEffect(() => {
    if (containerRef.current && !editorRef.current && !isFlowView) {
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
  }, [isFlowView, content]);

  // Setup editor update listener
  useEffect(() => {
    if (editorRef.current && !isFlowView) {
      const updateListener = EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          const transaction = update.transactions.find(
            (tr) => !tr.annotation(Transaction.remote),
          );

          if (transaction) {
            const newContent = update.state.doc.toString();
            if (!ignoreSave) {
              lastUpdateRef.current = newContent;
              onSaveContent(newContent, true);
            }
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
  }, [onSaveContent, isFlowView, ignoreSave]);

  // Update editor content when it changes externally
  useEffect(() => {
    if (editorRef.current && content && !isFlowView) {
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
  }, [content, status, isFlowView]);

  // Handle saving flow changes back to code - optimized
  const handleFlowSave = useCallback((newCode) => {
    if (newCode === lastUpdateRef.current) return;
    
    // Use RAF to batch updates with browser rendering cycle
    requestAnimationFrame(() => {
      setIgnoreSave(true);
      lastUpdateRef.current = newCode;
      onSaveContent(newCode, true);
      
      // Reset ignore flag after a shorter delay
      setTimeout(() => {
        setIgnoreSave(false);
      }, 200);
    });
  }, [onSaveContent]);

  // Toggle between views
  const handleToggleView = useCallback(() => {
    setIsFlowView(!isFlowView);
  }, [isFlowView]);

  return (
    <div className="relative not-prose w-full h-full" style={{ minHeight: '80vh' }}>
      <div className="absolute top-2 right-2 z-10">
        <button 
          onClick={handleToggleView}
          className={`px-4 py-2 ${isValidActContent ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-400 cursor-not-allowed'} text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-colors`}
          disabled={!isValidActContent}
          title={!isValidActContent ? "Content is not in ACT format" : ""}
        >
          {isFlowView ? 'Show Code View' : 'Show Flow View'}
        </button>
      </div>
      
      {isFlowView ? (
        <div 
          ref={flowContainerRef}
          className="w-full h-[80vh]" 
          style={{ height: '80vh', width: '100%' }}
        >
          {parsedData && (
            <FlowWrapper 
              nodes={parsedData.nodes}
              edges={parsedData.edges}
              workflow={parsedData.workflow}
              env={parsedData.env}
              edgesRaw={parsedData.edgesRaw}
              onSave={handleFlowSave}
            />
          )}
        </div>
      ) : (
        <div
          className="w-full pb-[calc(80dvh)] text-sm"
          ref={containerRef}
        />
      )}
    </div>
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