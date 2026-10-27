"""
Unit tests for Fix 1 (Approval Gating on Open Findings) & Fix 2 (Guest Vault Access Protection)
Classification: LOCAL ISOLATED UNIT TEST
Does NOT call live networks, does NOT mutate production databases, does NOT read secrets.
"""

import os
import sys
from unittest.mock import MagicMock, patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "backend")))

from fastapi import HTTPException
from main import approve_draft, ApproveDraftRequest, check_brand_access, DEMO_BRAND_ID

def test_approve_blocked_when_open_findings_remain():
    """Fix 1 & Fix 2 Gating (demo_reviewer): Attempting to approve draft with open findings returns 409 and creates NO snapshot"""
    mock_supabase = MagicMock()
    
    # Draft is pending_approval
    draft_data = {
        "id": "test-draft-123",
        "brand_id": DEMO_BRAND_ID,
        "status": "pending_approval",
        "current_version": 2,
        "body_text": "Unfixed draft text"
    }
    
    # Findings table returns 1 open finding
    open_findings = [
        {
            "id": "f-1",
            "draft_id": "test-draft-123",
            "version_no": 2,
            "lane": "evidence_needed",
            "citation_id": "R-04",
            "explanation": "Claim requires evidence"
        }
    ]
    
    mock_table = MagicMock()
    mock_supabase.table.return_value = mock_table
    
    # drafts query
    mock_drafts_select = MagicMock()
    mock_drafts_select.eq.return_value.execute.return_value.data = [draft_data]
    
    # findings query
    mock_findings_select = MagicMock()
    mock_findings_select.eq.return_value.eq.return_value.execute.return_value.data = open_findings
    
    mock_drafts_update = MagicMock()
    mock_decisions_insert = MagicMock()

    def table_router(table_name):
        mock_t = MagicMock()
        if table_name == "drafts":
            mock_t.select.return_value = mock_drafts_select
            mock_t.update.return_value = mock_drafts_update
        elif table_name == "findings":
            mock_t.select.return_value = mock_findings_select
        elif table_name == "decisions":
            mock_t.insert.return_value = mock_decisions_insert
        elif table_name == "vault_items":
            mock_t.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = []
        return mock_t
        
    mock_supabase.table.side_effect = table_router
    
    with patch("main.get_supabase", return_value=mock_supabase), \
         patch("main.get_authenticated_user", return_value=None):
        try:
            approve_draft("test-draft-123", ApproveDraftRequest(comment="Approve please"))
            assert False, "Should have raised HTTPException 409"
        except HTTPException as exc:
            assert exc.status_code == 409, f"Expected 409 Conflict, got {exc.status_code}"
            assert "Cannot approve: open findings remain" in exc.detail
            # Verify NO snapshot was created, drafts update was NOT called, decisions insert was NOT called
            mock_drafts_update.eq.return_value.execute.assert_not_called()
            mock_decisions_insert.execute.assert_not_called()
            print("PASS: demo_reviewer approval blocked with 409 when findings are open; NO snapshot created")

