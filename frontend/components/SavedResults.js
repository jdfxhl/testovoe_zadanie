import { useState, useEffect, useCallback } from 'react';
import { useStore } from '../lib/store';
import { distributionApi, getSocket } from '../lib/api';
import { toast } from 'react-toastify';
import styles from './SavedResults.module.css';

export default function SavedResults() {
  const sessionId = useStore((state) => state.sessionId);
  const setDistributionResult = useStore((state) => state.setDistributionResult);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchSavedResults = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const resp = await distributionApi.getSavedResults(sessionId);
      setResults(resp.results || []);
    } catch (err) {
      toast.error('Failed to load saved results');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSavedResults();
  }, [fetchSavedResults]);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleSaved = (data) => {
      if (data.session_id === sessionId) {
        fetchSavedResults();
      }
    };

    socket.on('distribution_saved', handleSaved);
    return () => socket.off('distribution_saved', handleSaved);
  }, [sessionId, fetchSavedResults]);

  const handleLoad = async (resultId) => {
    try {
      const resp = await distributionApi.load(resultId);
      setDistributionResult(resp.distribution, resp.id);
      toast.success('Результат загружен');
    } catch (err) {
      toast.error('Ошибка загрузки');
    }
  };

  const handleExport = async (resultId) => {
    try {
      const resp = await distributionApi.export(resultId);
      const blob = resp.data;
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `distribution_${resultId}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Файл загружен');
    } catch (err) {
      toast.error('Ошибка экспорта');
    }
  };

  if (loading) {
    return <div className={styles.loading}>Загрузка...</div>;
  }

  return (
    <div className={styles.container}>
      <h2>Сохранённые расчёты</h2>
      {results.length === 0 ? (
        <p>Нет сохранённых результатов.</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Сумма</th>
              <th>Дата создания</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>{r.total_amount.toFixed(2)}</td>
                <td>{new Date(r.created_at).toLocaleString()}</td>
                <td>
                  <button onClick={() => handleLoad(r.id)}>Загрузить</button>
                  <button onClick={() => handleExport(r.id)}>Скачать Excel</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}