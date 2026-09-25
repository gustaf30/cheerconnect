const role = process.argv[2];
const targetUserId = process.env.TARGET_USER_ID;

async function main(): Promise<void> {
  const bus = await import("@/lib/realtime-bus");

  if (bus.getRealtimeTransport() !== "redis") {
    console.error(`TRANSPORT_INVALID:${bus.getRealtimeTransport()}`);
    process.exitCode = 1;
    return;
  }

  if (role === "publish") {
    if (!targetUserId) throw new Error("TARGET_USER_ID is required");
    bus.publishRealtimeEvent({ userId: targetUserId, type: "notification" });
    console.log("PUBLISHED");
    return;
  }

  if (role === "local") {
    // Publica e assina no mesmo processo: com o Redis inacessível o evento
    // ainda precisa chegar pelo caminho local.
    if (!targetUserId) throw new Error("TARGET_USER_ID is required");
    const localTimeout = setTimeout(() => {
      console.error("LOCAL_TIMEOUT");
      process.exitCode = 1;
    }, Number(process.env.PROBE_TIMEOUT_MS ?? 20000));

    const stop = bus.subscribeRealtimeEvents((event) => {
      if (event.userId === targetUserId && event.type === "notification") {
        console.log("RECEIVED");
        clearTimeout(localTimeout);
        stop();
        process.exitCode = 0;
      }
    });

    bus.publishRealtimeEvent({ userId: targetUserId, type: "notification" });
    console.log("READY");
    return;
  }

  if (!targetUserId) throw new Error("TARGET_USER_ID is required");
  const timeout = setTimeout(() => {
    console.error("TIMEOUT");
    process.exitCode = 1;
  }, Number(process.env.PROBE_TIMEOUT_MS ?? 20000));

  const unsubscribe = bus.subscribeRealtimeEvents((event) => {
    if (event.userId === targetUserId && event.type === "notification") {
      console.log("RECEIVED");
      clearTimeout(timeout);
      unsubscribe();
      process.exitCode = 0;
    }
  });

  console.log("READY");
}

main().catch((error) => {
  console.error(`FAILED:${(error as Error).message}`);
  process.exitCode = 1;
});
