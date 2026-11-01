import io
import re
import math
import base64
import zipfile
import logging
from typing import Dict, Any, List, Optional, Tuple
from PIL import Image

logger = logging.getLogger("brandgate.document_parser")

MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024  # 10MB limit

# Seeded default brand palettes
BRAND_A_PALETTE = ['#1E3A8A', '#D97706', '#F8FAFC', '#0F172A']
BRAND_B_PALETTE = ['#06B6D4', '#0B0F19']

def hex_to_rgb(hex_code: str) -> Tuple[int, int, int]:
    h = hex_code.lstrip('#')
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))

def color_distance(c1: Tuple[int, int, int], c2: Tuple[int, int, int]) -> float:
    return math.sqrt(sum((a - b) ** 2 for a, b in zip(c1, c2)))

def extract_palette_from_vault(vault_items: Optional[List[Dict[str, Any]]] = None) -> List[str]:
    """Extracts approved hex codes from active palette vault items, falling back to defaults."""
    if not vault_items:
        return BRAND_A_PALETTE

    found_hexes = []
    for item in vault_items:
        if item.get("kind") == "palette" and item.get("status") == "active":
            text = f"{item.get('title', '')} {item.get('text', '')}"
            matches = re.findall(r'#[0-9a-fA-F]{6}', text)
            for m in matches:
                found_hexes.append(m.upper())

    if found_hexes:
        return list(dict.fromkeys(found_hexes))
    return BRAND_A_PALETTE

def get_relative_luminance(rgb: Tuple[int, int, int]) -> float:
    r, g, b = [c / 255.0 for c in rgb]
    r = r / 12.92 if r <= 0.03928 else ((r + 0.055) / 1.055) ** 2.4
    g = g / 12.92 if g <= 0.03928 else ((g + 0.055) / 1.055) ** 2.4
    b = b / 12.92 if b <= 0.03928 else ((b + 0.055) / 1.055) ** 2.4
    return 0.2126 * r + 0.7152 * g + 0.0722 * b

def calculate_contrast(rgb1: Tuple[int, int, int], rgb2: Tuple[int, int, int]) -> float:
    l1 = get_relative_luminance(rgb1)
    l2 = get_relative_luminance(rgb2)
    lighter = max(l1, l2)
    darker = min(l1, l2)
    return round((lighter + 0.05) / (darker + 0.05), 1)

def analyze_image_bytes(image_bytes: bytes, approved_palette: List[str], threshold: float = 100.0) -> Dict[str, Any]:
    """
    Analyzes an extracted image: samples dominant colors, checks alignment with approved palette,
    calculates WCAG 2.1 AA contrast ratio between dominant colors, and returns a base64 data URL.
    """
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert('RGB')
        img_thumb = img.resize((50, 50))
        colors = img_thumb.getcolors(maxcolors=2500)
        if not colors:
            colors = [(1, (128, 128, 128))]
        sorted_colors = sorted(colors, key=lambda x: x[0], reverse=True)
        dominant_rgbs = [c[1] for c in sorted_colors[:4]]

        approved_rgbs = [hex_to_rgb(h) for h in approved_palette]

        is_off_palette = False
        for drgb in dominant_rgbs:
            if not any(color_distance(drgb, argb) <= threshold for argb in approved_rgbs):
                is_off_palette = True
                break

        dominant_hexes = [f"#{c[0]:02X}{c[1]:02X}{c[2]:02X}" for c in dominant_rgbs]

        # Contrast calculation between lightest and darkest sampled colors
        contrast_ratio = None
        if len(dominant_rgbs) >= 2:
            sorted_by_lum = sorted(dominant_rgbs, key=get_relative_luminance)
            contrast_ratio = calculate_contrast(sorted_by_lum[-1], sorted_by_lum[0])

        # Determine format for data URL
        fmt = img.format or "PNG"
        mime_type = f"image/{fmt.lower()}" if fmt.lower() in ("png", "jpeg", "webp") else "image/png"
        b64_str = base64.b64encode(image_bytes).decode("utf-8")
        data_url = f"data:{mime_type};base64,{b64_str}"

        return {
            "valid": True,
            "data_url": data_url,
            "sampled_colors": dominant_hexes,
            "is_off_palette": is_off_palette,
            "contrast_ratio": contrast_ratio,
            "error": None
        }
    except Exception as exc:
        logger.warning(f"Failed to analyze extracted image: {exc}")
        return {
            "valid": False,
            "data_url": None,
            "sampled_colors": [],
            "is_off_palette": False,
            "contrast_ratio": None,
            "error": "Could not sample — human decision"
        }

