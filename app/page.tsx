"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

type Book = {
  id: number;
  isbn: string;
  title: string;
  author: string;
  publisher?: string | null;
  coverUrl?: string | null;
  location: string;
  stock: number;
  notes?: string | null;
  price?: number | null;
};
type BookEditState = Record<number, { open: boolean; location: string; stock: string; price: string; notes: string; saving: boolean }>;

type Dashboard = {
  totalBooks: number;
  withoutStock: number;
  latestBooks: { id: number; title: string; author: string; createdAt: string }[];
};

type Draft = {
  isbn: string;
  title: string;
  author: string;
  publisher: string;
  coverUrl: string;
  location: string;
  stock: number;
  notes: string;
  price: string;
};

type ScanDraft = {
  id: number;
  isbn: string;
  title?: string | null;
  author?: string | null;
  publisher?: string | null;
  coverUrl?: string | null;
  createdAt: string;
};

const initialDraft: Draft = {
  isbn: "",
  title: "",
  author: "",
  publisher: "",
  coverUrl: "",
  location: "Deposito A / Estante 1",
  stock: 1,
  notes: "",
  price: "",
};

function normalizeIsbn(value: string) {
  return value.replaceAll("-", "").replaceAll(" ", "").trim().toUpperCase();
}

function isValidIsbn10(isbn: string) {
  if (!/^\d{9}[\dX]$/.test(isbn)) return false;
  let sum = 0;
  for (let index = 0; index < 10; index += 1) {
    const char = isbn[index];
    const value = char === "X" ? 10 : Number(char);
    sum += value * (10 - index);
  }
  return sum % 11 === 0;
}

function isValidIsbn13(isbn: string) {
  if (!/^\d{13}$/.test(isbn)) return false;
  let sum = 0;
  for (let index = 0; index < 12; index += 1) {
    const value = Number(isbn[index]);
    sum += index % 2 === 0 ? value : value * 3;
  }
  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit === Number(isbn[12]);
}

