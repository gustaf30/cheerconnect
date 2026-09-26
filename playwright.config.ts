import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  // 60 s, e não os 30 s do padrão do Playwright: a suíte roda a aplicação em
  // contêiner, sobre Docker Desktop, e os testes de acessibilidade fazem
  // varredura axe completa em sete páginas de cada tema. Com 30 s o primeiro
  // teste a abrir uma rota fria estourava o tempo numa execução limpa e passava
  // na seguinte — instabilidade que vinha do limite, não do código sob teste.
  timeout: 60_000,
  // Workers limitados por memória, não por CPU. Cada worker abre um Chromium
  // (~300 MB) e a suíte cria conta e conteúdo por teste; com o padrão do
  // Playwright (metade dos cores) numa máquina com 2–3 GB livres a suíte passa a
  // falhar por falta de recurso, de forma intermitente e sem relação com o código
  // sob teste. Tres workers dão paralelismo suficiente e cabem folgados.
  workers: Number(process.env.E2E_WORKERS || 3),
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3102",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  // Sem `webServer` de propósito. Ele subia `npm run dev`, que herda o
  // DATABASE_URL do `.env` — o banco de produção — e os E2E são destrutivos.
  // Quem roda a suíte precisa apontar E2E_BASE_URL e DATABASE_URL para a pilha
  // isolada, e o globalSetup recusa qualquer outra coisa.
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
