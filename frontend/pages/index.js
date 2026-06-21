import React, { useEffect, useState } from 'react';
import { useStore } from '../lib/store';
import { authApi, sppApi, initializeSocket, getSocket } from '../lib/api';
import { toast } from 'react-toastify';
import SPPTree from '../components/SPPTree';
import DistributionForm from '../components/DistributionForm';
import ResultsView from '../components/ResultsView';
import SavedResults from '../components/SavedResults';

export default function Home() {
  const {
    isAuthenticated,
    setAuth,
    sppStructure,
    setSppStructure,
    loading,
    setLoading,
    currentPage,
    setCurrentPage,
    sessionId,
    setSavedResults,
  } = useStore();

  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        setLoading(true);

        const token = localStorage.getItem('accessToken');
        const storedSessionId = localStorage.getItem('sessionId');
        const storedUserId = localStorage.getItem('userId');

        if (!token) {
          const loginResponse = await authApi.login();
          localStorage.setItem('accessToken', loginResponse.access_token);
          localStorage.setItem('sessionId', loginResponse.session_id);
          localStorage.setItem('userId', loginResponse.user_id);
          setAuth(loginResponse.user_id, loginResponse.access_token, loginResponse.session_id);
        } else {
          setAuth(storedUserId, token, storedSessionId);
        }

        const finalSessionId = storedSessionId || sessionId;
        if (finalSessionId) {
          initializeSocket(finalSessionId);
        }

        const structureResponse = await sppApi.getStructure();
        setSppStructure(structureResponse.structure);

        setInitialized(true);
      } catch (error) {
        console.error('Initialization error:', error);
        toast.error('Failed to initialize application');
      } finally {
        setLoading(false);
      }
    };

    if (!initialized) {
      initializeApp();
    }
  }, [initialized, setAuth, setSppStructure, setLoading, sessionId]);

  if (loading && !initialized) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="header">
        <h1>SPP Distribution System</h1>
        <nav className="nav">
          <button
            className={`nav-btn ${currentPage === 'home' ? 'active' : ''}`}
            onClick={() => setCurrentPage('home')}
          >
            Distribution
          </button>
          <button
            className={`nav-btn ${currentPage === 'results' ? 'active' : ''}`}
            onClick={() => setCurrentPage('results')}
          >
            Saved Results
          </button>
        </nav>
      </header>

      <main className="main-content">
        {currentPage === 'home' ? (
          <div className="home-page">
            <div className="page-grid">
              <div className="spp-section">
                <h2>SPP Structure</h2>
                <SPPTree structure={sppStructure} />
              </div>
              <div className="form-section">
                <h2>Distribution Calculation</h2>
                <DistributionForm />
                <ResultsView />
              </div>
            </div>
          </div>
        ) : (
          <SavedResults />
        )}
      </main>

      <footer className="footer">
        <p>&copy; 2024 SPP Distribution System. All rights reserved.</p>
      </footer>
    </div>
  );
}