function isValidIsbn(raw: string) {
  const isbn = normalizeIsbn(raw);
  return (isbn.length === 10 && isValidIsbn10(isbn)) || (isbn.length === 13 && isValidIsbn13(isbn));
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [books, setBooks] = useState<Book[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerTimedOut, setScannerTimedOut] = useState(false);
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string>("");
  const [lastRefresh, setLastRefresh] = useState<string>("");
  const [clearing, setClearing] = useState(false);
  const [scanQueue, setScanQueue] = useState<ScanDraft[]>([]);
  const [scanError, setScanError] = useState("");
  const [scanningFile, setScanningFile] = useState(false);
  const [bookEdit, setBookEdit] = useState<BookEditState>({});

  const hasStockLabel = useMemo(
    () =>
      books.reduce<Record<number, "TENEMOS STOCK" | "SIN STOCK">>((accumulator, book) => {
        accumulator[book.id] = book.stock > 0 ? "TENEMOS STOCK" : "SIN STOCK";
        return accumulator;
      }, {}),
    [books],
  );

  async function loadBooks(search = "") {
    const response = await fetch(`/api/books?q=${encodeURIComponent(search)}`, { cache: "no-store" });
    const data = await response.json();
    setBooks(data);
    setLastRefresh(new Date().toLocaleTimeString("es-AR"));
  }

  async function loadDashboard() {
    const response = await fetch("/api/dashboard", { cache: "no-store" });
    setDashboard(await response.json());
  }

  async function loadScanQueue() {
    const response = await fetch("/api/scans", { cache: "no-store" });
    if (!response.ok) return;
    setScanQueue(await response.json());
  }

  async function fetchByIsbn(isbn: string, enqueue = false) {
    const normalized = normalizeIsbn(isbn);
    if (!isValidIsbn(normalized)) {
      setScanError("ISBN invalido. Revisa que tenga 10 o 13 digitos correctos.");
      return;
    }
    setLoadingMetadata(true);
    setScanError("");
    try {
      const response = await fetch(`/api/isbn?isbn=${encodeURIComponent(normalized)}`);
      if (!response.ok) {
        if (enqueue) {
          await fetch("/api/scans", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ isbn: normalized }),
          });
          await loadScanQueue();
        }
        return;
      }
      const data = await response.json();
      setDraft((prev) => ({
        ...prev,
        isbn: normalized,
        title: data.title || prev.title,
        author: data.author || prev.author,
        publisher: data.publisher || prev.publisher,
        coverUrl: data.coverUrl || prev.coverUrl,
      }));
      if (enqueue) {
        await fetch("/api/scans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            isbn: normalized,
            title: data.title || "",
            author: data.author || "",
            publisher: data.publisher || "",
            coverUrl: data.coverUrl || "",
          }),
        });
        await loadScanQueue();
      }
    } finally {
      setLoadingMetadata(false);
    }
  }

  async function saveBook() {
    if (!draft.isbn || !draft.title || !draft.author || !draft.location) return;
    setSaving(true);
    setSaveMessage("");
    try {
      const response = await fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      if (!response.ok) {
        setSaveMessage("Error al guardar. Reintenta.");
        return;
      }
      setSaveMessage("Guardado OK");
      const matchingScan = scanQueue.find((scan) => scan.isbn === draft.isbn);
      if (matchingScan) {
        await fetch("/api/scans", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: matchingScan.id }),
        });
      }
      await Promise.all([loadBooks(query), loadDashboard()]);
      await loadScanQueue();
      setDraft({ ...initialDraft, location: draft.location });
    } finally {
      setSaving(false);
    }
  }

  async function clearAllBooks() {
    const confirmed = window.confirm("Esto borra todos los libros cargados. Queres continuar?");
    if (!confirmed) return;
    setClearing(true);
    setSaveMessage("");
    try {
      const response = await fetch("/api/books", { method: "DELETE" });
      if (!response.ok) {
        setSaveMessage("Error al borrar.");
        return;
      }
      setSaveMessage("Base limpia.");
      await Promise.all([loadBooks(query), loadDashboard()]);
      await fetch("/api/scans", { method: "DELETE" });
      await loadScanQueue();
    } finally {
      setClearing(false);
    }
  }

  async function removeScan(scanId: number) {
    await fetch(`/api/scans/${scanId}`, { method: "DELETE" });
    await loadScanQueue();
  }

  function toggleBookEdit(book: Book) {
    setBookEdit((prev) => {
      const current = prev[book.id];
      if (current?.open) {
        return { ...prev, [book.id]: { ...current, open: false } };
      }
      return {
        ...prev,
        [book.id]: {
          open: true,
          location: book.location,
          stock: String(book.stock),
          price: book.price?.toString() ?? "",
          notes: book.notes ?? "",
          saving: false,
        },
      };
    });
  }

  async function saveBookEdit(bookId: number) {
    const edit = bookEdit[bookId];
    if (!edit) return;
    setBookEdit((prev) => ({ ...prev, [bookId]: { ...edit, saving: true } }));
    const payload = {
      id: bookId,
      location: edit.location,
      stock: Number(edit.stock) || 0,
      price: edit.price.trim() ? Number(edit.price) : null,
      notes: edit.notes,
    };
    const response = await fetch("/api/books", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (response.ok) {
      await Promise.all([loadBooks(query), loadDashboard()]);
      setBookEdit((prev) => ({ ...prev, [bookId]: { ...edit, open: false, saving: false } }));
      return;
    }
    setBookEdit((prev) => ({ ...prev, [bookId]: { ...edit, saving: false } }));
  }

  async function scanFromImageFile(file: File) {
    setScanningFile(true);
    setScanError("");
    try {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("isbn-reader-file", {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
        ],
        verbose: false,
      });
      const decoded = await scanner.scanFile(file, true);
      scanner.clear();
      if (!isValidIsbn(decoded)) {
        setScanError("La foto no devolvio un ISBN valido. Proba otra foto o ingreso manual.");
        return;
      }
      const normalized = normalizeIsbn(decoded);
      setDraft((prev) => ({ ...prev, isbn: normalized }));
      await fetchByIsbn(normalized, true);
    } catch {
      setScanError("No se pudo leer la foto. Proba con mas luz y mejor enfoque.");
    } finally {
      setScanningFile(false);
    }
  }

  useEffect(() => {
    const start = setTimeout(() => {
      loadBooks();
      loadDashboard();
      loadScanQueue();
    }, 0);
    return () => clearTimeout(start);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => loadBooks(query), 180);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const refresh = setInterval(() => {
      loadBooks(query);
      loadDashboard();
      loadScanQueue();
    }, 3000);
    return () => clearInterval(refresh);
  }, [query]);

  useEffect(() => {
    if (!scannerOpen) return;
    let scannerInstance: { stop: () => Promise<void>; clear: () => void } | null = null;
    let detected = false;
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!detected) setScannerTimedOut(true);
    }, 5000);
    (async () => {
      const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
      if (cancelled) return;
      const scanner = new Html5Qrcode("isbn-reader", {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
        ],
        verbose: false,
      });
      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 12, qrbox: { width: 280, height: 140 } },
          (rawText: string) => {
            const clean = rawText.replaceAll("-", "").trim();
            if (isValidIsbn(clean)) {
              detected = true;
              setScanError("");
              setDraft((prev) => ({ ...prev, isbn: clean }));
              fetchByIsbn(clean, true);
              setScannerOpen(false);
            }
          },
          () => undefined,
        );
        scannerInstance = scanner;
      } catch {
        setScannerOpen(false);
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      if (!scannerInstance) return;
      scannerInstance
        .stop()
        .catch(() => undefined)
        .finally(() => scannerInstance?.clear());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scannerOpen]);

  return (
    <main className="mx-auto min-h-screen max-w-7xl bg-[radial-gradient(circle_at_top,#fff7ed,white_45%)] p-4 pb-8 text-stone-900 lg:p-6">
      <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-orange-100">
        <h1 className="text-2xl font-black tracking-tight">Libreria Express</h1>
        <p className="text-sm text-stone-600">Busqueda rapida, stock al instante y carga simple por ISBN.</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Kpi label="Libros" value={dashboard?.totalBooks ?? 0} />
          <Kpi label="Sin stock" value={dashboard?.withoutStock ?? 0} warning />
          <Kpi label="Ultimos" value={dashboard?.latestBooks.length ?? 0} />
        </div>
      </section>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="space-y-4">
          <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-orange-100">
            <h2 className="text-lg font-bold">Escaneos en vivo (celular a PC)</h2>
            <p className="mt-1 text-xs text-stone-500">Cuando escaneas desde el celu, aparece aca para completar y guardar desde PC.</p>
            <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
              {scanQueue.length === 0 ? (
                <p className="rounded-xl bg-stone-50 p-3 text-sm text-stone-600">Sin escaneos pendientes.</p>
              ) : (
                scanQueue.map((scan) => (
                  <div key={scan.id} className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 p-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">{scan.title || "Sin titulo"}</p>
                      <p className="truncate text-xs text-stone-600">
                        {scan.isbn} {scan.author ? `- ${scan.author}` : ""}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          setDraft((prev) => ({
                            ...prev,
                            isbn: scan.isbn,
                            title: scan.title || "",
                            author: scan.author || "",
                            publisher: scan.publisher || "",
                            coverUrl: scan.coverUrl || "",
                          }))
                        }
                        className="rounded-xl bg-stone-900 px-3 py-2 text-xs font-bold text-white"
                      >
                        Cargar
                      </button>
                      <button
                        onClick={() => removeScan(scan.id)}
                        className="rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white"
                      >
                        Descartar
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
        <section className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-orange-100">
          <h2 className="text-lg font-bold">Acciones rapidas</h2>
          <p className="mt-1 text-xs text-stone-500">Escanea desde celular o limpia datos de prueba.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={clearAllBooks}
              className="rounded-2xl bg-rose-600 px-4 py-3 text-sm font-bold text-white active:scale-[0.98]"
            >
              {clearing ? "Borrando..." : "Borrar cargados"}
            </button>
            <button
              onClick={() =>
                setScannerOpen((value) => {
                  const next = !value;
                  if (next) setScannerTimedOut(false);
                  return next;
                })
              }
              className="rounded-2xl bg-orange-500 px-4 py-3 text-sm font-bold text-white active:scale-[0.98]"
            >
              {scannerOpen ? "Cerrar camara" : "Escanear libro"}
            </button>
          </div>
        </section>
      </div>

      <section className="mt-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-orange-100">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Carga rapida</h2>
          <p className="text-xs text-stone-500">Formulario para completar y guardar.</p>
        </div>
        {scannerOpen && <div id="isbn-reader" className="mt-3 overflow-hidden rounded-2xl border border-stone-200 p-2" />}
        {scannerOpen && scannerTimedOut && (
          <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm">
            <p className="font-bold text-amber-900">No detecto el codigo todavia.</p>
            <p className="text-amber-800">Acerca/aleja el libro o ingresa el ISBN manualmente abajo.</p>
          </div>
        )}
        <label className="mt-3 block rounded-2xl border border-stone-200 bg-stone-50 p-3 text-sm font-semibold text-stone-700">
          {scanningFile ? "Leyendo foto..." : "Fallback: escanear desde foto"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="mt-2 block w-full text-sm"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void scanFromImageFile(file);
              event.currentTarget.value = "";
            }}
          />
        </label>
        <div id="isbn-reader-file" className="hidden" />
        {scanError ? <p className="mt-3 rounded-xl bg-rose-50 p-2 text-sm font-semibold text-rose-700">{scanError}</p> : null}
        <div className="mt-3 grid gap-2 lg:grid-cols-2">
          <div className="grid gap-2 lg:col-span-2 lg:grid-cols-12">
            <div className="lg:col-span-6">
              <Input
                label="ISBN"
                value={draft.isbn}
                onChange={(value) => {
                  setDraft({ ...draft, isbn: value });
                  if (scanError) setScanError("");
                }}
              />
            </div>
            <button
              onClick={() => fetchByIsbn(draft.isbn)}
              className="self-end rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold lg:col-span-3"
            >
              {loadingMetadata ? "Buscando..." : "Completar ISBN"}
            </button>
            <button
              onClick={() => fetchByIsbn(draft.isbn, true)}
              className="self-end rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm font-semibold lg:col-span-3"
            >
              Encolar ISBN
            </button>
          </div>
          <Input label="Titulo" value={draft.title} onChange={(value) => setDraft({ ...draft, title: value })} />
          <Input label="Autor" value={draft.author} onChange={(value) => setDraft({ ...draft, author: value })} />
          <Input label="Editorial" value={draft.publisher} onChange={(value) => setDraft({ ...draft, publisher: value })} />
          <Input label="Portada (URL)" value={draft.coverUrl} onChange={(value) => setDraft({ ...draft, coverUrl: value })} />
          <Input label="Ubicacion" value={draft.location} onChange={(value) => setDraft({ ...draft, location: value })} />
          <div className="grid grid-cols-2 gap-2 lg:col-span-2">
            <Input label="Stock" value={String(draft.stock)} onChange={(value) => setDraft({ ...draft, stock: Number(value) || 0 })} />
            <Input label="Precio (opcional)" value={draft.price} onChange={(value) => setDraft({ ...draft, price: value })} />
          </div>
          <Input label="Notas" value={draft.notes} onChange={(value) => setDraft({ ...draft, notes: value })} />
          <button
            onClick={saveBook}
            className="mt-1 rounded-2xl bg-emerald-600 px-4 py-4 text-base font-extrabold text-white active:scale-[0.98] lg:col-span-2"
          >
            {saving ? "Guardando..." : "Guardar y seguir escaneando"}
          </button>
          {saveMessage ? <p className="text-sm font-semibold text-emerald-700 lg:col-span-2">{saveMessage}</p> : null}
        </div>
      </section>

      <section className="mt-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-orange-100">
        <label className="text-sm font-semibold">Buscar por titulo, autor o ISBN</label>
        <p className="mt-1 text-xs text-stone-500">Ultima actualizacion: {lastRefresh || "--:--:--"}</p>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Ej: Borges, 978..., Cien anos..."
          className="mt-2 w-full rounded-2xl border border-stone-200 px-4 py-3 text-base outline-none ring-orange-200 focus:ring"
        />
      </section>

      <section className="mt-4 space-y-3">
        {books.map((book) => (
          <article key={book.id} className="rounded-3xl bg-white p-4 shadow-sm ring-1 ring-orange-100">
            <div className="flex gap-3">
              {book.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={book.coverUrl} alt={book.title} className="h-24 w-16 rounded-lg object-cover ring-1 ring-stone-200" />
              ) : (
                <div className="h-24 w-16 rounded-lg bg-stone-100" />
              )}
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-base font-extrabold">{book.title}</h3>
                <p className="text-sm text-stone-600">{book.author}</p>
                <p className="mt-2 text-xs font-semibold text-stone-500">ISBN: {book.isbn}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              <Tag>{hasStockLabel[book.id]}</Tag>
              <Tag>Stock: {book.stock}</Tag>
              <Tag>Ubicacion: {book.location}</Tag>
              {book.price ? <Tag>Precio: ${book.price.toLocaleString("es-AR")}</Tag> : null}
            </div>
            <button
              onClick={() => toggleBookEdit(book)}
              className="mt-3 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-xs font-bold"
            >
              {bookEdit[book.id]?.open ? "Cerrar edicion" : "Editar stock/ubicacion/precio"}
            </button>
            {bookEdit[book.id]?.open ? (
              <div className="mt-3 grid gap-2 rounded-xl border border-stone-200 p-3">
                <Input
                  label="Ubicacion"
                  value={bookEdit[book.id]?.location ?? ""}
                  onChange={(value) => setBookEdit((prev) => ({ ...prev, [book.id]: { ...prev[book.id], location: value } }))}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    label="Stock"
                    value={bookEdit[book.id]?.stock ?? ""}
                    onChange={(value) => setBookEdit((prev) => ({ ...prev, [book.id]: { ...prev[book.id], stock: value } }))}
                  />
                  <Input
                    label="Precio"
                    value={bookEdit[book.id]?.price ?? ""}
                    onChange={(value) => setBookEdit((prev) => ({ ...prev, [book.id]: { ...prev[book.id], price: value } }))}
                  />
                </div>
                <Input
                  label="Notas"
                  value={bookEdit[book.id]?.notes ?? ""}
                  onChange={(value) => setBookEdit((prev) => ({ ...prev, [book.id]: { ...prev[book.id], notes: value } }))}
                />
                <button
                  onClick={() => saveBookEdit(book.id)}
                  className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white"
                >
                  {bookEdit[book.id]?.saving ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            ) : null}
          </article>
        ))}
      </section>
    </main>
  );
}

function Kpi({ label, value, warning = false }: { label: string; value: number; warning?: boolean }) {
  return (
    <div className={`rounded-2xl p-3 ${warning ? "bg-rose-50 text-rose-700" : "bg-orange-50 text-stone-800"}`}>
      <p className="text-xs font-semibold uppercase">{label}</p>
      <p className="text-2xl font-black">{value}</p>
    </div>
  );
}

function Tag({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-stone-100 px-3 py-1 font-semibold text-stone-700">{children}</span>;
}

function Input({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1 text-sm font-semibold">
      <span>{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-2xl border border-stone-200 px-3 py-3 text-base outline-none ring-orange-200 focus:ring"
      />
    </label>
  );
}
