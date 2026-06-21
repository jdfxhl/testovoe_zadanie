import React from 'react';
import { useStore } from '../lib/store';
import { distributionApi } from '../lib/api';
import { toast } from 'react-toastify';
import '../styles/components.css';

export default function ResultsView() {
  const {
    showResults,
    distributionResult,
    resultId,
    sessionId,
    setLoading,
    loading,
  } = useStore();

  if (!showResults || !distributionResult) {
    return null;
  }

  const handleSave = async () => {
    if (!resultId || !sessionId) {
      toast.error('Cannot save result');
      return;
    }

    try {
      setLoading(true);
      await distributionApi.save(resultId, sessionId);
      toast.success('Result saved successfully');
    } catch (error) {
      toast.error('Failed to save result');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!resultId) {
      toast.error('Cannot export result');
      return;
    }

    try {
      setLoading(true);
      const response = await distributionApi.export(resultId);
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `distribution_${resultId}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
      
      toast.success('Result exported successfully');
    } catch (error) {
      toast.error('Failed to export result');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="results-view">
      <h3>Distribution Results</h3>
      
      <div className="results-table">
        <table>
          <thead>
            <tr>
              <th>Element Code</th>
              <th>Element Name</th>
              <th>Allocated Amount</th>
              <th>Percentage</th>
            </tr>
          </thead>
          <tbody>
            {distributionResult.map((item) => (
              <tr key={item.element_id}>
                <td>{item.code}</td>
                <td>{item.name}</td>
                <td>{item.allocated_amount.toFixed(2)}</td>
                <td>{(item.percentage * 100).toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="results-actions">
        <button
          className="btn btn-success"
          onClick={handleSave}
          disabled={loading}
        >
          {loading ? 'Saving...' : 'Save Result'}
        </button>
        <button
          className="btn btn-info"
          onClick={handleExport}
          disabled={loading}
        >
          {loading ? 'Exporting...' : 'Export to Excel'}
        </button>
      </div>
    </div>
  );
}
