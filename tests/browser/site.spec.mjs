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

test('consultation validates input, encodes the message and preserves edits', async ({ page }) => {
  await page.goto('/contacto.html?interes=Insonorizaci%C3%B3n');
  const vehicle = page.getByLabel('¿Qué auto tenés?');
  const idea = page.getByLabel('Contanos tu idea');
  const review = page.getByRole('button', { name: 'Revisar consulta' });
  await expect(page.getByLabel('¿Qué te interesa?')).toHaveValue('Insonorización');
  await expect(vehicle).toBeFocused();

  await review.click();
  await expect(vehicle).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Revisá tu consulta' })).toBeHidden();
  await vehicle.fill('   ');
  await idea.fill('   ');
  await review.click();
  await expect(vehicle).toBeFocused();
  await expect(vehicle).toHaveJSProperty('validationMessage', 'Completá este campo.');

  const vehicleText = '  Golf 2015 & GTI  ';
  const ideaText = '  Mejorar audio + vibraciones. ¿Qué recomendás? #consulta  ';
  await vehicle.fill(vehicleText);
  await idea.fill(ideaText);
  await review.click();

  const message = `Hola Luquisound. Tengo un ${vehicleText.trim()}.\n\nMe interesa: Insonorización.\n\nMi idea: ${ideaText.trim()}`;
  await expect(page.getByLabel('Vista previa del mensaje')).toHaveValue(message);
  const whatsapp = page.getByRole('link', { name: 'Continuar en WhatsApp' });
  const destination = new URL(await whatsapp.getAttribute('href'));
  expect(destination.origin).toBe('https://wa.me');
  expect(destination.pathname).toBe('/5491173581958');
  expect(destination.searchParams.get('text')).toBe(message);
  await expect(whatsapp).toBeFocused();

  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await expect(vehicle).toHaveValue(vehicleText);
  await expect(idea).toHaveValue(ideaText);
  await expect(vehicle).toBeFocused();
  await idea.fill('Agregar un subwoofer & conservar el baúl.');
  await review.click();
  await expect(page.getByLabel('Vista previa del mensaje')).toHaveValue(/Agregar un subwoofer & conservar el baúl\.$/);
});

test('copy fallback selects the message without accessing the clipboard', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
  });
  await page.goto('/contacto.html');
  await page.getByLabel('¿Qué auto tenés?').fill('Corsa 2010');
  await page.getByLabel('Contanos tu idea').fill('Consultar por insonorización.');
  await page.getByRole('button', { name: 'Revisar consulta' }).click();
  await page.getByRole('button', { name: 'Copiar mensaje' }).click();
  const message = page.getByLabel('Vista previa del mensaje');
  await expect(message).toBeFocused();
  await expect(page.getByRole('status')).toHaveText('Seleccionamos el mensaje para que puedas copiarlo. No se envió ninguna consulta.');
  const selection = await message.evaluate(element => ({
    start: element.selectionStart,
    end: element.selectionEnd,
    length: element.value.length,
  }));
  expect(selection.start).toBe(0);
  expect(selection.end).toBe(selection.length);
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
