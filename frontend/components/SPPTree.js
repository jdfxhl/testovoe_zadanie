import React, { useState } from 'react';
import { useStore } from '../lib/store';
import '../styles/components.css';

export default function SPPTree({ structure }) {
  const { selectedElements, addSelectedElement, removeSelectedElement } = useStore();
  const [expandedNodes, setExpandedNodes] = useState(new Set());

  const toggleNode = (nodeId) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  const handleSelectElement = (elementId) => {
    if (selectedElements.includes(elementId)) {
      removeSelectedElement(elementId);
    } else {
      addSelectedElement(elementId);
    }
  };

  const renderTreeNode = (node) => {
    const isExpanded = expandedNodes.has(node.id);
    const hasChildren = node.children && node.children.length > 0;
    const isSelected = selectedElements.includes(node.id);

    return (
      <div key={node.id} className="tree-node">
        <div className="node-content">
          {hasChildren && (
            <button
              className="expand-btn"
              onClick={() => toggleNode(node.id)}
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          )}
          {!hasChildren && <span className="expand-placeholder"></span>}

          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => handleSelectElement(node.id)}
            className="node-checkbox"
          />

          <span className="node-label">
            {node.name} ({node.code})
          </span>
          {node.weight && (
            <span className="node-weight">Weight: {node.weight}</span>
          )}
        </div>

        {hasChildren && isExpanded && (
          <div className="tree-children">
            {node.children.map((child) => renderTreeNode(child))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="spp-tree">
      {structure.map((node) => renderTreeNode(node))}
    </div>
  );
}