def extract_docx(file_bytes: bytes, approved_palette: List[str]) -> Dict[str, Any]:
    """
    Extracts DOCX text in document order with paragraph breaks.
    Extracts embedded images from word/media/ and runs palette checks.
    """
    import docx

    # 1. Text extraction in document order with paragraph breaks
    doc = docx.Document(io.BytesIO(file_bytes))
    paragraph_texts = [p.text for p in doc.paragraphs if p.text.strip()]
    
    # Also include any table text in document order
    for table in doc.tables:
        for row in table.rows:
            row_texts = [cell.text.strip() for cell in row.cells if cell.text.strip()]
            if row_texts:
                paragraph_texts.append(" | ".join(row_texts))

    full_text = "\n\n".join(paragraph_texts)

    # 2. Extract embedded images from zip package
    images: List[Dict[str, Any]] = []
    images_unextractable = False
    unextractable_reason = None

    try:
        with zipfile.ZipFile(io.BytesIO(file_bytes)) as zf:
            media_names = [name for name in zf.namelist() if name.startswith("word/media/")]
            for m_name in media_names:
                try:
                    img_data = zf.read(m_name)
                    if not img_data:
                        images_unextractable = True
                        unextractable_reason = "Image could not be extracted — check manually"
                        continue
                    analysis = analyze_image_bytes(img_data, approved_palette)
                    if analysis["valid"]:
                        images.append({
                            "name": m_name,
                            "page_number": 1,
                            "data_url": analysis["data_url"],
                            "sampled_colors": analysis["sampled_colors"],
                            "is_off_palette": analysis["is_off_palette"],
                            "contrast_ratio": analysis.get("contrast_ratio"),
                        })
                    else:
                        images_unextractable = True
                        unextractable_reason = "Could not sample — human decision"
                except Exception:
                    images_unextractable = True
                    unextractable_reason = "Could not sample — human decision"
    except Exception as zip_exc:
        logger.warning(f"Zip extraction error on DOCX: {zip_exc}")

    is_any_off_palette = any(img.get("is_off_palette") for img in images)
    contrast_ratios = [img.get("contrast_ratio") for img in images if img.get("contrast_ratio") is not None]
    min_contrast = min(contrast_ratios) if contrast_ratios else None

    return {
        "file_type": "docx",
        "text": full_text,
        "page_count": 1,
        "pages": [{"page_number": 1, "text": full_text}],
        "has_text_layer": bool(full_text.strip()),
        "honest_limit_notice": None if full_text.strip() else "Empty DOCX document — no text layer found.",
        "has_images": len(images) > 0,
        "images": images,
        "images_unextractable": images_unextractable,
        "palette_unsampleable": images_unextractable,
        "unextractable_reason": unextractable_reason,
        "is_off_palette": is_any_off_palette,
        "contrast_ratio": min_contrast,
    }

def extract_pdf(file_bytes: bytes, approved_palette: List[str]) -> Dict[str, Any]:
    """
    Extracts PDF text in page order, keeping page numbers so findings can cite their page.
    Extracts images per page and runs palette checks.
    Detects scanned-image PDFs with no text layer (no OCR honest limit).
    """
    import pymupdf

    doc = pymupdf.open(stream=file_bytes, filetype="pdf")
    page_count = len(doc)
    pages: List[Dict[str, Any]] = []
    full_text_parts: List[str] = []

    images: List[Dict[str, Any]] = []
    images_unextractable = False
    unextractable_reason = None

    for i in range(page_count):
        page = doc[i]
        page_num = i + 1
        page_text = page.get_text("text").strip()
        pages.append({
            "page_number": page_num,
            "text": page_text
        })
        if page_text:
            full_text_parts.append(page_text)

        # Extract images on this page
        try:
            image_list = page.get_images(full=True)
            for img_info in image_list:
                xref = img_info[0]
                try:
                    extracted = doc.extract_image(xref)
                    if not extracted or not extracted.get("image"):
                        images_unextractable = True
                        unextractable_reason = "Could not sample — human decision"
                        continue
                    img_bytes = extracted["image"]
                    analysis = analyze_image_bytes(img_bytes, approved_palette)
                    if analysis["valid"]:
                        images.append({
                            "name": f"page_{page_num}_img_{xref}",
                            "page_number": page_num,
                            "data_url": analysis["data_url"],
                            "sampled_colors": analysis["sampled_colors"],
                            "is_off_palette": analysis["is_off_palette"],
                            "contrast_ratio": analysis.get("contrast_ratio"),
                        })
                    else:
                        images_unextractable = True
                        unextractable_reason = "Could not sample — human decision"
                except Exception:
                    images_unextractable = True
                    unextractable_reason = "Could not sample — human decision"
        except Exception:
            images_unextractable = True
            unextractable_reason = "Could not sample — human decision"

    total_text_len = sum(len(p["text"]) for p in pages)
    has_text_layer = total_text_len > 0
    full_text = "\n\n".join(full_text_parts)

    honest_limit_notice = None
    if not has_text_layer:
        honest_limit_notice = (
            "Scanned-image PDF with no text layer detected — OCR is not supported in this phase. "
            "The document cannot be text-checked."
        )

    is_any_off_palette = any(img.get("is_off_palette") for img in images)
    contrast_ratios = [img.get("contrast_ratio") for img in images if img.get("contrast_ratio") is not None]
    min_contrast = min(contrast_ratios) if contrast_ratios else None

    return {
        "file_type": "pdf",
        "text": full_text,
        "page_count": page_count,
        "pages": pages,
        "has_text_layer": has_text_layer,
        "honest_limit_notice": honest_limit_notice,
        "has_images": len(images) > 0,
        "images": images,
        "images_unextractable": images_unextractable,
        "palette_unsampleable": images_unextractable,
        "unextractable_reason": unextractable_reason,
        "is_off_palette": is_any_off_palette,
        "contrast_ratio": min_contrast,
    }

def parse_document(file_bytes: bytes, filename: str, active_vault_items: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    """
    Entrypoint for parsing uploaded .docx or .pdf documents.
    Enforces maximum file size limit (10MB) and valid extensions.
    """
    if len(file_bytes) > MAX_FILE_SIZE_BYTES:
        raise ValueError(f"File size exceeds maximum allowed limit of {MAX_FILE_SIZE_BYTES // (1024 * 1024)}MB.")

    lower_name = filename.lower()
    palette = extract_palette_from_vault(active_vault_items)

    if lower_name.endswith(".docx"):
        result = extract_docx(file_bytes, palette)
    elif lower_name.endswith(".pdf"):
        result = extract_pdf(file_bytes, palette)
    else:
        raise ValueError("Unsupported document format. Allowed formats: .docx, .pdf")

    result["filename"] = filename
    return result
