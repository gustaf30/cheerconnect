"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { Loader2, ArrowLeft, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

interface Settings {
  email: string;
  username: string;
  hasPassword: boolean;
  notifications: {
    postLiked: boolean;
    postCommented: boolean;
    connectionRequest: boolean;
    connectionAccepted: boolean;
    commentReplied: boolean;
    messageReceived: boolean;
  };
  privacy: {
    profileVisibility: "PUBLIC" | "CONNECTIONS_ONLY";
    showEmail: boolean;
  };
  canChangeUsername: boolean;
  nextUsernameChangeDate: string | null;
  daysUntilUsernameChange: number;
}

export default function SettingsPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [username, setUsername] = useState("");

  // Password change state
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Delete account state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Username availability check state
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch("/api/settings");
      if (!response.ok) throw new Error();

      const data = await response.json();
      setSettings(data.settings);
      setUsername(data.settings.username);
    } catch {
      toast.error("Erro ao carregar configurações");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const checkUsernameAvailability = async () => {
    if (!username || username === settings?.username) return;

    setIsCheckingUsername(true);
    setUsernameAvailable(null);

    try {
      const response = await fetch(
        `/api/settings/username?username=${encodeURIComponent(username)}`
      );
      const data = await response.json();
      setUsernameAvailable(data.available);
    } catch {
      toast.error("Erro ao verificar username");
    } finally {
      setIsCheckingUsername(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    setIsSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username !== settings.username ? username : undefined,
          notifications: settings.notifications,
          privacy: settings.privacy,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erro ao salvar configurações");
      }

      const data = await response.json();
      setSettings(data.settings);
      toast.success("Configurações salvas!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar configurações");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Preencha todos os campos");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Nova senha deve ter pelo menos 6 caracteres");
      return;
    }

    setIsChangingPassword(true);
    try {
      const response = await fetch("/api/settings/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          confirmPassword,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erro ao alterar senha");
      }

      toast.success("Senha alterada com sucesso!");
      setPasswordDialogOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao alterar senha");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmation !== settings?.username) {
      toast.error("Digite seu username corretamente para confirmar");
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch("/api/users/me", {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erro ao excluir conta");
      }

      toast.success("Conta excluída com sucesso");
      await signOut({ callbackUrl: "/" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao excluir conta");
    } finally {
      setIsDeleting(false);
    }
  };

  const updateNotification = (key: keyof Settings["notifications"], value: boolean) => {
    if (!settings) return;
    setSettings({
      ...settings,
      notifications: {
        ...settings.notifications,
        [key]: value,
      },
    });
  };

  const updatePrivacy = <K extends keyof Settings["privacy"]>(
    key: K,
    value: Settings["privacy"][K]
  ) => {
    if (!settings) return;
    setSettings({
      ...settings,
      privacy: {
        ...settings.privacy,
        [key]: value,
      },
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-6 space-y-4">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Erro ao carregar configurações</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/profile">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Configurações</h1>
      </div>

      {/* Account Card */}
      <Card>
        <CardHeader>
          <CardTitle>Conta</CardTitle>
          <CardDescription>
            Gerencie suas informações de conta
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={settings.email} disabled className="bg-muted" />
            <p className="text-xs text-muted-foreground">
              O email não pode ser alterado
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <p className="text-xs text-muted-foreground">
              O username só pode ser alterado uma vez a cada 30 dias
            </p>

            <div className="flex gap-2">
              <Input
                id="username"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setUsernameAvailable(null);
                }}
                placeholder="seu_username"
                disabled={!settings.canChangeUsername}
              />
              {settings.canChangeUsername && username !== settings.username && (
                <Button
                  variant="outline"
                  onClick={checkUsernameAvailability}
                  disabled={isCheckingUsername || !username}
                >
                  {isCheckingUsername ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Verificar"
                  )}
                </Button>
              )}
            </div>

            {/* Username availability feedback */}
            {usernameAvailable !== null && (
              <p
                className={`text-xs ${
                  usernameAvailable ? "text-green-600" : "text-red-600"
                }`}
              >
                {usernameAvailable
                  ? "✓ Username disponível"
                  : "✗ Username já está em uso"}
              </p>
            )}

            {/* Restriction message or URL info */}
            {settings.canChangeUsername ? (
              <p className="text-xs text-muted-foreground">
                Usado para sua URL de perfil: /profile/{username}
              </p>
            ) : (
              <p className="text-xs text-amber-600">
                Você poderá alterar o username em {settings.daysUntilUsernameChange} dia(s)
              </p>
            )}
          </div>

          <Separator />

          <div className="space-y-4">
            <div>
              <h4 className="font-medium">Senha</h4>
              {settings.hasPassword ? (
                <p className="text-sm text-muted-foreground">
                  Você pode alterar sua senha a qualquer momento
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Você entrou com Google. Não é possível definir uma senha.
                </p>
              )}
            </div>
            {settings.hasPassword && (
              <Button variant="outline" onClick={() => setPasswordDialogOpen(true)}>
                Alterar senha
              </Button>
            )}
          </div>

          <Separator />

          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-destructive">Zona de Perigo</h4>
              <p className="text-sm text-muted-foreground">
                Excluir sua conta é permanente e não pode ser desfeito
              </p>
            </div>
            <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
              Excluir conta
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notifications Card */}
      <Card>
        <CardHeader>
          <CardTitle>Notificações</CardTitle>
          <CardDescription>
            Escolha quais notificações você deseja receber
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Curtidas em posts</Label>
              <p className="text-sm text-muted-foreground">
                Quando alguém curtir sua publicação
              </p>
            </div>
            <Switch
              checked={settings.notifications.postLiked}
              onCheckedChange={(checked) => updateNotification("postLiked", checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Comentários em posts</Label>
              <p className="text-sm text-muted-foreground">
                Quando alguém comentar sua publicação
              </p>
            </div>
            <Switch
              checked={settings.notifications.postCommented}
              onCheckedChange={(checked) => updateNotification("postCommented", checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Solicitações de conexão</Label>
              <p className="text-sm text-muted-foreground">
                Quando alguém enviar uma solicitação de conexão
              </p>
            </div>
            <Switch
              checked={settings.notifications.connectionRequest}
              onCheckedChange={(checked) => updateNotification("connectionRequest", checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Conexões aceitas</Label>
              <p className="text-sm text-muted-foreground">
                Quando alguém aceitar sua solicitação de conexão
              </p>
            </div>
            <Switch
              checked={settings.notifications.connectionAccepted}
              onCheckedChange={(checked) => updateNotification("connectionAccepted", checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Respostas a comentários</Label>
              <p className="text-sm text-muted-foreground">
                Quando alguém responder seu comentário
              </p>
            </div>
            <Switch
              checked={settings.notifications.commentReplied}
              onCheckedChange={(checked) => updateNotification("commentReplied", checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Mensagens recebidas</Label>
              <p className="text-sm text-muted-foreground">
                Quando alguém enviar uma mensagem
              </p>
            </div>
            <Switch
              checked={settings.notifications.messageReceived}
              onCheckedChange={(checked) => updateNotification("messageReceived", checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Privacy Card */}
      <Card>
        <CardHeader>
          <CardTitle>Privacidade</CardTitle>
          <CardDescription>
            Controle quem pode ver suas informações
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Visibilidade do perfil</Label>
            <Select
              value={settings.privacy.profileVisibility}
              onValueChange={(value: "PUBLIC" | "CONNECTIONS_ONLY") =>
                updatePrivacy("profileVisibility", value)
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PUBLIC">Público - Qualquer pessoa pode ver</SelectItem>
                <SelectItem value="CONNECTIONS_ONLY">Apenas conexões</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Mostrar email no perfil</Label>
              <p className="text-sm text-muted-foreground">
                Permite que outros usuários vejam seu email
              </p>
            </div>
            <Switch
              checked={settings.privacy.showEmail}
              onCheckedChange={(checked) => updatePrivacy("showEmail", checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end gap-3">
        <Link href="/profile">
          <Button variant="outline">Cancelar</Button>
        </Link>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar configurações
        </Button>
      </div>

      {/* Change Password Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar senha</DialogTitle>
            <DialogDescription>
              Digite sua senha atual e escolha uma nova senha
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Senha atual</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showCurrentPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                >
                  {showCurrentPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-password">Nova senha</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Mínimo de 6 caracteres
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar nova senha</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleChangePassword} disabled={isChangingPassword}>
              {isChangingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Alterar senha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Account Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza que deseja excluir sua conta?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>
                Esta ação é permanente e não pode ser desfeita. Todos os seus dados
                serão excluídos, incluindo:
              </p>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>Seu perfil e informações pessoais</li>
                <li>Todas as suas publicações e comentários</li>
                <li>Suas conexões e histórico de times</li>
                <li>Suas conquistas e notificações</li>
              </ul>
              <div className="pt-4">
                <Label htmlFor="delete-confirm">
                  Digite <span className="font-mono font-bold">{settings.username}</span> para confirmar:
                </Label>
                <Input
                  id="delete-confirm"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  className="mt-2"
                  placeholder="Digite seu username"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmation("")}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={isDeleting || deleteConfirmation !== settings.username}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Excluir conta permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
