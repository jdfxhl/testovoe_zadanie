import { useState } from 'react';
import { useStore } from '../lib/store';
import styles from './SPPTree.module.css';

const TreeNode = ({ node, distribution }) => {
  const [collapsed, setCollapsed] = useState(false);
  const selectedElements = useStore((state) => state.selectedElements);
  const addSelectedElement = useStore((state) => state.addSelectedElement);
  const removeSelectedElement = useStore((state) => state.removeSelectedElement);

  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedElements.includes(node.id);
  const distNode = distribution ? distribution[node.code] : null;
  const amount = distNode ? distNode.amount : null;

  const handleToggleCollapse = () => {
    setCollapsed(!collapsed);
  };

  const handleCheckboxChange = (e) => {
    if (e.target.checked) {
      addSelectedElement(node.id);
    } else {
      removeSelectedElement(node.id);
    }
  };

  return (
    <div className={styles.treeNode}>
      <div className={styles.nodeRow} style={{ paddingLeft: `${(node.level - 1) * 20}px` }}>
        <div className={styles.nodeInfo}>
          {hasChildren && (
            <button className={styles.toggleBtn} onClick={handleToggleCollapse}>
              {collapsed ? '▸' : '▾'}
            </button>
          )}
          {!hasChildren && <span className={styles.toggleBtnPlaceholder} />}
          
          <input
            type="checkbox"
            checked={isSelected}
            onChange={handleCheckboxChange}
            className={styles.checkbox}
          />
          
          <span className={styles.nodeLabel}>
            {node.code} — {node.name}
            {amount !== null && (
              <span className={styles.amount}>{amount.toFixed(2)}</span>
            )}
          </span>
        </div>
      </div>
      
      {hasChildren && !collapsed && (
        <div className={styles.children}>
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              distribution={distNode ? distNode.children : null}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default function SPPTree({ structure }) {
  const distributionResult = useStore((state) => state.distributionResult);

  return (
    <div className={styles.tree}>
      {structure.map((rootNode) => (
        <TreeNode
          key={rootNode.id}
          node={rootNode}
          distribution={distributionResult ? distributionResult[rootNode.code]?.children : null}
        />
      ))}
    </div>
  );
}