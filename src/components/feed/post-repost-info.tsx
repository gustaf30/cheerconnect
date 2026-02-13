"use client";

import Link from "next/link";
import { Repeat2 } from "lucide-react";

interface PostRepostInfoProps {
  authorName: string;
  authorUsername: string;
}

export function PostRepostInfo({ authorName, authorUsername }: PostRepostInfoProps) {
  return (
    <div className="px-5 pt-3 flex items-center gap-2 text-sm text-muted-foreground">
      <Repeat2 className="h-4 w-4" />
      <Link href={`/profile/${authorUsername}`} className="hover:underline font-medium">
        {authorName}
      </Link>
      <span>repostou</span>
    </div>
  );
}
