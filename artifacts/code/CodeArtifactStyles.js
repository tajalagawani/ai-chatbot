// Stylesheet for CodeArtifact and related components
export const styles = `
  .cm-section-header {
    color: #569cd6;
    font-weight: bold;
  }

  .cm-key {
    color: #9cdcfe;
  }

  .cm-value {
    color: #ce9178;
  }

  .cm-node-type {
    color: #4ec9b0;
  }

  .cm-comment {
    color: #6a9955;
    font-style: italic;
  }

  .react-flow__node {
    padding: 10px;
    border-radius: 5px;
    font-size: 12px;
    color: #333;
    text-align: center;
    border-width: 2px;
    width: 150px;
  }

  .react-flow__node.running {
    border-color: #3b82f6;
    background-color: #eff6ff;
  }

  .react-flow__node.completed {
    border-color: #22c55e;
    background-color: #f0fdf4;
  }

  .react-flow__node.failed {
    border-color: #ef4444;
    background-color: #fef2f2;
  }

  .react-flow__edge-path {
    stroke-width: 2;
  }

  .react-flow__edge.animated path {
    stroke-dasharray: 5;
    animation: dashdraw 0.5s linear infinite;
  }

  @keyframes dashdraw {
    from {
      stroke-dashoffset: 10;
    }
  }
`;

// Inject custom styles when in browser environment
export const injectStyles = () => {
  if (typeof document !== 'undefined') {
    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
  }
};

export default { styles, injectStyles };