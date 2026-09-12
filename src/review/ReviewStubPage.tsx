import { Link, useSearchParams } from "react-router";

import { useDocumentTitle } from "../components/useDocumentTitle";

/** Placeholder for the spaced-repetition review screen (next slice). */
export function ReviewStubPage() {
  useDocumentTitle("Review");
  const [params] = useSearchParams();
  const savedResultId = params.get("savedResultId");
  return (
    <div className="result-placeholder card">
      <h1 className="type-title">Review is coming soon</h1>
      <p className="text-secondary">
        Spaced-repetition review will open here. For now, review due cards in the StudyPulse app.
      </p>
      <Link to={savedResultId ? `/results/${encodeURIComponent(savedResultId)}#flashcards` : "/library"} className="btn btn-small">
        {savedResultId ? "Back to flashcards" : "Back to library"}
      </Link>
    </div>
  );
}