def test_approve_blocked_when_open_findings_remain_authenticated_reviewer():
    """Fix 1 & Fix 2 Gating (real reviewer): Attempting to approve draft with open findings returns 409 and creates NO snapshot"""
    mock_supabase = MagicMock()
    
    draft_data = {
        "id": "test-draft-789",
        "brand_id": DEMO_BRAND_ID,
        "status": "pending_approval",
        "current_version": 3,
        "body_text": "Diwali Dhamaka! trusted cookware brand — clinically proven non-stick — now for just Rs. 1,299!",
        "created_by_user_id": "creator-user-111"
    }
    
    open_findings = [
        {
            "id": "f-2",
            "draft_id": "test-draft-789",
            "version_no": 3,
            "lane": "evidence_needed",
            "citation_id": "R-04",
            "explanation": "Rank and performance superlatives require an approved evidence record."
        }
    ]
    
    mock_drafts_select = MagicMock()
    mock_drafts_select.eq.return_value.execute.return_value.data = [draft_data]
    
    mock_findings_select = MagicMock()
    mock_findings_select.eq.return_value.eq.return_value.execute.return_value.data = open_findings
    
    mock_drafts_update = MagicMock()
    mock_decisions_insert = MagicMock()

    def table_router(table_name):
        mock_t = MagicMock()
        if table_name == "drafts":
            mock_t.select.return_value = mock_drafts_select
            mock_t.update.return_value = mock_drafts_update
        elif table_name == "findings":
            mock_t.select.return_value = mock_findings_select
        elif table_name == "decisions":
            mock_t.insert.return_value = mock_decisions_insert
        elif table_name == "vault_items":
            mock_t.select.return_value.eq.return_value.eq.return_value.execute.return_value.data = []
        return mock_t
        
    mock_supabase.table.side_effect = table_router
    
    mock_reviewer_user = {"id": "reviewer-user-222", "role": "reviewer", "email": "reviewer@brandgate.test"}
    
    with patch("main.get_supabase", return_value=mock_supabase), \
         patch("main.get_authenticated_user", return_value=mock_reviewer_user):
        try:
            approve_draft("test-draft-789", ApproveDraftRequest(comment="Approve with open finding"))
            assert False, "Should have raised HTTPException 409"
        except HTTPException as exc:
            assert exc.status_code == 409, f"Expected 409 Conflict, got {exc.status_code}"
            assert "Cannot approve: open findings remain" in exc.detail
            # Verify NO snapshot was created, drafts update was NOT called, decisions insert was NOT called
            mock_drafts_update.eq.return_value.execute.assert_not_called()
            mock_decisions_insert.execute.assert_not_called()
            print("PASS: authenticated reviewer approval blocked with 409 when findings are open; NO snapshot created")

def test_approve_blocked_by_fresh_deterministic_claims_defense_in_depth():
    """Fix 2 Defense-in-depth: If findings table is empty but draft text has unaddressed claims, returns 409"""
    mock_supabase = MagicMock()
    
    # Draft text has "clinically proven non-stick" at v3
    draft_data = {
        "id": "test-draft-v3",
        "brand_id": DEMO_BRAND_ID,
        "status": "pending_approval",
        "current_version": 3,
        "body_text": "Diwali Dhamaka! trusted cookware brand — clinically proven non-stick — now for just Rs. 1,299!"
    }
    
    mock_drafts_select = MagicMock()
    mock_drafts_select.eq.return_value.execute.return_value.data = [draft_data]
    
    # Even if findings table returns empty (e.g. review wasn't run on this version in DB)
    mock_findings_select = MagicMock()
    mock_findings_select.eq.return_value.eq.return_value.execute.return_value.data = []
    
    active_vault_items = [
        {
            "brand_id": DEMO_BRAND_ID,
            "item_id": "R-04",
            "kind": "rule",
            "title": "Superlatives & Ranking Claims Require Approved Evidence",
            "text": "Rank and performance superlatives require an approved evidence record. Seeded vault has NO approved evidence records.",
            "status": "active"
        }
    ]
    
    mock_vault_select = MagicMock()
    mock_vault_select.eq.return_value.eq.return_value.execute.return_value.data = active_vault_items

    mock_drafts_update = MagicMock()
    mock_decisions_insert = MagicMock()

    def table_router(table_name):
        mock_t = MagicMock()
        if table_name == "drafts":
            mock_t.select.return_value = mock_drafts_select
            mock_t.update.return_value = mock_drafts_update
        elif table_name == "findings":
            mock_t.select.return_value = mock_findings_select
        elif table_name == "decisions":
            mock_t.insert.return_value = mock_decisions_insert
        elif table_name == "vault_items":
            mock_t.select.return_value = mock_vault_select
        return mock_t
        
    mock_supabase.table.side_effect = table_router
    
    with patch("main.get_supabase", return_value=mock_supabase), \
         patch("main.get_authenticated_user", return_value=None):
        try:
            approve_draft("test-draft-v3", ApproveDraftRequest(comment="Approve v3 with claim in body"))
            assert False, "Should have raised HTTPException 409 due to defense-in-depth deterministic review"
        except HTTPException as exc:
            assert exc.status_code == 409, f"Expected 409 Conflict, got {exc.status_code}"
            assert "Cannot approve: open findings remain" in exc.detail
            mock_drafts_update.eq.return_value.execute.assert_not_called()
            mock_decisions_insert.execute.assert_not_called()
            print("PASS: approve_draft blocked with 409 via defense-in-depth deterministic claim check")

