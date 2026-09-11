import { useState } from "react";

import { Icon } from "../components/Icon";
import { thumbnailFor } from "./format";
import type { LibraryRow } from "./libraryApi";

/** Phone LibraryItemThumbnail: 60×60, radius 8; sky icon on a sky tint when there's no image. */
export function Thumbnail({ row }: { row: LibraryRow }) {
  const { imageUrl, icon } = thumbnailFor(row);
  const [failed, setFailed] = useState(false);
  if (imageUrl && !failed) {
    return (
      <span className="thumb">
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          width={60}
          height={60}
          onError={() => setFailed(true)}
        />
      </span>
    );
  }
  return (
    <span className="thumb thumb-icon" aria-hidden="true">
      <Icon name={icon} size={26} />
    </span>
  );
}
