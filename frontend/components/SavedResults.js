import React, { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { distributionApi } from '../lib/api';
import { toast } from 'react-toastify';
import '../styles/components.css';

export default function SavedResults() {
  const { sessionId, setLoading, loading } = useStore();
  const [results, setResults] = useState([]);
  const [selectedResult, setSelectedResult] = useState(null);
  const [resultDetails, setResultDetails] = useState(null);

  useEffect(() => {
    if (sessionId) {
      loadSavedResults();
    }
  }, [sessionId]);

  const loadSavedResults = async () => {
    try {
      setLoading(true);
      const response = await distributionApi.getSavedResults(sessionId);
      setResults(response.results || []);
    } catch (error) {
      toast.error('Failed to load saved results');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectResult = async (resultId) => {
    try {
      setLoading(true);
      const response = await distributionApi.load(resultId);
      setSelectedResult(resultId);
      setResultDetails(response);
    } catch (error) {
      toast.error('Failed to load result details');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (resultId) => {
    try {
      setLoading(true);
      const response = await distributionApi.export(resultId);
      
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
    <div className="saved-results">
      <h2>Saved Distribution Results</h2>

      {loading && !results.length ? (
        <div className="loading-container">
          <p>Loading results...</p>
        </div>
      ) : results.length === 0 ? (
        <p className="no-results">No saved results yet</p>
      ) : (
        <div className="results-grid">
          <div className="results-list">
            <h3>Results List</h3>
            <ul>
              {results.map((result) => (
                <li
                  key={result.id}
                  className={selectedResult === result.id ? 'active' : ''}
                  onClick={() => handleSelectResult(result.id)}
                >
                  <div className="result-item">
                    <strong>{result.name || `Result ${result.id}`}</strong>
                    <small>{new Date(result.created_at).toLocaleString()}</small>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {resultDetails && (
            <div className="result-details">
              <h3>Distribution Details</h3>
              <div className="details-table">
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
                    {resultDetails.result.map((item) => (
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

              <button
                className="btn btn-info"
                onClick={() => handleExport(selectedResult)}
                disabled={loading}
              >
                {loading ? 'Exporting...' : 'Export to Excel'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
