import { useEffect, useMemo, useRef, useState } from 'react'

const relayNames = {
  dp: 'Dp',
  wbl: 'WBL',
  ic: 'Ic',
  nc: 'Nc',
  op: 'Op',
  pwl: 'Pwł',
  poz: 'Pozwolenie',
  lzs: 'LZS',
  sa: 'SA',
  stko: 'StKo',
  zwbl: 'Zwbl',
  zp: 'Zp',
}

const baseLeft = { dp: 'up' }
const baseRight = { dp: 'up' }

const steps = [
  {
    id: 'base',
    title: 'Stan zasadniczy',
    trigger: 'Czeka na WBL',
    actionLabel: 'Naciśnij WBL',
    signal: 'none',
    track: 'Szlak wolny',
    description: 'Układ czeka na rozpoczęcie dania pozwolenia. Dp jest podciągnięty, pozostałe przekaźniki są opadnięte.',
    left: {
      label: 'Stacja A',
      relays: baseLeft,
      lamps: [{ label: 'Blokada A gotowa', state: 'steady' }],
      note: 'Dyżurny na stacji A może nacisnąć przycisk WBL.',
    },
    right: {
      label: 'Stacja B',
      relays: baseRight,
      lamps: [{ label: 'Czuwanie', state: 'steady' }],
      note: 'Stacja B oczekuje na sygnał przemienny z dwóch żył liniowych.',
    },
    links: [['wbl', 'nc', 'Po naciśnięciu WBL najpierw podciąga się WBL, a następnie Nc.']],
  },
  {
    id: 'wbl-pressed',
    title: 'WBL wciśnięty na stacji A',
    trigger: 'Przycisk WBL',
    actionLabel: 'Sekwencja trwa',
    signal: 'local',
    track: 'WBL podciągnięty',
    description: 'Po wciśnięciu przycisku podciąga się WBL. Nc jeszcze czeka, więc napięcie przemienne nie jest jeszcze nadawane na linię.',
    left: {
      label: 'Stacja A',
      relays: { ...baseLeft, wbl: 'up' },
      lamps: [{ label: 'WBL miga', state: 'blink' }],
      note: 'WBL jest podciągnięty. To pierwszy stan po fizycznym naciśnięciu przycisku.',
    },
    right: {
      label: 'Stacja B',
      relays: baseRight,
      lamps: [{ label: 'Oczekiwanie', state: 'steady' }],
      note: 'Na stacji B nie ma jeszcze reakcji, bo sygnał nie dotarł linią.',
    },
    links: [
      ['wbl', 'nc', 'WBL zamyka obwód przygotowujący podciągnięcie Nc.'],
      ['nc', 'ic', 'Dopiero Nc nada napięcie przemienne do B.'],
    ],
  },
  {
    id: 'nc-energized',
    title: 'Nc podciąga się na stacji A',
    trigger: 'Zwłoka po WBL',
    actionLabel: 'Sekwencja trwa',
    signal: 'local',
    track: 'Nc przygotowuje AC',
    description:
      'Po krótkiej zwłoce podciąga się Nc. To właśnie Nc załącza napięcie przemienne, które pójdzie dwiema żyłami do stacji B.',
    left: {
      label: 'Stacja A',
      relays: { ...baseLeft, wbl: 'up', nc: 'up' },
      lamps: [{ label: 'WBL miga', state: 'blink' }],
      note: 'WBL i Nc są podciągnięte. Nc jest przekaźnikiem nadającym napięcie przemienne do linii.',
    },
    right: {
      label: 'Stacja B',
      relays: baseRight,
      lamps: [{ label: 'Oczekiwanie AC', state: 'steady' }],
      note: 'Sygnał przemienny jest przygotowany po stronie A, ale reakcja B nastąpi w kolejnym momencie.',
    },
    links: [
      ['wbl', 'nc', 'Podciągnięty WBL doprowadza do podciągnięcia Nc.'],
      ['nc', 'ic', 'Nc wysyła napięcie przemienne do Ic na stacji B.'],
    ],
  },
  {
    id: 'ac-signal',
    title: 'Sygnał przemienny dociera do B',
    trigger: 'Dwie żyły liniowe',
    actionLabel: 'Naciśnij Pozwolenie na B',
    signal: 'ac',
    track: 'Sygnał AC A do B',
    description:
      'Nc wysyła sygnał przemienny dwiema żyłami na stację B. Na stacji B podciąga się Ic, lampka miga i dzwonek dzwoni.',
    left: {
      label: 'Stacja A',
      relays: { ...baseLeft, wbl: 'up', nc: 'up' },
      lamps: [{ label: 'WBL miga', state: 'blink' }],
      note: 'Nc utrzymuje nadawanie sygnału przemiennego.',
    },
    right: {
      label: 'Stacja B',
      relays: { ...baseRight, ic: 'up' },
      lamps: [{ label: 'Lampka B miga', state: 'blink' }, { label: 'Dzwonek', state: 'ring' }],
      note: 'Ic na stacji B jest podciągnięty, a dyżurny dostaje sygnał optyczny i akustyczny.',
    },
    links: [
      ['nc', 'ic', 'Sygnał przemienny z Nc na A podciąga Ic na B.'],
      ['ic', 'poz', 'Ic umożliwia użycie przycisku Pozwolenie.'],
    ],
  },
  {
    id: 'permission-b',
    title: 'Dyżurny B wciska Pozwolenie',
    trigger: 'Przycisk Pozwolenie',
    actionLabel: 'Dostarcz sygnał stały do A',
    signal: 'dc',
    track: 'Sygnał stały B do A',
    description:
      'Na stacji B podciąga się Pozwolenie i LZS, jednocześnie odpada Dp. LZS wysyła sygnał stały tymi samymi dwiema żyłami do stacji A.',
    left: {
      label: 'Stacja A',
      relays: { ...baseLeft, wbl: 'up', nc: 'up' },
      lamps: [{ label: 'WBL miga', state: 'blink' }],
      note: 'A nadal czeka na powrotny sygnał stały.',
    },
    right: {
      label: 'Stacja B',
      relays: { ic: 'up', poz: 'up', lzs: 'up', dp: 'down' },
      lamps: [{ label: 'LZS świeci', state: 'steady' }],
      note: 'Pozwolenie i LZS są podciągnięte, Dp odpada.',
    },
    links: [
      ['poz', 'lzs', 'Pozwolenie podciąga LZS.'],
      ['lzs', 'dp', 'Podciągnięcie LZS powoduje odpadnięcie Dp.'],
      ['lzs', 'pwl', 'LZS nadaje sygnał stały do Pwł na A.'],
    ],
  },
  {
    id: 'a-receives',
    title: 'Stacja A odbiera sygnał stały',
    trigger: 'Powrót z B',
    actionLabel: 'Naciśnij SA na semaforze A',
    signal: 'dc-return',
    track: 'Pozwolenie odebrane',
    description:
      'Na stacji A po dotarciu sygnału podciąga się Pwł i Op. Nc odpada, a WBL odpada, więc pierwszy obwód nadawania zostaje zakończony.',
    left: {
      label: 'Stacja A',
      relays: { dp: 'up', pwl: 'up', op: 'up', nc: 'down', wbl: 'down' },
      lamps: [{ label: 'Pozwolenie A', state: 'steady' }],
      note: 'Pwł i Op są podciągnięte. WBL i Nc wróciły do stanu opadniętego.',
    },
    right: {
      label: 'Stacja B',
      relays: { ic: 'up', poz: 'up', lzs: 'up', dp: 'down' },
      lamps: [{ label: 'LZS świeci', state: 'steady' }],
      note: 'B utrzymuje pozwolenie do czasu wyjazdu pociągu.',
    },
    links: [
      ['pwl', 'op', 'Sygnał stały podciąga Pwł i Op na A.'],
      ['pwl', 'nc', 'Po odebraniu pozwolenia Nc odpada.'],
      ['nc', 'wbl', 'Odpadnięcie Nc zwalnia WBL.'],
    ],
  },
  {
    id: 'signal-a',
    title: 'Wyjazd ze stacji A',
    trigger: 'Przycisk SA',
    actionLabel: 'Pociąg wyjechał ze stacji A',
    signal: 'train-start',
    track: 'Semafor A zezwala',
    description:
      'Dyżurny na stacji A wciska przycisk sygnału zezwalającego. SA podciąga się, a Pwł odpada.',
    left: {
      label: 'Stacja A',
      relays: { dp: 'up', op: 'up', sa: 'up', pwl: 'down' },
      lamps: [{ label: 'Semafor A zezwala', state: 'steady' }],
      note: 'SA jest podciągnięty, Pwł opadł po podaniu sygnału wyjazdowego.',
    },
    right: {
      label: 'Stacja B',
      relays: { ic: 'up', poz: 'up', lzs: 'up', dp: 'down' },
      lamps: [{ label: 'LZS świeci', state: 'steady' }],
      note: 'B nadal trzyma LZS do momentu opuszczenia stacji A przez pociąg.',
    },
    links: [
      ['sa', 'pwl', 'Podanie sygnału SA powoduje odpadnięcie Pwł.'],
      ['sa', 'lzs', 'Wyjazd pociągu przygotowuje zgaszenie LZS na B.'],
    ],
  },
  {
    id: 'left-a',
    title: 'Pociąg opuścił stację A',
    trigger: 'Czujniki wyjazdowe',
    actionLabel: 'Pokaż pociąg na szlaku',
    signal: 'train-moving',
    track: 'Pociąg ruszył',
    description: 'Po wyjechaniu pociągu ze stacji A odpada SA, a na stacji B odpada LZS.',
    left: {
      label: 'Stacja A',
      relays: { dp: 'up', op: 'up', sa: 'down', pwl: 'down' },
      lamps: [{ label: 'SA zgasł', state: 'steady' }],
      note: 'SA odpadł po opuszczeniu stacji przez pociąg.',
    },
    right: {
      label: 'Stacja B',
      relays: { ic: 'up', poz: 'down', lzs: 'down', dp: 'down' },
      lamps: [{ label: 'LZS zgasł', state: 'steady' }],
      note: 'Odpadnięcie LZS informuje B, że pociąg wyszedł ze stacji A.',
    },
    links: [
      ['sa', 'lzs', 'Zanik SA po wyjeździe powoduje odpadnięcie LZS.'],
      ['lzs', 'dp', 'Dp na B pozostaje opadnięty podczas zajętości.'],
    ],
  },
  {
    id: 'on-route',
    title: 'Pociąg znajduje się na szlaku',
    trigger: 'Czujniki szlakowe',
    actionLabel: 'Wykryj wjazd do stacji B',
    signal: 'train-route',
    track: 'Szlak zajęty',
    description:
      'Czujniki potwierdzają, że pociąg jest na szlaku. Na stacji A Op jest podciągnięty, a na stacji B wszystkie przekaźniki są opadnięte.',
    left: {
      label: 'Stacja A',
      relays: { op: 'up', dp: 'up' },
      lamps: [{ label: 'Szlak zajęty', state: 'blink' }],
      note: 'Op na A jest podciągnięty i utrzymuje informację o zajętości.',
    },
    right: {
      label: 'Stacja B',
      relays: {},
      lamps: [{ label: 'Wszystko opadnięte', state: 'steady' }],
      note: 'Na B wszystkie przekaźniki blokady są opadnięte.',
    },
    links: [
      ['op', 'stko', 'Stan Op trwa do wykrycia wjazdu pociągu na B.'],
    ],
  },
  {
    id: 'arrival-b',
    title: 'Wjazd pociągu do stacji B',
    trigger: 'Czujniki stacji B',
    actionLabel: 'Zakończ cykl',
    signal: 'return',
    track: 'Zwrot blokady',
    description:
      'Na B podciąga się StKo i Zwbl. Nc na B podnosi się chwilowo, Ic odpada, Dp podciąga się i Zwbl odpada. W tej chwili na A podciągają się Ic i Zp, Op odpada, potem Ic odpada, Nc podnosi się, a następnie Zp i Nc odpadają.',
    left: {
      label: 'Stacja A',
      relays: { dp: 'up', ic: 'pulse', zp: 'pulse', op: 'down', nc: 'pulse' },
      lamps: [{ label: 'Powrót blokady', state: 'blink' }],
      note: 'Sekwencja A: Ic podciągnięty chwilowo, Zp podciągnięty chwilowo, Op odpada, potem Nc podnosi się i wraca.',
    },
    right: {
      label: 'Stacja B',
      relays: { stko: 'up', zwbl: 'pulse', nc: 'pulse', ic: 'down', dp: 'up' },
      lamps: [{ label: 'StKo', state: 'steady' }, { label: 'Zwbl impuls', state: 'blink' }],
      note: 'Sekwencja B: StKo i Zwbl startują zwrot, Nc podnosi się chwilowo, Ic odpada, Dp podciąga się.',
    },
    links: [
      ['stko', 'zwbl', 'Wykrycie wjazdu podciąga StKo i Zwbl.'],
      ['zwbl', 'nc', 'Zwbl chwilowo podnosi Nc na B.'],
      ['nc', 'ic', 'Chwilowe Nc na B powoduje odpadnięcie Ic na B i podciągnięcie Ic na A.'],
      ['ic', 'zp', 'Ic na A podciąga Zp.'],
      ['zp', 'op', 'Zp powoduje odpadnięcie Op.'],
      ['dp', 'zwbl', 'Podciągnięcie Dp kończy impuls Zwbl.'],
    ],
  },
]

