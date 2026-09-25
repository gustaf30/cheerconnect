# ADR 003: Eventos em processo com fallback

## Status

Aceito.

## Contexto

SSE based only in permanent database polling increases load as concurrent users grow. Upstash REST does not provide a native Pub/Sub channel for this deployment.

## Decisão

Use an in-process event bus for immediate invalidation after message writes and keep a low-frequency polling fallback in the SSE route. The bus is deliberately isolated behind `src/lib/realtime-bus.ts`; a Redis Streams or hosted broker adapter can replace it without changing route contracts.

## Consequências

- Single-instance deployments receive immediate events with no additional paid service.
- Multi-instance deployments remain correct because polling is retained.
- The polling interval is configurable in the stream route and should be revisited when a distributed broker is introduced.
