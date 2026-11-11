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
  await expect(page.getByLabel('¿Qué te interesa?')).toHaveValue('Asesoramiento');
  await expect(page.locator('label[for="vehicle-year"]')).toBeVisible();
  await vehicle.fill('Chevrolet Corsa');
  await year.fill('1900');
  await expectWhatsApp(context, destinations, () => vehicle.press('Enter'),
    'Hola Luquisound. Tengo un Chevrolet Corsa 1900.\n\nMe interesa: Asesoramiento.');

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

test('focused consultation controls stay below the header on short and enlarged-text screens', async ({ page }) => {
  for (const [width, height, fontSize] of [[360, 480, 16], [812, 375, 32]]) {
    await page.setViewportSize({ width, height });
    await page.goto('/contacto.html');
    await page.evaluate(size => { document.documentElement.style.fontSize = `${size}px`; }, fontSize);
    await page.evaluate(() => document.fonts.ready);
    for (const control of [page.getByLabel('¿Qué auto tenés?'), page.getByLabel('Año', { exact: true }),
      page.getByRole('button', { name: 'Consultar por WhatsApp' })]) {
      await control.focus();
      await expect.poll(() => control.evaluate(element => {
        const rect = element.getBoundingClientRect();
        const header = document.getElementById('site-header').getBoundingClientRect();
        return rect.top >= header.bottom && rect.bottom <= innerHeight
          && element.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2));
      }), { message: `Focused consultation control is obscured at ${width}x${height}, ${fontSize}px text` }).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('mobile menu links navigate by pointer, touch and keyboard', async ({ page, isMobile }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [name, route] of [['Servicios', '/servicios.html'], ['Trabajos', '/trabajos.html']]) {
    await page.goto('/');
    const menu = page.locator('#menu-toggle');
    const link = page.getByRole('navigation').getByRole('link', { name, exact: true });
    if (isMobile) {
      await menu.tap();
      await link.tap();
    } else {
      await menu.click();
      await link.click();
    }
    await expect(page).toHaveURL(new RegExp(`${route}$`));
    await expect(page.getByRole('heading', { level: 1 })).toContainText(name);

    await page.goto('/');
    await menu.focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('navigation').getByRole('link', { name: 'Inicio', exact: true })).toBeFocused();
    await page.keyboard.press('Tab');
    if (name === 'Trabajos') await page.keyboard.press('Tab');
    await expect(link).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`${route}$`));
  }
  await page.goto('/contacto.html');
  await page.locator('#menu-toggle').click();
  await page.getByRole('navigation').getByRole('link', { name: 'Contacto', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('¿Qué auto tenés?')).toBeFocused();
  await expect(page.getByRole('navigation')).toBeHidden();
});

test('floating WhatsApp opens the direct chat and avoids form interaction', async ({ context, page }) => {
  const destinations = await interceptWhatsApp(context);
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 480 });
    await page.goto('/contacto.html');
    const floating = page.getByRole('link', { name: 'Abrir WhatsApp directamente' });
    await expect(floating).toBeVisible();
    await expect(floating).toBeInViewport({ ratio: 1 });
    const bounds = await floating.boundingBox();
    expect(bounds.width).toBeGreaterThanOrEqual(44);
    expect(bounds.height).toBeGreaterThanOrEqual(44);
    const count = destinations.length;
    const popupPromise = context.waitForEvent('page');
    await floating.click();
    const popup = await popupPromise;
    await expect.poll(() => destinations.length).toBe(count + 1);
    expect(destinations.at(-1).href).toBe('https://wa.me/5491173581958');
    await popup.close();

    const vehicle = page.getByLabel('¿Qué auto tenés?');
    await expect(vehicle).toHaveValue('');
    await vehicle.focus();
    await expect(floating).toBeHidden();
    await vehicle.evaluate(element => element.blur());
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await expect(floating).toBeVisible();
    await page.locator('h1').click();
    const submit = page.getByRole('button', { name: 'Consultar por WhatsApp' });
    await submit.scrollIntoViewIfNeeded();
    await expect(floating).toBeHidden();
    expect(await submit.evaluate(element => {
      const rect = element.getBoundingClientRect();
      return element.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2));
    })).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test('all pages share persistent top navigation and prototype sharing metadata', async ({ page }) => {
  const routes = ['/', '/servicios.html', '/trabajos.html', '/contacto.html'];
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 780 });
    for (const route of routes) {
      await page.goto(route);
      const navigation = page.getByRole('navigation', { name: 'Navegación principal' });
      const menu = page.locator('#menu-toggle');
      const header = page.locator('#site-header');
      if (width < 1000) {
        await expect(navigation).toBeHidden();
        await menu.click();
        await expect(navigation).toBeVisible();
        await expect(menu).toHaveAttribute('aria-expanded', 'true');
      }
      await expect(navigation.getByRole('link')).toHaveText(['Inicio', 'Servicios', 'Trabajos', 'Contacto']);
      await expect(navigation.locator('[aria-current="page"]')).toHaveCount(1);
      if (width < 1000) {
        await page.keyboard.press('Escape');
        await expect(navigation).toBeHidden();
        await expect(menu).toBeFocused();
        await expect(menu).toHaveAttribute('aria-expanded', 'false');
      }
      const before = await header.boundingBox();
      await page.evaluate(() => window.scrollTo({ top: 220, behavior: 'instant' }));
      const after = await header.boundingBox();
      expect(after.y, `Header moved on ${route}`).toBeCloseTo(before.y, 1);
      await expect(header).toBeInViewport({ ratio: 1 });
      await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
      const canonical = `https://luquisound.com${route}`;
      await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', canonical);
      await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', canonical);
      await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /^https:\/\/luquisound\.com\/assets\//);
      await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary_large_image');
    }
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
    await expect(page.getByRole('link', { name: 'Abrir WhatsApp directamente' })).toBeVisible();
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

