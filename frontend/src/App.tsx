import React, { useEffect, useState } from 'react';
import { Brand, Draft, Finding, ApiConnectionStatus, UserRole } from './types';
import { api } from './api/client';
import { supabase } from './supabase';
import { Navbar } from './components/Navbar';
import { Home } from './pages/Home';
import { Vault } from './pages/Vault';
import { Submit } from './pages/Submit';
import { Report } from './pages/Report';
import { Review } from './pages/Review';
import { Insights } from './pages/Insights';

export const App: React.FC = () => {

  const [activeTab, setActiveTab] = useState<string>('home');
  const [apiStatus, setApiStatus] = useState<ApiConnectionStatus>('waking');
  const [userRole, setUserRole] = useState<UserRole>('creator');
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [activeBrand, setActiveBrand] = useState<Brand | null>(null);
  const [activeDraft, setActiveDraft] = useState<Draft | null>(null);
  const [draftFindings, setDraftFindings] = useState<Finding[]>([]);
  const [llmReviewResult, setLlmReviewResult] = useState<any | null>(null);


  // Initialize Supabase Auth listener
  useEffect(() => {
    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          setCurrentUserEmail(session.user.email || null);
          api.setAuthToken(session.access_token);
        } else {
          setCurrentUserEmail(null);
          api.setAuthToken(null);
        }
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session) {
          setCurrentUserEmail(session.user.email || null);
          api.setAuthToken(session.access_token);
        } else {
          setCurrentUserEmail(null);
          api.setAuthToken(null);
        }
      });

      return () => subscription.unsubscribe();
    }
  }, []);

  const handleSignOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setCurrentUserEmail(null);
    api.setAuthToken(null);
  };

  // Check API health and dynamically fetch brands (NO hardcoded brand IDs)
  const initApp = async () => {
    const status = await api.checkHealth((intermediateStatus) => {
      setApiStatus(intermediateStatus);
    });
    setApiStatus(status);

    if (status === 'connected') {
      try {
        const brands = await api.getBrands();
        if (brands && brands.length > 0) {
          setActiveBrand(brands[0]);
        }
      } catch (err) {
        console.warn('Could not load brands from API:', err);
      }
    } else {

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

  const handleReviewCompleted = (draft: Draft, findings: Finding[], llmReview?: any) => {
    setActiveDraft(draft);
    setDraftFindings(findings);
    setLlmReviewResult(llmReview || null);
    setActiveTab('report');
  };

  const handleDraftUpdated = (draft: Draft, findings?: Finding[], llmReview?: any) => {
    setActiveDraft(draft);
    if (findings) {
      setDraftFindings(findings);
    }
    if (llmReview !== undefined) {
      setLlmReviewResult(llmReview);
    }
  };


  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        apiStatus={apiStatus}
        userRole={userRole}
        setUserRole={setUserRole}
        currentUserEmail={currentUserEmail}
        onSignOut={handleSignOut}
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
            llmReview={llmReviewResult}
            onDraftUpdated={handleDraftUpdated}
            onNavigateToReview={() => setActiveTab('review')}
            apiStatus={apiStatus}
          />
        )}

        {activeTab === 'review' && (
          <Review
            draft={activeDraft}
            findings={draftFindings}
            userRole={userRole}
            onDraftUpdated={handleDraftUpdated}
          />
        )}
        {activeTab === 'insights' && (
          <Insights activeBrand={activeBrand} />
        )}
      </main>
    </div>
  );
};


export default App;
