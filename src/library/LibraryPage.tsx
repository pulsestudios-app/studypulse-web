import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";

import { useSession } from "../auth/AuthProvider";
import { Icon } from "../components/Icon";
import { useDocumentTitle } from "../components/useDocumentTitle";
import { displayTitle, formatDate, formatDuration, sourceTypeLabel } from "./format";
import { useLibraryPage, type LibraryRow } from "./libraryApi";
import { libraryHref, normalizeSearch, parsePageParam } from "./pagination";
import { Thumbnail } from "./Thumbnail";

const SEARCH_DEBOUNCE_MS = 250;
const SKELETON_ROWS = 6;

export function LibraryPage() {
  useDocumentTitle("Library");
  const session = useSession();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const page = parsePageParam(searchParams.get("page"));
  const search = normalizeSearch(searchParams.get("q"));
  const [draft, setDraft] = useState(search);
  const [syncedSearch, setSyncedSearch] = useState(search);
  const listTop = useRef<HTMLDivElement>(null);

  // Keep the input in sync with back/forward navigation without clobbering in-progress
  // typing (e.g. a trailing space). Adjusting state during render, per React docs.
  if (search !== syncedSearch) {
    setSyncedSearch(search);
    if (normalizeSearch(draft) !== search) {
      setDraft(search);
    }
  }

  // Debounced URL update; a new search always starts at page 1.
  useEffect(() => {
    const next = normalizeSearch(draft);
    if (next === search) {
      return;
    }
    const timer = window.setTimeout(() => {
      navigate(libraryHref(1, next), { replace: true });
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [draft, search, navigate]);

  const query = useLibraryPage(session.user.id, page, search);
  const data = query.data;
  const showSkeleton = query.isPending;

  useEffect(() => {
    listTop.current?.scrollIntoView({ block: "start" });
  }, [page]);

  return (
    <div className="library">
      <div className="library-header" ref={listTop}>
        <h1 className="type-header">Library</h1>
        <label className="library-search">
          <Icon name="search" size={18} className="library-search-icon" />
          <span className="visually-hidden">Search your library by title</span>
          <input
            className="input library-search-input"
            type="search"
            placeholder="Search by title"
            value={draft}
            maxLength={100}
            onChange={(event) => setDraft(event.target.value)}
          />
        </label>
      </div>

      {query.isError ? (
        <div className="notice notice-error library-error" role="alert">
          <span>We couldn't load your library.</span>
          <button type="button" className="btn btn-small" onClick={() => void query.refetch()}>
            Try again
          </button>
        </div>
      ) : showSkeleton ? (
        <LibrarySkeleton />
      ) : data && data.items.length > 0 ? (
        <ul className={`library-list${query.isFetching ? " library-list-refreshing" : ""}`} aria-busy={query.isFetching}>
          {data.items.map((row) => (
            <li key={row.id}>
              <LibraryItem row={row} />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState search={search} page={page} />
      )}

      {data && (page > 1 || data.hasNext) ? (
        <nav className="pagination" aria-label="Library pages">
          {page > 1 ? (
            <Link className="btn btn-small" to={libraryHref(page - 1, search)} rel="prev">
              <Icon name="chevron-left" size={18} /> Previous
            </Link>
          ) : (
            <span className="btn btn-small" aria-disabled="true" data-disabled="true">
              <Icon name="chevron-left" size={18} /> Previous
            </span>
          )}
          <span className="pagination-label type-caption text-secondary">Page {page}</span>
          {data.hasNext ? (
            <Link className="btn btn-small" to={libraryHref(page + 1, search)} rel="next">
              Next <Icon name="chevron-right" size={18} />
            </Link>
          ) : (
            <span className="btn btn-small" aria-disabled="true" data-disabled="true">
              Next <Icon name="chevron-right" size={18} />
            </span>
          )}
        </nav>
      ) : null}
    </div>
  );
}

function LibraryItem({ row }: { row: LibraryRow }) {
  const date = formatDate(row.created_at);
  return (
    <Link to={`/results/${row.id}`} className="library-item">
      <Thumbnail row={row} />
      <span className="library-item-body">
        <span className="library-item-title">{displayTitle(row)}</span>
        <span className="library-item-meta">
          {date ? `${date} · ` : ""}
          {formatDuration(row.duration_seconds)}
        </span>
      </span>
      <span className="pill library-item-type">{sourceTypeLabel(row.source_type)}</span>
    </Link>
  );
}

function LibrarySkeleton() {
  return (
    <ul className="library-list" aria-hidden="true">
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <li key={index} className="library-item library-item-skeleton">
          <span className="thumb skeleton" />
          <span className="library-item-body">
            <span className="skeleton skeleton-line" style={{ width: `${55 + ((index * 13) % 35)}%` }} />
            <span className="skeleton skeleton-line skeleton-line-short" />
          </span>
        </li>
      ))}
      <li className="visually-hidden" role="status">
        Loading your library
      </li>
    </ul>
  );
}

function EmptyState({ search, page }: { search: string; page: number }) {
  if (search) {
    return (
      <div className="empty-state card">
        <h2 className="type-title">No matches</h2>
        <p className="text-secondary">Nothing in your library has a title containing “{search}”.</p>
        <Link to="/library" className="btn btn-small">
          Clear search
        </Link>
      </div>
    );
  }
  if (page > 1) {
    return (
      <div className="empty-state card">
        <h2 className="type-title">Nothing on this page</h2>
        <Link to="/library" className="btn btn-small">
          Back to page 1
        </Link>
      </div>
    );
  }
  return (
    <div className="empty-state card">
      <h2 className="type-title">Your library is empty</h2>
      <p className="text-secondary">
        Record a lecture, upload a file or paste a YouTube link in the StudyPulse app — or upload from your computer at{" "}
        <a href="https://pulsestudios.app/upload/" target="_blank" rel="noreferrer">
          pulsestudios.app/upload
        </a>
        . Saved results show up here.
      </p>
    </div>
  );
}
