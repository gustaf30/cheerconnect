/**
 * O nome do cookie de sessão depende do protocolo do NEXTAUTH_URL: com HTTPS o
 * NextAuth grava o token com prefixo `__Secure-`, sem HTTPS usa o nome puro.
 *
 * A escrita é regida por `useSecureCookies` em `src/lib/auth.ts` e a leitura por
 * `getToken` no `src/proxy.ts`. Quando as duas decisões divergem, o token é
 * gravado com um nome e procurado com outro, e toda rota autenticada responde
 * 401. O caso concreto era `NODE_ENV=production` com `NEXTAUTH_URL` em `http://`,
 * típico de implantação self-hosted: a escrita usava o prefixo e a leitura não.
 *
 * Por isso as duas pontas leem daqui, usando o mesmo critério padrão do próprio
 * NextAuth (derivado do protocolo da URL), em vez de cada uma inventar o seu.
 *
 * O critério é o de `getToken` em `next-auth/jwt`, inclusive o ramo de queda
 * quando não há URL configurada. Isso importa porque a promessa deste módulo é
 * "informar isto é o mesmo que não informar": se o helper devolvesse `false`
 * onde o NextAuth devolveria `true`, a correção trocaria um 401 por um cookie sem
 * o atributo Secure, que é falha silenciosa e pior que a original.
 */
export function usesSecureCookies(): boolean {
  const configured = process.env.NEXTAUTH_URL;
  if (configured) return configured.startsWith("https://");
  // Sem URL configurada, quem decide é o ambiente — é dele que vem o protocolo.
  // Os dois ramos espelham o padrão de `getToken` (next-auth/jwt, que usa só
  // VERCEL) e o de `detect-origin` (que também aceita AUTH_TRUST_HOST, para
  // implantação atrás de proxy). Incluir o segundo não é redundante: sem ele,
  // uma implantação atrás de proxy que omita NEXTAUTH_URL perderia o atributo
  // Secure, que era o que o código anterior garantia por via do NODE_ENV.
  return Boolean(process.env.VERCEL || process.env.AUTH_TRUST_HOST);
}
