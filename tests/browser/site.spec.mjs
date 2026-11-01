import { test as base, expect } from '@playwright/test';

const test = base.extend({
  runtimeGuard: [async ({ context, page, baseURL }, use) => {
    const externalRequests = [];
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    // A smoke test must never deliver a consultation or visit an external service.
    await context.route('**/*', async route => {
      if (new URL(route.request().url()).origin !== new URL(baseURL).origin) {
        externalRequests.push(route.request().url());
        await route.abort();
      } else {
        await route.fallback();
      }
    });
    await use();
    expect(externalRequests, 'Unexpected external requests').toEqual([]);
    expect(pageErrors, 'Uncaught browser errors').toEqual([]);
  }, { auto: true }],
});

async function interceptWhatsApp(context) {
  const destinations = [];
  await context.route('https://wa.me/**', async route => {
    destinations.push(new URL(route.request().url()));
    await route.fulfill({ status: 200, contentType: 'text/html', body: '<p>Intercepted consultation</p>' });
  });
  return destinations;
}

async function expectWhatsApp(context, destinations, action, message) {
  const previousCount = destinations.length;
  const popupPromise = context.waitForEvent('page');
  await action();
  const popup = await popupPromise;
  await expect.poll(() => destinations.length).toBe(previousCount + 1);
  const destination = destinations.at(-1);
  expect(destination.origin).toBe('https://wa.me');
  expect(destination.pathname).toBe('/5491173581958');
  expect(destination.searchParams.get('text')).toBe(message);
  await popup.close();
}

test('consultation validates input and opens WhatsApp with an encoded message', async ({ context, page }) => {
  const destinations = await interceptWhatsApp(context);
  await page.clock.setFixedTime(new Date('2031-06-01T12:00:00Z'));
  await page.goto('/contacto.html?interes=Insonorizaci%C3%B3n');
  const vehicle = page.getByLabel('¿Qué auto tenés?');
  const year = page.getByLabel('Año', { exact: true });
  const idea = page.getByLabel('Contanos tu idea (opcional)', { exact: true });
  const consult = page.getByRole('button', { name: 'Consultar por WhatsApp' });
  await expect(page.getByLabel('¿Qué te interesa?')).toHaveValue('Insonorización');
  await expect(vehicle).toBeFocused();

  await consult.click();
  await expect(vehicle).toBeFocused();
  await year.fill('2015');
  await vehicle.fill('   ');
  await consult.click();
  await expect(vehicle).toBeFocused();
  await expect(vehicle).toHaveJSProperty('validationMessage', 'Completá este campo.');

  const vehicleText = '  Volkswagen Golf & GTI  ';
  const ideaText = '  Mejorar audio + vibraciones. ¿Qué recomendás? #consulta  ';
  await vehicle.fill(vehicleText);
  await year.fill('');
  await consult.click();
  await expect(year).toBeFocused();
  expect(await year.evaluate(element => element.validity.valueMissing)).toBe(true);
  for (const invalidYear of ['    ', '20', '20a4', '1899', '0000', '2032']) {
    await year.fill(invalidYear);
    await expect(year).toHaveJSProperty('validationMessage', 'Ingresá un año entre 1900 y 2031.');
    await consult.click();
    await expect(year).toBeFocused();
  }
  await year.fill('2015');
  await year.evaluate(element => { element.value = '2032'; });
  await consult.click();
  await expect(year).toHaveJSProperty('validationMessage', 'Ingresá un año entre 1900 y 2031.');
  expect(destinations).toEqual([]);

  await year.fill('2015');
  await idea.fill(ideaText);
  const message = `Hola Luquisound. Tengo un ${vehicleText.trim()} 2015.\n\nMe interesa: Insonorización.\n\nMi idea: ${ideaText.trim()}`;
  await expectWhatsApp(context, destinations, () => consult.click(), message);

  await expect(page.locator('#consultation-form')).toBeVisible();
  await expect(vehicle).toHaveValue(vehicleText);
  await expect(year).toHaveValue('2015');
  await expect(idea).toHaveValue(ideaText);
});