test('the home features three real cases with working deep links and reduced-motion posters', async ({ page }) => {
  const videoRequests = [];
  page.on('request', request => { if (new URL(request.url()).pathname.endsWith('.mp4')) videoRequests.push(request.url()); });
  await page.goto('/');
  const video = page.locator('#hero-video');
  await expect(video).not.toHaveAttribute('src');
  await expect(video).toHaveJSProperty('paused', true);
  await expect(video).toHaveJSProperty('controls', false);
  await expect(video).toHaveJSProperty('loop', true);
  const cases = [
    ['ford-mustang-insonorizacion', 'Ford Mustang'],
    ['bmw-335i', 'BMW 335i'],
    ['mercedes-c63s', 'Mercedes-Benz C63s'],
  ];
  for (const [id, title] of cases) {
    const link = page.locator(`#trabajos-destacados a[href="trabajos.html?trabajo=${id}"]`);
    await expect(link).toHaveCount(1);
    await link.click();
    await expect(page.getByRole('dialog', { name: title, exact: true })).toBeVisible();
    await page.goBack();
    await expect(page.locator('#trabajos-destacados')).toBeVisible();
  }
  expect(videoRequests).toEqual([]);
});

test('home and portfolio reflow with enlarged text on narrow and landscape screens', async ({ page }) => {
  for (const [width, height] of [[320, 568], [812, 375]]) {
    await page.setViewportSize({ width, height });
    for (const route of ['/', '/trabajos.html']) {
      await page.goto(route);
      await page.evaluate(() => { document.documentElement.style.fontSize = '32px'; });
      await page.evaluate(() => document.fonts.ready);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        { message: `Horizontal overflow on ${route} at ${width}x${height} with enlarged text` }).toBe(true);
      const target = route === '/' ? page.locator('#trabajos-destacados a').first() : page.locator('.project-card').first();
      await target.focus();
      await expect.poll(() => target.evaluate(element => {
        const rect = element.getBoundingClientRect();
        const top = Math.max(rect.top, document.getElementById('site-header').getBoundingClientRect().bottom);
        const bottom = Math.min(rect.bottom, innerHeight);
        return bottom > top && element.contains(document.elementFromPoint(rect.left + rect.width / 2, (top + bottom) / 2));
      })).toBe(true);
    }
  }
});

