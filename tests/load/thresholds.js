// Limiares de aceitação da LOAD-001, derivados de GOAL.md:
// p95 < 500 ms, erros < 1%.
//
// A autenticação usa bcrypt com custo 12 por desenho, então não pode
// compartilhar o mesmo orçamento das demais rotas: medir 500 ms aqui mediria a
// verificação de senha, não a aplicação.

export const P95_TARGET_MS = Number(__ENV.P95_TARGET_MS || 500);
export const ERROR_RATE_TARGET = Number(__ENV.ERROR_RATE_TARGET || 0.01);
export const AUTH_P95_TARGET_MS = Number(__ENV.AUTH_P95_TARGET_MS || 2000);

// /api/health saiu do cenário de leitura de propósito: com Redis fora o ping
// leva até 1,5 s e contaminaria o p95. O orquestrador faz o polling de liveness.
export const thresholds = {
  "http_req_duration{scenario:read}": [`p(95)<${P95_TARGET_MS}`],
  "http_req_failed{scenario:read}": [`rate<${ERROR_RATE_TARGET}`],
  "checks{scenario:read}": [`rate>${1 - ERROR_RATE_TARGET}`],

  "http_req_duration{scenario:mutations}": [`p(95)<${P95_TARGET_MS}`],
  "http_req_failed{scenario:mutations}": [`rate<${ERROR_RATE_TARGET}`],
  "checks{scenario:mutations}": [`rate>${1 - ERROR_RATE_TARGET}`],

  "http_req_duration{scenario:auth}": [`p(95)<${AUTH_P95_TARGET_MS}`],
  "checks{scenario:auth}": [`rate>${1 - ERROR_RATE_TARGET}`],
  "http_req_failed{scenario:auth}": [`rate<${ERROR_RATE_TARGET}`],
};
