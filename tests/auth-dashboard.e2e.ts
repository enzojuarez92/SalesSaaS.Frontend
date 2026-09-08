import { test, expect, type Page } from "@playwright/test";
const tenantId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const session = {
  accessToken: "test-token",
  expiresAtUtc: new Date(Date.now() + 3600000).toISOString(),
  refreshToken: "test-refresh",
  refreshTokenExpiresAtUtc: new Date(Date.now() + 86400000).toISOString(),
  userId: "test-user",
  email: "demo@example.com",
  tenantId,
  role: "Owner",
};
async function mock(page: Page, status = 200) {
  await page.route("**/api/**", async (route) => {
    const url = new URL(route.request().url());
    if (
      url.pathname === "/api/auth/login" ||
      url.pathname === "/api/auth/register"
    )
      return route.fulfill({ json: session });
    if (url.pathname === "/api/auth/logout")
      return route.fulfill({ status: 204 });
    if (url.pathname === "/api/analytics/dashboard") {
      expect(url.searchParams.get("tenantId")).toBe(tenantId);
      expect(route.request().headers().authorization).toBe("Bearer test-token");
      return route.fulfill({
        status,
        json:
          status === 200
            ? {
                dailySales: {
                  current: 125000,
                  previous: 100000,
                  variationPercentage: 25,
                },
                monthlySales: {
                  current: 900000,
                  previous: 1000000,
                  variationPercentage: -10,
                },
                estimatedGrossProfit: 300000,
                estimatedGrossMarginPercentage: 33.33,
                processedOrders: 45,
                averageTicket: 20000,
                totalReceivable: 180000,
                totalPayable: 80000,
              }
            : { detail: "Acceso denegado de prueba" },
      });
    }
    if (url.pathname === "/api/billing/subscriptions/current")
      return route.fulfill({
        json: {
          planName: "Basic",
          status: 4,
          expiresAtUtc: "2026-12-31T00:00:00Z",
          autoRenew: false,
        },
      });
    if (url.pathname === "/api/products")
      return route.fulfill({
        json: {
          items: [
            {
              id: "product-1",
              sku: "SKU-01",
              name: "Café de prueba",
              categoryId: null,
              brandId: null,
              description: "",
              price: 1000,
              cost: 500,
              stock: 5,
              minimumStockAlert: 2,
              isActive: true,
            },
          ],
          pageNumber: 1,
          pageSize: 10,
          totalCount: 1,
          totalPages: 1,
        },
      });
    if (url.pathname === "/api/customers")
      return route.fulfill({
        json: {
          items: [
            {
              id: "customer-1",
              name: "Cliente de prueba",
              documentType: "DNI",
              documentNumber: "12345678",
              taxCondition: "Consumidor final",
              email: "cliente@example.com",
              phone: "",
              address: "",
              city: "",
              state: "",
              postalCode: "",
              creditLimit: 5000,
              allowCredit: true,
              isActive: true,
            },
          ],
          pageNumber: 1,
          pageSize: 10,
          totalCount: 1,
          totalPages: 1,
        },
      });
    if (url.pathname === "/api/suppliers") return route.fulfill({ json: [] });
    if (url.pathname === "/api/orders")
      return route.fulfill({
        status: 201,
        headers: { location: "/api/orders/order-1" },
        json: { id: "order-1" },
      });
    if (url.pathname === "/api/sales/invoices")
      return route.fulfill({
        status: 201,
        headers: { location: "/api/sales/invoices/invoice-1" },
        json: { id: "invoice-1" },
      });
    if (url.pathname === "/api/afip/invoices/invoice-1/authorize")
      return route.fulfill({
        json: {
          invoiceId: "invoice-1",
          isApproved: true,
          cae: "12345678901234",
          caeExpirationDate: "2026-12-31",
          barCode: "qr-payload",
          errors: null,
        },
      });
    return route.fulfill({ json: [] });
  });
}
async function login(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Correo electrónico").fill(session.email);
  await page.getByLabel("Contraseña", { exact: true }).fill("ExamplePass123");
  await page.getByRole("button", { name: "Ingresar a mi negocio" }).click();
}
test("protects private routes and rejects a corrupt stored session", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("salessaas.session", "{invalid"),
  );
  await page.goto("/");
  await expect(page).toHaveURL(/login/);
  await expect(
    page.getByRole("heading", { name: "Qué bueno verte de nuevo" }),
  ).toBeVisible();
});
test("login sends tenant-scoped bearer requests, persists, renders KPIs, and logs out", async ({
  page,
}) => {
  await mock(page);
  await login(page);
  await expect(page.getByText("$ 125.000", { exact: true })).toBeVisible();
  await expect(page.getByText("-10%", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("$ 125.000", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Notificaciones", exact: true })
    .click();
  await expect(
    page.getByText("Todavía no tenés notificaciones."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Abrir perfil" }).click();
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/login/);
  expect(
    await page.evaluate(() => localStorage.getItem("salessaas.session")),
  ).toBeNull();
});
test("403 preserves the session and explains the failure", async ({ page }) => {
  await mock(page, 403);
  await login(page);
  await expect(page.getByRole("alert")).toContainText(
    "Acceso denegado de prueba",
  );
  await expect(page).toHaveURL(/\/$/);
  expect(
    await page.evaluate(() => localStorage.getItem("salessaas.session")),
  ).not.toBeNull();
});
test("401 expires the session", async ({ page }) => {
  await mock(page, 401);
  await login(page);
  await expect(page).toHaveURL(/login\?expired=1/);
  expect(
    await page.evaluate(() => localStorage.getItem("salessaas.session")),
  ).toBeNull();
});
test("mobile navigation and login fit the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mock(page);
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Qué bueno verte de nuevo" }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/login-mobile.png",
    fullPage: true,
  });
  await login(page);
  await expect(page.getByText("$ 125.000", { exact: true })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/dashboard-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Abrir menú" }).click();
  await page
    .getByRole("navigation")
    .getByRole("link", { name: "Compras" })
    .click();
  await expect(
    page.getByText("PRÓXIMA ENTREGA", { exact: true }),
  ).toBeVisible();
});
test("registration matches all backend fields and signs in", async ({
  page,
}) => {
  await mock(page);
  await page.goto("/register");
  await page.getByLabel("Nombre", { exact: true }).fill("Demo");
  await page.getByLabel("Apellido", { exact: true }).fill("Usuario");
  await page.getByLabel("Nombre del negocio").fill("Negocio de prueba");
  await page.getByLabel("CUIT / Identificación fiscal").fill("20123456786");
  await page.getByLabel("Correo electrónico").fill(session.email);
  await page.getByLabel("Contraseña", { exact: true }).fill("ExamplePass123");
  const request = page.waitForRequest("**/api/auth/register");
  await page.getByRole("button", { name: "Crear mi negocio" }).click();
  expect((await request).postDataJSON()).toEqual({
    firstName: "Demo",
    lastName: "Usuario",
    tenantName: "Negocio de prueba",
    taxId: "20123456786",
    email: session.email,
    password: "ExamplePass123",
  });
  await expect(page.getByText("$ 125.000", { exact: true })).toBeVisible();
});

test("registration blocks malformed CUIT before calling the API", async ({
  page,
}) => {
  await mock(page);
  await page.goto("/register");
  await page.getByLabel("Nombre", { exact: true }).fill("Demo");
  await page.getByLabel("Apellido", { exact: true }).fill("Usuario");
  await page.getByLabel("Nombre del negocio").fill("Negocio de prueba");
  await page.getByLabel("CUIT / Identificación fiscal").fill("20-12345678-9");
  await page.getByLabel("Correo electrónico").fill(session.email);
  await page.getByLabel("Contraseña", { exact: true }).fill("ExamplePass123");
  await page.getByRole("button", { name: "Crear mi negocio" }).click();
  await expect(
    page.getByText("Ingresá un CUIT argentino válido de 11 dígitos."),
  ).toBeVisible();
  await expect(page).toHaveURL(/register/);
});

test("POS, inventory and accounts work on a small viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mock(page);
  await login(page);
  await page.goto("/ventas");
  await page.getByRole("button", { name: /Café de prueba/ }).click();
  await page.getByLabel("Buscar cliente").fill("Cliente");
  await page.getByRole("button", { name: /Cliente de prueba/ }).click();
  await page.getByRole("button", { name: "Registrar venta" }).click();
  await expect(page.getByText("Elegí cliente, depósito")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.goto("/productos");
  await expect(page.getByText("Café de prueba")).toBeVisible();
  await page.getByRole("button", { name: "Nuevo producto" }).click();
  await expect(
    page.getByRole("heading", { name: "Nuevo producto" }),
  ).toBeVisible();
  await page.goto("/cuentas-corrientes");
  await expect(page.getByText("Cliente de prueba")).toBeVisible();
});
