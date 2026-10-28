#!/usr/bin/env python3
"""Patch the retained official DOCX template and export its PDF with LibreOffice.

Run from the repository root with the Codex bundled Python. The existing official
DOCX is the layout authority; --input can select an earlier copy of that template.
Only document.xml is changed. Other ZIP members, table geometry, styles and page
breaks stay intact. Repeated runs are idempotent. Set SOFFICE to the bundled
bin/override/soffice if it is not already on PATH. Render/inspect the result with
the document skill's render_docx.py before publishing.
"""
from argparse import ArgumentParser
from copy import deepcopy
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
from zipfile import ZipFile
from lxml import etree

BASE = Path('lendet/2026-2027/mobile')
STEM = 'Syllabusi-Programimi-per-Pajisje-Mobile-2026-2027'
NS = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
W = '{' + NS['w'] + '}'

def text(element):
    return ''.join(element.xpath('.//w:t/text()', namespaces=NS))

def set_text(element, value):
    """Keep paragraph/cell/run properties, changing only visible text."""
    nodes = element.xpath('.//w:t', namespaces=NS)
    if not nodes:
        raise ValueError('Expected existing text in official template')
    nodes[0].text = value
    for node in nodes[1:]:
        node.text = ''

def patch(source):
    tree = etree.fromstring(source)
    tables = tree.xpath('./w:body/w:tbl', namespaces=NS)
    if len(tables) != 2:
        raise ValueError('Expected the retained two-table official template')
    outer_rows = tables[1].findall(W + 'tr')
    schedule = outer_rows[2].find('.//' + W + 'tbl')
    for row in schedule.findall(W + 'tr'):
        cells = row.findall(W + 'tc')
        label = text(cells[0])
        if label.startswith('VII29.10'):
            set_text(cells[1], 'Kolokviumi I dhe kontrolli i MVP-së')
            set_text(cells[3], 'Javët 1–6; plani i javës 7')
            set_text(cells[4], 'Kolokviumi I: 10 pikë. Demonstrim i kërkesës për vend dhe kontroll formativ i MVP-së.')
        elif label.startswith('XIV17.12'):
            set_text(cells[1], 'Kolokviumi II, testimi dhe CI/CD')
            set_text(cells[4], 'Kolokviumi II: 10 pikë; organizimi njoftohet. Test i rrjedhës kryesore dhe publikim i versionit.')
    grade_cell = outer_rows[10].find(W + 'tc')
    paragraphs = grade_cell.findall(W + 'p')
    project = next(p for p in paragraphs if text(p).startswith('Projekti individual:'))
    set_text(project, 'Projekti individual: 40 pikë për një aplikacion Next.js/PWA të përdorshëm nga një biznes real shërbimesh. Kolokviumi I në javën 7 dhe Kolokviumi II në javën 14 japin nga 10 pikë. Demonstrimi dhe mbrojtja mbeten aktivitete mësimore dhe prova të projektit, pa pikë të veçanta.')
    rules_text = ('Kolokviumi I: 10 pyetje nga javët 1–6, me 3 alternativa dhe një përgjigje të saktë; e saktë = 1 pikë, e gabuar ose bosh = 0. Profesori hap regjistrimin dhe nis 10 minutat veçmas për G1/G2. Një tentim për student; hyrja e vonuar ka kohën e mbetur. Përgjigjet ruhen; rifreskimi nuk rinis kohën. Rezultatet dalin pas afatit të grupit. Hyrja nuk kërkon GitHub apo vijueshmëri të mëparshme. Kolokviumi II është i planifikuar; organizimi njoftohet para zhvillimit.')
    rules = next((p for p in paragraphs if text(p).startswith('Kolokviumi I:')), None)
    if rules is None:
        rules = deepcopy(project)
        project.addnext(rules)
    set_text(rules, rules_text)
    grading = grade_cell.find(W + 'tbl')
    rows = grading.findall(W + 'tr')
    first = rows[4]
    for cell, value in zip(first.findall(W + 'tc'), ['Kolokviumi I · Java 7', '10', '10 pyetje nga javët 1–6; 10 minuta']):
        set_text(cell, value)
    if len(rows) == 5:
        second = deepcopy(first)
        grading.append(second)
    elif len(rows) == 6:
        second = rows[5]
    else:
        raise ValueError('Unexpected grading table shape')
    for cell, value in zip(second.findall(W + 'tc'), ['Kolokviumi II · Java 14', '10', 'Organizimi njoftohet para zhvillimit']):
        set_text(cell, value)
    policy_cell = outer_rows[12].find(W + 'tc')
    policy = next(p for p in policy_cell.findall(W + 'p') if text(p).startswith('Ndarja e fotografisë'))
    set_text(policy, 'Ndarja e fotografisë së QR-së ose regjistrimi për dikë tjetër cenon besueshmërinë e evidencës; rastet trajtohen sipas rregullave të institucionit. Historiku i vijueshmërisë është privat. Rezultatet e kolokviumit shfaqin emrin, grupin dhe pikët në sistem, pa email apo indeks. Pikët e tjera individuale komunikohen studentit përkatës dhe stafit të autorizuar.')
    result = etree.tostring(tree, encoding='UTF-8', xml_declaration=True, standalone=True)
    assert 'Demonstrimi dhe mbrojtja: 20' not in text(tree)
    return result

def main():
    parser = ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, default=BASE / (STEM + '.docx'))
    parser.add_argument('--docx-only', action='store_true')
    args = parser.parse_args()
    plan = json.loads(Path('grading/course-plan.json').read_text())
    components = plan['assessment']['components']
    assert [c['points'] for c in components] == [10, 30, 40, 10, 10]
    assert sum(c['points'] for c in components) == plan['assessment']['totalPoints'] == 100
    with ZipFile(args.input) as archive:
        members = [(entry, archive.read(entry.filename)) for entry in archive.infolist()]
    target = BASE / (STEM + '.docx')
    with tempfile.TemporaryDirectory(prefix='mobile-syllabus-') as temporary:
        temp = Path(temporary)
        document = temp / target.name
        with ZipFile(document, 'w') as archive:
            for entry, content in members:
                archive.writestr(entry, patch(content) if entry.filename == 'word/document.xml' else content)
        shutil.copyfile(document, target)
        if not args.docx_only:
            runtime_soffice = Path(os.sys.executable).parent.parent.parent / 'bin/override/soffice'
            soffice = os.environ.get('SOFFICE') or (str(runtime_soffice) if runtime_soffice.exists() else shutil.which('soffice'))
            if not soffice:
                raise RuntimeError('Set SOFFICE to the bundled LibreOffice executable')
            subprocess.run([soffice, '-env:UserInstallation=' + (temp / 'profile').as_uri(), '--headless', '--convert-to', 'pdf', '--outdir', str(temp), str(document)], check=True, env={**os.environ, 'TMPDIR':'/private/tmp'})
            pdf = temp / (STEM + '.pdf')
            if not pdf.exists():
                raise RuntimeError('LibreOffice did not produce the expected PDF')
            shutil.copyfile(pdf, BASE / pdf.name)
    print('Updated retained official syllabus DOCX' + ('' if args.docx_only else ' and PDF'))

if __name__ == '__main__':
    main()
