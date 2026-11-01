import pymupdf
import sys

def verify_final_pdf(pdf_path="docs/BrandGate_Final_Product.pdf"):
    print("=" * 70)
    print("AUTOMATED VERIFICATION OF FINAL PRODUCT PDF")
    print("=" * 70)
    
    doc = pymupdf.open(pdf_path)
    page_count = len(doc)
    print(f"[CHECK] Total page count: {page_count} (Expected: 8)")
    assert page_count == 8, f"Expected 8 pages, got {page_count}"
    
    all_text = ""
    for idx, page in enumerate(doc):
        text = page.get_text()
        char_count = len(text.strip())
        print(f"  -> Page {idx+1}: {char_count} text characters. Non-blank: {char_count > 100}")
        assert char_count > 100, f"Page {idx+1} appears blank or empty! ({char_count} chars)"
        all_text += f"\n--- PAGE {idx+1} ---\n" + text

    print("\n--- Verifying Locked Facts & Numbers ---")
    locked_checks = [
        ("Git commit hash 059aedce", "059aedce"),
        ("Git commit count 37 commits", "37 commits"),
        ("Brand A Vault count (12 Vault Items)", "12 Vault Items"),
        ("Brand B Vault count (5 Vault Items)", "5 Vault Items"),
        ("Approved price F-12 (Rs. 1,299)", "1,299"),
        ("Contradiction price (Rs. 999)", "999"),
        ("NovaTech price F-20 (Rs. 4,999)", "4,999"),
        ("Demo cumulative drafts (312)", "312"),
        ("Demo cumulative flags (990)", "990"),
        ("Demo top citation R-04 count (571)", "571"),
        ("Demo dispositions 162", "162"),
        ("Demo dispositions 33", "33"),
        ("Demo dispositions 116", "116"),
        ("Demo capture time 2026-11-01 19:59:46 UTC", "2026-11-01 19:59:46 UTC"),
        ("NovaTech cumulative drafts (69)", "69"),
        ("NovaTech cumulative flags (212)", "212"),
        ("NovaTech top citation R-15 count (139)", "139"),
        ("NovaTech dispositions 9", "9"),
        ("NovaTech dispositions 1", "1"),
        ("NovaTech dispositions 59", "59"),
        ("NovaTech capture time 2026-11-01 19:56:15 UTC", "2026-11-01 19:56:15 UTC"),
        ("Document upload size limit (10MB)", "10MB"),
        ("Phase 4 hardening test count (10 / 10)", "10 / 10"),
        ("Brand-switch restoration test count (6 / 6)", "6 / 6"),
        ("Phase 4.2 all test count (5 / 5)", "5 / 5"),
        ("Document governance test count (8 / 8)", "8 / 8"),
        ("Homepage workspace selector test count (4 / 4)", "4 / 4"),
        ("Navbar dropdown clipping test count (3 / 3)", "3 / 3"),
        ("Render cold start duration (~45 seconds)", "45"),
        ("Live check GO (2026-11-01 23:21 IST)", "2026-11-01 23:21 IST"),
        ("Live check FAIL (2026-11-02 00:29 IST)", "2026-11-02 00:29 IST"),
        ("Live check GO (2026-11-02 01:30 IST)", "2026-11-02 01:30 IST"),
    ]

    for label, target in locked_checks:
        found = target in all_text
        print(f"  [{'PASS' if found else 'FAIL'}] {label} -> '{target}'")
        assert found, f"Locked fact missing from PDF: {label} ('{target}')"

    print("\n--- Verifying Forbidden Text Absence ---")
    forbidden = ["trusted by millions", "100 / 100", "status:ok"]
    for phrase in forbidden:
        present = phrase in all_text.lower()
        print(f"  [{'PASS' if not present else 'FAIL'}] Absence of '{phrase}'")
        assert not present, f"Forbidden phrase found in PDF: '{phrase}'"

    print("\n" + "=" * 70)
    print("ALL PDF VERIFICATION CHECKS PASSED (8/8 SLIDES VALIDATED)!")
    print("=" * 70)

if __name__ == "__main__":
    pdf_file = "docs/BrandGate_Final_Product.pdf"
    if len(sys.argv) > 1:
        pdf_file = sys.argv[1]
    verify_final_pdf(pdf_file)
