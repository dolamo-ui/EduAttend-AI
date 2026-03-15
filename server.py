"""
server.py — AI Photo Lab Local Backend
=======================================
Replaces all Hugging Face remote API calls with local Python inference.

MODELS USED (all free, run locally):
  • Captioning : Salesforce/blip-image-captioning-base  (works locally, no 503s)
  • Name match : Rule-based + optional transformers zero-shot (no Mistral needed)

INSTALL:
  pip install fastapi uvicorn pillow transformers torch torchvision accelerate python-multipart

RUN:
  uvicorn server:app --reload --port 8000

VITE PROXY (vite.config.ts) — add this so the frontend can reach /api/*:
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
"""

from __future__ import annotations

import hashlib
import io
import json
import logging
import re
from functools import lru_cache
from typing import Any

import torch
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from transformers import BlipForConditionalGeneration, BlipProcessor

# ─────────────────────────────────────────────────────────────────────────────
# Logging
# ─────────────────────────────────────────────────────────────────────────────

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger("ai_photo_lab")

# ─────────────────────────────────────────────────────────────────────────────
# App
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(title="AI Photo Lab — Local Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:4173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────────────────────────────────────
# Model loading  (cached so it only loads once)
# ─────────────────────────────────────────────────────────────────────────────

CAPTION_MODEL_ID = "Salesforce/blip-image-captioning-base"
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"


@lru_cache(maxsize=1)
def get_blip():
    """Load BLIP caption model once and cache it."""
    log.info("Loading BLIP model: %s on %s …", CAPTION_MODEL_ID, DEVICE)
    processor = BlipProcessor.from_pretrained(CAPTION_MODEL_ID)
    model = BlipForConditionalGeneration.from_pretrained(
        CAPTION_MODEL_ID, torch_dtype=torch.float16 if DEVICE == "cuda" else torch.float32
    ).to(DEVICE)
    model.eval()
    log.info("BLIP model loaded ✓")
    return processor, model


# ─────────────────────────────────────────────────────────────────────────────
# Caption helper
# ─────────────────────────────────────────────────────────────────────────────


def generate_caption(image: Image.Image) -> str:
    """Run BLIP captioning on a PIL image and return a text caption."""
    processor, model = get_blip()

    # Resize large images to avoid OOM on CPU
    max_side = 512
    if max(image.size) > max_side:
        image.thumbnail((max_side, max_side), Image.LANCZOS)

    inputs = processor(images=image, return_tensors="pt").to(DEVICE)
    with torch.no_grad():
        ids = model.generate(
            **inputs,
            max_new_tokens=60,
            num_beams=4,
            early_stopping=True,
        )
    caption: str = processor.decode(ids[0], skip_special_tokens=True)
    log.info("Caption: %s", caption)
    return caption


# ─────────────────────────────────────────────────────────────────────────────
# Name-matching logic  (no Mistral needed)
#
# Approach:
#   1. Count visible *people* in the caption (words like "people", "students",
#      "children", "group", "crowd", digit words, or numeric tokens).
#   2. Mark the first N students as PRESENT, the rest ABSENT.
#   3. If no count hint exists in the caption, treat ALL as present (conservative).
#
# This is intentionally simple and transparent so teachers know what the AI
# is actually doing.  You can swap in a real classifier later.
# ─────────────────────────────────────────────────────────────────────────────

_WORD_NUMS = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
    "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14,
    "fifteen": 15, "sixteen": 16, "seventeen": 17, "eighteen": 18,
    "nineteen": 19, "twenty": 20,
}


def _count_from_caption(caption: str) -> int | None:
    """
    Try to extract a person count from a BLIP caption.
    Returns None when no count hint is found.
    """
    lower = caption.lower()

    # "a group of 5 students" / "5 people" / "3 children"
    digit_match = re.search(
        r"(\d+)\s+(?:people|students?|children|kids?|persons?|boys?|girls?|men|women|pupils?)",
        lower,
    )
    if digit_match:
        return int(digit_match.group(1))

    # "two students" / "a group of three children"
    for word, val in _WORD_NUMS.items():
        if re.search(
            rf"\b{word}\b\s+(?:people|students?|children|kids?|persons?|boys?|girls?|men|women|pupils?)",
            lower,
        ):
            return val

    # "a group of people" without a number → assume several present
    group_words = ["group", "crowd", "class", "classroom", "many", "several", "bunch"]
    if any(w in lower for w in group_words):
        return None  # caller will handle as "all present"

    # Single-person caption ("a woman", "a student")
    single_words = ["a man", "a woman", "a boy", "a girl", "a student", "a child", "a person", "a teacher"]
    if any(w in lower for w in single_words):
        return 1

    return None


