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

const pathToTab = (pathname: string): string => {
  const clean = pathname.toLowerCase().replace(/\/+$/, '');
  if (clean === '/vault') return 'vault';
  if (clean === '/submit') return 'submit';
  if (clean === '/report') return 'report';
  if (clean === '/review') return 'review';
  if (clean === '/insights') return 'insights';
  return 'home';
};

const tabToPath = (tab: string): string => {
  if (tab === 'vault') return '/vault';
  if (tab === 'submit') return '/submit';
  if (tab === 'report') return '/report';
  if (tab === 'review') return '/review';
  if (tab === 'insights') return '/insights';
  return '/';
};

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return pathToTab(window.location.pathname);
    }
    return 'home';
  });

  const [apiStatus, setApiStatus] = useState<ApiConnectionStatus>('waking');
  const [wakingElapsed, setWakingElapsed] = useState<number>(0);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [activeBrand, setActiveBrand] = useState<Brand | null>(null);

  // Persona persistence in shared localStorage across browser reloads
  const [userRole, setUserRole] = useState<UserRole>(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedRole = localStorage.getItem('brandgate_user_role');
        if (savedRole === 'reviewer' || savedRole === 'creator') {
          return savedRole;
        }
      } catch {}
    }
    return 'creator';
  });

  const handleRoleChange = (role: UserRole) => {
    setUserRole(role);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('brandgate_user_role', role);
      } catch {}
    }
  };

  // Restore draft state from shared localStorage across browser tabs & reloads
  const [activeDraft, setActiveDraft] = useState<Draft | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('brandgate_active_draft') || sessionStorage.getItem('brandgate_active_draft');
        return saved ? JSON.parse(saved) : null;
      } catch {
        return null;
      }
    }
    return null;
  });

  const [draftFindings, setDraftFindings] = useState<Finding[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('brandgate_draft_findings') || sessionStorage.getItem('brandgate_draft_findings');
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return [];
  });

  const [llmReviewResult, setLlmReviewResult] = useState<any | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('brandgate_llm_review') || sessionStorage.getItem('brandgate_llm_review');
        return saved ? JSON.parse(saved) : null;
      } catch {
        return null;
      }
    }
    return null;
  });

  const [isRestoringDraft, setIsRestoringDraft] = useState<boolean>(false);

  // Restore draft from backend on fresh tab / deep link (/report or /review)
  useEffect(() => {
    const restoreDraftFromBackend = async () => {
      if (typeof window === 'undefined') return;
      const savedDraftId = localStorage.getItem('brandgate_active_draft_id');
      if (!savedDraftId) return;

      if (!activeDraft) {
        setIsRestoringDraft(true);
        try {
          const fetchedDraft = await api.getDraft(savedDraftId);
          setActiveDraft(fetchedDraft);
          localStorage.setItem('brandgate_active_draft', JSON.stringify(fetchedDraft));

          if (fetchedDraft.status !== 'draft') {
            const reviewRes = await api.reviewDraft(fetchedDraft.id);
            setDraftFindings(reviewRes.findings || []);
            setLlmReviewResult(reviewRes.llm_review || null);
            localStorage.setItem('brandgate_draft_findings', JSON.stringify(reviewRes.findings || []));
            if (reviewRes.llm_review) {
              localStorage.setItem('brandgate_llm_review', JSON.stringify(reviewRes.llm_review));
            }
          }
        } catch (err) {
          console.warn('Could not restore draft from shared backend ID:', err);
          localStorage.removeItem('brandgate_active_draft_id');
          localStorage.removeItem('brandgate_active_draft');
        } finally {
          setIsRestoringDraft(false);
        }
      }
    };

    if (apiStatus === 'connected') {
      restoreDraftFromBackend();
    }
  }, [apiStatus]);

  // HTML5 History API popstate synchronization (Back / Forward buttons)
  useEffect(() => {
    const handlePopState = () => {
      const tab = pathToTab(window.location.pathname);
      setActiveTab(tab);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateToTab = (tab: string) => {
    setActiveTab(tab);
    const targetPath = tabToPath(tab);
    if (typeof window !== 'undefined' && window.location.pathname !== targetPath) {
      window.history.pushState({ tab }, '', targetPath);
    }
  };

  // Live elapsed timer for server waking / cold-start state
  useEffect(() => {
    let timer: any = null;
    if (apiStatus === 'waking') {
      timer = setInterval(() => {
        setWakingElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      setWakingElapsed(0);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [apiStatus]);

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
    setDraftFindings([]);
    setLlmReviewResult(null);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('brandgate_active_draft_id', draft.id);
        localStorage.setItem('brandgate_active_draft', JSON.stringify(draft));
        localStorage.removeItem('brandgate_draft_findings');
        localStorage.removeItem('brandgate_llm_review');
        sessionStorage.setItem('brandgate_active_draft', JSON.stringify(draft));
        sessionStorage.removeItem('brandgate_draft_findings');
        sessionStorage.removeItem('brandgate_llm_review');
      } catch {}
    }
    navigateToTab('submit');
  };

  const handleReviewCompleted = (draft: Draft, findings: Finding[], llmReview?: any) => {
    setActiveDraft(draft);
    setDraftFindings(findings);
    setLlmReviewResult(llmReview || null);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('brandgate_active_draft_id', draft.id);
        localStorage.setItem('brandgate_active_draft', JSON.stringify(draft));
        localStorage.setItem('brandgate_draft_findings', JSON.stringify(findings));
        if (llmReview) {
          localStorage.setItem('brandgate_llm_review', JSON.stringify(llmReview));
        } else {
          localStorage.removeItem('brandgate_llm_review');
        }
        sessionStorage.setItem('brandgate_active_draft', JSON.stringify(draft));
        sessionStorage.setItem('brandgate_draft_findings', JSON.stringify(findings));
        if (llmReview) {
          sessionStorage.setItem('brandgate_llm_review', JSON.stringify(llmReview));
        }
      } catch {}
    }
    navigateToTab('report');
  };

  const handleDraftUpdated = (draft: Draft, findings?: Finding[], llmReview?: any) => {
    setActiveDraft(draft);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('brandgate_active_draft_id', draft.id);
        localStorage.setItem('brandgate_active_draft', JSON.stringify(draft));
        sessionStorage.setItem('brandgate_active_draft', JSON.stringify(draft));
      } catch {}
    }
    if (findings) {
      setDraftFindings(findings);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('brandgate_draft_findings', JSON.stringify(findings));
          sessionStorage.setItem('brandgate_draft_findings', JSON.stringify(findings));
        } catch {}
      }
    }
    if (llmReview !== undefined) {
      setLlmReviewResult(llmReview);
      if (typeof window !== 'undefined') {
        try {
          if (llmReview) {
            localStorage.setItem('brandgate_llm_review', JSON.stringify(llmReview));
            sessionStorage.setItem('brandgate_llm_review', JSON.stringify(llmReview));
          } else {
            localStorage.removeItem('brandgate_llm_review');
            sessionStorage.removeItem('brandgate_llm_review');
          }
        } catch {}
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#080D12] text-[#F3F7FA] flex flex-col font-sans bg-grid-pattern relative selection:bg-teal-400 selection:text-black">
      {/* Ambient Radial Gradient Glow */}
      <div className="fixed inset-0 pointer-events-none bg-radial-gradient"></div>

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar
          activeTab={activeTab}
          setActiveTab={navigateToTab}
          apiStatus={apiStatus}
          userRole={userRole}
          setUserRole={handleRoleChange}
          currentUserEmail={currentUserEmail}
          onSignOut={handleSignOut}
          onRefreshHealth={initApp}
          wakingElapsed={wakingElapsed}
        />

        <main className="flex-1">
          {activeTab === 'home' && (
            <Home
              activeBrand={activeBrand}
              currentDraft={activeDraft}
              onDraftCreated={handleDraftCreated}
              onNavigateToVault={() => navigateToTab('vault')}
              apiStatus={apiStatus}
            />
          )}
          {activeTab === 'vault' && (
            <Vault activeBrand={activeBrand} currentUserEmail={currentUserEmail} />
          )}
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
              onNavigateToReview={() => navigateToTab('review')}
              onNavigateToSubmit={() => navigateToTab('submit')}
              apiStatus={apiStatus}
              isRestoringDraft={isRestoringDraft}
            />
          )}
          {activeTab === 'review' && (
            <Review
              draft={activeDraft}
              findings={draftFindings}
              userRole={userRole}
              onDraftUpdated={handleDraftUpdated}
              onRoleChange={handleRoleChange}
              isRestoringDraft={isRestoringDraft}
            />
          )}
          {activeTab === 'insights' && (
            <Insights activeBrand={activeBrand} />
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
