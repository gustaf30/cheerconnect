"use client";

import { useState, useEffect, useCallback } from "react";
import { signOut } from "next-auth/react";
import { Loader2, ArrowLeft, Eye, EyeOff, Sun, Moon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { useTheme } from "next-themes";
import { PASSWORD_MIN_LENGTH, PASSWORD_REGEX, PASSWORD_ERROR } from "@/lib/constants";
import { FeedbackWidget } from "@/components/feed/widgets/feedback-widget";

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
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [username, setUsername] = useState("");

  // Estado de alteração de senha
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Estado de exclusão de conta
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Estado de verificação de disponibilidade de username
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);

  // Tema
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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

    if (newPassword.length < PASSWORD_MIN_LENGTH || !PASSWORD_REGEX.test(newPassword)) {
      toast.error(PASSWORD_ERROR);
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
          <div key={i} className="bento-card-static">
            <div className="accent-bar" />
            <div className="p-6 space-y-4">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>
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
    <div className="space-y-6 stagger-children">
      <div className="flex items-center gap-4">
        <Link href="/profile">
          <Button variant="ghost" size="icon" aria-label="Voltar">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="heading-section font-display">Configurações</h1>
      </div>

      {/* Card de Conta */}
      <div className="bento-card-static">
        <div className="accent-bar" />
        <div className="p-6">
          <h2 className="heading-card mb-1">Conta</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Gerencie suas informações de conta
          </p>
          <div className="space-y-6">
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

            {/* Feedback de disponibilidade do username */}
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

            {/* Mensagem de restrição ou info da URL */}
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
          </div>
        </div>
      </div>

      {/* Card de Aparência */}
      <div className="bento-card-static">
        <div className="accent-bar" />
        <div className="p-6">
          <h2 className="heading-card mb-1">Aparência</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Personalize a aparência do aplicativo
          </p>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Modo escuro</Label>
              <p className="text-sm text-muted-foreground">
                Alterne entre tema claro e escuro
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Sun className="h-4 w-4 text-muted-foreground" />
              {mounted ? (
                <Switch
                  checked={theme === "dark"}
                  onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                />
              ) : (
                <Switch checked={false} disabled />
              )}
              <Moon className="h-4 w-4 text-muted-foreground" />
            </div>
          </div>
        </div>
      </div>

      {/* Card de Notificações */}
      <div className="bento-card-static">
        <div className="accent-bar" />
        <div className="p-6">
          <h2 className="heading-card mb-1">Notificações</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Escolha quais notificações você deseja receber
          </p>
          <div className="space-y-6">
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
          </div>
        </div>
      </div>

      {/* Card de Privacidade */}
      <div className="bento-card-static">
        <div className="accent-bar" />
        <div className="p-6">
          <h2 className="heading-card mb-1">Privacidade</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Controle quem pode ver suas informações
          </p>
          <div className="space-y-6">
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
          </div>
        </div>
      </div>

      {/* Feedback */}
      <FeedbackWidget />

      {/* Botão Salvar */}
      <div className="flex justify-end gap-3">
        <Link href="/profile">
          <Button variant="outline">Cancelar</Button>
        </Link>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Salvar configurações
        </Button>
      </div>

      {/* Dialog de Alteração de Senha */}
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
                  aria-label={showCurrentPassword ? "Ocultar senha atual" : "Mostrar senha atual"}
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
                  aria-label={showNewPassword ? "Ocultar nova senha" : "Mostrar nova senha"}
                >
                  {showNewPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Min. 8 caracteres, incluindo maiuscula, minuscula e numero
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

      {/* Dialog de Exclusão de Conta */}
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