def test_approve_succeeds_when_zero_findings_remain():
    """Fix 1 & Fix 2 Clean Path: Approving draft with 0 open findings succeeds with locked VERIFIED COMPLIANT snapshot"""
    mock_supabase = MagicMock()
    
    draft_data = {
        "id": "test-draft-456",
        "brand_id": DEMO_BRAND_ID,
        "status": "pending_approval",
        "current_version": 4,
        "body_text": "Diwali Dhamaka! trusted cookware brand — certified quality non-stick — now for just Rs. 1,299!"
    }
    
    mock_drafts_select = MagicMock()
    mock_drafts_select.eq.return_value.execute.return_value.data = [draft_data]
    
    # 0 findings open
    mock_findings_select = MagicMock()
    mock_findings_select.eq.return_value.eq.return_value.execute.return_value.data = []
    
    active_vault_items = [
        {
            "brand_id": DEMO_BRAND_ID,
            "item_id": "F-12",
            "kind": "fact",
            "title": "Festive Cookware Promotional Price",
            "text": "Festive cookware offer Rs. 1,299, effective 24-31 Oct 2026.",
            "status": "active"
        },
        {
            "brand_id": DEMO_BRAND_ID,
            "item_id": "R-04",
            "kind": "rule",
            "title": "Superlatives & Ranking Claims Require Approved Evidence",
            "text": "Rank and performance superlatives require an approved evidence record. Seeded vault has NO approved evidence records.",
            "status": "active"
        }
    ]
    mock_vault_select = MagicMock()
    mock_vault_select.eq.return_value.eq.return_value.execute.return_value.data = active_vault_items

    mock_drafts_update = MagicMock()
    mock_decisions_insert = MagicMock()

    def table_router(table_name):
        mock_t = MagicMock()
        if table_name == "drafts":
            mock_t.select.return_value = mock_drafts_select
            mock_t.update.return_value = mock_drafts_update
        elif table_name == "findings":
            mock_t.select.return_value = mock_findings_select
        elif table_name == "decisions":
            mock_t.insert.return_value = mock_decisions_insert
        elif table_name == "vault_items":
            mock_t.select.return_value = mock_vault_select
        return mock_t
        
    mock_supabase.table.side_effect = table_router
    
    with patch("main.get_supabase", return_value=mock_supabase), \
         patch("main.get_authenticated_user", return_value=None):
        res = approve_draft("test-draft-456", ApproveDraftRequest(comment="Approved for publication"))
        assert res["status"] == "approved"
        assert res["snapshot"]["locked"] is True
        assert res["snapshot"]["compliance_badge"] == "VERIFIED COMPLIANT"
        assert "vault-00000000" not in res["snapshot"]["vault_version"]
        assert "Demo Brand" in res["snapshot"]["vault_version"]
        mock_drafts_update.eq.return_value.execute.assert_called_once()
        mock_decisions_insert.execute.assert_called_once()
        print("PASS: approve_draft succeeds with locked snapshot when 0 findings remain")

def test_guest_vault_write_blocked_403():
    """Fix 2: Guest vault create/update/delete/reset attempts return 403 Forbidden"""
    try:
        check_brand_access(None, DEMO_BRAND_ID, write=True)
        assert False, "Should have raised HTTPException 403"
    except HTTPException as exc:
        assert exc.status_code == 403
        assert "read-only for guests" in exc.detail
        print("PASS: Guest vault write access returned HTTP 403")

def test_guest_non_demo_brand_access_blocked_403():
    """Fix 2: Guest access to non-demo brand returns 403 Forbidden"""
    try:
        check_brand_access(None, "other-brand-uuid-1234", write=False)
        assert False, "Should have raised HTTPException 403"
    except HTTPException as exc:
        assert exc.status_code == 403
        assert "restricted strictly to the seeded demo brand" in exc.detail
        print("PASS: Guest access to non-demo brand returned HTTP 403")

if __name__ == "__main__":
    print("=" * 60)
    print("RUNNING APPROVAL GATING & GUEST VAULT TEST SUITE")
    print("=" * 60)
    test_approve_blocked_when_open_findings_remain()
    test_approve_blocked_when_open_findings_remain_authenticated_reviewer()
    test_approve_blocked_by_fresh_deterministic_claims_defense_in_depth()
    test_approve_succeeds_when_zero_findings_remain()
    test_guest_vault_write_blocked_403()
    test_guest_non_demo_brand_access_blocked_403()
    print("=" * 60)
    print("ALL TESTS PASSED CLEANLY!")
    print("=" * 60)
