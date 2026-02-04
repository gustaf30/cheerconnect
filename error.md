## Error Type
Console Error

## Error Message
Error fetching posts


    at PostList.useCallback[fetchPosts] (src/components/feed/post-list.tsx:55:15)

## Code Frame
  53 |       setPosts(data.posts);
  54 |     } catch {
> 55 |       console.error("Error fetching posts");
     |               ^
  56 |     } finally {
  57 |       setIsLoading(false);
  58 |     }

Next.js version: 16.1.6 (Turbopack)

C:\Users\Gustavo\.claude\projects\tcc\cheerconnect\.next\dev\server\chunks\[root-of-the-server]__0536f038._.js:284:162

  281         status: 401
  282     });
  283 }
→ 284 const user = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].user.findUnique(

    at <unknown> (src\app\api\users\me\route.ts:24:36)
    at async GET (src\app\api\users\me\route.ts:24:18)
  22 |     }
  23 |
> 24 |     const user = await prisma.user.findUnique({
     |                                    ^
  25 |       where: { id: session.user.id },
  26 |       select: {
  27 |         id: true, {
  code: 'ECONNREFUSED',
  meta: [Object],
  clientVersion: '7.3.0'
}
 GET /api/users/me 500 in 128ms (compile: 3ms, proxy.ts: 4ms, render: 120ms)
 GET /feed 200 in 85ms (compile: 5ms, proxy.ts: 3ms, render: 77ms)
 GET /api/auth/session 200 in 20ms (compile: 8ms, render: 13ms)
Get unread messages count error: Error [PrismaClientKnownRequestError]: 
Invalid `__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].message.count()` invocation in
C:\Users\Gustavo\.claude\projects\tcc\cheerconnect\.next\dev\server\chunks\[root-of-the-server]__e519a4af._.js:272:166

  269 }
  270 const userId = session.user.id;
  271 // Count unread messages where user is the recipient (not the sender)
→ 272 const count = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].message.count(

    at <unknown> (src\app\api\messages\count\route.ts:17:40)
    at async GET (src\app\api\messages\count\route.ts:17:19)
  15 |
  16 |     // Count unread messages where user is the recipient (not the sender)
> 17 |     const count = await prisma.message.count({
     |                                        ^
  18 |       where: {
  19 |         isRead: false,
  20 |         senderId: { not: userId }, {
  code: 'ECONNREFUSED',
  meta: [Object],
  clientVersion: '7.3.0'
}
 GET /api/messages/count 500 in 145ms (compile: 5ms, proxy.ts: 14ms, render: 127ms)
Get notification count error: Error [PrismaClientKnownRequestError]: 
Invalid `__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].notification.count()` invocation in
C:\Users\Gustavo\.claude\projects\tcc\cheerconnect\.next\dev\server\chunks\[root-of-the-server]__b14915e8._.js:270:171

  267         status: 401
  268     });
  269 }
→ 270 const count = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].notification.count(

    at <unknown> (src\app\api\notifications\count\route.ts:14:45)
    at async GET (src\app\api\notifications\count\route.ts:14:19)
  12 |     }
  13 |
> 14 |     const count = await prisma.notification.count({
     |                                             ^
  15 |       where: {
  16 |         userId: session.user.id,
  17 |         isRead: false, {
  code: 'ECONNREFUSED',
  meta: [Object],
  clientVersion: '7.3.0'
}
 GET /api/notifications/count 500 in 252ms (compile: 8ms, proxy.ts: 12ms, render: 232ms)
Get posts error: Error [PrismaClientKnownRequestError]: 
Invalid `__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].connection.findMany()` invocation in
C:\Users\Gustavo\.claude\projects\tcc\cheerconnect\.next\dev\server\chunks\[root-of-the-server]__47215105._.js:288:179

  285 let whereClause = {};
  286 if (filter === "following") {
  287     // Get user's connections
→ 288     const connections = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].connection.findMany(

    at <unknown> (src\app\api\posts\route.ts:32:51)
    at async GET (src\app\api\posts\route.ts:32:27)
  30 |     if (filter === "following") {
  31 |       // Get user's connections
> 32 |       const connections = await prisma.connection.findMany({
     |                                                   ^
  33 |         where: {
  34 |           status: "ACCEPTED",
  35 |           OR: [ {
  code: 'ECONNREFUSED',
  meta: [Object],
  clientVersion: '7.3.0'
}
 GET /api/posts?filter=following 500 in 352ms (compile: 10ms, proxy.ts: 9ms, render: 333ms)
Get profile error: Error [PrismaClientKnownRequestError]: 
Invalid `__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].user.findUnique()` invocation in
C:\Users\Gustavo\.claude\projects\tcc\cheerconnect\.next\dev\server\chunks\[root-of-the-server]__0536f038._.js:284:162

  281         status: 401
  282     });
  283 }
→ 284 const user = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].user.findUnique(

    at <unknown> (src\app\api\users\me\route.ts:24:36)
    at async GET (src\app\api\users\me\route.ts:24:18)
  22 |     }
  23 |
> 24 |     const user = await prisma.user.findUnique({
     |                                    ^
  25 |       where: { id: session.user.id },
  26 |       select: {
  27 |         id: true, {
  code: 'ECONNREFUSED',
  meta: [Object],
  clientVersion: '7.3.0'
}
 GET /api/users/me 500 in 169ms (compile: 15ms, proxy.ts: 13ms, render: 141ms)
Get connections error: Error [PrismaClientKnownRequestError]: 
Invalid `__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].connection.findMany()` invocation in
C:\Users\Gustavo\.claude\projects\tcc\cheerconnect\.next\dev\server\chunks\[root-of-the-server]__b9f2ac81._.js:279:175

  276 }
  277 const { searchParams } = new URL(request.url);
  278 const status = searchParams.get("status") || "ACCEPTED";
→ 279 const connections = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].connection.findMany(

    at <unknown> (src\app\api\connections\route.ts:22:49)
    at async GET (src\app\api\connections\route.ts:22:25)
  20 |     const status = searchParams.get("status") || "ACCEPTED";
  21 |
> 22 |     const connections = await prisma.connection.findMany({
     |                                                 ^
  23 |       where: {
  24 |         status: status as "PENDING" | "ACCEPTED" | "REJECTED",
  25 |         OR: [ {
  code: 'ECONNREFUSED',
  meta: [Object],
  clientVersion: '7.3.0'
}
 GET /api/connections 500 in 275ms (compile: 23ms, proxy.ts: 12ms, render: 240ms)
Get achievements error: Error [PrismaClientKnownRequestError]: 
Invalid `__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].achievement.findMany()` invocation in
C:\Users\Gustavo\.claude\projects\tcc\cheerconnect\.next\dev\server\chunks\[root-of-the-server]__a0bc3940._.js:280:177

  277         status: 401
  278     });
  279 }
→ 280 const achievements = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].achievement.findMany(

    at <unknown> (src\app\api\achievements\route.ts:22:51)
    at async GET (src\app\api\achievements\route.ts:22:26)
  20 |     }
  21 |
> 22 |     const achievements = await prisma.achievement.findMany({
     |                                                   ^
  23 |       where: { userId: session.user.id },
  24 |       orderBy: { date: "desc" },
  25 |     }); {
  code: 'ECONNREFUSED',
  meta: [Object],
  clientVersion: '7.3.0'
}
 GET /api/achievements 500 in 386ms (compile: 26ms, proxy.ts: 13ms, render: 347ms)
Get profile error: Error [PrismaClientKnownRequestError]: 
Invalid `__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].user.findUnique()` invocation in
C:\Users\Gustavo\.claude\projects\tcc\cheerconnect\.next\dev\server\chunks\[root-of-the-server]__0536f038._.js:284:162

  281         status: 401
  282     });
  283 }
→ 284 const user = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].user.findUnique(

    at <unknown> (src\app\api\users\me\route.ts:24:36)
    at async GET (src\app\api\users\me\route.ts:24:18)
  22 |     }
  23 |
> 24 |     const user = await prisma.user.findUnique({
     |                                    ^
  25 |       where: { id: session.user.id },
  26 |       select: {
  27 |         id: true, {
  code: 'ECONNREFUSED',
  meta: [Object],
  clientVersion: '7.3.0'
}
 GET /api/users/me 500 in 333ms (compile: 3ms, proxy.ts: 223ms, render: 108ms)
Get profile error: Error [PrismaClientKnownRequestError]: 
Invalid `__TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].user.findUnique()` invocation in
C:\Users\Gustavo\.claude\projects\tcc\cheerconnect\.next\dev\server\chunks\[root-of-the-server]__0536f038._.js:284:162

  281         status: 401
  282     });
  283 }
→ 284 const user = await __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$prisma$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["prisma"].user.findUnique(

    at <unknown> (src\app\api\users\me\route.ts:24:36)
    at async GET (src\app\api\users\me\route.ts:24:18)
  22 |     }
  23 |
> 24 |     const user = await prisma.user.findUnique({
     |                                    ^
  25 |       where: { id: session.user.id },
  26 |       select: {
  27 |         id: true, {
  code: 'ECONNREFUSED',
  meta: [Object],
  clientVersion: '7.3.0'
}
 GET /api/users/me 500 in 121ms (compile: 3ms, proxy.ts: 4ms, render: 114ms)
⨯ Error [PrismaClientKnownRequestError]: 
Invalid `{imported module ./src/lib/prisma.ts}["prisma"].user.findUnique()` invocation in
C:\Users\Gustavo\.claude\projects\tcc\cheerconnect\.next\dev\server\chunks\ssr\[root-of-the-server]__c6b790c0._.js:236:156

  233 if (!session?.user?.id) {
  234     (0, {imported module ./nodemodules/next/dist/client/components/navigation.react-server.js}["redirect"])("/login");
  235 }
→ 236 const user = await {imported module ./src/lib/prisma.ts}["prisma"].user.findUnique(

    at <unknown> (src\app\(main)\profile\page.tsx:13:34)
    at async ProfilePage (src\app\(main)\profile\page.tsx:13:16)
  11 |   }
  12 |
> 13 |   const user = await prisma.user.findUnique({
     |                                  ^
  14 |     where: { id: session.user.id },
  15 |     select: { username: true },
  16 |   }); {
  code: 'ECONNREFUSED',
  meta: [Object],
  clientVersion: '7.3.0',
  digest: '128948223'
}
 GET /profile 200 in 220ms (compile: 115ms, proxy.ts: 3ms, render: 101ms)