test('consultation accepts year boundaries and optional ideas on keyboard resubmission', async ({ context, page }) => {
  const destinations = await interceptWhatsApp(context);
  await page.clock.setFixedTime(new Date('2031-06-01T12:00:00Z'));
  await page.goto('/contacto.html');
  const vehicle = page.getByLabel('¿Qué auto tenés?');
  const year = page.getByLabel('Año', { exact: true });
  const idea = page.getByLabel('Contanos tu idea (opcional)', { exact: true });
  await vehicle.fill('Chevrolet Corsa');
  await year.fill('1900');
  await expectWhatsApp(context, destinations, () => vehicle.press('Enter'),
    'Hola Luquisound. Tengo un Chevrolet Corsa 1900.\n\nMe interesa: Audio.');

  await vehicle.fill('Volkswagen Golf');
  await page.clock.setFixedTime(new Date('2032-06-01T12:00:00Z'));
  await year.fill('2032');
  await idea.fill('   ');
  await page.getByLabel('¿Qué te interesa?').selectOption('Personalización');
  await expectWhatsApp(context, destinations, () => year.press('Enter'),
    'Hola Luquisound. Tengo un Volkswagen Golf 2032.\n\nMe interesa: Personalización.');
  await expect(page.locator('#consultation-form')).toBeVisible();
  await expect(vehicle).toHaveValue('Volkswagen Golf');
  await expect(idea).toHaveValue('   ');
});

test('mobile contact keeps the consultation clear while scrolling and navigation reachable at the end', async ({ page }) => {
  for (const height of [780, 480]) {
    await page.setViewportSize({ width: 360, height });
    await page.goto('/contacto.html');
    await page.evaluate(() => document.fonts.ready);
    let visibleChecks = 0;
    for (const top of [0, 120, 240, 360, 480, 600]) {
      await page.evaluate(top => window.scrollTo({ top, behavior: 'instant' }), top);
      const accessibility = await page.evaluate(() => {
        const button = document.getElementById('whatsapp-consultation');
        const buttonRect = button.getBoundingClientRect();
        const navRect = document.querySelector('.floating-nav').getBoundingClientRect();
        const visible = buttonRect.top >= 0 && buttonRect.bottom <= innerHeight;
        const overlap = buttonRect.left < navRect.right && buttonRect.right > navRect.left
          && buttonRect.top < navRect.bottom && buttonRect.bottom > navRect.top;
        return {
          overlap,
          visible,
          receivesPointer: visible && button.contains(document.elementFromPoint(
            buttonRect.left + buttonRect.width / 2, buttonRect.top + buttonRect.height / 2,
          )),
        };
      });
      expect(accessibility.overlap, `CTA overlap at 360x${height}, scroll ${top}`).toBe(false);
      if (accessibility.visible) {
        expect(accessibility.receivesPointer, `CTA pointer at 360x${height}, scroll ${top}`).toBe(true);
        visibleChecks++;
      }
    }
    expect(visibleChecks).toBeGreaterThan(0);
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
    const navigation = page.getByRole('navigation', { name: 'Navegación principal' });
    await expect(navigation).toBeInViewport({ ratio: 1 });
    await expect(navigation.getByRole('link')).toHaveText(['Inicio', 'Servicios', 'Trabajos', /Contacto/]);
  }
});

test('contact above the mobile breakpoint and other mobile pages retain floating navigation', async ({ page }) => {
  for (const [route, width] of [
    ['/contacto.html', 700], ['/contacto.html', 1280],
    ['/servicios.html', 360], ['/trabajos.html', 360],
  ]) {
    await page.setViewportSize({ width, height: 780 });
    await page.goto(route);
    await page.evaluate(() => document.fonts.ready);
    const navigation = page.getByRole('navigation', { name: 'Navegación principal' });
    const before = await navigation.boundingBox();
    await page.evaluate(() => window.scrollTo({ top: 220, behavior: 'instant' }));
    expect(await page.evaluate(() => scrollY)).toBeGreaterThan(0);
    const after = await navigation.boundingBox();
    expect(after.y, `Navigation moved on ${route} at ${width}px`).toBeCloseTo(before.y, 1);
    await expect(navigation).toBeInViewport({ ratio: 1 });
  }
});

test.describe('contact without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('provides a direct WhatsApp alternative', async ({ page }) => {
    await page.goto('/contacto.html');
    await expect(page.getByRole('button', { name: 'Consultar por WhatsApp' })).toBeHidden();
    await expect(page.getByLabel('¿Qué auto tenés?')).toBeDisabled();
    await expect(page.getByRole('link', { name: 'consultarnos directamente por WhatsApp' }))
      .toHaveAttribute('href', 'https://wa.me/5491173581958');
  });
});

test('service dialogs restore history and focus, then preselect the consultation', async ({ page }) => {
  await page.goto('/servicios.html');
  const opener = page.getByRole('link', { name: 'Ver detalle de Insonorización', exact: true });
  const dialog = page.getByRole('dialog', { name: 'Insonorización', exact: true });
  await opener.click();
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\?servicio=insonorizacion$/);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\/servicios\.html$/);
  await expect(opener).toBeFocused();

  await page.goForward();
  await expect(dialog).toBeVisible();
  await dialog.getByRole('link', { name: 'Consultar', exact: true }).click();
  await expect(page).toHaveURL(/\/contacto\.html\?interes=/);
  await expect(page.getByLabel('¿Qué te interesa?')).toHaveValue('Insonorización');
  await expect(page.getByLabel('¿Qué auto tenés?')).toBeFocused();
});

