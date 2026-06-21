import { useState, useEffect } from 'react';
import { useStore } from '../lib/store';
import { sppApi, distributionApi } from '../lib/api';
import { toast } from 'react-toastify';
import styles from './DistributionForm.module.css';

export default function DistributionForm() {
  const {
    selectedElements,
    totalAmount,
    sessionId,
    resultId,
    distributionResult,
    setSppStructure,
    setDistributionResult,
    clearSelectedElements,
    resetDistribution,
  } = useStore();

  const [availableDates, setAvailableDates] = useState([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Fetch available dates on mount
  useEffect(() => {
    const fetchDates = async () => {
      try {
        const resp = await sppApi.getAvailableDates();
        setAvailableDates(resp.dates || []);
        if (resp.dates && resp.dates.length > 0) {
          setSelectedDate(resp.dates[0]); // select most recent by default
        }
      } catch (err) {
        toast.error('Failed to load available dates');
      }
    };
    fetchDates();
  }, []);

  // When date changes, reload SPP structure for that date
  useEffect(() => {
    if (!selectedDate) return;
    const fetchStructure = async () => {
      try {
        const resp = await sppApi.getStructure(selectedDate);
        setSppStructure(resp.structure);
      } catch (err) {
        toast.error('Failed to load structure for selected date');
      }
    };
    fetchStructure();
  }, [selectedDate, setSppStructure]);

  const handleCalculate = async () => {
    if (selectedElements.length === 0) {
      toast.warn('Выберите хотя бы один элемент СПП');
      return;
    }
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      toast.warn('Введите корректную сумму');
      return;
    }
    setLoading(true);
    try {
      const resp = await distributionApi.calculate(selectedElements, numAmount, selectedDate);
      setDistributionResult(resp.distribution, resp.result_id);
      toast.success('Распределение рассчитано');
    } catch (err) {
      toast.error('Ошибка при расчете');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!resultId) {
      toast.warn('Сначала выполните расчет');
      return;
    }
    setSaving(true);
    try {
      const resp = await distributionApi.save(resultId, sessionId);
      toast.success('Результат сохранен');
      // WebSocket will update saved results list automatically
    } catch (err) {
      toast.error('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    if (!resultId) {
      toast.warn('Сначала выполните расчет и сохраните результат');
      return;
    }
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

  const handleReset = () => {
    resetDistribution();
    setAmount('');
  };

  return (
    <div className={styles.form}>
      <div className={styles.field}>
        <label>Дата версии СПП:</label>
        <select value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}>
          {availableDates.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      <div className={styles.field}>
        <label>Сумма распределения:</label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Введите сумму"
        />
      </div>

      <div className={styles.actions}>
        <button onClick={handleCalculate} disabled={loading || selectedElements.length === 0}>
          {loading ? 'Вычисление...' : 'Выполнить'}
        </button>
        <button onClick={handleSave} disabled={saving || !resultId}>
          {saving ? 'Сохранение...' : 'Сохранить'}
        </button>
        <button onClick={handleExport} disabled={!resultId}>
          Скачать Excel
        </button>
        <button onClick={handleReset} className={styles.resetBtn}>
          Сбросить
        </button>
      </div>

      {resultId && (
        <div className={styles.resultInfo}>
          <p>Результат ID: {resultId}</p>
          {totalAmount && <p>Общая сумма: {totalAmount}</p>}
        </div>
      )}
    </div>
  );
}