def match_names(
    caption: str,
    students: list[dict[str, str]],
) -> tuple[list[str], list[str], str]:
    """
    Returns (present_ids, absent_ids, summary).

    Strategy:
      • If caption mentions N people → mark first N students present, rest absent.
      • If no count hint → mark ALL present (teachers should verify).
      • Students are ordered by roll_no ascending for determinism.
    """
    ordered = sorted(students, key=lambda s: s.get("roll_no", ""))
    total = len(ordered)

    if total == 0:
        return [], [], caption

    count = _count_from_caption(caption)

    if count is None:
        # No reliable count — conservatively mark all present
        present_ids = [s["id"] for s in ordered]
        absent_ids: list[str] = []
        summary = (
            f"{caption.capitalize()}. "
            f"No exact headcount detected — all {total} consented student(s) marked present. "
            "Please verify manually."
        )
    else:
        count = max(0, min(count, total))
        present_ids = [s["id"] for s in ordered[:count]]
        absent_ids  = [s["id"] for s in ordered[count:]]
        summary = (
            f"{caption.capitalize()}. "
            f"AI detected approximately {count} person(s) — "
            f"{len(present_ids)} marked present, {len(absent_ids)} marked absent."
        )

    log.info(
        "Name match → present=%d  absent=%d  (caption count hint: %s)",
        len(present_ids), len(absent_ids), count,
    )
    return present_ids, absent_ids, summary


# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────


@app.get("/api/health")
async def health() -> dict[str, Any]:
    """Quick health check — also warms up the model on first call."""
    try:
        get_blip()          # trigger load if not already cached
        model_ok = True
    except Exception as exc:
        log.warning("Model not yet loaded: %s", exc)
        model_ok = False

    return {
        "status": "ok",
        "model": CAPTION_MODEL_ID,
        "device": DEVICE,
        "model_loaded": model_ok,
    }


@app.post("/api/analyse")
async def analyse(
    photo: UploadFile = File(..., description="Classroom photo (JPEG/PNG/WEBP)"),
    students_json: str = Form(..., description='JSON array of {id, name, roll_no, class_name}'),
) -> dict[str, Any]:
    """
    Main endpoint.  Accepts a multipart/form-data POST with:
      • photo          — image file
      • students_json  — JSON string of consented students

    Returns JSON:
      {
        "present_ids": [...],
        "absent_ids":  [...],
        "imageHash":   "sha256...",
        "summary":     "..."
      }
    """
    # ── Parse students ────────────────────────────────────────────────────
    try:
        students: list[dict[str, str]] = json.loads(students_json)
        if not isinstance(students, list):
            raise ValueError("students_json must be a JSON array")
    except (json.JSONDecodeError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=f"Invalid students_json: {exc}") from exc

    # ── Read image ────────────────────────────────────────────────────────
    raw_bytes = await photo.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Empty photo file.")

    # SHA-256 of raw bytes (frontend can still do duplicate detection)
    image_hash = hashlib.sha256(raw_bytes).hexdigest()

    try:
        image = Image.open(io.BytesIO(raw_bytes)).convert("RGB")
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Cannot open image: {exc}") from exc

    # ── Caption ───────────────────────────────────────────────────────────
    try:
        caption = generate_caption(image)
    except Exception as exc:
        log.exception("Caption generation failed")
        raise HTTPException(status_code=500, detail=f"Caption model error: {exc}") from exc

    # ── Name matching ─────────────────────────────────────────────────────
    present_ids, absent_ids, summary = match_names(caption, students)

    return {
        "present_ids": present_ids,
        "absent_ids":  absent_ids,
        "imageHash":   image_hash,
        "summary":     summary,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Dev entry point
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)