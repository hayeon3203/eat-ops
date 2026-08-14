"use client";

import { useState } from "react";
import { getIdentity } from "./nickname";
import type { Recommendation, Visit } from "./types";

const AGENT_API_BASE = process.env.NEXT_PUBLIC_AGENT_API_URL ?? "http://127.0.0.1:8787";

const RATINGS = [1, 2, 3, 4, 5];

function stars(rating: number) {
  return "★".repeat(rating) + "☆".repeat(5 - rating);
}

function average(reviews: Visit[]): number | null {
  const rated = reviews.filter((r) => r.rating != null);
  if (rated.length === 0) return null;
  return Math.round((rated.reduce((sum, r) => sum + (r.rating ?? 0), 0) / rated.length) * 10) / 10;
}

interface ReviewSectionProps {
  place: Recommendation;
}

export function ReviewSection({ place }: ReviewSectionProps) {
  const [open, setOpen] = useState(false);
  const [reviews, setReviews] = useState<Visit[] | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Before the first expand the summary comes from the list request's join;
  // afterwards the loaded reviews are the fresher source (own posts included).
  const count = reviews ? reviews.filter((r) => r.rating != null).length : place.review_count;
  const avg = reviews ? average(reviews) : place.rating_avg;

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next || reviews) return;
    try {
      const res = await fetch(
        `${AGENT_API_BASE}/api/visits?place_id=${encodeURIComponent(place.kakao_place_id)}`
      );
      if (!res.ok) throw new Error(`failed: ${res.status}`);
      setReviews(await res.json());
    } catch {
      setReviews([]);
      setError("리뷰를 불러오지 못했습니다.");
    }
  }

  async function submit() {
    if (rating === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const identity = getIdentity();
      const res = await fetch(`${AGENT_API_BASE}/api/visits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kakao_place_id: place.kakao_place_id,
          place_name: place.place_name,
          address: place.address,
          lat: place.lat,
          lng: place.lng,
          rating,
          note: comment,
          author: identity.nickname,
          author_id: identity.id,
        }),
      });
      if (!res.ok) throw new Error(`failed: ${res.status}`);
      const saved: Visit = await res.json();
      setReviews((prev) => [saved, ...(prev ?? [])]);
      setRating(0);
      setComment("");
    } catch {
      setError("리뷰 등록에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  async function remove(review: Visit) {
    if (!window.confirm("내 리뷰를 삭제할까요?")) return;
    try {
      const res = await fetch(
        `${AGENT_API_BASE}/api/visits/${review.id}?author_id=${encodeURIComponent(review.author_id ?? "")}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error(`failed: ${res.status}`);
      setReviews((prev) => (prev ?? []).filter((r) => r.id !== review.id));
    } catch {
      setError("삭제에 실패했습니다.");
    }
  }

  // Read once per render rather than in the map body — getIdentity() writes to
  // localStorage on first call, and a card that is merely visible shouldn't
  // mint an identity. Only expanded cards reach here.
  const myId = open ? getIdentity().id : null;

  return (
    <div className="review-section">
      <button type="button" className="review-summary" aria-expanded={open} onClick={toggle}>
        <span>
          {count > 0 && avg != null ? (
            <>
              <span className="review-summary-stars">★ {avg.toFixed(1)}</span>
              <span className="review-summary-count">리뷰 {count}</span>
            </>
          ) : (
            <span className="review-summary-empty">리뷰 남기기</span>
          )}
        </span>
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="m4 6 4 4 4-4" />
        </svg>
      </button>

      {open && (
        <div className="review-panel">
          <div className="review-form">
            <div className="review-stars-input" role="group" aria-label="별점 선택">
              {RATINGS.map((value) => (
                <button
                  type="button"
                  key={value}
                  className={value <= rating ? "selected" : ""}
                  aria-pressed={value <= rating}
                  aria-label={`${value}점`}
                  onClick={() => setRating(value === rating ? 0 : value)}
                >
                  ★
                </button>
              ))}
            </div>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="한마디 (선택)"
            />
            <button className="review-submit" onClick={submit} disabled={submitting || rating === 0}>
              등록
            </button>
          </div>

          {error && <p className="visit-search-error">{error}</p>}

          {reviews === null ? (
            <p className="sidebar-empty">불러오는 중…</p>
          ) : reviews.length === 0 ? (
            <p className="sidebar-empty">아직 리뷰가 없습니다.</p>
          ) : (
            <ul className="review-list">
              {reviews.map((r) => (
                <li key={r.id} className="review-item">
                  <div className="review-item-head">
                    <span className="review-item-author">{r.author ?? "익명"}</span>
                    {r.rating != null && <span className="review-item-stars">{stars(r.rating)}</span>}
                    <span className="review-item-date">{r.visited_at.slice(0, 10)}</span>
                  </div>
                  {r.note && <p className="review-item-note">{r.note}</p>}
                  {r.author_id != null && r.author_id === myId && (
                    <button type="button" className="review-item-delete" onClick={() => remove(r)}>
                      삭제
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
