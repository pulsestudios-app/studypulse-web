import { Link, useParams } from "react-router";

import { useDocumentTitle } from "../components/useDocumentTitle";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Slice 1 placeholder: the result viewer ships in a later slice. */
export function ResultPlaceholderPage() {
  useDocumentTitle("Result");
  const { id = "" } = useParams();
  const valid = UUID_RE.test(id);
  return (
    <div className="result-placeholder card">
      <h1 className="type-title">{valid ? "Result viewer coming soon" : "Result not found"}</h1>
      <p className="text-secondary">
        {valid
          ? "Transcripts, summaries, quizzes and flashcards will open here. For now, open this result in the StudyPulse app."
          : "This link doesn't look like a StudyPulse result."}
      </p>
      <Link to="/library" className="btn btn-small">
        Back to library
      </Link>
    </div>
  );
}
