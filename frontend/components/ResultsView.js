import { useStore } from '../lib/store';
import styles from './ResultsView.module.css';

export default function ResultsView() {
  const resultId = useStore((state) => state.resultId);
  const totalAmount = useStore((state) => state.totalAmount);
  const showResults = useStore((state) => state.showResults);

  if (!showResults || !resultId) return null;

  return (
    <div className={styles.container}>
      <h3>Последний результат</h3>
      <p><strong>ID результата:</strong> {resultId}</p>
      {totalAmount > 0 && <p><strong>Общая сумма:</strong> {totalAmount.toFixed(2)}</p>}
    </div>
  );
}