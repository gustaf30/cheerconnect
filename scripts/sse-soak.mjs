import process from "node:process";

// k6 não consome corpos em streaming, então o soak de SSE fica aqui: mede
// time-to-first-event, quantos corações chegaram, e se as conexões são
// liberadas ao abortar.

const BASE_URL = process.env.LOAD_BASE_URL || "http://localhost:3000";
const CONNECTIONS = Number(process.env.SSE_CONNECTIONS || 10);
const SOAK_MS = Number(process.env.SSE_SOAK_MS || 45000);
const PASSWORD = process.env.LOAD_PASSWORD || "123456";
const FIRST_EVENT_BUDGET_MS = Number(process.env.SSE_FIRST_EVENT_BUDGET_MS || 10000);

async function login(email) {
  const csrfResponse = await fetch(`${BASE_URL}/api/auth/csrf`);
  const { csrfToken } = await csrfResponse.json();
  // Em produção useSecureCookies é verdadeiro, então o NextAuth prefixa o
  // cookie de CSRF com __Host- (e o de sessão com __Secure-).
  const csrfCookie = (csrfResponse.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(";")[0])
    .find(
      (c) =>
        c.startsWith("__Host-next-auth.csrf-token=") ||
        c.startsWith("next-auth.csrf-token=")
    );

  const response = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      ...(csrfCookie ? { cookie: csrfCookie } : {}),
    },
    body: new URLSearchParams({ csrfToken, email, password: PASSWORD, json: "true" }),
    redirect: "manual",
  });

  // Em produção useSecureCookies é verdadeiro, então o cookie vem prefixado.
  const sessionCookie = (response.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(";")[0])
    .find(
      (c) =>
        c.startsWith("next-auth.session-token=") ||
        c.startsWith("__Secure-next-auth.session-token=")
    );

  if (!sessionCookie) {
    throw new Error(`login falhou para ${email} (status ${response.status})`);
  }
  return sessionCookie;
}

const state = {
  opened: 0,
  rejected: 0,
  firstEventMs: [],
  heartbeats: 0,
  dataEvents: 0,
  errors: 0,
  closed: 0,
};

const controllers = [];

async function openStream(label) {
  const cookie = await login(`load${label}@load.test`);
  const controller = new AbortController();
  controllers.push(controller);

  const started = Date.now();
  const response = await fetch(`${BASE_URL}/api/notifications/stream`, {
    headers: { cookie, accept: "text/event-stream" },
    signal: controller.signal,
  });

  if (response.status !== 200) {
    state.rejected += 1;
    return;
  }
  if (!response.headers.get("content-type")?.includes("text/event-stream")) {
    state.rejected += 1;
    return;
  }

  state.opened += 1;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let sawFirst = false;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });

      if (!sawFirst && value.byteLength > 0) {
        sawFirst = true;
        state.firstEventMs.push(Date.now() - started);
      }
      for (const line of text.split("\n")) {
        if (line.startsWith(": heartbeat")) state.heartbeats += 1;
        if (line.startsWith("data: ")) state.dataEvents += 1;
      }
    }
    state.closed += 1;
  } catch (error) {
    if (error.name === "AbortError") {
      state.closed += 1;
    } else {
      state.errors += 1;
    }
  } finally {
    reader.releaseLock();
  }
}

async function main() {
  console.log(`Soak de SSE em ${BASE_URL}`);
  console.log(`  conexões=${CONNECTIONS} soak=${SOAK_MS}ms\n`);

  const streams = [];
  for (let i = 0; i < CONNECTIONS; i++) {
    streams.push(openStream(i).catch(() => { state.errors += 1; }));
  }

  await new Promise((resolve) => setTimeout(resolve, SOAK_MS));

  const beforeAbort = process.getActiveResourcesInfo().length;
  for (const controller of controllers) controller.abort();
  await Promise.allSettled(streams);
  await new Promise((resolve) => setTimeout(resolve, 2000));
  const afterAbort = process.getActiveResourcesInfo().length;

  const firstEvents = state.firstEventMs;
  const worstFirst = firstEvents.length ? Math.max(...firstEvents) : null;
  const failures = [];

  if (state.opened < CONNECTIONS) {
    failures.push(`apenas ${state.opened}/${CONNECTIONS} conexões abriram`);
  }
  if (state.errors > 0) {
    failures.push(`${state.errors} erro(s) durante o streaming`);
  }
  if (firstEvents.length === 0) {
    failures.push("nenhuma conexão recebeu bytes do stream");
  } else if (worstFirst > FIRST_EVENT_BUDGET_MS) {
    failures.push(`time-to-first-event ${worstFirst}ms acima do orçamento ${FIRST_EVENT_BUDGET_MS}ms`);
  }
  if (state.closed !== state.opened) {
    failures.push(`${state.opened - state.closed} conexão(ões) não liberaram no abort`);
  }
  if (afterAbort > beforeAbort) {
    failures.push(`handles ativos cresceram após o abort (${beforeAbort} -> ${afterAbort})`);
  }

  console.log(`  conexões abertas:  ${state.opened}/${CONNECTIONS}`);
  console.log(`  conexões liberadas:${state.closed}`);
  console.log(`  heartbeats:        ${state.heartbeats}`);
  console.log(`  eventos data:      ${state.dataEvents}`);
  console.log(`  time-to-first:     ${worstFirst}ms (pior caso)`);
  console.log(`  handles antes/depois do abort: ${beforeAbort}/${afterAbort}`);

  if (failures.length > 0) {
    console.error("\nFALHA:");
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exitCode = 1;
    return;
  }

  console.log("\nOK: SSE estável, sem vazamento de conexões.");
}

main().catch((error) => {
  console.error("Falha no soak de SSE:", error?.message ?? error);
  process.exitCode = 1;
});