const actionTargets = {
  'wbl-pressed': 'nc-energized',
  'nc-energized': 'ac-signal',
  'ac-signal': 'permission-b',
  'permission-b': 'a-receives',
  'a-receives': 'signal-a',
  'signal-a': 'left-a',
  'left-a': 'on-route',
  'on-route': 'arrival-b',
  'arrival-b': 'base',
}

const schemeTabs = ['Marcinkowice', 'Biegonice', 'Nowy Sącz']

async function fetchJson(path, options) {
  const response = await fetch(path, options)

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`)
  }

  return response.json()
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '')
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function App() {
  const [activeModule, setActiveModule] = useState('home')
  const [stepId, setStepId] = useState(steps[0].id)
  const [sequenceRunning, setSequenceRunning] = useState(false)
  const sequenceTimers = useRef([])
  const activeIndex = steps.findIndex((step) => step.id === stepId)
  const step = steps[activeIndex] ?? steps[0]

  const activeRelays = useMemo(() => {
    const merged = { ...step.left.relays, ...step.right.relays }
    return Object.entries(relayNames).map(([id, name]) => ({
      id,
      name,
      state: merged[id] ?? 'down',
    }))
  }, [step])

  const clearSequence = () => {
    sequenceTimers.current.forEach((timer) => clearTimeout(timer))
    sequenceTimers.current = []
    setSequenceRunning(false)
  }

  const chooseStep = (id) => {
    clearSequence()
    setStepId(id)
  }

  const openHome = () => {
    clearSequence()
    setActiveModule('home')
  }

  const startWblSequence = () => {
    clearSequence()
    setSequenceRunning(true)
    setStepId('wbl-pressed')
    sequenceTimers.current = [
      setTimeout(() => setStepId('nc-energized'), 1100),
      setTimeout(() => {
        setStepId('ac-signal')
        setSequenceRunning(false)
        sequenceTimers.current = []
      }, 2400),
    ]
  }

  const goNext = () => {
    if (step.id === 'base') {
      startWblSequence()
      return
    }

    if (sequenceRunning) {
      return
    }

    setStepId(actionTargets[step.id] ?? steps[0].id)
  }

  if (activeModule === 'home') {
    return <StartPage onSelect={setActiveModule} />
  }

  if (activeModule === 'schematy') {
    return <SchematyPage onBack={openHome} />
  }

  if (activeModule === 'notatki') {
    return <NotatkiPage onBack={openHome} />
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <section className="mx-auto flex min-h-screen w-full max-w-[1520px] flex-col gap-4 px-4 py-4 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-800 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-300">
              Blokada liniowa EAP
            </p>
            <h1 className="mt-2 text-2xl font-semibold sm:text-4xl">
              Sekwencja WBL, pozwolenia i zwrotu blokady
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="back-button" type="button" onClick={openHome}>
              Start
            </button>
            <div className="border border-teal-400/40 bg-teal-400/10 px-3 py-2 text-sm font-medium text-teal-100">
              Kierunek A {'->'} B
            </div>
          </div>
        </header>

        <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="border border-zinc-800 bg-zinc-900/70 p-3">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-300">
                Kroki
              </h2>
              <span className="text-xs text-zinc-500">
                {activeIndex + 1}/{steps.length}
              </span>
            </div>
            <div className="grid gap-2">
              {steps.map((item, index) => (
                <button
                  className={`stage-button ${item.id === step.id ? 'stage-button-active' : ''}`}
                  key={item.id}
                  type="button"
                  onClick={() => chooseStep(item.id)}
                >
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <strong>{item.title}</strong>
                </button>
              ))}
            </div>
          </aside>

          <section className="grid gap-4">
            <div className="control-strip">
              <div>
                <span>{step.trigger}</span>
                <strong>{step.title}</strong>
              </div>
              <button
                className={`action-button action-${step.id}`}
                type="button"
                onClick={goNext}
                disabled={sequenceRunning}
              >
                {step.actionLabel}
              </button>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1fr_280px_1fr]">
              <StationPanel side="left" station={step.left} />

              <div className="process-column border border-zinc-800 bg-zinc-950 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                  Aktualny krok
                </p>
                <h2 className="mt-2 text-xl font-semibold text-white">{step.title}</h2>
                <p className="mt-3 text-sm leading-6 text-zinc-300">{step.description}</p>
                <div className="mt-5 border-y border-zinc-800 py-4">
                  <FlowArrow label={step.trigger} />
                </div>
                <div className="mt-4 grid gap-2 text-sm">
                  <InfoRow label="Szlak" value={step.track} />
                  <InfoRow label="Krok" value={`${activeIndex + 1} z ${steps.length}`} />
                </div>
              </div>

              <StationPanel side="right" station={step.right} />
            </div>

            <CircuitView step={step} />

            <RelayBoard relays={activeRelays} />
          </section>
        </div>
      </section>
    </main>
  )
}

function StartPage({ onSelect }) {
  return (
    <main className="start-page min-h-screen bg-zinc-950 text-zinc-100">
      <section className="start-shell">
        <div className="start-panel">
          <p className="start-kicker">Strona startu</p>
          <h1>Panel szkoleniowy</h1>
          <div className="start-actions" aria-label="Wybierz moduł">
            <button type="button" onClick={() => onSelect('schematy')}>
              SCHEMATY
            </button>
            <button type="button" onClick={() => onSelect('eap')}>
              BLOKADA EAP
            </button>
            <button type="button" onClick={() => onSelect('notatki')}>
              NOTATKI
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}

function SchematyPage({ onBack }) {
  const [activeScheme, setActiveScheme] = useState(schemeTabs[0])
  const [schemeFiles, setSchemeFiles] = useState(() =>
    Object.fromEntries(schemeTabs.map((tab) => [tab, []])),
  )
  const [selectedFileId, setSelectedFileId] = useState(null)
  const [databaseStatus, setDatabaseStatus] = useState('loading')

  const activeFiles = schemeFiles[activeScheme] ?? []
  const selectedFile = activeFiles.find((file) => file.id === selectedFileId) ?? null

  useEffect(() => {
    let isActive = true

    fetchJson('/api/files')
      .then((storedFiles) => {
        if (!isActive) {
          return
        }

        const groupedFiles = Object.fromEntries(schemeTabs.map((tab) => [tab, []]))

        storedFiles.forEach((file) => {
          groupedFiles[file.scheme]?.push(file)
        })

        setSchemeFiles(groupedFiles)
        setDatabaseStatus('ready')
      })
      .catch(() => {
        if (isActive) {
          setDatabaseStatus('error')
        }
      })

    return () => {
      isActive = false
    }
  }, [])

  const addFiles = async (event) => {
    const selectedFiles = Array.from(event.target.files ?? [])

    if (selectedFiles.length === 0) {
      return
    }

    const filesToAdd = await Promise.all(selectedFiles.map(async (file) => {
      const customName = file.type === 'application/pdf'
        ? window.prompt('Podaj nazwę pliku PDF', file.name.replace(/\.pdf$/i, ''))
        : null

      if (file.type === 'application/pdf' && customName === null) {
        return null
      }

      return fetchJson('/api/files', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data: await readFileAsBase64(file),
          scheme: activeScheme,
          name: customName?.trim() || file.name,
          originalName: file.name,
          type: file.type,
          size: file.size,
        }),
      })
    }))
    const savedFiles = filesToAdd.filter(Boolean)

    if (savedFiles.length === 0) {
      event.target.value = ''
      return
    }

    setSchemeFiles((currentFiles) => ({
      ...currentFiles,
      [activeScheme]: [
        ...(currentFiles[activeScheme] ?? []),
        ...savedFiles,
      ],
    }))

    setSelectedFileId(savedFiles.at(-1).id)

    event.target.value = ''
  }

  if (selectedFile) {
    return (
      <FileDisplay
        file={selectedFile}
        onBack={() => setSelectedFileId(null)}
      />
    )
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <section className="mx-auto flex min-h-screen w-full max-w-[1100px] flex-col gap-4 px-4 py-4 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-800 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
              Schematy
            </p>
            <h1 className="mt-2 text-2xl font-semibold sm:text-4xl">SCHEMATY</h1>
          </div>
          <button className="back-button" type="button" onClick={onBack}>
            Start
          </button>
        </header>

        <div className="scheme-tabs" aria-label="Schematy stacji">
          {schemeTabs.map((tab) => (
            <button
              className={tab === activeScheme ? 'scheme-tab-active' : ''}
              key={tab}
              type="button"
              onClick={() => {
                setActiveScheme(tab)
                setSelectedFileId(null)
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        <section className="scheme-panel">
          <div className="scheme-panel-head">
            <strong>{activeScheme}</strong>
            <label className="file-button">
              Dodaj plik
              <input accept="application/pdf,image/*" multiple type="file" onChange={addFiles} />
            </label>
          </div>

          {databaseStatus === 'loading' ? (
            <div className="file-empty">Ładowanie plików</div>
          ) : databaseStatus === 'error' ? (
            <div className="file-empty">Baza danych jest niedostępna</div>
          ) : activeFiles.length > 0 ? (
            <div className="file-browser">
              <div className="file-list">
                {activeFiles.map((file) => (
                  <button
                    key={file.id}
                    type="button"
                    onClick={() => setSelectedFileId(file.id)}
                  >
                    <strong>{file.name}</strong>
                    <span>{formatFileSize(file.size)}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="file-empty">Brak dodanych plików</div>
          )}
        </section>
      </section>
    </main>
  )
}

function FileDisplay({ file, onBack }) {
  return (
    <main className="file-display-page bg-zinc-950 text-zinc-100">
      <section className="file-display-shell">
        <div className="file-display-frame">
          {file.type.startsWith('image/') ? (
            <img alt={file.name} src={file.url} />
          ) : (
            <iframe src={file.url} title={file.name} />
          )}
        </div>
        <button className="file-return-button" type="button" onClick={onBack}>
          Powrót
        </button>
      </section>
    </main>
  )
}

function formatFileSize(size) {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`
  }

  return `${(size / 1024 / 1024).toFixed(1)} MB`
}

