import { useState, useCallback } from 'react';
import { useStore } from '../lib/store';
import styles from './SPPTree.module.css';

const getAllDescendantIds = (node) => {
  let ids = [];
  if (node.children && node.children.length > 0) {
    node.children.forEach((child) => {
      ids.push(child.id);
      ids = ids.concat(getAllDescendantIds(child));
    });
  }
  return ids;
};

const TreeNode = ({ node, distribution }) => {
  const [collapsed, setCollapsed] = useState(false);
  const selectedElements = useStore((state) => state.selectedElements);
  const addSelectedElement = useStore((state) => state.addSelectedElement);
  const removeSelectedElement = useStore((state) => state.removeSelectedElement);

  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedElements.includes(node.id);
  const amount = distribution?.amount;

  const handleToggleCollapse = () => setCollapsed(!collapsed);

  const handleCheckboxChange = useCallback((e) => {
    const checked = e.target.checked;
    const idsToUpdate = [node.id, ...getAllDescendantIds(node)];

    if (checked) {
      idsToUpdate.forEach((id) => addSelectedElement(id));
    } else {
      idsToUpdate.forEach((id) => removeSelectedElement(id));
    }
  }, [node, addSelectedElement, removeSelectedElement]);

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
            {amount !== undefined && (
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
              distribution={distribution?.children?.[child.code]}
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
          distribution={distributionResult?.[rootNode.code]}
        />
      ))}
    </div>
  );
}