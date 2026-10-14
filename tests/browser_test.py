"""Prueba E2E de la demo. Requiere servidor en 5173 y Python Playwright.
Ejecutar: python3 tests/browser_test.py (CHROMIUM_PATH opcional).
"""
import os
from playwright.sync_api import sync_playwright, expect

with sync_playwright() as p:
    path = os.environ.get('CHROMIUM_PATH')
    browser = p.chromium.launch(headless=True, **({'executable_path':path} if path else {}))
    page = browser.new_page(viewport={'width':1440,'height':1000})
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto('http://127.0.0.1:5173', wait_until='networkidle')
    expect(page.get_by_role('heading', name='Qué bueno verte de nuevo.')).to_be_visible()
    page.get_by_role('tab', name='Crear cuenta').click()
    page.get_by_label('Tu nombre').fill('Camila')
    page.get_by_label('Correo electrónico').fill('camila@example.test')
    page.get_by_label('Contraseña', exact=True).fill('Prueba-vehiculo-2026')
    page.get_by_role('button', name='Crear mi cuenta').click()
    expect(page.get_by_role('button', name='Activar suscripción de prueba')).to_be_visible()
    expect(page.get_by_role('button', name='Agregar vehículo', exact=True)).to_have_count(0)
    page.get_by_role('button', name='Activar suscripción de prueba').click()
    expect(page.get_by_role('heading', name='Tu garaje está esperando.')).to_be_visible()
    page.get_by_role('button', name='Agregar mi primer vehículo').click()
    expect(page.get_by_label('Marca', exact=True)).to_be_disabled()
    page.get_by_label('Tipo de vehículo').select_option('Moto')
    page.get_by_label('Marca', exact=True).select_option('Bajaj')
    page.get_by_label('Modelo', exact=True).select_option('Pulsar RS200')
    years = page.get_by_label('Año', exact=True).locator('option').all_text_contents()
    assert '1900' not in years and '2027' not in years and '2026' in years and '2016' in years
    page.get_by_label('Año', exact=True).select_option('2020')
    page.get_by_label('Kilometraje actual', exact=True).fill('15000')
    expect(page.get_by_label('Kilometraje actual', exact=True)).to_have_value('15.000')
    page.get_by_role('button', name='Agregar a mi garaje').click()
    expect(page.get_by_role('heading', name='Bajaj Pulsar RS200')).to_be_visible()
    page.get_by_role('button', name='Generar plan de mantenciones').click()
    expect(page.get_by_role('heading', name='Para revisar ahora')).to_be_visible()
    expect(page.get_by_role('heading', name='Aceite y filtro')).to_be_visible()
    page.get_by_role('button', name='Registrar mantención', exact=False).click()
    page.get_by_label('Costo total (CLP)').fill('45000')
    page.get_by_label('Taller (opcional)').fill('Taller de prueba')
    page.get_by_label('Detalles (opcional)').fill('<img src=x onerror=alert(1)>')
    page.get_by_role('button', name='Guardar mantención').click()
    page.get_by_role('button', name='Bitácora', exact=False).click()
    expect(page.get_by_text('Taller: Taller de prueba',exact=True)).to_be_visible()
    expect(page.get_by_text('<img src=x onerror=alert(1)>',exact=True)).to_be_visible()
    assert page.locator('.record img').count() == 0
    with page.expect_download() as info:
        page.get_by_role('button', name='Exportar CSV').click()
    assert info.value.suggested_filename == 'bitacora-garaje.csv'
    page.reload(wait_until='networkidle')
    page.get_by_role('button', name='Generar plan de mantenciones').click()
    expect(page.get_by_role('heading', name='Para revisar ahora')).to_be_visible()
    assert page.locator('.dashboard-grid > div > section.card').last.get_by_role('heading',name='Aceite y filtro').count()==0
    page.screenshot(path='/tmp/garaje-dashboard.png', full_page=True)
    page.get_by_role('button', name='Actualizar kilometraje').click()
    page.get_by_label('Nuevo kilometraje').fill('14000')
    page.get_by_role('button', name='Guardar',exact=True).click()
    expect(page.locator('#form-error')).to_contain_text('no puede disminuir')
    page.get_by_role('button', name='Cancelar',exact=True).click()
    page.get_by_role('button', name='Cambiar tema').click()
    page.set_viewport_size({'width':390,'height':844})
    page.screenshot(path='/tmp/garaje-mobile.png', full_page=True)
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Horizontal overflow'
    page.get_by_role('button',name='Cerrar sesión',exact=True).last.click()
    expect(page.get_by_role('heading',name='Qué bueno verte de nuevo.')).to_be_visible()
    page.get_by_role('tab',name='Crear cuenta').click()
    page.get_by_label('Tu nombre').fill('Diego')
    page.get_by_label('Correo electrónico').fill('diego@example.test')
    page.get_by_label('Contraseña',exact=True).fill('Otra-prueba-2026')
    page.get_by_role('button',name='Crear mi cuenta').click()
    page.get_by_role('button',name='Activar suscripción de prueba').click()
    expect(page.get_by_role('heading',name='Tu garaje está esperando.')).to_be_visible()
    assert not errors, errors
    print('PASS: auth gate, registration, subscription, dependent catalog, mileage mask, plan, records, XSS escaping, CSV, persistence, odometer validation, responsive theme, logout, user isolation; no JS errors.')
    browser.close()
