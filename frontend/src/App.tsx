import React, { useEffect, useState } from 'react';
import { Brand, Draft, Finding, ApiConnectionStatus, UserRole } from './types';
import { api } from './api/client';
import { Navbar } from './components/Navbar';
import { Home } from './pages/Home';
import { Vault } from './pages/Vault';
import { Submit } from './pages/Submit';
import { Report } from './pages/Report';
import { Review } from './pages/Review';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('home');
  const [apiStatus, setApiStatus] = useState<ApiConnectionStatus>('waking');
  const [userRole, setUserRole] = useState<UserRole>('creator');
  const [activeBrand, setActiveBrand] = useState<Brand | null>(null);
  const [activeDraft, setActiveDraft] = useState<Draft | null>(null);
  const [draftFindings, setDraftFindings] = useState<Finding[]>([]);

  // Check API health and dynamically fetch brands (NO hardcoded brand IDs)
  const initApp = async () => {
    const status = await api.checkHealth();
    setApiStatus(status);

    if (status === 'connected') {
      try {
        const brands = await api.getBrands();
        if (brands && brands.length > 0) {
          // CRITICAL: Pick the first brand returned by the backend
          setActiveBrand(brands[0]);
        }
      } catch (err) {
        console.warn('Could not load brands from API:', err);
      }
    } else {
      // Local fallback for offline mode
      setActiveBrand({
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Demo Brand (Seeded)',
      });
    }
  };

  useEffect(() => {
    initApp();
  }, []);

  const handleDraftCreated = (draft: Draft) => {
    setActiveDraft(draft);
    setActiveTab('submit');
  };

  const handleReviewCompleted = (draft: Draft, findings: Finding[]) => {
    setActiveDraft(draft);
    setDraftFindings(findings);
    setActiveTab('report');
  };

  const handleDraftUpdated = (draft: Draft, findings: Finding[]) => {
    setActiveDraft(draft);
    setDraftFindings(findings);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        apiStatus={apiStatus}
        userRole={userRole}
        setUserRole={setUserRole}
        onRefreshHealth={initApp}
      />

      <main className="flex-1">
        {activeTab === 'home' && (
          <Home
            activeBrand={activeBrand}
            onDraftCreated={handleDraftCreated}
            apiStatus={apiStatus}
          />
        )}
        {activeTab === 'vault' && <Vault activeBrand={activeBrand} />}
        {activeTab === 'submit' && (
          <Submit
            currentDraft={activeDraft}
            onReviewCompleted={handleReviewCompleted}
            apiStatus={apiStatus}
          />
        )}
        {activeTab === 'report' && (
          <Report
            draft={activeDraft}
            findings={draftFindings}
            onDraftUpdated={handleDraftUpdated}
            onNavigateToReview={() => setActiveTab('review')}
            apiStatus={apiStatus}
          />
        )}
        {activeTab === 'review' && (
          <Review draft={activeDraft} findings={draftFindings} />
        )}
      </main>
    </div>
  );
};

export default App;
