import { test, expect, type Page } from "@playwright/test";
const tenantId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  warehouseId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const session = {
  accessToken: "test-token",
  refreshToken: "refresh",
  userId: "user",
  email: "demo@example.com",
  tenantId,
  role: "Owner",
  expiresAtUtc: new Date(Date.now() + 3600000).toISOString(),
};
async function mock(page: Page, signedIn = true) {
  if (signedIn)
    await page.addInitScript(
      (s) => localStorage.setItem("salessaas.session", JSON.stringify(s)),
      session,
    );
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.startsWith("/api/auth/")) return route.fulfill({ json: session });
    if (path === "/api/warehouses")
      return route.fulfill({
        json: [
          {
            id: warehouseId,
            name: "Sucursal Central",
            isActive: true,
            code: "MAIN",
          },
        ],
      });
    if (path === "/api/tenants/current")
      return route.fulfill({ json: { id: tenantId, name: "Mi comercio" } });
    if (path === "/api/billing/subscriptions/current")
      return route.fulfill({
        json: { planName: "Pro", status: 1, expiresAtUtc: "2030-01-01" },
      });
    if (path === "/api/dashboard/summary")
      return route.fulfill({
        json: {
          dailySales: 1250000,
          monthlySales: 1250000,
          dailyTransactions: 1,
          monthlyTransactions: 1,
          totalReceivable: 0,
          criticalStockCount: 0,
          currentCash: null,
          recentSales: [],
        },
      });
    if (
      path === "/api/dashboard/top-products" ||
      path === "/api/dashboard/sales-chart" ||
      path === "/api/categories" ||
      path === "/api/purchases/orders" ||
      path === "/api/suppliers" ||
      path === "/api/brands"
    )
      return route.fulfill({ json: [] });
    if (path === "/api/products") {
      expect(route.request().headers()["x-warehouse-id"]).toBe(warehouseId);
      return route.fulfill({
        json: {
          items: [
            {
              id: "product",
              name: "Café de prueba",
              sku: "CAFE",
              price: 1000,
              cost: 500,
              stock: 10,
              minimumStockAlert: 1,
              isActive: true,
            },
          ],
          totalCount: 1,
          pageNumber: 1,
          pageSize: 10,
        },
      });
    }
    if (path === "/api/customers")
      return route.fulfill({
        json: {
          items: [
            {
              id: "customer",
              name: "Consumidor Final",
              documentNumber: "00000000",
              taxCondition: "Consumidor Final",
              currentBalance: 0,
              creditLimit: 0,
              allowCredit: false,
              email: "",
            },
          ],
          totalCount: 1,
        },
      });
    if (path === "/api/cash/current") return route.fulfill({ status: 204 });
    if (path === "/api/profile")
      return route.fulfill({
        json: { firstName: "Demo", lastName: "Usuario", email: session.email },
      });
    return route.fulfill({ json: [] });
  });
}
test("protected route redirects an anonymous session to login", async ({
  page,
}) => {
  await mock(page, false);
  await page.goto("/productos");
  await expect(page).toHaveURL(/login/);
});
for (const path of ["/", "/login", "/register"])
  test(`authenticated ${path} reaches dashboard without redirect loop`, async ({
    page,
  }) => {
    await mock(page);
    await page.goto(path);
    await expect(page).toHaveURL(/dashboard/);
    await expect(
      page.getByRole("heading", { name: "Resumen general." }),
    ).toBeVisible();
    await expect(
      page.getByText("$ 1.250.000,00", { exact: true }).first(),
    ).toBeVisible();
  });
test("profile menu and logout are reachable", async ({ page }) => {
  await mock(page);
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Abrir perfil" }).click();
  await page.getByRole("link", { name: "Mi perfil" }).click();
  await expect(page.getByRole("heading", { name: "Mi perfil" })).toBeVisible();
  await page.getByRole("button", { name: "Abrir perfil" }).click();
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/login/);
});
test("mobile POS uses warehouse header and blocks checkout without cash", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mock(page);
  await page.goto("/ventas");
  await page.getByRole("button", { name: /Café de prueba/ }).click();
  await expect(
    page.getByRole("button", { name: "Abrí la caja para cobrar" }),
  ).toBeDisabled();
  await expect(page.getByText(/La caja está cerrada/).first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test("product list offers Excel and Kardex, purchases is operational", async ({
  page,
}) => {
  await mock(page);
  await page.goto("/productos");
  await expect(page.getByText("Importar Excel")).toBeVisible();
  await expect(page.getByRole("button", { name: "Kardex" })).toBeVisible();
  await page.goto("/compras");
  await expect(
    page.getByRole("heading", { name: "Nueva orden de compra" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Proveedores", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Nuevo proveedor" }),
  ).toBeVisible();
});
test("registration blocks malformed fiscal ID without submitting", async ({
  page,
}) => {
  await mock(page, false);
  let calls = 0;
  page.on("request", (r) => {
    if (r.url().includes("/auth/register")) calls++;
  });
  await page.goto("/register");
  await page.getByLabel("Nombre", { exact: true }).fill("Demo");
  await page.getByLabel("Apellido", { exact: true }).fill("Usuario");
  await page.getByLabel("Nombre del negocio").fill("Prueba");
  await page.getByLabel(/CUIT/).fill("20123456789");
  await page.getByLabel("Correo electrónico").fill(session.email);
  await page.getByLabel("Contraseña", { exact: true }).fill("ExamplePass123");
  await page.getByRole("button", { name: "Crear mi negocio" }).click();
  await expect(page.getByText(/CUIT argentino válido/).first()).toBeVisible();
  expect(calls).toBe(0);
});
