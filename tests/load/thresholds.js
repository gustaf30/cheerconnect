// Limiares de aceitação da LOAD-001, derivados de GOAL.md.
//
// O alvo de 500 ms é avaliado sobre as ROTAS DE API, nunca sobre a mistura. A
// medição anterior agrupava respostas de API e renders de página no mesmo
// p(95), o que mistura duas coisas sem relação: o custo de servidor de uma
// visualização de página e o da API que a alimenta.
//
// Pages têm meta própria e bem mais apertada porque são cascas ESTÁTICAS: /feed,
// /trending, /search e /profile estão entre as rotas prerenderizadas, então o
// HTML sai do cache e o dado chega pela API depois, no cliente. A meta de página
// não é experiência do usuário: é uma trava contra a regressão dessas rotas para
// dinâmica. O custo real de servidor de uma visualização está inteiramente na
// API, que é onde os 500 ms se aplicam.
//
// A autenticação usa bcrypt com custo 12 por desenho, então não pode
// compartilhar o mesmo orçamento das demais rotas: medir 500 ms aqui mediria a
// verificação de senha, não a aplicação.

export const P95_TARGET_MS = Number(__ENV.P95_TARGET_MS || 500);
export const PAGE_P95_TARGET_MS = Number(__ENV.PAGE_P95_TARGET_MS || 200);
export const ERROR_RATE_TARGET = Number(__ENV.ERROR_RATE_TARGET || 0.01);
export const AUTH_P95_TARGET_MS = Number(__ENV.AUTH_P95_TARGET_MS || 2000);

// /api/health saiu do cenário de leitura de propósito: com Redis fora o ping
// leva até 1,5 s e contaminaria o p95. O orquestrador faz o polling de liveness.
export const thresholds = {
  "http_req_duration{scenario:read,kind:api}": [`p(95)<${P95_TARGET_MS}`],
  "http_req_duration{scenario:read,kind:page}": [`p(95)<${PAGE_P95_TARGET_MS}`],
  "http_req_failed{scenario:read,kind:api}": [`rate<${ERROR_RATE_TARGET}`],
  "http_req_failed{scenario:read,kind:page}": [`rate<${ERROR_RATE_TARGET}`],
  "checks{scenario:read,kind:api}": [`rate>${1 - ERROR_RATE_TARGET}`],
  "checks{scenario:read,kind:page}": [`rate>${1 - ERROR_RATE_TARGET}`],

  "http_req_duration{scenario:mutations,kind:api}": [`p(95)<${P95_TARGET_MS}`],
  "http_req_failed{scenario:mutations,kind:api}": [`rate<${ERROR_RATE_TARGET}`],
  "checks{scenario:mutations,kind:api}": [`rate>${1 - ERROR_RATE_TARGET}`],

  "http_req_duration{scenario:auth,kind:api}": [`p(95)<${AUTH_P95_TARGET_MS}`],
  "checks{scenario:auth,kind:api}": [`rate>${1 - ERROR_RATE_TARGET}`],
  "http_req_failed{scenario:auth,kind:api}": [`rate<${ERROR_RATE_TARGET}`],
};
