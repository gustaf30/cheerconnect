import { CreatePostCard } from "@/components/feed/create-post-card";
import { PostList } from "@/components/feed/post-list";

export default function FeedPage() {
  return (
    <div className="space-y-6">
      <CreatePostCard />
      <PostList />
    </div>
  );
}