test('work filters, photo navigation and Back preserve the selected gallery', async ({ page }) => {
  await page.goto('/trabajos.html');
  const filter = page.getByRole('button', { name: /^Insonorización/ });
  const mustang = page.getByRole('link', { name: 'Ver el trabajo de insonorización del Ford Mustang', exact: true });
  const golf = page.getByRole('link', { name: 'Ver el trabajo del Volkswagen Golf R32', exact: true });
  await filter.click();
  await expect(filter).toHaveAttribute('aria-pressed', 'true');
  await expect(golf).toBeHidden();
  await expect(page).toHaveURL(/\?categoria=insonorizacion$/);
  await mustang.click();
  const dialog = page.getByRole('dialog', { name: 'Ford Mustang', exact: true });
  const photo = dialog.locator('#project-image');
  await expect(photo).toBeVisible();
  const firstSource = await photo.getAttribute('src');
  await dialog.getByRole('button', { name: 'Foto o video siguiente', exact: true }).click();
  await expect(photo).not.toHaveAttribute('src', firstSource);
  await dialog.getByRole('button', { name: 'Foto o video anterior', exact: true }).click();
  await expect(photo).toHaveAttribute('src', firstSource);

  await page.goBack();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/\?categoria=insonorizacion$/);
  await expect(filter).toHaveAttribute('aria-pressed', 'true');
  await expect(mustang).toBeFocused();
  await page.goBack();
  await expect(page).toHaveURL(/\/trabajos\.html$/);
  await expect(golf).toBeVisible();
});

test('closing a work releases its selected video and can reopen the same case', async ({ page }) => {
  await page.goto('/trabajos.html?trabajo=bmw-335i');
  const dialog = page.getByRole('dialog', { name: 'BMW 335i', exact: true });
  const video = page.locator('#project-video');
  await expect(dialog.locator('#project-image')).toBeVisible();
  await dialog.getByRole('button', { name: 'Foto o video siguiente', exact: true }).click();
  await expect(video).toBeVisible();
  await expect(video).toHaveAttribute('src', 'assets/case-bmw.mp4');
  await dialog.getByRole('button', { name: 'Cerrar trabajo', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(video).not.toHaveAttribute('src');
  await expect(video).toHaveJSProperty('paused', true);
  await expect(page).toHaveURL(/\/trabajos\.html$/);

  await page.getByRole('link', { name: 'Ver el trabajo del BMW 335i', exact: true }).click();
  await expect(dialog.locator('#project-image')).toBeVisible();
  await expect(video).toBeHidden();
});

test('a failed service video offers retry and clears the error on recovery or change', async ({ page }) => {
  let failVideo = true;
  await page.route('**/assets/case-bmw.mp4', route => failVideo ? route.abort() : route.continue());
  await page.goto('/servicios.html');
  await page.getByRole('link', { name: 'Ver detalle de Insonorización', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Insonorización', exact: true });
  await dialog.getByRole('button', { name: 'BMW 335i', exact: true }).click();
  const video = dialog.locator('#service-dialog-video');
  await video.evaluate(element => element.play().catch(() => {}));
  const error = dialog.locator('#service-dialog-error');
  const retry = dialog.getByRole('button', { name: 'Reintentar', exact: true });
  await expect(error).toBeVisible();
  await expect(error).toContainText(/video/i);
  await expect(retry).toBeVisible();

  failVideo = false;
  await retry.click();
  await expect(error).toBeHidden();
  await expect(retry).toBeHidden();
  await expect.poll(() => video.evaluate(element => element.readyState)).toBeGreaterThanOrEqual(2);
  await expect(video).toHaveJSProperty('paused', false);

  failVideo = true;
  await dialog.getByRole('button', { name: 'BMW 335i', exact: true }).click();
  await video.evaluate(element => element.play().catch(() => {}));
  await expect(error).toBeVisible();
  await dialog.getByRole('button', { name: 'Ford Mustang', exact: true }).click();
  await expect(error).toBeHidden();
  await expect(retry).toBeHidden();
  await expect(video).not.toHaveAttribute('src');
  await expect(video).toHaveJSProperty('paused', true);
  await expect(dialog.locator('#service-dialog-image')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});
