import { NextRequest, NextResponse } from "next/server";

type IsbnMetadata = {
  title: string;
  author: string;
  publisher: string;
  coverUrl: string | null;
  source: string;
};

function normalizeOpenLibrary(data: Record<string, unknown>, isbn: string) {
  const key = `ISBN:${isbn}`;
  const entry = data[key] as
    | {
        title?: string;
        authors?: { name: string }[];
        publishers?: { name: string }[];
        cover?: { medium?: string; large?: string };
      }
    | undefined;
  if (!entry) return null;
  return <IsbnMetadata>{
    title: entry.title ?? "",
    author: entry.authors?.map((author) => author.name).join(", ") ?? "",
    publisher: entry.publishers?.map((publisher) => publisher.name).join(", ") ?? "",
    coverUrl: entry.cover?.large || entry.cover?.medium || null,
    source: "openlibrary",
  };
}

async function fromGoogleBooks(isbn: string): Promise<IsbnMetadata | null> {
  const googleUrl = `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`;
  const googleResponse = await fetch(googleUrl, { cache: "no-store" });
  if (!googleResponse.ok) return null;
  const googleData = await googleResponse.json();
  const volume = googleData.items?.[0]?.volumeInfo;
  if (!volume) return null;
  return {
    title: volume.title ?? "",
    author: Array.isArray(volume.authors) ? volume.authors.join(", ") : "",
    publisher: volume.publisher ?? "",
    coverUrl: volume.imageLinks?.thumbnail ?? null,
    source: "google_books",
  };
}

async function fromCrossref(isbn: string): Promise<IsbnMetadata | null> {
  const url = `https://api.crossref.org/works?filter=isbn:${isbn}&rows=1`;
  const response = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": "Libreria-Express/1.0 (metadata lookup)" },
  });
  if (!response.ok) return null;
  const payload = await response.json();
  const item = payload?.message?.items?.[0];
  if (!item) return null;
  const title = Array.isArray(item.title) ? item.title[0] : "";
  const author = Array.isArray(item.author)
    ? item.author
        .map((person: { given?: string; family?: string }) => `${person.given ?? ""} ${person.family ?? ""}`.trim())
        .filter(Boolean)
        .join(", ")
    : "";
  const publisher = typeof item.publisher === "string" ? item.publisher : "";
  return {
    title: title || "",
    author,
    publisher,
    coverUrl: null,
    source: "crossref",
  };
}

function openLibraryCoverFallback(isbn: string) {
  return `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
}

export async function GET(request: NextRequest) {
  const isbn = request.nextUrl.searchParams.get("isbn")?.replaceAll("-", "").trim();
  if (!isbn) {
    return NextResponse.json({ error: "ISBN requerido" }, { status: 400 });
  }

  const openLibraryUrl = `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`;
  const openLibraryResponse = await fetch(openLibraryUrl, { cache: "no-store" });
  if (openLibraryResponse.ok) {
    const data = (await openLibraryResponse.json()) as Record<string, unknown>;
    const normalized = normalizeOpenLibrary(data, isbn);
    if (normalized) return NextResponse.json(normalized);
  }

  const google = await fromGoogleBooks(isbn);
  if (google) {
    if (!google.coverUrl) {
      google.coverUrl = openLibraryCoverFallback(isbn);
    }
    return NextResponse.json(google);
  }

  const crossref = await fromCrossref(isbn);
  if (crossref) {
    crossref.coverUrl = openLibraryCoverFallback(isbn);
    return NextResponse.json(crossref);
  }

  return NextResponse.json(
    {
      error: "ISBN no encontrado en fuentes gratuitas",
      isbn,
      source: "none",
      fallbackCover: openLibraryCoverFallback(isbn),
    },
    { status: 404 },
  );
}
