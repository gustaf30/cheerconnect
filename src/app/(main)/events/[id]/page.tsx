import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import EventDetailClient from "./event-detail-client";

interface EventPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: EventPageProps): Promise<Metadata> {
  const { id } = await params;
  const event = await prisma.event.findUnique({
    where: { id },
    select: { name: true, description: true, location: true },
  });

  if (!event) return { title: "Evento | CheerConnect" };

  const description = event.description
    ? event.description.length > 160
      ? event.description.substring(0, 157) + "..."
      : event.description
    : `${event.name} no CheerConnect`;

  return {
    title: `${event.name} | CheerConnect`,
    description,
    openGraph: {
      title: `${event.name} | CheerConnect`,
      description,
      type: "article",
    },
  };
}

export default function EventPage() {
  return <EventDetailClient />;
}
