import os
import sys
from reportlab.lib.pagesizes import A4, landscape
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Image
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors

def build_pdf(output_path="docs/BrandGate_Final_Product.pdf"):
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    # 841.89 x 595.27 pt (A4 Landscape)
    PAGE_WIDTH = 841.89
    PAGE_HEIGHT = 595.27
    
    doc = SimpleDocTemplate(
        output_path,
        pagesize=landscape(A4),
        leftMargin=24,
        rightMargin=24,
        topMargin=28,
        bottomMargin=24,
    )
    
    USABLE_WIDTH = PAGE_WIDTH - 48  # 793.89 pt
    
    # Color palette
    BG_DARK = colors.HexColor("#080C16")
    CARD_BG = colors.HexColor("#0F172A")
    CARD_BG_ALT = colors.HexColor("#131E33")
    BORDER_COLOR = colors.HexColor("#1E293B")
    BORDER_ACCENT = colors.HexColor("#2DD4BF")
    TEXT_MAIN = colors.HexColor("#F8FAFC")
    TEXT_MUTED = colors.HexColor("#94A3B8")
    TEXT_TEAL = colors.HexColor("#2DD4BF")
    TEXT_CYAN = colors.HexColor("#38BDF8")
    TEXT_AMBER = colors.HexColor("#F59E0B")
    TEXT_ROSE = colors.HexColor("#F43F5E")
    
    def draw_background(canvas, document):
        canvas.saveState()
        # Full canvas dark background
        canvas.setFillColor(BG_DARK)
        canvas.rect(0, 0, PAGE_WIDTH, PAGE_HEIGHT, fill=1, stroke=0)
        
        # Top banner bar
        canvas.setFillColor(colors.HexColor("#0D1527"))
        canvas.rect(0, PAGE_HEIGHT - 22, PAGE_WIDTH, 22, fill=1, stroke=0)
        canvas.setStrokeColor(BORDER_COLOR)
        canvas.setLineWidth(0.75)
        canvas.line(0, PAGE_HEIGHT - 22, PAGE_WIDTH, PAGE_HEIGHT - 22)
        
        canvas.setFont("Helvetica-Bold", 8)
        canvas.setFillColor(TEXT_TEAL)
        canvas.drawString(24, PAGE_HEIGHT - 15, "BRANDGATE")
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(TEXT_MUTED)
        canvas.drawString(90, PAGE_HEIGHT - 15, "|   PRE-PUBLICATION BRAND GOVERNANCE PLATFORM")
        
        page_num = document.page
        canvas.drawRightString(PAGE_WIDTH - 24, PAGE_HEIGHT - 15, f"CODEX 48 FINAL PRODUCT DECK  •  SLIDE {page_num} OF 8")
        
        # Bottom footer bar
        canvas.setFillColor(colors.HexColor("#0D1527"))
        canvas.rect(0, 0, PAGE_WIDTH, 18, fill=1, stroke=0)
        canvas.line(0, 18, PAGE_WIDTH, 18)
        
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(colors.HexColor("#64748B"))
        canvas.drawString(24, 5.5, "Live App: brand-gate-rho.vercel.app   •   API: brandgate-codex-48.onrender.com   •   Repo: github.com/manthansingh26/BrandGate-Codex-48 (059aedce)")
        canvas.drawRightString(PAGE_WIDTH - 24, 5.5, "Team: STRAW HAT PIRATE (Solo)   •   Leader: Manthan Shravansingh Rajpurohit")
        canvas.restoreState()

    # Typography styles
    styles = {
        'deck_title': ParagraphStyle('DeckTitle', fontName='Helvetica-Bold', fontSize=17, leading=20, textColor=TEXT_MAIN),
        'deck_sub': ParagraphStyle('DeckSub', fontName='Helvetica', fontSize=8.5, leading=11, textColor=TEXT_MUTED),
        'card_header': ParagraphStyle('CardH', fontName='Helvetica-Bold', fontSize=9.5, leading=12, textColor=TEXT_TEAL),
        'card_header_cyan': ParagraphStyle('CardHCyan', fontName='Helvetica-Bold', fontSize=9.5, leading=12, textColor=TEXT_CYAN),
        'card_header_amber': ParagraphStyle('CardHAmber', fontName='Helvetica-Bold', fontSize=9.5, leading=12, textColor=TEXT_AMBER),
        'card_header_rose': ParagraphStyle('CardHRose', fontName='Helvetica-Bold', fontSize=9.5, leading=12, textColor=TEXT_ROSE),
        'card_body': ParagraphStyle('CardB', fontName='Helvetica', fontSize=8, leading=10.5, textColor=TEXT_MAIN),
        'card_body_muted': ParagraphStyle('CardBMuted', fontName='Helvetica', fontSize=7, leading=9, textColor=TEXT_MUTED),
        'code_snippet': ParagraphStyle('CodeSnip', fontName='Courier', fontSize=7, leading=9, textColor=TEXT_TEAL),
        'step_num': ParagraphStyle('StepNum', fontName='Helvetica-Bold', fontSize=10, leading=12, textColor=TEXT_TEAL),
    }

    def make_card(content_elements, bg_color=CARD_BG, border_color=BORDER_COLOR, padding=5, width=None):
        table_data = [[elem] for elem in content_elements]
        col_widths = [width] if width else None
        t = Table(table_data, colWidths=col_widths)
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,-1), bg_color),
            ('BOX', (0,0), (-1,-1), 0.75, border_color),
            ('TOPPADDING', (0,0), (-1,-1), padding),
            ('BOTTOMPADDING', (0,0), (-1,-1), padding),
            ('LEFTPADDING', (0,0), (-1,-1), padding + 2),
            ('RIGHTPADDING', (0,0), (-1,-1), padding + 2),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ]))
        return t

    def make_row(cells, col_widths, padding=0):
        t = Table([cells], colWidths=col_widths)
        t.setStyle(TableStyle([
            ('LEFTPADDING', (0,0), (-1,-1), padding),
            ('RIGHTPADDING', (0,0), (-1,-1), padding),
            ('TOPPADDING', (0,0), (-1,-1), 0),
            ('BOTTOMPADDING', (0,0), (-1,-1), 0),
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ]))
        return t

    story = []

    # =========================================================================
    # SLIDE 1: Cover & Product Thesis + "No citation, no flag."
    # =========================================================================
    story.append(Paragraph("BrandGate — Intelligent Brand Governance Platform", styles['deck_title']))
    story.append(Paragraph("The automated pre-publication gate every marketing post must pass before it reaches customers.", styles['deck_sub']))
    story.append(Spacer(1, 6))

    c1 = make_card([
        Paragraph("CORE GUARANTEE", styles['card_header']),
        Paragraph("<b>&ldquo;No citation, no flag.&rdquo;</b>", styles['deck_title']),
        Paragraph("A finding with no valid vault citation ID must <b>NEVER</b> be shown. Every flag is strictly grounded in an active brand-vault record. If a promotional claim cannot be tied to an explicit rule or verified fact, zero violation is raised. Zero hallucinations, zero ungrounded rejections.", styles['card_body']),
        Spacer(1, 3),
        Paragraph("<b>Dual-Persona Security & Velocity:</b><br/>• <b>Creators:</b> Instant inline feedback & 1-click remediation without creative friction.<br/>• <b>Reviewers:</b> Strict 403 author-approver separation, immutable audit logs, locked snapshots.", styles['card_body_muted'])
    ], bg_color=CARD_BG_ALT, border_color=BORDER_ACCENT, padding=8, width=382)

    c2 = make_card([
        Paragraph("LIVE DEPLOYMENT & TEAM METADATA", styles['card_header_cyan']),
        Paragraph("• <b>Live App (Judge Link):</b> https://brand-gate-rho.vercel.app/<br/>• <b>Backend API:</b> https://brandgate-codex-48.onrender.com (Render FastAPI)<br/>• <b>GitHub Repo:</b> github.com/manthansingh26/BrandGate-Codex-48<br/>• <b>Git Head:</b> 37 commits, current <b>059aedce</b> (Verified 2026-11-02)<br/>• <b>Team:</b> SOLO team <b>STRAW HAT PIRATE</b> | Leader: <b>Manthan Shravansingh Rajpurohit</b><br/>• <b>Access:</b> Zero sign-in wall — complete evaluation accessible in Guest Demo mode.", styles['card_body']),
        Spacer(1, 2),
        Paragraph("<b>Design Philosophy:</b> Dark Space Navy theme (#05070E), Linear/Stripe Bento grid layout, WCAG AA contrast validation, zero-login guest evaluation.", styles['card_body_muted'])
    ], padding=6, width=382)

    left_col = Table([[c1], [Spacer(1, 4)], [c2]], colWidths=[382])
    left_col.setStyle(TableStyle([
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
    ]))

    hero_img = Image("docs/screenshots/01-home-hero.png", width=388, height=218)
    img_card = make_card([
        Paragraph("LIVE PRODUCTION INTERFACE (ZERO SIGN-IN GUEST DEMO)", styles['card_header']),
        hero_img,
        Paragraph("Live hero interface at brand-gate-rho.vercel.app — featuring seeded demo brand switcher, API health status, and 1-click demo draft kickoff.", styles['card_body_muted'])
    ], padding=5, width=394)

    story.append(make_row([left_col, img_card], [392, 396]))
    story.append(PageBreak())

    # =========================================================================
    # SLIDE 2: Judge Path in 60 Seconds (Numbered Visual Flow)
    # =========================================================================
    story.append(Paragraph("Judge Path in 60 Seconds — Numbered Visual Workflow", styles['deck_title']))
    story.append(Paragraph("Zero sign-in evaluation journey: from raw festive promotional copy to an immutable approved compliance snapshot.", styles['deck_sub']))
    story.append(Spacer(1, 5))

    steps_r1 = [
        make_card([
            Paragraph("STEP 1: KICK OFF", styles['step_num']),
            Paragraph("<b>Try Demo Draft</b>", styles['card_body']),
            Paragraph("On hero, click primary teal button. Seeds Brand A cookware draft: <i>&ldquo;Diwali Dhamaka! India's No. 1 cookware brand... Rs. 999!&rdquo;</i>", styles['card_body_muted'])
        ], width=188),
        make_card([
            Paragraph("STEP 2: REVIEW", styles['step_num']),
            Paragraph("<b>Deterministic Engine</b>", styles['card_body']),
            Paragraph("Click <b>Review Draft</b>. Deterministic regex & vault engine executes with secondary Gemini advisory validation.", styles['card_body_muted'])
        ], width=188),
        make_card([
            Paragraph("STEP 3: INSPECT", styles['step_num']),
            Paragraph("<b>1x F-12 + 2x R-04</b>", styles['card_body']),
            Paragraph("Flags Rs. 999 vs Rs. 1,299 (F-12 Contradiction) and 'No. 1' / 'clinically proven' (R-04 Evidence Needed). <b>0 uncited</b>.", styles['card_body_muted'])
        ], width=188),
        make_card([
            Paragraph("STEP 4: APPLY FIX", styles['step_num']),
            Paragraph("<b>1-Click Remediation</b>", styles['card_body']),
            Paragraph("Click Apply Fix for each flag. Updates text cleanly to locked final text: <i>&ldquo;...trusted cookware brand... Rs. 1,299!&rdquo;</i>", styles['card_body_muted'])
        ], width=188),
    ]

    steps_r2 = [
        make_card([
            Paragraph("STEP 5: PENDING", styles['step_num']),
            Paragraph("<b>Pending Review State</b>", styles['card_body']),
            Paragraph("Version 4 generated in <b>Pending Review</b>. System never prematurely displays 'Clear to Publish' before review.", styles['card_body_muted'])
        ], width=188),
        make_card([
            Paragraph("STEP 6: REQUEST", styles['step_num']),
            Paragraph("<b>Request Approval</b>", styles['card_body']),
            Paragraph("Switch to Review tab. Creator requests approval. Status advances to <code>pending_approval</code> server-side.", styles['card_body_muted'])
        ], width=188),
        make_card([
            Paragraph("STEP 7: TOGGLE", styles['step_num']),
            Paragraph("<b>Reviewer Approval</b>", styles['card_body']),
            Paragraph("Toggle role to Reviewer in navbar. Click Approve Draft. Creator self-approval strictly blocked with <b>HTTP 403</b>.", styles['card_body_muted'])
        ], width=188),
        make_card([
            Paragraph("STEP 8: LOCKED", styles['step_num']),
            Paragraph("<b>Approved Snapshot</b>", styles['card_body']),
            Paragraph("<b>LOCKED APPROVED SNAPSHOT</b> card appears with <b>VERIFIED COMPLIANT</b>, approver role (demo_reviewer), and audit trail.", styles['card_body_muted'])
        ], width=188),
    ]

    story.append(make_row(steps_r1, [196, 196, 196, 196]))
    story.append(Spacer(1, 4))
    story.append(make_row(steps_r2, [196, 196, 196, 196]))
    story.append(Spacer(1, 4))

    r_img = Image("docs/screenshots/04-report-v1-findings.png", width=380, height=128)
    a_img = Image("docs/screenshots/05-review-locked.jpg", width=380, height=128)
    c_left = make_card([Paragraph("INITIAL GOVERNANCE REPORT (1x F-12 + 2x R-04)", styles['card_header']), r_img], width=386)
    c_right = make_card([Paragraph("LOCKED APPROVED SNAPSHOT (VERIFIED COMPLIANT)", styles['card_header_cyan']), a_img], width=386)
    story.append(make_row([c_left, c_right], [394, 394]))
    story.append(PageBreak())

    # =========================================================================
    # SLIDE 3: Three Locked Round 3 Improvements (Built & Live-Verified)
    # =========================================================================
    story.append(Paragraph("Three Locked Round 3 Improvements (Built & Live-Verified)", styles['deck_title']))
    story.append(Paragraph("All three improvements implemented, tested, and verified live on production in official required sequence.", styles['deck_sub']))
    story.append(Spacer(1, 5))

    imp1 = make_card([
        Paragraph("1. MULTI-BRAND WORKSPACES", styles['card_header']),
        Paragraph("<b>Tenant-Scoped Isolation Across Drafts & Vaults</b>", styles['card_body']),
        Paragraph("• <b>Brand A (Demo Brand Cookware):</b> 12 Vault Items (F-12, A-02, R-04, R-09, T-01..T-04, P-01 #1E3A8A, P-02 #D97706, P-03 #F8FAFC, P-04 #0F172A).<br/>• <b>Brand B (NovaTech Audio):</b> 5 Vault Items (F-20 Rs. 4,999, R-15, T-10 'world best', P-10 #06B6D4, P-11 #0B0F19).<br/>• Zero cross-brand citation leakage: Brand B review (F-20, R-15) never cites Brand A cookware items.<br/>• <b>How Judge Tests Live:</b> Click top-left workspace selector or homepage workspace pills to switch between Demo Brand and NovaTech Audio — inspect independent forms, vaults, and rules.", styles['card_body_muted'])
    ], width=252)

    imp2 = make_card([
        Paragraph("2. DOCX / PDF EXTRACTION", styles['card_header_cyan']),
        Paragraph("<b>Document Governance with Page Badges & 10MB Limit</b>", styles['card_body']),
        Paragraph("• <b>Order Preservation:</b> DOCX parser extracts paragraphs and tables in true document body order.<br/>• <b>Multi-Page Page Badges:</b> PDF text extracted with exact page attribution — findings surface <code>Page 1</code> vs <code>Page 2</code> badges directly on finding cards.<br/>• <b>Honest Scanned-PDF Limit:</b> Scanned PDFs without text layers explicitly report no OCR support — zero fake passes or synthetic hallucinations.<br/>• <b>How Judge Tests Live:</b> On Submit tab, upload DOCX or multi-page PDF up to 10MB to see document text and Page N badges; test scanned PDF for honest limit notice.", styles['card_body_muted'])
    ], width=252)

    imp3 = make_card([
        Paragraph("3. INSIGHTS V2 & HARDENED IMAGES", styles['card_header_amber']),
        Paragraph("<b>PostgreSQL Aggregation & Robust Visual Governance</b>", styles['card_body']),
        Paragraph("• <b>Grounded Insights v2:</b> Aggregated database metrics per brand with directional trend (IMPROVING/WORSENING) and fix-first directives. All counts are cumulative across history.<br/>• <b>Approximate Palette Sampling:</b> Image color sampling explicitly labeled 'Approximate', generating advisory Human Decision findings (never Contradiction).<br/>• <b>Reviewer-Only Logo (A-02):</b> Logo verification strictly requires reviewer confirmation — no fake CV.<br/>• <b>How Judge Tests Live:</b> Open Insights tab to inspect live metrics; attach image on Submit to test Approximate palette sampling.", styles['card_body_muted'])
    ], width=252)

    story.append(make_row([imp1, imp2, imp3], [261, 261, 261]))
    story.append(Spacer(1, 5))

    hardening_card = make_card([
        Paragraph("PLUS LIVE-VERIFIED RELIABILITY & LAYOUT HARDENING", styles['card_header']),
        Paragraph("• <b>Brand-Switch Restoration:</b> Never blank, never requires page reload — switching brands instantly restores the cached latest draft and current-version findings with zero blank renders.<br/>• <b>Pending Review Interim:</b> Applying fixes creates new draft version strictly marked <i>'Pending Review'</i> — never prematurely labeled 'Clear to Publish' before review.<br/>• <b>DOCX Reliability:</b> 0 <i>'Failed to fetch draft'</i> errors across consecutive reviews with document parsing resilience and retry guards.<br/>• <b>Single-Row Homepage Pills & Viewport-Safe Navbar Dropdown:</b> Single-row layout on desktop (w-fit, flex-nowrap) with center-aligned mobile wrap; navbar brand dropdown permanently anchored to trigger left edge with viewport bounds clamp.", styles['card_body'])
    ], bg_color=CARD_BG_ALT, border_color=BORDER_ACCENT, padding=6, width=780)
    story.append(hardening_card)
    story.append(PageBreak())

    # =========================================================================
    # SLIDE 4: Complete Features List & Governance Matrix
    # =========================================================================
    story.append(Paragraph("Complete Features List & Capabilities Matrix", styles['deck_title']))
    story.append(Paragraph("End-to-end brand protection across advertising copy, document attachments, creative assets, and sign-off workflows.", styles['deck_sub']))
    story.append(Spacer(1, 5))

    f1 = make_card([
        Paragraph("BRAND VAULT TRUTH ENGINE", styles['card_header']),
        Paragraph("Centralized truth repository grouping approved facts (F-12, F-20), mandatory negative rules (R-04, R-15), approved terminology (T-01..T-04), and brand color palettes (P-01..P-11).", styles['card_body_muted'])
    ], width=252)
    f2 = make_card([
        Paragraph("DETERMINISTIC REVIEW GATE", styles['card_header']),
        Paragraph("Authoritative primary server gate executing regex pricing reconciliation, superlative evidence checks, alt-text accessibility, and WCAG contrast validation.", styles['card_body_muted'])
    ], width=252)
    f3 = make_card([
        Paragraph("GROUNDED GEMINI ADVISORY", styles['card_header']),
        Paragraph("Secondary compliance suggestions powered by Google Gemini (temperature 0.2), strictly bounded by retrieved vault items via keyword fallback and validated by citation validator.", styles['card_body_muted'])
    ], width=252)

    f4 = make_card([
        Paragraph("ONE-CLICK REMEDIATION", styles['card_header_cyan']),
        Paragraph("Constructive fixes replacing prohibited superlatives with approved brand terminology (T-04 'trusted cookware brand', T-03 'certified quality') and approved pricing.", styles['card_body_muted'])
    ], width=252)
    f5 = make_card([
        Paragraph("SERVER APPROVAL STATE MACHINE", styles['card_header_cyan']),
        Paragraph("Server-enforced status transitions: draft ➔ checked ➔ pending_approval ➔ approved. Blocks creator self-approval (403), halts on open findings, resets to draft on edit.", styles['card_body_muted'])
    ], width=252)
    f6 = make_card([
        Paragraph("DOCUMENT & MULTI-PAGE GOVERNANCE", styles['card_header_cyan']),
        Paragraph("Upload DOCX and multi-page PDFs up to 10MB. Findings surface exact Page N badges; unextractable assets flag 'Could not sample — human decision' with no fake pass.", styles['card_body_muted'])
    ], width=252)

    story.append(make_row([f1, f2, f3], [261, 261, 261]))
    story.append(Spacer(1, 4))
    story.append(make_row([f4, f5, f6], [261, 261, 261]))
    story.append(Spacer(1, 4))

    gov_data = [
        [Paragraph("<b>Governance Dimension</b>", styles['card_header']), Paragraph("<b>Creator Experience</b>", styles['card_header']), Paragraph("<b>Reviewer / Compliance Role</b>", styles['card_header']), Paragraph("<b>System / Safety Guarantee</b>", styles['card_header'])],
        [Paragraph("<b>Promotional Pricing</b>", styles['card_body']), Paragraph("Instant inline flag with 1-click update to F-12 (Rs. 1,299)", styles['card_body_muted']), Paragraph("Verified against active approved promotion facts", styles['card_body_muted']), Paragraph("Deterministic regex pricing reconciliation", styles['code_snippet'])],
        [Paragraph("<b>Superlatives & Claims</b>", styles['card_body']), Paragraph("Constructive replacements (e.g. 'trusted', 'certified quality')", styles['card_body_muted']), Paragraph("Evidence-needed lane — superlatives held until clinical proof", styles['card_body_muted']), Paragraph("Rule R-04 / R-15 grounded claim engine", styles['code_snippet'])],
        [Paragraph("<b>Color Palette & Images</b>", styles['card_body']), Paragraph("Palette check labeled 'Approximate'; alt-text reminder (R-09)", styles['card_body_muted']), Paragraph("Reviewer confirmation required for logo placement (A-02)", styles['card_body_muted']), Paragraph("WCAG AA contrast & approximate palette math", styles['code_snippet'])],
        [Paragraph("<b>Sign-off & Publishing</b>", styles['card_body']), Paragraph("Request Approval button; self-approval strictly prevented", styles['card_body_muted']), Paragraph("Approve Draft button produces LOCKED APPROVED SNAPSHOT", styles['card_body_muted']), Paragraph("HTTP 403 enforcement & version immutability", styles['code_snippet'])],
    ]
    gov_table = Table(gov_data, colWidths=[130, 215, 215, 220])
    gov_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#0D1527")),
        ('BACKGROUND', (0,1), (-1,-1), CARD_BG),
        ('BOX', (0,0), (-1,-1), 0.75, BORDER_COLOR),
        ('INNERGRID', (0,0), (-1,-1), 0.5, BORDER_COLOR),
        ('TOPPADDING', (0,0), (-1,-1), 3),
        ('BOTTOMPADDING', (0,0), (-1,-1), 3),
        ('LEFTPADDING', (0,0), (-1,-1), 6),
        ('RIGHTPADDING', (0,0), (-1,-1), 6),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
    ]))
    story.append(gov_table)
    story.append(PageBreak())

    # =========================================================================
    # SLIDE 5: Technical Architecture & System Flow (Diagrammatic)
    # =========================================================================
    story.append(Paragraph("Technical Architecture & Implementation Summary", styles['deck_title']))
    story.append(Paragraph("Dual-deployment monorepo: React 18 + Vite on Vercel CDN, FastAPI on Render, Supabase PostgreSQL with fail-closed safety.", styles['deck_sub']))
    story.append(Spacer(1, 5))

    arch_flow = make_card([
        Paragraph("SYSTEM ARCHITECTURE & EXECUTION TOPOLOGY", styles['card_header']),
        Paragraph("""
<b>[ CLIENT LAYER — VERCEL CDN ]</b> React 18 + TypeScript + Vite + Tailwind CSS | Zero-Login Guest Demo Mode | WCAG 2.1 AA Contrast Tools
           │
           ▼ HTTPS / REST (CORS Allowed: localhost, brand-gate-rho.vercel.app)
<b>[ API GATEWAY & BUSINESS LAYER — RENDER WEB SERVICE ]</b> Python 3.11 + FastAPI + Uvicorn | 70s Health Timeout & 90s Retry Cadence
           │
           ├───────────────────────────────────────────────┬───────────────────────────────────────────────┐
           ▼                                               ▼                                               ▼
<b>[ DETERMINISTIC SAFETY GATE ]</b>                 <b>[ SECONDARY AI ADVISORY ]</b>                       <b>[ PERSISTENCE LAYER — SUPABASE ]</b>
• Regex Pricing Reconciliation (F-12, F-20)       • Google Gemini Advisory Model                  • PostgreSQL 15 + pgvector
• Superlative Grounding Engine (R-04, R-15)       • Retrieval-Only Prompt (temperature 0.2)       • Row Level Security (RLS)
• Document Order Parser (DOCX & PDF 10MB)         • Grounded in Retrieved Vault Records           • Drafts, Versions, Findings, Snapshots
• Color Palette Sampling & WCAG Contrast          • Strict Citation Validator Verification        • Storage Bucket: brandgate-creatives
• Author-Reviewer Gate (HTTP 403 on Self-Approve) • Fail-Safe: Timeout never halts gate          • Version-Scoped Queries: (draft_id, version_no)
        """, styles['code_snippet'])
    ], padding=6, width=780)
    story.append(arch_flow)
    story.append(Spacer(1, 5))

    s5_c1 = make_card([
        Paragraph("FAIL-CLOSED SECURITY", styles['card_header']),
        Paragraph("Approval re-checks active vault rules deterministically before writing snapshot. If vault retrieval fails, approval halts immediately (HTTP 503/409). Creator self-approval is blocked on backend with HTTP 403.", styles['card_body_muted'])
    ], width=252)
    s5_c2 = make_card([
        Paragraph("VERSION-SCOPED DATA ACCESS", styles['card_header_cyan']),
        Paragraph("Every findings query is strictly scoped to <code>(draft_id, version_no)</code>. Stale historical findings never leak into new versions or cause sticky flags after remediation.", styles['card_body_muted'])
    ], width=252)
    s5_c3 = make_card([
        Paragraph("COLD-START RESILIENCE", styles['card_header_amber']),
        Paragraph("Accommodates Render free-tier container spin-up (~45s) via 70s health check timeout, 90s retry window, live <code>waking</code> state feedback, and in-place user Retry buttons.", styles['card_body_muted'])
    ], width=252)

    story.append(make_row([s5_c1, s5_c2, s5_c3], [261, 261, 261]))
    story.append(PageBreak())

    # =========================================================================
    # SLIDE 6: Testing Verification & Live Database Insights
    # =========================================================================
    story.append(Paragraph("Testing Verification & Real Database Insights", styles['deck_title']))
    story.append(Paragraph("100% verified local automated test suites paired with live production PostgreSQL cumulative analytics.", styles['deck_sub']))
    story.append(Spacer(1, 5))

    test_suites_card = make_card([
        Paragraph("LOCAL AUTOMATED TEST SUITES (100% PASSING)", styles['card_header']),
        Paragraph("""
• <b>Phase 4 Hardening</b> (<code>tests/test_phase4_hardening.py</code>): <b>10 / 10 passed</b>
• <b>Brand-Switch Restoration</b> (<code>tests/test_brand_switch_restoration.py</code>): <b>6 / 6 passed</b>
• <b>Phase 4.2 Hardening Suite</b> (<code>tests/test_phase4_2_all.py</code>): <b>5 / 5 passed</b>
• <b>Document Governance Suite</b> (<code>tests/test_document_governance.py</code>): <b>8 / 8 passed</b>
• <b>Homepage Workspace Selector</b> (<code>tests/test_homepage_workspace_selector.tsx</code>): <b>4 / 4 passed</b>
• <b>Navbar Dropdown Clipping</b> (<code>tests/test_navbar_dropdown_clipping.tsx</code>): <b>3 / 3 passed</b>
• <b>Frontend Production Build</b> (<code>cd frontend && npm run build</code>): <b>0 errors (1.98s)</b>
        """, styles['card_body']),
        Spacer(1, 2),
        Paragraph("<b>Live Production Verification Log:</b><br/>• <b>2026-11-01 23:21 IST:</b> FULL JUDGE GO (PASS) — Full judge path verified live on Vercel.<br/>• <b>2026-11-02 00:29 IST:</b> Dropdown Left Clipping (FAIL) — Observed live, reproduced & fixed.<br/>• <b>2026-11-02 01:30 IST:</b> FULL JUDGE GO (PASS) — Post-fix end-to-end judge path verified live.<br/><i>*Note: Mobile 360px and 120% zoom verified via automated layout geometry, not physical browser.</i>", styles['card_body_muted'])
    ], width=382)

    insights_card = make_card([
        Paragraph("POSTGRESQL DATABASE INSIGHTS (LATEST VERIFIED SET)", styles['card_header_cyan']),
        Paragraph("<b>Cumulative Aggregates Across Full Evaluation History (Oct 2026 – Present)</b>", styles['card_body']),
        Paragraph("""
<b>Demo Brand (Seeded)</b> [Captured: <b>2026-11-01 19:59:46 UTC</b>]:
• Cumulative Drafts: <b>312</b>  |  Total Flags: <b>990</b>
• Top Repeat Violation: <b>R-04</b> (571 occurrences)
• Directional Trend: <b>IMPROVING</b>
• Dispositions: <b>162</b> Clear to Publish  |  <b>33</b> Clear with Edits  |  <b>116</b> Hold for Legal

<b>NovaTech Audio (Demo)</b> [Captured: <b>2026-11-01 19:56:15 UTC</b>]:
• Cumulative Drafts: <b>69</b>  |  Total Flags: <b>212</b>
• Top Repeat Violation: <b>R-15</b> (139 occurrences)
• Directional Trend: <b>WORSENING</b>
• Dispositions: <b>9</b> Clear to Publish  |  <b>1</b> Clear with Edits  |  <b>59</b> Hold for Legal
        """, styles['card_body']),
        Spacer(1, 2),
        Paragraph("<b>Complete Multi-Brand Isolation:</b> Switching brand selector instantly updates metrics with zero cross-brand contamination. All numbers represent real database rows — zero synthetic or fabricated values.", styles['card_body_muted'])
    ], width=386)

    story.append(make_row([test_suites_card, insights_card], [392, 396]))
    story.append(Spacer(1, 4))

    ins_img = Image("docs/screenshots/08-insights-total.png", width=776, height=135)
    story.append(make_card([
        Paragraph("LIVE POSTGRESQL GOVERNANCE INSIGHTS DASHBOARD", styles['card_header']),
        ins_img
    ], padding=3, width=780))
    story.append(PageBreak())

    # =========================================================================
    # SLIDE 7: Roadmap & Future Plan (Proposals)
    # =========================================================================
    story.append(Paragraph("Product Roadmap & Future Plan (Post-Codex Proposals)", styles['deck_title']))
    story.append(Paragraph("Strategic architecture enhancements proposed for enterprise rollout beyond the official hackathon release.", styles['deck_sub']))
    story.append(Spacer(1, 6))

    r1 = make_card([
        Paragraph("PROPOSAL 1: OCR ENGINE FOR SCANNED DOCUMENTS", styles['card_header']),
        Paragraph("<b>Tesseract / AWS Textract Pipeline for Scanned Media</b>", styles['card_body']),
        Paragraph("• Ingest scanned PDF print advertisements, flyers, and photographed packaging labels.<br/>• Multi-engine text extraction with confidence scoring to prevent OCR noise from triggering false compliance flags.<br/>• Bounding-box visualization highlighting the exact physical location of pricing or claim violations on the print proof.", styles['card_body_muted'])
    ], width=382)

    r2 = make_card([
        Paragraph("PROPOSAL 2: FIGMA & DESIGN TOKEN SYNC", styles['card_header_cyan']),
        Paragraph("<b>Automated Vault Synchronization with Brand Systems</b>", styles['card_body']),
        Paragraph("• Direct bi-directional integration with Figma Design Tokens and Notion/Confluence brand guidelines.<br/>• Rule updates in the brand book automatically propagate into BrandGate Vault facts, rules, and palettes.<br/>• Webhook notifications alerting compliance reviewers whenever a marketing team updates promotional pricing.", styles['card_body_muted'])
    ], width=382)

    r3 = make_card([
        Paragraph("PROPOSAL 3: HEADLESS GOVERNANCE API & CI/CD GATE", styles['card_header_amber']),
        Paragraph("<b>Pre-Commit Compliance Checks for Marketing Repositories</b>", styles['card_body']),
        Paragraph("• GitHub Actions & GitLab CI integrations to validate CMS copy, markdown articles, and banner assets in PRs.<br/>• Figma Plugin providing real-time inline compliance feedback directly within designer canvas.<br/>• Programmatic approval token webhooks triggering automated social media publishing upon snapshot sign-off.", styles['card_body_muted'])
    ], width=382)

    r4 = make_card([
        Paragraph("PROPOSAL 4: ENTERPRISE MULTI-TENANT SSO & RBAC", styles['card_header_rose']),
        Paragraph("<b>SAML 2.0 / Okta Integration & Organizational Tenancy</b>", styles['card_body']),
        Paragraph("• Enterprise single sign-on (SSO) with Okta, Azure AD, and Google Workspace.<br/>• Granular role-based permissions: Creator, Copy Editor, Legal Reviewer, Agency Contributor, Compliance Officer.<br/>• Complete tenant data isolation with customer-managed encryption keys (CMEK) and audit export compliance.", styles['card_body_muted'])
    ], width=382)

    story.append(make_row([r1, r2], [392, 396]))
    story.append(Spacer(1, 5))
    story.append(make_row([r3, r4], [392, 396]))
    story.append(PageBreak())

    # =========================================================================
    # SLIDE 8: Honest Limitations & System Disclosures
    # =========================================================================
    story.append(Paragraph("Honest Limitations & System Disclosures", styles['deck_title']))
    story.append(Paragraph("Transparent disclosure of operational boundaries, trade-offs, and verification scope across the platform.", styles['deck_sub']))
    story.append(Spacer(1, 5))

    l1 = make_card([
        Paragraph("1. SCANNED PDF INGESTION (NO OCR)", styles['card_header_rose']),
        Paragraph("Evaluates digital text layers only. Scanned image PDFs without embedded text layers cannot be evaluated for text; Optical Character Recognition (OCR) is not performed and synthetic text is never fabricated.", styles['card_body_muted'])
    ], width=382)
    l2 = make_card([
        Paragraph("2. APPROXIMATE PALETTE SAMPLING", styles['card_header_amber']),
        Paragraph("Image color sampling math is explicitly labeled 'Approximate'; rule P-01 produces advisory Human Decision even on on-palette images to prevent automated false rejections.", styles['card_body_muted'])
    ], width=382)

    l3 = make_card([
        Paragraph("3. REVIEWER-CONFIRMED LOGO (A-02)", styles['card_header_cyan']),
        Paragraph("Automated computer-vision logo recognition is never claimed. Rule A-02 strictly requires manual reviewer confirmation to prevent deceptive logo approvals.", styles['card_body_muted'])
    ], width=382)
    l4 = make_card([
        Paragraph("4. DETERMINISTIC GATE AUTHORITY", styles['card_header']),
        Paragraph("Google Gemini advisory suggestions can time out under free-tier latency; the deterministic engine remains the primary authoritative gate, failing gracefully to labeled status without halting review.", styles['card_body_muted'])
    ], width=382)

    l5 = make_card([
        Paragraph("5. RENDER FREE-TIER COLD STARTS", styles['card_header_rose']),
        Paragraph("Backend services sleep after 15 min idle; initial container spin-up takes ~45 seconds. Handled gracefully with live 'waking' UI feedback and automatic retry cadence.", styles['card_body_muted'])
    ], width=382)
    l6 = make_card([
        Paragraph("6. TRANSIENT INSIGHTS LATENCY", styles['card_header_amber']),
        Paragraph("PostgreSQL newest row can be transiently stale under burst concurrent writes; refreshing or waiting a few seconds settles the aggregation counts.", styles['card_body_muted'])
    ], width=382)

    l7 = make_card([
        Paragraph("7. BRAND-SWITCH UI SETTLEMENT", styles['card_header_cyan']),
        Paragraph("Switching brand workspaces can occasionally lag by one observation cycle before UI state fully settles to the active brand's cached version.", styles['card_body_muted'])
    ], width=382)
    l8 = make_card([
        Paragraph("8. SUBMIT TITLE EDITS", styles['card_header']),
        Paragraph("Title-only edits in the Submit form do not persist to the Report heading (governance evaluates draft body text, attachments, and metadata).", styles['card_body_muted'])
    ], width=382)

    l9 = make_card([
        Paragraph("9. TREND 'STABLE' CLASSIFICATION", styles['card_header_amber']),
        Paragraph("The 'Stable' trend determination in Insights v2 is verified by local test fixtures, but has not been observed live during continuous production traffic (which yielded IMPROVING or WORSENING).", styles['card_body_muted'])
    ], width=382)
    l10 = make_card([
        Paragraph("10. MOBILE 360PX & 120% ZOOM", styles['card_header_rose']),
        Paragraph("Layout constraints and responsive classes are implemented, but physical mobile (360px) and 120% browser zoom were not verified in a physical browser harness.", styles['card_body_muted'])
    ], width=382)

    story.append(make_row([l1, l2], [392, 396]))
    story.append(Spacer(1, 3))
    story.append(make_row([l3, l4], [392, 396]))
    story.append(Spacer(1, 3))
    story.append(make_row([l5, l6], [392, 396]))
    story.append(Spacer(1, 3))
    story.append(make_row([l7, l8], [392, 396]))
    story.append(Spacer(1, 3))
    story.append(make_row([l9, l10], [392, 396]))

    # Build PDF
    doc.build(story, onFirstPage=draw_background, onLaterPages=draw_background)
    print(f"SUCCESS: Generated {output_path} with 8 slides!")

if __name__ == "__main__":
    out = "docs/BrandGate_Final_Product.pdf"
    if len(sys.argv) > 1:
        out = sys.argv[1]
    build_pdf(out)
