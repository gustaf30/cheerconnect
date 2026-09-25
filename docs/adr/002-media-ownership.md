# ADR 002: Ownership explícito de mídia

## Status

Aceito.

## Contexto

URLs Cloudinary são Capabilities e não provam, sozinhas, que um usuário tem direito de usar ou excluir um arquivo.

## Decisão

Persistir cada asset em `MediaAsset`, com `ownerId`, `postId` ou `teamId`, `publicId`, finalidade, bytes e dimensões. Uploads assinados criam registros pendentes; a conclusão valida token, URL, public ID e pasta do usuário. Exclusões consultam ownership no banco e nunca derivam autorização somente de uma URL.

## Consequências

- Posts, avatares, banners e logos têm rastreabilidade.
- Assets antigos sem registro são tratados apenas no fluxo legado do post, nunca para outro recurso.
- Exclusão de conta pode remover assets próprios e transferir para a equipe assets enviados por um usuário que sairá.
