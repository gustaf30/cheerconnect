"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Flag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type Report = {
  id: string;
  reason: string;
  description: string | null;
  contentType: string;
  contentId: string;
  status: string;
  resolutionNote: string | null;
  createdAt: string;
  reporter: { name: string; username: string } | null;
  content: {
    id: string;
    content?: string | null;
    bio?: string | null;
    name?: string | null;
    username?: string;
  } | null;
};

export default function ModerationPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [status, setStatus] = useState("PENDING");
  const [cursor, setCursor] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  const fetchReports = useCallback(async (next: string | null = null, replace = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ status, limit: "25" });
      if (next) params.set("cursor", next);
      const response = await fetch(`/api/reports?${params.toString()}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro ao carregar denúncias");
      setReports((current) => replace || !next ? data.reports : [...current, ...data.reports]);
      setCursor(next);
      setNextCursor(data.nextCursor);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao carregar denúncias");
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    fetchReports(null, true);
  }, [fetchReports]);

  const updateReport = async (id: string, nextStatus: "RESOLVED" | "DISMISSED") => {
    setUpdating(id);
    try {
      const response = await fetch("/api/reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: nextStatus }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Erro ao atualizar denúncia");
      setReports((current) => current.map((report) => report.id === id ? { ...report, status: nextStatus } : report));
      toast.success("Denúncia atualizada");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao atualizar denúncia");
    } finally {
      setUpdating(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Flag className="h-6 w-6 text-primary" aria-hidden="true" />
        <h1 className="heading-section font-display">Moderação</h1>
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Consulte e resolva denúncias da comunidade.</p>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44" aria-label="Filtrar denúncias por status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PENDING">Pendentes</SelectItem>
            <SelectItem value="REVIEWED">Em revisão</SelectItem>
            <SelectItem value="RESOLVED">Resolvidas</SelectItem>
            <SelectItem value="DISMISSED">Descartadas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading && reports.length === 0 ? (
        <p className="text-muted-foreground">Carregando denúncias...</p>
      ) : reports.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-muted-foreground">Nenhuma denúncia encontrada.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <Card key={report.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{report.contentType}</Badge>
                      <span className="font-medium">{report.reason}</span>
                    </div>
                     <p className="mt-2 text-sm text-muted-foreground">{report.description || "Sem descrição adicional."}</p>
                     {report.content ? (
                       <div className="mt-3 rounded-lg border bg-muted/30 p-3 text-sm">
                         <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Conteúdo denunciado</p>
                         <p className="whitespace-pre-wrap">{report.content.content || report.content.bio || report.content.name || "Conteúdo indisponível"}</p>
                         {report.content.username ? <p className="mt-1 text-xs text-muted-foreground">@{report.content.username}</p> : null}
                       </div>
                     ) : (
                       <p className="mt-2 text-xs text-muted-foreground">Conteúdo removido ou indisponível.</p>
                     )}
                     <p className="mt-2 text-xs text-muted-foreground">

                      {report.reporter ? `${report.reporter.name} (@${report.reporter.username})` : "Autor desconhecido"} · {new Date(report.createdAt).toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <Badge variant={report.status === "PENDING" ? "destructive" : "outline"}>{report.status}</Badge>
                </div>
                {report.status === "PENDING" || report.status === "REVIEWED" ? (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => updateReport(report.id, "RESOLVED")} disabled={updating === report.id}>
                      <Check className="mr-1 h-4 w-4" /> Resolver
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => updateReport(report.id, "DISMISSED")} disabled={updating === report.id}>
                      <X className="mr-1 h-4 w-4" /> Descartar
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="outline" size="sm" disabled={!cursor || loading} onClick={() => fetchReports(null, true)}>
          <ChevronLeft className="mr-1 h-4 w-4" /> Atualizar
        </Button>
        <Button variant="outline" size="sm" disabled={!nextCursor || loading} onClick={() => fetchReports(nextCursor)}>
          Carregar mais <ChevronRight className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
