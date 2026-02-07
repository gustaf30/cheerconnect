# Page Dependency Trees

## Landing Page — `/`
```
src/app/page.tsx
├── src/app/layout.tsx (RootLayout)
└── src/app/globals.css
```

## Login — `/(auth)/login`
```
src/app/(auth)/login/page.tsx
├── src/app/(auth)/layout.tsx (AuthLayout)
├── src/components/ui/card.tsx
├── src/components/ui/input.tsx
├── src/components/ui/button.tsx
├── src/components/ui/label.tsx
├── src/components/ui/separator.tsx
└── src/app/globals.css
```

## Register — `/(auth)/register`
```
src/app/(auth)/register/page.tsx
├── src/app/(auth)/layout.tsx (AuthLayout)
├── src/components/ui/card.tsx
├── src/components/ui/input.tsx
├── src/components/ui/button.tsx
├── src/components/ui/label.tsx
├── src/components/ui/select.tsx
├── src/components/ui/city-selector.tsx
└── src/app/globals.css
```

## Feed — `/(main)/feed`
```
src/app/(main)/feed/page.tsx
├── src/app/(main)/layout.tsx (MainLayout)
│   ├── src/components/shared/header.tsx
│   │   ├── src/components/shared/sidebar.tsx
│   │   ├── src/components/shared/notification-dropdown.tsx
│   │   │   └── src/components/shared/notification-item.tsx
│   │   └── src/components/shared/message-button.tsx
│   ├── src/components/shared/sidebar.tsx
│   └── src/components/providers/page-transition-provider.tsx
├── src/components/feed/create-post-card.tsx
├── src/components/feed/post-list.tsx
│   └── src/components/feed/post-card.tsx
│       └── src/components/feed/comment-section.tsx
│           └── src/components/feed/comment-item.tsx
├── src/components/ui/button.tsx
├── src/components/ui/card.tsx
├── src/components/ui/avatar.tsx
├── src/components/ui/badge.tsx
├── src/components/ui/textarea.tsx
├── src/components/ui/dialog.tsx
├── src/components/ui/dropdown-menu.tsx
└── src/app/globals.css
```

## Connections — `/(main)/connections`
```
src/app/(main)/connections/page.tsx
├── src/app/(main)/layout.tsx (MainLayout)
├── src/components/ui/card.tsx
├── src/components/ui/button.tsx
├── src/components/ui/avatar.tsx
├── src/components/ui/badge.tsx
├── src/components/ui/tabs.tsx
├── src/components/ui/skeleton.tsx
└── src/app/globals.css
```

## Teams — `/(main)/teams`
```
src/app/(main)/teams/page.tsx
├── src/app/(main)/layout.tsx (MainLayout)
├── src/components/ui/card.tsx
├── src/components/ui/button.tsx
├── src/components/ui/input.tsx
├── src/components/ui/avatar.tsx
├── src/components/ui/badge.tsx
├── src/components/ui/dialog.tsx
├── src/components/ui/label.tsx
├── src/components/ui/select.tsx
├── src/components/ui/textarea.tsx
├── src/components/ui/city-selector.tsx
├── src/components/ui/skeleton.tsx
└── src/app/globals.css
```

## Events — `/(main)/events`
```
src/app/(main)/events/page.tsx
├── src/app/(main)/layout.tsx (MainLayout)
├── src/components/ui/card.tsx
├── src/components/ui/button.tsx
├── src/components/ui/input.tsx
├── src/components/ui/badge.tsx
├── src/components/ui/dialog.tsx
├── src/components/ui/label.tsx
├── src/components/ui/select.tsx
├── src/components/ui/city-selector.tsx
├── src/components/ui/skeleton.tsx
└── src/app/globals.css
```

## Search — `/(main)/search`
```
src/app/(main)/search/page.tsx
├── src/app/(main)/layout.tsx (MainLayout)
├── src/components/ui/card.tsx
├── src/components/ui/button.tsx
├── src/components/ui/input.tsx
├── src/components/ui/avatar.tsx
├── src/components/ui/badge.tsx
├── src/components/ui/select.tsx
├── src/components/ui/city-selector.tsx
├── src/components/ui/skeleton.tsx
└── src/app/globals.css
```

## Messages — `/(main)/messages`
```
src/app/(main)/messages/page.tsx
├── src/app/(main)/layout.tsx (MainLayout)
├── src/components/messages/conversation-list.tsx
│   └── src/components/messages/conversation-item.tsx
├── src/components/messages/connection-search.tsx
├── src/components/messages/message-list.tsx
│   └── src/components/messages/message-bubble.tsx
├── src/components/messages/message-input.tsx
├── src/components/ui/card.tsx
├── src/components/ui/button.tsx
├── src/components/ui/input.tsx
├── src/components/ui/avatar.tsx
├── src/components/ui/scroll-area.tsx
├── src/components/ui/skeleton.tsx
└── src/app/globals.css
```

## Profile — `/(main)/profile/[username]`
```
src/app/(main)/profile/[username]/page.tsx
├── src/app/(main)/layout.tsx (MainLayout)
├── src/components/profile/profile-header.tsx
├── src/components/profile/profile-tabs.tsx
│   └── src/components/feed/post-card.tsx
├── src/components/ui/card.tsx
├── src/components/ui/button.tsx
├── src/components/ui/avatar.tsx
├── src/components/ui/badge.tsx
├── src/components/ui/tabs.tsx
├── src/components/ui/skeleton.tsx
└── src/app/globals.css
```

## Settings — `/(main)/settings`
```
src/app/(main)/settings/page.tsx
├── src/app/(main)/layout.tsx (MainLayout)
├── src/components/ui/card.tsx
├── src/components/ui/switch.tsx
├── src/components/ui/separator.tsx
├── src/components/ui/skeleton.tsx
└── src/app/globals.css
```