function NotatkiPage({ onBack }) {
  const [notes, setNotes] = useState([])
  const [noteDraft, setNoteDraft] = useState('')
  const [noteModalOpen, setNoteModalOpen] = useState(false)
  const [notesStatus, setNotesStatus] = useState('loading')

  useEffect(() => {
    let isActive = true

    fetchJson('/api/notes')
      .then((storedNotes) => {
        if (isActive) {
          setNotes(storedNotes)
          setNotesStatus('ready')
        }
      })
      .catch(() => {
        if (isActive) {
          setNotesStatus('error')
        }
      })

    return () => {
      isActive = false
    }
  }, [])

  const addNote = async (event) => {
    event.preventDefault()
    const trimmedNote = noteDraft.trim()

    if (!trimmedNote) {
      return
    }

    const note = await fetchJson('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: trimmedNote }),
    })

    setNotes((currentNotes) => [note, ...currentNotes])
    setNoteDraft('')
    setNoteModalOpen(false)
  }

  const crossOutNote = async (note) => {
    const updatedNote = await fetchJson(`/api/notes/${note.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ crossedOut: true }),
    })

    setNotes((currentNotes) =>
      currentNotes.map((currentNote) =>
        currentNote.id === note.id ? updatedNote : currentNote,
      ),
    )
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100">
      <section className="mx-auto flex min-h-screen w-full max-w-[1100px] flex-col gap-4 px-4 py-4 sm:px-6">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-800 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-300">
              Notatki
            </p>
            <h1 className="mt-2 text-2xl font-semibold sm:text-4xl">NOTATKI</h1>
          </div>
          <button className="back-button" type="button" onClick={onBack}>
            Start
          </button>
        </header>

        <section className="notes-panel">
          <div className="notes-panel-head">
            <strong>NOTATKI</strong>
            <button type="button" onClick={() => setNoteModalOpen(true)}>
              Dodaj notatkę
            </button>
          </div>

          {notesStatus === 'loading' ? (
            <div className="file-empty">Ładowanie notatek</div>
          ) : notesStatus === 'error' ? (
            <div className="file-empty">Baza danych jest niedostępna</div>
          ) : notes.length > 0 ? (
            <div className="notes-list">
              {notes.map((note) => (
                <article key={note.id}>
                  <p className={note.crossedOut ? 'note-crossed-out' : ''}>
                    {note.text.toUpperCase()}
                  </p>
                  <button
                    type="button"
                    onClick={() => crossOutNote(note)}
                  >
                    Wykreśl
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <div className="file-empty">Brak notatek</div>
          )}
        </section>

        {noteModalOpen ? (
          <div className="note-modal-backdrop" role="presentation">
            <form className="note-modal" onSubmit={addNote}>
              <h2>Dodaj notatkę</h2>
              <textarea
                autoFocus
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
              />
              <div className="note-modal-actions">
                <button
                  type="button"
                  onClick={() => {
                    setNoteDraft('')
                    setNoteModalOpen(false)
                  }}
                >
                  Anuluj
                </button>
                <button type="submit">
                  Dodaj
                </button>
              </div>
            </form>
          </div>
        ) : null}
      </section>
    </main>
  )
}

function StationPanel({ station, side }) {
  const hasActiveRelay = Object.values(station.relays).some((state) => state === 'up' || state === 'pulse')

  return (
    <article className="station-panel border border-zinc-800 bg-zinc-900/70 p-4">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
            {side === 'left' ? 'Stacja nadawcza' : 'Stacja odbiorcza'}
          </p>
          <h2 className="mt-1 text-xl font-semibold">{station.label}</h2>
        </div>
        <SignalHead active={hasActiveRelay} />
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {Object.entries(relayNames).map(([id, name]) => (
          <RelayTile
            key={id}
            name={name}
            state={station.relays[id] ?? 'down'}
            muted={!Object.hasOwn(station.relays, id)}
          />
        ))}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto]">
        <div className="border border-zinc-800 bg-zinc-950/70 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">
            Adnotacja
          </p>
          <p className="mt-2 text-sm leading-6 text-zinc-300">{station.note}</p>
        </div>
        <div className="lamp-stack">
          {station.lamps.map((lamp) => (
            <span className={`lamp-${lamp.state}`} key={lamp.label}>
              {lamp.label}
            </span>
          ))}
        </div>
      </div>
    </article>
  )
}

function CircuitView({ step }) {
  return (
    <section className="border border-zinc-800 bg-zinc-950 p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-300">
          Dwie żyły liniowe i zależności
        </h2>
        <div className="track-state">{step.track}</div>
      </div>

      <div className={`circuit-board signal-${step.signal}`}>
        <div className="station-block">A</div>
        <div className="line-pair">
          <div className="wire wire-top">
            <div className="track-pulse" />
          </div>
          <div className="wire wire-bottom">
            <div className="track-pulse track-pulse-second" />
          </div>
          <div className="train-symbol" />
          <span className="wire-label wire-label-top">żyła 1</span>
          <span className="wire-label wire-label-bottom">żyła 2</span>
        </div>
        <div className="station-block">B</div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {step.links.map(([from, to, label]) => (
          <Dependency key={`${from}-${to}-${label}`} from={from} to={to} label={label} />
        ))}
      </div>
    </section>
  )
}

function RelayBoard({ relays }) {
  return (
    <section className="border border-zinc-800 bg-zinc-900/70 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-300">
          Tablica przekaźników
        </h2>
        <div className="legend">
          <span><i className="state-dot state-up" /> podciągnięty</span>
          <span><i className="state-dot state-pulse" /> chwilowo</span>
          <span><i className="state-dot state-down" /> opadnięty</span>
        </div>
      </div>
      <div className="relay-grid">
        {relays.map((relay) => (
          <RelayTile key={relay.id} name={relay.name} state={relay.state} />
        ))}
      </div>
    </section>
  )
}

function RelayTile({ name, state, muted = false }) {
  const label = state === 'up' ? 'podciągnięty' : state === 'pulse' ? 'chwilowo' : 'opadnięty'

  return (
    <div className={`relay-tile relay-${state} ${muted ? 'relay-muted' : ''}`}>
      <div className="relay-coil">
        <span />
        <span />
        <span />
      </div>
      <strong>{name}</strong>
      <small>{label}</small>
    </div>
  )
}

function Dependency({ from, to, label }) {
  return (
    <div className="dependency">
      <span>{relayNames[from] ?? from}</span>
      <i />
      <span>{relayNames[to] ?? to}</span>
      <p>{label}</p>
    </div>
  )
}

function FlowArrow({ label }) {
  return (
    <div className="flow-arrow">
      <span>{label}</span>
      <i />
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-3 border border-zinc-800 bg-zinc-900/70 px-3 py-2">
      <span className="text-zinc-500">{label}</span>
      <strong className="text-right font-medium text-zinc-100">{value}</strong>
    </div>
  )
}

function SignalHead({ active }) {
  return (
    <div className="signal-head" aria-label={active ? 'sygnalizacja aktywna' : 'sygnalizacja wygaszona'}>
      <span className={active ? 'signal-on' : ''} />
      <span />
    </div>
  )
}

export default App