test.describe('home video with motion enabled', () => {
  test.use({ reducedMotion: 'no-preference' });

  test('loops without controls, pauses when covered or hidden and resumes on return', async ({ page }) => {
    await page.goto('/');
    const video = page.locator('#hero-video');
    await expect(video).toHaveAttribute('src', /assets\/(?:hero-desktop|workshop-mobile)\.mp4$/);
    await expect(video).toHaveJSProperty('loop', true);
    await expect(video).toHaveJSProperty('controls', false);
    await expect.poll(() => video.evaluate(element => element.currentTime)).toBeGreaterThan(0);
    await page.locator('#trabajos-destacados').scrollIntoViewIfNeeded();
    await expect(video).toHaveJSProperty('paused', true);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await expect(video).toHaveJSProperty('paused', false);
    const resumedAt = await video.evaluate(element => element.currentTime);
    await expect.poll(() => video.evaluate(element => element.currentTime)).not.toBe(resumedAt);
    // Simulate the document visibility event independently of headless window focus.
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(video).toHaveJSProperty('paused', true);
    await page.evaluate(() => {
      delete document.hidden;
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(video).toHaveJSProperty('paused', false);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(video).toHaveJSProperty('paused', true);
    await expect(video).not.toHaveAttribute('src');
  });

  test('data-saving preference keeps the poster without requesting video', async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'connection', { configurable: true,
        value: { saveData: true, addEventListener() {} } });
    });
    const videoRequests = [];
    page.on('request', request => { if (new URL(request.url()).pathname.endsWith('.mp4')) videoRequests.push(request.url()); });
    await page.goto('/');
    await expect(page.locator('#hero-video')).not.toHaveAttribute('src');
    await expect(page.locator('#hero-video')).toHaveJSProperty('paused', true);
    await expect(page.locator('.hero-poster')).toBeVisible();
    expect(videoRequests).toEqual([]);
  });
});

test('portfolio contains developed cases and retires standalone-photo links', async ({ page }) => {
  await page.goto('/trabajos.html');
  await expect(page.locator('.project-card')).toHaveCount(10);
  await expect(page.locator('.project-card:not([data-case])')).toHaveCount(0);
  await page.goto('/trabajos.html?categoria=audio&trabajo=foto-0');
  await expect(page).toHaveURL(/\/trabajos\.html\?categoria=audio$/);
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(page.getByRole('button', { name: /^Audio/ })).toHaveAttribute('aria-pressed', 'true');
});

test('work dialogs preserve modified browser arrow shortcuts', async ({ page }) => {
  await page.goto('/trabajos.html?trabajo=ford-mustang-insonorizacion');
  const dialog = page.getByRole('dialog', { name: 'Ford Mustang', exact: true });
  await expect(dialog).toBeVisible();
  const location = page.url();
  for (const modifier of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey']) {
    for (const key of ['ArrowLeft', 'ArrowRight']) {
      const prevented = await dialog.evaluate((element, { modifier, key }) => {
        const event = new KeyboardEvent('keydown', { key, [modifier]: true, bubbles: true, cancelable: true });
        element.dispatchEvent(event);
        return event.defaultPrevented;
      }, { modifier, key });
      expect(prevented, `${modifier}+${key} was intercepted`).toBe(false);
      await expect(page).toHaveURL(location);
      await expect(dialog).toBeVisible();
    }
  }
});

test('work video errors reset image messages and offer retry and media recovery', async ({ page }) => {
  let failImage = true;
  let failVideo = true;
  await page.route('**/assets/case-bmw.jpg', route => failImage ? route.abort() : route.continue());
  await page.route('**/assets/case-bmw.mp4', route => failVideo ? route.abort() : route.continue());
  await page.goto('/trabajos.html?trabajo=bmw-335i');
  const dialog = page.getByRole('dialog', { name: 'BMW 335i', exact: true });
  const error = page.locator('#project-media-error');
  const video = page.locator('#project-video');
  const retry = page.locator('#project-video-retry');
  const next = dialog.getByRole('button', { name: 'Foto o video siguiente', exact: true });
  await expect(error).toBeVisible();
  await expect(error).toContainText(/imagen/i);
  await next.click();
  await video.evaluate(element => element.play().catch(() => {}));
  await expect(error).toBeVisible();
  await expect(error).toContainText(/video/i);
  await expect(error).not.toContainText(/imagen/i);
  await expect(retry).toBeVisible();

  failVideo = false;
  await retry.click();
  await expect(error).toBeHidden();
  await expect(retry).toBeHidden();
  await expect.poll(() => video.evaluate(element => element.readyState)).toBeGreaterThanOrEqual(2);
  await expect(video).toHaveJSProperty('paused', false);
  failImage = false;
  await dialog.getByRole('button', { name: 'Foto o video anterior', exact: true }).click();
  await expect(dialog.locator('#project-image')).toBeVisible();
  await expect(error).toBeHidden();
  await expect(retry).toBeHidden();
  await expect(video).not.toHaveAttribute('src');
  await expect(video).toHaveJSProperty('paused', true);

  failVideo = true;
  await next.click();
  await video.evaluate(element => element.play().catch(() => {}));
  await expect(retry).toBeVisible();
  await dialog.getByRole('button', { name: 'Cerrar trabajo', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(error).toBeHidden();
  await expect(retry).toBeHidden();
  await expect(video).not.toHaveAttribute('src');
});
