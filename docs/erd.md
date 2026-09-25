# Modelo entidade-relacionamento

```mermaid
erDiagram
  USER ||--o{ ACCOUNT : owns
  USER ||--o{ SESSION : opens
  USER ||--o{ POST : authors
  USER ||--o{ COMMENT : writes
  USER ||--o{ TEAM_MEMBER : joins
  USER ||--o{ EVENT : creates
  USER ||--o{ ACHIEVEMENT : earns
  USER ||--o{ CAREER_HISTORY : records
  USER ||--o{ MEDIA_ASSET : uploads
  USER ||--o{ NOTIFICATION : receives
  USER ||--o{ REPORT : files
  USER ||--o{ BLOCK : blocks
  USER ||--o{ PRIVACY_REQUEST : requests

  POST ||--o{ COMMENT : receives
  POST ||--o{ LIKE : receives
  POST ||--o{ POST_TAG : tagged
  POST ||--o{ MEDIA_ASSET : contains
  POST }o--o| POST : reposts

  TEAM ||--o{ TEAM_MEMBER : has
  TEAM ||--o{ TEAM_INVITE : sends
  TEAM ||--o{ TEAM_FOLLOW : followed
  TEAM ||--o{ TEAM_ACHIEVEMENT : earns
  TEAM ||--o{ POST : publishes
  TEAM ||--o{ EVENT : organizes
  TEAM ||--o{ MEDIA_ASSET : contains

  CONVERSATION ||--o{ MESSAGE : contains
  CONVERSATION }o--|| USER : participant1
  CONVERSATION }o--|| USER : participant2
  MESSAGE }o--|| USER : sends

  CONNECTION }o--|| USER : sender
  CONNECTION }o--|| USER : receiver
  TAG ||--o{ POST_TAG : classifies

  USER {
    string id PK
    string email UK
    string username UK
    string profileVisibility
    boolean emailVerified
    int tokenVersion
  }
  MEDIA_ASSET {
    string id PK
    string ownerId FK
    string postId FK
    string teamId FK
    string publicId
    string purpose
    string status
  }
  CONVERSATION {
    string id PK
    string pairKey UK
    string participant1Id FK
    string participant2Id FK
  }
  CONNECTION {
    string id PK
    string pairKey UK
    string senderId FK
    string receiverId FK
  }
  TEAM_MEMBER {
    string id PK
    boolean canEdit
    boolean canPost
    boolean canInvite
    boolean canManageMembers
    boolean canDeleteTeam
  }
```

`pairKey` is derived from the two participant IDs and has a unique index, preventing duplicate connections and conversations when requests arrive concurrently in opposite directions. `MediaAsset` is the ownership boundary for Cloudinary resources. Audit records intentionally keep a nullable actor and retention metadata so historical events can be anonymized without retaining unnecessary personal data.
