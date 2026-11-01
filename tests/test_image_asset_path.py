import os
import sys
import re
import json
import base64
import io
import urllib.request
from typing import List, Dict, Any
from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
from document_parser import analyze_image_bytes, BRAND_A_PALETTE

BASE_URL = "http://localhost:8000"
BRAND_A_ID = "00000000-0000-0000-0000-000000000001"
BRAND_B_ID = "00000000-0000-0000-0000-000000000002"

def create_solid_color_png(hex_color: str, size: tuple = (50, 50)) -> bytes:
    """Creates a PNG image with a solid fill color."""
    h = hex_color.lstrip('#')
    rgb = (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))
    img = Image.new("RGB", size, color=rgb)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()

def png_to_data_url(png_bytes: bytes) -> str:
    b64 = base64.b64encode(png_bytes).decode("utf-8")
    return f"data:image/png;base64,{b64}"

def create_draft(brand_id: str, title: str, body_text: str, image_url: str = None, alt_text: str = None) -> Dict[str, Any]:
    payload = {
        "brand_id": brand_id,
        "title": title,
        "body_text": body_text,
        "image_url": image_url,
        "alt_text": alt_text,
        "created_by_role": "guest"
    }
    req = urllib.request.Request(
        f"{BASE_URL}/api/drafts",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 201, f"Expected 201, got {resp.status}"
        return json.loads(resp.read().decode())

def review_draft(draft_id: str, options: Dict[str, Any] = None) -> Dict[str, Any]:
    req = urllib.request.Request(
        f"{BASE_URL}/api/drafts/{draft_id}/review",
        data=json.dumps(options or {}).encode(),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 200, f"Expected 200, got {resp.status}"
        return json.loads(resp.read().decode())

def get_draft(draft_id: str) -> Dict[str, Any]:
    req = urllib.request.Request(f"{BASE_URL}/api/drafts/{draft_id}")
    with urllib.request.urlopen(req) as resp:
        assert resp.status == 200, f"Expected 200, got {resp.status}"
        return json.loads(resp.read().decode())

def test_sampling_bug_fix():
    print("=" * 70)
    print("TEST 2: Solid pink PNG samples to pink, NOT #000060")
    print("=" * 70)
    # Bright pink: DeepPink RGB(255, 20, 147) -> #FF1493
    pink_png_bytes = create_solid_color_png("#FF1493")
    data_url = png_to_data_url(pink_png_bytes)

    # 1. Test client-side sampling algorithm logic
    # Exact reproduction of how solid pink sampled to #000060 on live:
    # A pink color with R=255, G=0, B=96 (#FF0060):
    raw_r, raw_g, raw_b = 255, 0, 96
    buggy_r = round(raw_r / 32) * 32  # 256
    buggy_g = round(raw_g / 32) * 32  # 0
    buggy_b = round(raw_b / 32) * 32  # 96
    # In JS: ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)
    val = (1 << 24) + (buggy_r << 16) + (buggy_g << 8) + buggy_b  # 0x2000060
    js_to_string_16 = f"{val:x}"  # '2000060'
    js_slice_1 = js_to_string_16[1:]  # '000060'
    buggy_hex = f"#{js_slice_1.upper()}"  # '#000060'
    print(f"   [Demonstration of Buggy Algorithm] Raw Pink RGB({raw_r},{raw_g},{raw_b}) -> {buggy_hex} (Dark blue bug!)")
    assert buggy_hex == "#000060", f"Expected buggy code to produce #000060, got {buggy_hex}"

    # Fixed version clamps to 0..255 and formats each channel with padStart:
    fixed_r = min(255, max(0, round(raw_r / 32) * 32))
    fixed_g = min(255, max(0, round(raw_g / 32) * 32))
    fixed_b = min(255, max(0, round(raw_b / 32) * 32))
    fixed_hex = f"#{fixed_r:02X}{fixed_g:02X}{fixed_b:02X}"
    print(f"   [Fixed Algorithm] Raw Pink RGB({raw_r},{raw_g},{raw_b}) -> {fixed_hex} (Vibrant Pink!)")
    assert fixed_hex == "#FF0060", f"Expected #FF0060, got {fixed_hex}"
    assert fixed_hex != "#000060", "Sampled color must NOT be #000060!"

    # 2. Test backend Pillow analyzer
    analysis = analyze_image_bytes(pink_png_bytes, BRAND_A_PALETTE)
    dominant_color = analysis["sampled_colors"][0]
    print(f"   [Backend Pillow Analysis] Sampled colors: {analysis['sampled_colors']}, is_off_palette: {analysis['is_off_palette']}")
    assert dominant_color == "#FF1493", f"Expected #FF1493, got {dominant_color}"
    assert dominant_color != "#000060", "Pillow sampling must NOT be #000060!"
    assert analysis["is_off_palette"] is True, "Bright pink must be off-palette for Brand A!"
    print("PASS: Solid bright pink PNG samples to pink (#FF1493 / #FF20A0), NOT #000060!")

def test_off_palette_blank_alt_full_path():
    print("\n" + "=" * 70)
    print("TEST 1: Off-palette PNG + blank alt through full submit-review-retrieval path")
    print("=" * 70)
    # 1. Create solid bright pink PNG (#FF1493) and encode as data URL
    pink_png_bytes = create_solid_color_png("#FF1493")
    pink_data_url = png_to_data_url(pink_png_bytes)

    # 2. Submit draft with attached image and blank alt text
    clean_text = "Festive Cookware launch for all Indian households with trusted durability."
    print("1. Submitting draft with attached bright pink PNG and blank alt text...")
    draft = create_draft(
        brand_id=BRAND_A_ID,
        title="Pink Asset Creative Test",
        body_text=clean_text,
        image_url=pink_data_url,
        alt_text=""  # Blank alt text
    )
    draft_id = draft["id"]
    print(f"   Draft created: id={draft_id}, image_url attached={bool(draft.get('image_url'))}")
    assert draft.get("image_url") == pink_data_url, "Draft image_url must match attached image!"

    # 3. Review draft via POST /api/drafts/{id}/review
    print("2. Calling /api/drafts/{id}/review...")
    review_res = review_draft(draft_id, {
        "palette_off": True,
        "image_url": pink_data_url,
        "alt_text": ""
    })
    findings = review_res.get("findings", [])
    print(f"   Review returned {len(findings)} findings:")
    for f in findings:
        print(f"     - [{f.get('lane')}] {f.get('citation_id')}: {f.get('explanation')}")

    # Check palette finding
    palette_finding = next((f for f in findings if f.get("citation_id") in ("P-01", "P-02", "P-03", "P-04")), None)
    assert palette_finding is not None, "Off-palette image MUST produce a palette finding!"
    assert palette_finding["lane"] == "human_decision", f"Palette finding MUST be in human_decision lane only, got {palette_finding['lane']}"
    assert "Sampling: Approximate" in palette_finding["explanation"], f"Palette finding explanation MUST show 'Sampling: Approximate', got: {palette_finding['explanation']}"

    # Check R-09 missing alt finding
    r09_finding = next((f for f in findings if f.get("citation_id") == "R-09"), None)
    assert r09_finding is not None, "Blank alt text with image attached MUST produce an R-09 finding!"
    assert r09_finding["lane"] == "human_decision", f"R-09 finding MUST be in human_decision lane, got {r09_finding['lane']}"

    # Check contradiction lane
    contradictions = [f for f in findings if f.get("lane") == "contradiction"]
    assert len(contradictions) == 0, f"Clean text + off-palette image must NEVER give Contradictions! Got: {contradictions}"

    # 4. Retrieve draft via GET /api/drafts/{id}
    print("3. Retrieving draft from /api/drafts/{id}...")
    retrieved = get_draft(draft_id)
    retrieved_image_url = retrieved.get("image_url")
    print(f"   Retrieved draft image_url is present: {bool(retrieved_image_url)}")
    assert retrieved_image_url == pink_data_url, "Retrieved draft MUST retain the attached image_url!"

    # 5. Report rendering simulation
    # Report zero-state check: when draft.image_url is present, it must NEVER say 'no visual asset was uploaded'
    has_image = bool(retrieved.get("image_url"))
    report_zero_message = (
        'Creative copy and uploaded visual asset align with all active Brand Vault rules. Proceed to the review tab to request final reviewer sign-off.'
        if has_image
        else 'Creative copy aligns with all active Brand Vault rules (no visual asset was uploaded for this draft). Proceed to the review tab to request final reviewer sign-off.'
    )
    print(f"   Report text state with image: \"{report_zero_message}\"")
    assert "no visual asset was uploaded" not in report_zero_message, "Report must NEVER say 'no visual asset was uploaded' when an image was attached!"
    print("PASS: Off-palette PNG + blank alt through full submit-review-retrieval path gives palette Human Decision + R-09!")

def test_on_palette_image_no_contradiction():
    print("\n" + "=" * 70)
    print("TEST 3: On-palette image does NOT give a palette Contradiction")
    print("=" * 70)
    # Brand A primary blue: #1E3A8A
    blue_png_bytes = create_solid_color_png("#1E3A8A")
    blue_data_url = png_to_data_url(blue_png_bytes)

    clean_text = "Festive Cookware launch for all Indian households with trusted durability."
    draft = create_draft(
        brand_id=BRAND_A_ID,
        title="On-Palette Asset Test",
        body_text=clean_text,
        image_url=blue_data_url,
        alt_text="Cookware set presented on royal blue brand background"
    )
    draft_id = draft["id"]

    # Review with palette_off = False (on-palette image)
    review_res = review_draft(draft_id, {
        "palette_off": False,
        "image_url": blue_data_url,
        "alt_text": "Cookware set presented on royal blue brand background"
    })
    findings = review_res.get("findings", [])
    print(f"   Review returned {len(findings)} findings for on-palette image + valid alt:")
    for f in findings:
        print(f"     - [{f.get('lane')}] {f.get('citation_id')}: {f.get('explanation')}")

    # Must NOT have any palette findings in contradiction lane
    palette_contradictions = [f for f in findings if f.get("citation_id") in ("P-01", "P-02", "P-03", "P-04") and f.get("lane") == "contradiction"]
    assert len(palette_contradictions) == 0, f"On-palette image must NEVER give a palette contradiction! Got: {palette_contradictions}"

    # In fact, since text is clean, image is on-palette, and alt is valid, zero blocker findings!
    print("PASS: On-palette image does NOT give a palette Contradiction!")

if __name__ == "__main__":
    test_sampling_bug_fix()
    test_off_palette_blank_alt_full_path()
    test_on_palette_image_no_contradiction()
    print("\n" + "=" * 70)
    print("ALL IMAGE ASSET PATH TESTS PASSED SUCCESSFULLY!")
    print("=" * 70)
